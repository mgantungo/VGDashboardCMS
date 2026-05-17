'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-activities/log',
      handler: 'sfa-activity.log',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-activities/by-opportunity',
      handler: 'sfa-activity.byOpportunity',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-activities/due-followups',
      handler: 'sfa-activity.dueFollowups',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-activities/remove',
      handler: 'sfa-activity.remove',
      config: { policies: [] },
    },
  ],
};
