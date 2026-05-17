'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/sfa-quotation-communications/record-send',
      handler: 'sfa-quotation-communication.recordSend',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotation-communications/record-response',
      handler: 'sfa-quotation-communication.recordClientResponse',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/sfa-quotation-communications/by-quotation',
      handler: 'sfa-quotation-communication.byQuotation',
      config: { policies: [] },
    },
  ],
};
