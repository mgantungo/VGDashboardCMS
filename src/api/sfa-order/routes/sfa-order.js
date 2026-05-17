'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-orders/convert',
      handler: 'sfa-order.convert',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-orders/list',
      handler: 'sfa-order.list',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-orders/detail',
      handler: 'sfa-order.detail',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-orders/update-status',
      handler: 'sfa-order.updateStatus',
      config: { policies: [] },
    },
  ],
};
