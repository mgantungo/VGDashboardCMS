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
    }
  ]
};
