'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::broadcast-source.broadcast-source');
