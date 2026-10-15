'use strict';

/** Standard service for CRM Integration Log. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-integration-log.crm-integration-log');
