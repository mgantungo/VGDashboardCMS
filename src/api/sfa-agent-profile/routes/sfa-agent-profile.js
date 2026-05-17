'use strict';

// Custom routes only.
// Core CRUD routes are in routes/core.js — Strapi loads both automatically.

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
