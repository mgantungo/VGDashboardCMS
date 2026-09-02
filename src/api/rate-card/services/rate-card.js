'use strict';

/**
 * rate-card service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::rate-card.rate-card');
