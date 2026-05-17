'use strict';
// src/api/sfa-buy-in/routes/custom-sfa-buy-in.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-buy-ins/list',   handler: 'sfa-buy-in.list',        config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-buy-ins/create', handler: 'sfa-buy-in.createBuyIn', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-buy-ins/update', handler: 'sfa-buy-in.updateBuyIn', config: { auth: false, policies: [] } },
  ],
};
