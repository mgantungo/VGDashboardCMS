// api/advert/routes/print-class-report.js
//
// Workflow re-order — Display vs Classified report. Standalone route file;
// custom-routes.js is untouched. New route files need a full Strapi restart.
'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/reports/print-class/summary',
      handler: 'print-class-report.summary',
      config: {
        auth: false,
        description: 'Display vs Classified totals for print adverts by class, product and payment method',
      },
    },
    {
      method: 'POST',
      path: '/reports/print-class/list',
      handler: 'print-class-report.list',
      config: {
        auth: false,
        description: 'Advert rows behind the Display vs Classified report (drill-down / Excel export)',
      },
    },
  ],
};
