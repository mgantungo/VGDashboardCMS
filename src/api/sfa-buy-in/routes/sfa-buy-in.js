'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-buy-ins/list',
      handler: 'sfa-buy-in.list',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-buy-ins/create',
      handler: 'sfa-buy-in.createBuyIn',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-buy-ins/update',
      handler: 'sfa-buy-in.updateBuyIn',
      config: { policies: [] },
    },
  ],
};
