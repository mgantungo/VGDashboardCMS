'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-dashboard/my-stats',
      handler: 'sfa-dashboard.myStats',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-dashboard/management-stats',
      handler: 'sfa-dashboard.managementStats',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-dashboard/followup-summary',
      handler: 'sfa-dashboard.followupSummary',
      config: { policies: [] },
    },
  ],
};
