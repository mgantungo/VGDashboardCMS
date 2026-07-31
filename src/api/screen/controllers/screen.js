'use strict';

/**
 * screen controller
 *
 * Core CRUD is provided by createCoreController. The custom endpoints
 * (current / checkin / push / status) live in ./screen-custom.js and are
 * merged in below so this file stays close to the generated default.
 */

const { createCoreController } = require('@strapi/strapi').factories;
const customActions = require('./screen-custom');

module.exports = createCoreController('api::screen.screen', ({ strapi }) => ({
  ...customActions({ strapi }),
}));
