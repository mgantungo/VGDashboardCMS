'use strict';

/** Standard service for CRM Procurement Order. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-procurement-order.crm-procurement-order');
