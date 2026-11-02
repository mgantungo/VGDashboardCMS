// api/production-report/routes/production-report.js
//
// Read-only production report (Copy Desk, Design House, Booking Desk views).
// Identity: x-user-email header, checked against vgams-user. New api folder,
// so Strapi needs a full restart to pick it up.
'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/reports/production',
      handler: 'production-report.production',
      config: {
        auth: false,
        description: 'One row per print advert per run date: booking, sales person, Copy Desk, Pager and artwork state',
      },
    },
  ],
};
