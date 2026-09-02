'use strict';

/**
 * access-log router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::access-log.access-log');
