'use strict';

/** Standard service for CRM Cost Entry. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-cost-entry.crm-cost-entry');
