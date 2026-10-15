'use strict';

/** Standard service for CRM Provider. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-provider.crm-provider');
