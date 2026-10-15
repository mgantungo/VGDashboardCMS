'use strict';

/** Standard service for CRM Baseline Snapshot. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-baseline.crm-baseline');
