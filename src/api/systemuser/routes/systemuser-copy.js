'use strict';

/**
 * systemuser router
 * File location: src/api/systemuser/routes/systemuser.js
 */

module.exports = {
  routes: [
    // Custom authentication route
    {
      method: 'POST',
      path: '/systemusers/authenticate',
      handler: 'systemuser.authenticate',
      config: {
        auth: false, // No authentication required for login
        policies: [],
        middlewares: [],
      },
    },

    // Get all users - no auth for now
    {
      method: 'GET',
      path: '/systemusers',
      handler: 'systemuser.find',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Get single user - no auth for now
    {
      method: 'GET',
      path: '/systemusers/:id',
      handler: 'systemuser.findOne',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Create user - no auth for now
    {
      method: 'POST',
      path: '/systemusers',
      handler: 'systemuser.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Update user - no auth for now
    {
      method: 'PUT',
      path: '/systemusers/:id',
      handler: 'systemuser.update',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Delete user - no auth for now
    {
      method: 'DELETE',
      path: '/systemusers/:id',
      handler: 'systemuser.delete',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    }
  ]
};
