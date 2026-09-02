'use strict';

/**
 * polling-station service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::polling-station.polling-station');
