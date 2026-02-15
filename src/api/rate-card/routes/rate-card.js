// src/api/rate-card/routes/rate-card.js
'use strict';

module.exports = {
  routes: [

    {
      method: 'POST',
      path: '/rate-cards/bulk-update-expiry',
      handler: 'rate-card.bulkUpdateExpiryDates',
      config: {
        policies: [],
        middlewares: [],
        /*
        auth: {
          strategies: ['api-token']
        }
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
        auth: {
          strategies: ['api-token']
        }
      }
    },
    {
      method: 'POST',
      path: '/rate-cards/analyzeResources',
      handler: 'rate-card.analyzeResources',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          strategies: ['api-token']
        }
      }
    },
  ]
};
