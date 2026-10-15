'use strict';

/** Standard service for CRM Audit Log. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-audit-log.crm-audit-log');
