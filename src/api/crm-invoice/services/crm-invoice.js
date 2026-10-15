'use strict';

/** Standard service for CRM Invoice (finance mirror). Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-invoice.crm-invoice');
