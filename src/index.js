'use strict';
/**
 * CRM hook-up (optional). If src/crm-bootstrap.js is missing, Strapi still
 * starts normally and only logs a warning — the CMS never fails because of it.
 */
let crm = null;
try {
  crm = require('./crm-bootstrap');
} catch (e) {
  crm = null;
}
 
module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    if (crm) crm.register({ strapi });
    else strapi.log.warn('[crm] src/crm-bootstrap.js not found — CRM setup, daily jobs and admin-edit audit are off.');
  },
 
  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    if (crm) await crm.bootstrap({ strapi });
  },
};
 






//'use strict';

//module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
//  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
//  bootstrap(/*{ strapi }*/) {},
//};
