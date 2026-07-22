// api/advert/routes/pager-assignments.js
//
// Standalone route file — Strapi merges every file placed under an api's
// routes/ folder automatically, so this sits alongside your existing
// custom-routes.js without needing to edit it.
'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/adverts/:id/pager-assignments',
      handler: 'pager-assignments.getPagerAssignments',
      config: {
        auth: false,
        description: 'Every pager-page (across every publication) this advert is placed on',
      },
    },
  ],
};
