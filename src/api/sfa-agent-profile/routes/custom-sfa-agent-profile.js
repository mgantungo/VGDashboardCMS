'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-agent-profiles/me',
      handler: 'sfa-agent-profile.me',
      config: {
        policies: [],
        middlewares: [],
        description: 'Returns the SFA profile of the authenticated user',
      },
    },
  ],
};
