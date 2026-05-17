'use strict';
// src/api/client/controllers/client-extension.js
//
// Drop this file into your EXISTING src/api/client/controllers/ folder.
// It adds two SFA-specific endpoints to the existing clients API.
// The existing client.js controller is NOT touched.

const { resolveSfaProfile } = require('../../../_sfa-helpers/sfa-profile');

module.exports = {

  /**
   * POST /api/clients/find-match
   *
   * Called during order conversion to check whether the prospect company
   * already exists in the clients collection.
   *
   * Resolution:
   *   1. Exact case-insensitive name match
   *   2. Contains / partial match
   *   3. No match → { found: false }
   */
  async findMatch(ctx) {
    const caller = await resolveSfaProfile(ctx, strapi);
    if (!caller) return;

    const { company_name } = ctx.request.body;
    if (!company_name) return ctx.badRequest('company_name is required.');

    // 1. Exact match
    const [exact] = await strapi.documents('api::client.client').findMany({
      filters: { company_name: { $eqi: company_name }, is_active: { $eq: true } },
      limit: 1,
    });
    if (exact) return ctx.send({ found: true, client: exact });

    // 2. Partial match
    const [partial] = await strapi.documents('api::client.client').findMany({
      filters: { company_name: { $containsi: company_name }, is_active: { $eq: true } },
      sort:  'company_name:asc',
      limit: 1,
    });
    if (partial) return ctx.send({ found: true, client: partial, matchType: 'partial' });

    return ctx.send({ found: false, client: null });
  },

  /**
   * POST /api/clients/search-by-name
   *
   * Typeahead search of confirmed clients.
   * Used in SfaNewOpportunityModal when the agent selects a return client.
   */
  async searchByName(ctx) {
    const caller = await resolveSfaProfile(ctx, strapi);
    if (!caller) return;

    const { company_name = '' } = ctx.request.body;
    if (!company_name || company_name.length < 2) return ctx.send([]);

    const results = await strapi.documents('api::client.client').findMany({
      filters: { company_name: { $containsi: company_name }, is_active: { $eq: true } },
      fields: ['company_name', 'bc_no', 'contact_person', 'phone', 'email',
               'payment_terms', 'credit_approved', 'credit_limit', 'clientTin'],
      sort:  'company_name:asc',
      limit: 20,
    });

    return ctx.send(results);
  },
};
