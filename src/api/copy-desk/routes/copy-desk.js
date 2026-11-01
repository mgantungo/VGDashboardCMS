// api/copy-desk/routes/copy-desk.js
//
// Workflow re-order — Copy Desk (stored role: sub_editor). New api folder,
// new route paths only. Identity for writes: x-user-email header (or
// userEmail in the body), checked against vgams-user — same stateless
// pattern as requireAdmin. Needs a full Strapi restart.
'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/copy-desk/bookings-by-date',
      handler: 'copy-desk.bookingsByDate',
      config: {
        auth: false,
        description: 'Cleared print bookings running on a date, with Copy Desk placement and artwork state',
      },
    },
    {
      method: 'POST',
      path: '/copy-desk/confirm-layout',
      handler: 'copy-desk.confirmLayout',
      config: {
        auth: false,
        description: 'Confirm (lock) a day layout; a reason is required when placed adverts still lack artwork',
      },
    },
    {
      method: 'POST',
      path: '/copy-desk/reopen-layout',
      handler: 'copy-desk.reopenLayout',
      config: {
        auth: false,
        description: 'Reopen a confirmed layout (reason required)',
      },
    },
    {
      method: 'GET',
      path: '/pager-pages/:id/available-adverts-cleared',
      handler: 'copy-desk.availableForPage',
      config: {
        auth: false,
        description: 'Cleared print adverts running on this page\'s publication date that are not yet placed',
      },
    },
  ],
};
