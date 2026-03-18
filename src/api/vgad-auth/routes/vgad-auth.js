'use strict';
 
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/vgad-auth/login',
      handler: 'auth.login',
      config: { auth: false },
    },
  ],
};
