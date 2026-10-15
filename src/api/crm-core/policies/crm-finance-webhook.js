'use strict';

/**
 * Protects the inbound finance-sync webhook with a shared secret
 * (header `x-crm-webhook-secret`, env CRM_FINANCE_WEBHOOK_SECRET).
 */
const crypto = require('crypto');
const { errors } = require('@strapi/utils');

module.exports = (policyContext) => {
  const expected = process.env.CRM_FINANCE_WEBHOOK_SECRET;
  if (!expected) throw new errors.ForbiddenError('Finance sync is not configured (CRM_FINANCE_WEBHOOK_SECRET is not set).');
  const given = String(policyContext.request?.header?.['x-crm-webhook-secret'] || '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new errors.UnauthorizedError('Bad webhook secret.');
  return true;
};
