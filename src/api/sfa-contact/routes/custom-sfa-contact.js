'use strict';
// src/api/sfa-contact/routes/custom-sfa-contact.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-contacts/by-company', handler: 'sfa-contact.byCompany',    config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-contacts/create',     handler: 'sfa-contact.createContact', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-contacts/update',     handler: 'sfa-contact.updateContact', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-contacts/remove',     handler: 'sfa-contact.removeContact', config: { auth: false, policies: [] } },
  ],
};
