'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-opportunity-buy-ins/by-opportunity',
      handler: 'sfa-opportunity-buy-in.byOpportunity',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-opportunity-buy-ins/save',
      handler: 'sfa-opportunity-buy-in.save',
      config: { policies: [] },
    },
  ],
};
