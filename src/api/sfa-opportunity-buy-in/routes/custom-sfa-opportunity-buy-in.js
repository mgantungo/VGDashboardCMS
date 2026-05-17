'use strict';
// src/api/sfa-opportunity-buy-in/routes/custom-sfa-opportunity-buy-in.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-opportunity-buy-ins/by-opportunity', handler: 'sfa-opportunity-buy-in.byOpportunity', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-opportunity-buy-ins/save',           handler: 'sfa-opportunity-buy-in.save',          config: { auth: false, policies: [] } },
  ],
};
