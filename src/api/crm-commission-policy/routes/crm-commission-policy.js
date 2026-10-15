'use strict';

/**
 * Standard REST routes for CRM Commission Policy: /api/crm-commission-policies
 *
 * Closed by default: they answer only for roles or API tokens you enable in
 * Settings → Users & Permissions / API Tokens (e.g. for reporting or integrations).
 * The CRM app itself uses the /api/crm/* workflow endpoints in api/crm-core, which
 * enforce record-level scope, cost/commission visibility and audit.
 */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreRouter('api::crm-commission-policy.crm-commission-policy');
