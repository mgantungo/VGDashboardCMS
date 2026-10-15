'use strict';

/** Standard service for CRM Contact. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-contact.crm-contact');
