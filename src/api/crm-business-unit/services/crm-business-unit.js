'use strict';

/** Standard service for CRM Business Unit. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-business-unit.crm-business-unit');
