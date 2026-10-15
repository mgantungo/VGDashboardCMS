'use strict';

/** Standard controller for CRM Stage History. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-stage-history.crm-stage-history');
