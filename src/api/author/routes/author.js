// src/api/author/routes/author.js
'use strict';

module.exports = {
  routes: [

     // Default Strapi CRUD routes (keep these for admin panel)
    {
      method: 'GET',
      path: '/authors',
      handler: 'author.find',
      config: {
        policies: []
      }
    },
    {
      method: 'GET',
      path: '/authors/:id',
      handler: 'author.findOne',
      config: {
        policies: []
      }
    },
    {
      method: 'POST',
      path: '/authors',
      handler: 'author.create',
      config: {
        policies: []
      }
    },
    {
      method: 'PUT',
      path: '/authors/:id',
      handler: 'author.update',
      config: {
        policies: []
      }
    },
    {
      method: 'DELETE',
      path: '/authors/:id',
      handler: 'author.delete',
      config: {
        policies: []
      }
    },
    // Authentication routes
    {
      method: 'GET',
      path: '/authors/initiate-login/:email/:password',
      handler: 'author.initiateLogin',
      config: {
        policies: [],
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/authors/verify-token',
      handler: 'author.verifyToken',
      config: {
        policies: [],
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/authors/resend-token',
      handler: 'author.resendToken',
      config: {
        policies: [],
        auth: false
      }
    },
    
    // Email service testing routes
    {
      method: 'POST',
      path: '/authors/test-email-service',
      handler: 'author.testEmailService',
      config: {
        policies: [],
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/authors/check-smtp-config',
      handler: 'author.checkSMTPConfig',
      config: {
        policies: [],
        auth: false
      }
    },
    
    // Profile routes
    {
      method: 'GET',
      path: '/authors/profile/:id',
      handler: 'author.getProfile',
      config: {
        policies: []
      }
    },
    {
      method: 'PUT',
      path: '/authors/profile/:id',
      handler: 'author.updateProfile',
      config: {
        policies: []
      }
    },
    
    // Password management routes
    {
      method: 'PUT',
      path: '/authors/change-password/:id',
      handler: 'author.changePassword',
      config: {
        policies: []
      }
    },
    {
      method: 'POST',
      path: '/authors/forgot-password',
      handler: 'author.forgotPassword',
      config: {
        policies: [],
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/authors/reset-password',
      handler: 'author.resetPassword',
      config: {
        policies: [],
        auth: false
      }
    },

   
  ]
};
