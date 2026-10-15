'use strict';

/** Standard service for CRM Settings. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-setting.crm-setting');
