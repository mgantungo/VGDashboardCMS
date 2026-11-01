// api/advert/routes/design-house-artwork.js
//
// Workflow re-order — Design House artwork per run date. Standalone route
// file; custom-routes.js is untouched. New route files need a full restart.
'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/design-house/placements',
      handler: 'design-house-artwork.getPlacements',
      config: {
        auth: false,
        description: 'Copy Desk placement and artwork state per run date for a list of advert ids',
      },
    },
    {
      method: 'POST',
      path: '/design-house/adverts/:id/artwork',
      handler: 'design-house-artwork.attachArtwork',
      config: {
        auth: false,
        description: 'Attach artwork to any cleared booking for chosen run dates, optionally carried to later dates',
      },
    },
    {
      method: 'POST',
      path: '/design-house/schedules/:scheduleId/drop',
      handler: 'design-house-artwork.dropRunDate',
      config: {
        auth: false,
        description: "Drop one run date's artwork (reason required); the row stays, flagged as dropped",
      },
    },
  ],
};
