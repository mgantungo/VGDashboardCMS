'use strict';

/** Standard controller for CRM Contact. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-contact.crm-contact');
