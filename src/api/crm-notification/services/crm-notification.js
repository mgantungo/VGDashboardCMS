'use strict';

/** Standard service for CRM Notification. Business rules live in api/crm-core/services. */
const { factories } = require('@strapi/strapi');

module.exports = factories.createCoreService('api::crm-notification.crm-notification');
