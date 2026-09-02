'use strict';
// src/api/sfa-company/routes/custom-sfa-company.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-companies/search', handler: 'sfa-company.search',        config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-companies/create', handler: 'sfa-company.createCompany', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-companies/update', handler: 'sfa-company.updateCompany', config: { auth: false, policies: [] } },
  ],
};
