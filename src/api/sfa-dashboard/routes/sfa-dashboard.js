'use strict';
// src/api/sfa-dashboard/routes/sfa-dashboard.js
// No content-type, so no createCoreRouter. Custom routes only.

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-dashboard/my-stats',         handler: 'sfa-dashboard.myStats',         config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-dashboard/management-stats', handler: 'sfa-dashboard.managementStats', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-dashboard/followup-summary', handler: 'sfa-dashboard.followupSummary', config: { auth: false, policies: [] } },
  ],
};
