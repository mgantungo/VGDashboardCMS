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
    
    // Get users by role
    {
      method: 'GET',
      path: '/vgams-users/by-role/:role',
      handler: 'vgams-user.findByRole',
      config: {
        policies: [],
        auth: true // Requires authentication
      }
    },
    
    // Register new user (public)
    {
      method: 'POST',
      path: '/vgams-users/register',
      handler: 'vgams-user.create',
      config: {
        policies: [],
        auth: false
      }
    }
  ]
};
