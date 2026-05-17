'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-opportunities/my-board',
      handler: 'sfa-opportunity.myBoard',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-opportunities/list',
      handler: 'sfa-opportunity.list',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-opportunities/detail',
      handler: 'sfa-opportunity.detail',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-opportunities/create',
      handler: 'sfa-opportunity.createOpportunity',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-opportunities/update',
      handler: 'sfa-opportunity.updateOpportunity',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-opportunities/change-stage',
      handler: 'sfa-opportunity.changeStage',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-opportunities/mark-lost',
      handler: 'sfa-opportunity.markLost',
      config: { policies: [] },
    },
  ],
};
