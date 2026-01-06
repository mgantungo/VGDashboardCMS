'use strict';

/**
 * payment router
 *

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::payment.payment');
*/

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/payments/record',
      handler: 'payment.recordPayment',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/invoices/:invoiceId/payments',
      handler: 'payment.getPaymentHistory',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
