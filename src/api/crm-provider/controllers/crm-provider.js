'use strict';

/** Standard controller for CRM Provider. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-provider.crm-provider');
