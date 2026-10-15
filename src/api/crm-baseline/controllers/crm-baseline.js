'use strict';

/** Standard controller for CRM Baseline Snapshot. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-baseline.crm-baseline');
