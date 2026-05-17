'use strict';
// src/api/sfa-activity/routes/custom-sfa-activity.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-activities/log',            handler: 'sfa-activity.log',           config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-activities/by-opportunity', handler: 'sfa-activity.byOpportunity', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-activities/due-followups',  handler: 'sfa-activity.dueFollowups',  config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-activities/remove',         handler: 'sfa-activity.remove',        config: { auth: false, policies: [] } },
  ],
};
