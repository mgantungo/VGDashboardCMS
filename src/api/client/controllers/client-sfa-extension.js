'use strict';

/**
 * clients/controllers/client-sfa-extension.js
 *
 * Drop this file into your existing:
 *   src/api/client/controllers/client-sfa-extension.js
 *
 * Then register the routes in:
 *   src/api/client/routes/client-sfa-extension.js
 *
 * This adds BC client matching endpoints used during SFA order conversion.
 */

module.exports = {

  /**
   * POST /api/clients/find-match
   * Attempt to find a BC client by company name (exact or fuzzy).
   * Used after order conversion to auto-link the order to a client record.
   */
  async findMatch(ctx) {
    const { company_name } = ctx.request.body;
    if (!company_name) return ctx.badRequest('company_name is required.');

    // 1. Try exact match first
    const [exact] = await strapi.documents('api::client.client').findMany({
      filters: {
        company_name: { $eqi: company_name },
        is_active:    { $eq: true },
      },
      limit: 1,
    });

    if (exact) {
      return ctx.send({ found: true, client: exact });
    }

    // 2. Fuzzy: company_name contains the search term
    const [fuzzy] = await strapi.documents('api::client.client').findMany({
      filters: {
        $or: [
          { company_name: { $containsi: company_name } },
          // also check if company_name contains the client name
          { company_name: { $containsi: company_name.split(' ')[0] } },
        ],
        is_active: { $eq: true },
      },
      sort: 'company_name:asc',
      limit: 1,
    });

    if (fuzzy) {
      return ctx.send({ found: true, client: fuzzy, match_type: 'fuzzy' });
    }

    return ctx.send({ found: false, client: null });
  },

  /**
   * POST /api/clients/search-by-name
   * Typeahead search of the BC client list (used in order detail BC-link UI).
   */
  async searchByName(ctx) {
    const { company_name = '' } = ctx.request.body;
    if (!company_name || company_name.length < 2) {
      return ctx.send([]);
    }

    const results = await strapi.documents('api::client.client').findMany({
      filters: {
        company_name: { $containsi: company_name },
        is_active:    { $eq: true },
      },
      fields: ['company_name', 'bc_no', 'contact_person', 'phone',
               'email', 'payment_terms', 'credit_approved', 'credit_limit'],
      sort: 'company_name:asc',
      limit: 20,
    });

    return ctx.send(results);
  },
};
