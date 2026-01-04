'use strict';

/**
 * workflow-log service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::workflow-log.workflow-log');
