// src/api/product/routes/product.js
'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/products',
      handler: 'product.find',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/products/:id',
      handler: 'product.findOne',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/products/category/:categoryId',
      handler: 'product.findByCategory',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/products/:productId/rate-cards',
      handler: 'product.getRateCards',
      config: {
        policies: [],
        middlewares: []
      }
    }
  ]
};
