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
    // ── Clearance: size, confirm, defer (controllers/clearance.js) ──────────
    {
      method: 'GET',
      path: '/copy-desk/size-presets',
      handler: 'clearance.sizePresets',
      config: { auth: false, description: 'Active size presets for a masthead (?productId=)' },
    },
    {
      method: 'POST',
      path: '/copy-desk/layout-status',
      handler: 'clearance.layoutStatus',
      config: { auth: false, description: 'Open / confirmed layout status for run dates (booking form warning, defer dialog)' },
    },
    {
      method: 'POST',
      path: '/copy-desk/clear',
      handler: 'clearance.clear',
      config: { auth: false, description: 'Clear one advert for design with a size (display) or no size (classified)' },
    },
    {
      method: 'POST',
      path: '/copy-desk/clear-bulk',
      handler: 'clearance.clearBulk',
      config: { auth: false, description: 'Confirm several adverts for one date at their booked size' },
    },
    {
      method: 'POST',
      path: '/copy-desk/withdraw',
      handler: 'clearance.withdraw',
      config: { auth: false, description: 'Withdraw a clearance (reason required)' },
    },
    {
      method: 'POST',
      path: '/copy-desk/defer',
      handler: 'clearance.defer',
      config: { auth: false, description: 'Move one run date of an advert to another day (reason required)' },
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
