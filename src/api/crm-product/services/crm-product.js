'use strict';

/** Standard service for CRM Product. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-product.crm-product');
