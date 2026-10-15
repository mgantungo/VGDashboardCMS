'use strict';

/** Standard controller for CRM LPO. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-lpo.crm-lpo');
