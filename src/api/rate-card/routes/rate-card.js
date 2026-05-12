// src/api/rate-card/routes/rate-card.js
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE EXISTS IN THIS FORM
//
// Strapi v4 has two route patterns:
//
//   A)  module.exports = createCoreRouter(...)
//       → auto-generates all CRUD routes but makes it hard to add custom ones
//
//   B)  module.exports = { routes: [...] }   ← what was here originally
//       → full manual control, but REPLACES the core routes entirely
//         (i.e. GET /rate-cards was never registered → 404)
//
// This file keeps pattern B and manually adds the standard find / findOne
// routes alongside the existing custom ones.
//
// ⚠️  ROUTE ORDER MATTERS — Express matches top-to-bottom.
//     Named paths (/analyzeResources, /inspectDimValuDS …) MUST come before
//     the parameterised path (/:id) or Strapi will treat "analyzeResources"
//     as an id value.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  routes: [

    // ── Custom named routes (must be above /:id routes) ──────────────────

    {
      method: 'POST',
      path: '/rate-cards/bulk-update-expiry',
      handler: 'rate-card.bulkUpdateExpiryDates',
      config: {
        policies: [],
        middlewares: [],
        /*
        auth: { strategies: ['api-token'] }
        */
      }
    },

    {
      method: 'POST',
      path: '/rate-cards/update-null-expiry',
      handler: 'rate-card.updateNullExpiryDates',
      config: {
        policies: [],
        middlewares: [],
        auth: { strategies: ['api-token'] }
      }
    },

    {
      method: 'GET',
      path: '/rate-cards/analyzeResources',
      handler: 'rate-card.analyzeResources',
      config: {
        policies: [],
        middlewares: [],
        /*
        auth: { strategies: ['api-token'] }
        */
      }
    },

    {
      method: 'GET',
      path: '/rate-cards/inspectDimValuDS',
      handler: 'rate-card.inspectDimValuDS',
      config: {
        policies: [],
        middlewares: [],
        /*
        auth: { strategies: ['api-token'] }
        */
      }
    },

    // ── Standard CRUD routes ──────────────────────────────────────────────
    // These were missing because the custom-routes format replaces core routes.
    // Adding them back explicitly restores GET /api/rate-cards functionality.

    {
      method: 'GET',
      path: '/rate-cards',
      handler: 'rate-card.find',           // inherited from createCoreController
      config: {
        policies: [],
        middlewares: [],
      }
    },

    {
      method: 'GET',
      path: '/rate-cards/:id',
      handler: 'rate-card.findOne',        // inherited from createCoreController
      config: {
        policies: [],
        middlewares: [],
      }
    },

    {
      method: 'POST',
      path: '/rate-cards',
      handler: 'rate-card.create',
      config: {
        policies: [],
        middlewares: [],
      }
    },

    {
      method: 'PUT',
      path: '/rate-cards/:id',
      handler: 'rate-card.update',
      config: {
        policies: [],
        middlewares: [],
      }
    },

    {
      method: 'DELETE',
      path: '/rate-cards/:id',
      handler: 'rate-card.delete',
      config: {
        policies: [],
        middlewares: [],
      }
    },

    // ── Selective field update (Settings > Rate Cards tab) ─────────────────

    {
      method: 'PATCH',
      path: '/rate-cards/:id/fields',
      handler: 'rate-card.updateRateCardFields',
      config: {
        policies: [],
        middlewares: [],
        /*
        auth: { strategies: ['api-token'] }
        */
      }
    },

  ]
};
