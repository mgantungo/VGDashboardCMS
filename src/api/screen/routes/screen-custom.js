'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/screens/status',
      handler: 'screen.status',
      config: {
        auth: false, // dashboard read — tighten with a policy/API token in production
      },
    },
    {
      method: 'GET',
      path: '/screens/:slug/current',
      handler: 'screen.current',
      config: {
        auth: false, // billboards poll this unauthenticated by design
      },
    },
    {
      method: 'POST',
      path: '/screens/:slug/checkin',
      handler: 'screen.checkin',
      config: {
        auth: false,
      },
    },
    {
      method: 'POST',
      path: '/screens/register',
      handler: 'screen.register',
      config: {
        auth: false, // dashboard write — recommend requiring auth here, see README
      },
    },
    {
      method: 'POST',
      path: '/screens/:slug/push',
      handler: 'screen.push',
      config: {
        auth: false, // recommend requiring auth here — see README
      },
    },
  ],
};
