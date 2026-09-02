'use strict';
 
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/vgad-auth/login',
      handler: 'vgad-auth.login',
      config: { auth: false },
    },
  ],
};
