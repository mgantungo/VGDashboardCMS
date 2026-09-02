'use strict';
// src/api/sfa-order/routes/custom-sfa-order.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-orders/convert',       handler: 'sfa-order.convert',      config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-orders/list',          handler: 'sfa-order.list',          config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-orders/detail',        handler: 'sfa-order.detail',        config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-orders/update-status', handler: 'sfa-order.updateStatus',  config: { auth: false, policies: [] } },
  ],
};
