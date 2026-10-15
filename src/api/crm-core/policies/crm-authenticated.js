'use strict';

/**
 * Every /api/crm/* route goes through this policy. It verifies the Strapi
 * Users & Permissions JWT itself (so admins don't have to tick dozens of
 * permissions), loads the CRM profile and puts the CRM context on the request.
 *
 * Route config: { requireProfile: true }  (default) — the login must have an active CRM profile.
 */
const { errors } = require('@strapi/utils');

module.exports = async (policyContext, config = {}, { strapi }) => {
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

  const crm = await strapi.service('api::crm-core.crm-access').context(user);
  crm.ip = policyContext.request?.ip || null;
  policyContext.state.user = user;
  policyContext.state.crm = crm;

  if (config.requireProfile !== false && (!crm.profile || !crm.active)) {
    throw new errors.ForbiddenError('Your account is not set up for the CRM yet. Ask a CRM administrator to link your login to your sales profile.');
  }
  return true;
};
