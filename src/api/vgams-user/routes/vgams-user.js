'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::vgams-user.vgams-user', {
  config: {
    find: {
      auth: false, // Make public if needed, or set to true for protected
      policies: [],
      middlewares: [],
    },
    findOne: {
      auth: false, // Make public if needed
    },
    create: {
      auth: false, // Make public for registration
    },
    update: {
      auth: true, // Requires authentication
    },
    delete: {
      auth: true, // Requires authentication
    },
  },
});
