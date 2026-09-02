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
    // Token verification route
    {
      method: 'POST',
      path: '/systemusers/verify-token',
      handler: 'systemuser.verifyToken',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Get current user route
    {
      method: 'GET',
      path: '/systemusers/me',
      handler: 'systemuser.me',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Debug user data
    {
      method: 'GET',
      path: '/systemusers/debug',
      handler: 'systemuser.debugUser',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Set password
    {
      method: 'POST',
      path: '/systemusers/set-password',
      handler: 'systemuser.setPassword',
      config: {
        auth: false,
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
