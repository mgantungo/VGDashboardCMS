'use strict';

/** Standard controller for CRM Project. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-project.crm-project');
