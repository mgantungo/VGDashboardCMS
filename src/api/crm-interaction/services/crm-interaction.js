'use strict';

/** Standard service for CRM Interaction. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-interaction.crm-interaction');
