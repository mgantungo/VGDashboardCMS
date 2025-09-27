// src/api/bc-dataset/routes/bc-dataset.js
'use strict';

/**
 * bc-dataset router
 */

module.exports = {
  routes: [
    // Custom route for date range: /api/bc-datasets/2021-08-01/2021-10-31
    {
      method: 'GET',
      path: '/bc-datasets/:startDate/:endDate',
      handler: 'bc-dataset.getByDateRange',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    
    // Custom route for single date: /api/bc-datasets/date/2021-08-01
    {
      method: 'GET',
      path: '/bc-datasets/date/:date',
      handler: 'bc-dataset.getByDate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    
    // Default CRUD routes
    {
      method: 'GET',
      path: '/bc-datasets',
      handler: 'bc-dataset.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/bc-datasets/:id',
      handler: 'bc-dataset.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/bc-datasets',
      handler: 'bc-dataset.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/bc-datasets/:id',
      handler: 'bc-dataset.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/bc-datasets/:id',
      handler: 'bc-dataset.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
