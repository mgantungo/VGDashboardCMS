'use strict';

/** Standard controller for CRM Pipeline Stage. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-pipeline-stage.crm-pipeline-stage');
