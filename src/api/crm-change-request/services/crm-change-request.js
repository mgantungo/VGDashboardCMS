'use strict';

/** Standard service for CRM Change Request. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-change-request.crm-change-request');
