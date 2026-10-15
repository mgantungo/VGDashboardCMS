'use strict';

/** Standard service for CRM Pipeline Stage. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-pipeline-stage.crm-pipeline-stage');
