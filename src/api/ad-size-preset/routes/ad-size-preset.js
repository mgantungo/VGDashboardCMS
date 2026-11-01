'use strict';

/**
 * ad-size-preset router — standard routes (/ad-size-presets). These follow
 * Users & Permissions like every other collection; Copy Desk does not use them.
 */
const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::ad-size-preset.ad-size-preset');
