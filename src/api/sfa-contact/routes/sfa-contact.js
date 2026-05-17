'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-contacts/by-company',
      handler: 'sfa-contact.byCompany',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-contacts/create',
      handler: 'sfa-contact.createContact',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-contacts/update',
      handler: 'sfa-contact.updateContact',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-contacts/remove',
      handler: 'sfa-contact.removeContact',
      config: { policies: [] },
    },
  ],
};
