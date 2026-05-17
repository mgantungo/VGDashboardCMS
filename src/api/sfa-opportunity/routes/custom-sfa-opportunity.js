'use strict';
// src/api/sfa-opportunity/routes/custom-sfa-opportunity.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-opportunities/my-board',     handler: 'sfa-opportunity.myBoard',           config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-opportunities/list',         handler: 'sfa-opportunity.list',              config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-opportunities/detail',       handler: 'sfa-opportunity.detail',            config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-opportunities/create',       handler: 'sfa-opportunity.createOpportunity', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-opportunities/update',       handler: 'sfa-opportunity.updateOpportunity', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-opportunities/change-stage', handler: 'sfa-opportunity.changeStage',       config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-opportunities/mark-lost',    handler: 'sfa-opportunity.markLost',          config: { auth: false, policies: [] } },
  ],
};
