'use strict';

/** Standard service for CRM Document. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-document.crm-document');
