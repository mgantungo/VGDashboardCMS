'use strict';

/**
 * systemuser service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::systemuser.systemuser');
