'use strict';

/** Standard service for CRM Approval Policy. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-approval-policy.crm-approval-policy');
