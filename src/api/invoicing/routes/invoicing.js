// api/invoicing/routes/invoicing.js
//
// Workflow re-order — Invoicing Officer. New api folder, new paths only.
// Every action needs x-user-email (or userEmail in the body) for an active
// invoicing_officer, finance_team or administrator account.
// Named routes come before the /:id ones. Needs a full Strapi restart.
'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/invoicing/queue',
      handler: 'invoicing.queue',
      config: { auth: false, description: 'Bookings by invoicing stage, split by payment method, with totals' },
    },
    {
      method: 'POST',
      path: '/invoicing/summary',
      handler: 'invoicing.summary',
      config: { auth: false, description: 'Totals by stage and payment method' },
    },
    {
      method: 'POST',
      path: '/invoicing/bulk',
      handler: 'invoicing.bulk',
      config: { auth: false, description: 'Confirm and/or invoice several bookings' },
    },
    {
      method: 'POST',
      path: '/invoicing/:id/confirm',
      handler: 'invoicing.confirm',
      config: { auth: false, description: 'Confirm one booking for invoicing' },
    },
    {
      method: 'POST',
      path: '/invoicing/:id/invoice',
      handler: 'invoicing.invoice',
      config: { auth: false, description: 'Create the VGAMS invoice for one confirmed booking' },
    },
  ],
};
