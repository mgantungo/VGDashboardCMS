'use strict';

/** Standard service for CRM Opportunity. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-opportunity.crm-opportunity');
