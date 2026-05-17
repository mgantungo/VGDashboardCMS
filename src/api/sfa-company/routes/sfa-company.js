'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-companies/search',
      handler: 'sfa-company.search',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-companies/create',
      handler: 'sfa-company.createCompany',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-companies/update',
      handler: 'sfa-company.updateCompany',
      config: { policies: [] },
    },
  ],
};
