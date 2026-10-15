'use strict';

/** Standard service for CRM Client Profile. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-client-profile.crm-client-profile');
