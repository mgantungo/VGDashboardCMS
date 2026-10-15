'use strict';

/** Standard controller for CRM Invoice (finance mirror). Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-invoice.crm-invoice');
