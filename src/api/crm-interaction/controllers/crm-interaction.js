'use strict';

/** Standard controller for CRM Interaction. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-interaction.crm-interaction');
