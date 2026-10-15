'use strict';

/** Standard service for CRM Profile. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-profile.crm-profile');
