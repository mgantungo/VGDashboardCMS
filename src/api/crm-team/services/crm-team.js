'use strict';

/** Standard service for CRM Team. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-team.crm-team');
