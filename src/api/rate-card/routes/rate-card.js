// src/api/rate-card/routes/rate-card.js
'use strict';

module.exports = {
  routes: [

    // ── Custom named routes (must be above /:id routes) ──────────────────

    {
      method: 'POST',
      path: '/rate-cards/bulk-update-expiry',
      handler: 'rate-card.bulkUpdateExpiryDates',
      config: { policies: [], middlewares: [] }
    },

    {
      method: 'POST',
      path: '/rate-cards/update-null-expiry',
      handler: 'rate-card.updateNullExpiryDates',
      config: { policies: [], middlewares: [] }
    },

    {
      method: 'GET',
      path: '/rate-cards/analyzeResources',
      handler: 'rate-card.analyzeResources',
      config: { policies: [], middlewares: [] }
    },

    {
      method: 'GET',
      path: '/rate-cards/inspectDimValuDS',
      handler: 'rate-card.inspectDimValuDS',
      config: { policies: [], middlewares: [] }
    },

    // ── NEW: Search endpoint with POST body ──────────────────────────────
    {
      method: 'POST',
      path: '/rate-cards/search',
      handler: 'rate-card.search',
      config: {
        policies: [],
        middlewares: [],
      }
    },

    // ── Standard CRUD routes ──────────────────────────────────────────────
    {
      method: 'GET',
      path: '/rate-cards',
      handler: 'rate-card.find',
      config: { policies: [], middlewares: [] }
    },

    {
      method: 'GET',
      path: '/rate-cards/:id',
      handler: 'rate-card.findOne',
      config: { policies: [], middlewares: [] }
    },

    {
      method: 'POST',
      path: '/rate-cards',
      handler: 'rate-card.create',
      config: { policies: [], middlewares: [] }
    },

    {
      method: 'PUT',
      path: '/rate-cards/:id',
      handler: 'rate-card.update',
      config: { policies: [], middlewares: [] }
    },

    {
      method: 'DELETE',
      path: '/rate-cards/:id',
      handler: 'rate-card.delete',
      config: { policies: [], middlewares: [] }
    },

    {
      method: 'PATCH',
      path: '/rate-cards/:id/fields',
      handler: 'rate-card.updateRateCardFields',
      config: { policies: [], middlewares: [] }
    },

  ]
};
