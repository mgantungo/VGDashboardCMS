'use strict';

module.exports = {
  routes: [
    // Login endpoint (GET method with params)
    {
      method: 'GET',
      path: '/vgams-users/initiate-login/:email/:password',
      handler: 'vgams-user.initiateLogin',
      config: {
        policies: [],
        auth: false
      }
    },
    
    // Alternative login endpoint (POST method with body)
    {
      method: 'POST',
      path: '/vgams-users/login',
      handler: 'vgams-user.initiateLoginPost',
      config: {
        policies: [],
        auth: false
      }
    },

    // ── Admin user management — NEW ──────────────────────────────────────
    // All require `adminEmail` (body or `x-admin-email` header) identifying
    // an active administrator; see requireAdmin() in the controller.
    // These are separate from the default Strapi REST CRUD for vgams-user,
    // which is already in use elsewhere and is left untouched.
    {
      method: 'GET',
      path: '/vgams-users/admin/list',
      handler: 'vgams-user.listUsers',
      config: {
        policies: [],
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/vgams-users/admin/create',
      handler: 'vgams-user.createUser',
      config: {
        policies: [],
        auth: false
      }
    },
    {
      method: 'PUT',
      path: '/vgams-users/admin/:id',
      handler: 'vgams-user.updateUserAdmin',
      config: {
        policies: [],
        auth: false
      }
    },
    {
      method: 'DELETE',
      path: '/vgams-users/admin/:id',
      handler: 'vgams-user.deleteUserAdmin',
      config: {
        policies: [],
        auth: false
      }
    }
  ]
};