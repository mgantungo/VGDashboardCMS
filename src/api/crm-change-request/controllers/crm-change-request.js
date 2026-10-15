'use strict';

/** Standard controller for CRM Change Request. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-change-request.crm-change-request');
