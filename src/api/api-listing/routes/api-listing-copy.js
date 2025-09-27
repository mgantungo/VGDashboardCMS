// src/api/api-listing/routes/api-listing.js
'use strict';

/**
 * api-listing router
 */

module.exports = {
  routes: [
    // Custom dashboard route
    {
      method: 'GET',
      path: '/api-listings/dashboard',
      handler: 'api-listing.getDashboardData',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    // Analytics route - article session duration with URL parameters
    {
      method: 'GET',
      path: '/api-listings/article-session-duration/:startDate/:endDate',
      handler: 'api-listing.getArticleSessionDuration',
      config: {
        auth: false, // Set to true if you want authentication
        policies: [],
        middlewares: [],
      },
    },
    // Articles route with date filtering and reorganized fields
    {
      method: 'GET',
      path: '/api-listings/articles/:startDate/:endDate/:offset',
      handler: 'api-listing.getArticles',
      config: {
        auth: false, // Set to true if you want authentication
        policies: [],
        middlewares: [],
      },
    },
    // Default CRUD routes
    {
      method: 'GET',
      path: '/api-listings',
      handler: 'api-listing.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/api-listings/:id',
      handler: 'api-listing.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/api-listings',
      handler: 'api-listing.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/api-listings/:id',
      handler: 'api-listing.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/api-listings/:id',
      handler: 'api-listing.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },

  ],
};
