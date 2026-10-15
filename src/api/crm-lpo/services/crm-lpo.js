'use strict';

/** Standard service for CRM LPO. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-lpo.crm-lpo');
