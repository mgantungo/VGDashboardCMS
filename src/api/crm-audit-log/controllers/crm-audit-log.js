'use strict';

/** Standard controller for CRM Audit Log. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-audit-log.crm-audit-log');
