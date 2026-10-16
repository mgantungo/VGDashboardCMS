'use strict';

/**
 * Every /api/crm/* route goes through this policy. It works out who is calling,
 * loads the CRM profile and puts the CRM context on the request.
 *
 * Two ways in:
 *  1. VGAMS login (what the CRM app uses). The user signs in through the shared
 *     POST /api/vgams-users/login with module 'crm' (AD password check + CRM eligibility).
 *     The CRM's Nuxt server then calls these routes with:
 *        x-crm-gateway-secret : must equal CRM_GATEWAY_SECRET (server-only, never in a browser)
 *        x-crm-email          : the signed-in @newvision.co.ug email
 *        x-crm-profile        : the CRM profile documentId returned at login (must still match)
 *     Eligibility is re-checked on every call, so deactivating the VGAMS user / sales person,
 *     or moving a staff user to a role without CRM access, takes effect immediately.
 *  2. Strapi Users & Permissions JWT (Authorization: Bearer …). Kept for integrations.
 *
 * Route config: { requireProfile: true }  (default) — the caller must have an active CRM profile.
 */
const crypto = require('crypto');
const { errors } = require('@strapi/utils');

function sameSecret(given, expected) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function viaGateway(policyContext, strapi) {
  const headers = policyContext.request?.headers || {};
  const given = headers['x-crm-gateway-secret'];
  if (!given) return null; // not a gateway call — try the JWT instead

  const expected = process.env.CRM_GATEWAY_SECRET || '';
  if (expected.length < 32) {
    strapi.log.error('[crm] CRM_GATEWAY_SECRET is missing or shorter than 32 characters — CRM sign-in is refused.');
    throw new errors.UnauthorizedError('CRM sign-in is not configured on the CMS.');
  }
  if (!sameSecret(given, expected)) throw new errors.UnauthorizedError('Please sign in again.');

  const email = String(headers['x-crm-email'] || '').trim().toLowerCase();
  const profileId = String(headers['x-crm-profile'] || '').trim();
  if (!email) throw new errors.UnauthorizedError('Please sign in again.');

  const crm = await strapi.service('api::crm-core.crm-access').contextForLogin(email);
  if (!crm) throw new errors.UnauthorizedError('Your account no longer has CRM access. Please sign in again.');
  if (profileId && crm.profileId !== profileId) throw new errors.UnauthorizedError('Please sign in again.');
  return crm;
}

async function viaJwt(policyContext, strapi) {
  const jwt = strapi.plugin('users-permissions').service('jwt');
  let payload = null;
  try {
    payload = await jwt.getToken(policyContext);
  } catch (e) {
    payload = null;
  }
  if (!payload || !payload.id) throw new errors.UnauthorizedError('Please sign in again.');

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: payload.id },
    select: ['id', 'documentId', 'username', 'email', 'blocked', 'confirmed'],
  });
  if (!user || user.blocked) throw new errors.UnauthorizedError('This login is blocked or no longer exists.');
  policyContext.state.user = user;
  return strapi.service('api::crm-core.crm-access').context(user);
}

module.exports = async (policyContext, config = {}, { strapi }) => {
  const crm = (await viaGateway(policyContext, strapi)) || (await viaJwt(policyContext, strapi));
  crm.ip = policyContext.request?.ip || null;
  policyContext.state.crm = crm;

  if (config.requireProfile !== false && (!crm.profile || !crm.active)) {
    throw new errors.ForbiddenError('Your account is not set up for the CRM yet. Ask a CRM administrator to give you access.');
  }
  return true;
};
