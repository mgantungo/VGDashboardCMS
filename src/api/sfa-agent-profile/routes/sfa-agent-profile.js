'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

// Core CRUD routes
const coreRouter = createCoreRouter('api::sfa-agent-profile.sfa-agent-profile');

// Custom routes
const customRoutes = {
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

module.exports = {
  routes: [
    ...customRoutes.routes,
    ...coreRouter.routes,
  ],
};
