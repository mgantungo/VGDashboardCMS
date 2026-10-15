'use strict';

/** Standard controller for CRM Approval Request. Workflow actions live in api/crm-core/controllers. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreController('api::crm-approval-request.crm-approval-request');
