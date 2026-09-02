'use strict';
// src/api/sfa-quotation/routes/custom-sfa-quotation.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-quotations/create',              handler: 'sfa-quotation.createQuotation',   config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotations/update',              handler: 'sfa-quotation.updateQuotation',   config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotations/by-opportunity',      handler: 'sfa-quotation.byOpportunity',     config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotations/pending-approval',    handler: 'sfa-quotation.pendingApproval',   config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotations/submit-for-approval', handler: 'sfa-quotation.submitForApproval', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotations/approve',             handler: 'sfa-quotation.approve',           config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotations/reject',              handler: 'sfa-quotation.reject',            config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotations/revise',              handler: 'sfa-quotation.revise',            config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotations/upload-pdf',          handler: 'sfa-quotation.uploadPdf',         config: { auth: false, policies: [] } },
  ],
};
