'use strict';

/** Standard service for CRM Stage History. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-stage-history.crm-stage-history');
