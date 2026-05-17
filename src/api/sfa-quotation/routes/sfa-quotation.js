'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-quotations/create',
      handler: 'sfa-quotation.createQuotation',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotations/update',
      handler: 'sfa-quotation.updateQuotation',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotations/by-opportunity',
      handler: 'sfa-quotation.byOpportunity',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotations/pending-approval',
      handler: 'sfa-quotation.pendingApproval',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotations/submit-for-approval',
      handler: 'sfa-quotation.submitForApproval',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotations/approve',
      handler: 'sfa-quotation.approve',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotations/reject',
      handler: 'sfa-quotation.reject',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotations/revise',
      handler: 'sfa-quotation.revise',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotations/upload-pdf',
      handler: 'sfa-quotation.uploadPdf',
      config: { policies: [] },
    },
  ],
};
