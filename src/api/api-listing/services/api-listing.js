'use strict';

/**
 * api-listing service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::api-listing.api-listing');
