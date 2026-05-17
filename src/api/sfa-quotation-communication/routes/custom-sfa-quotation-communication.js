'use strict';
// src/api/sfa-quotation-communication/routes/custom-sfa-quotation-communication.js

module.exports = {
  routes: [
    { method: 'POST', path: '/sfa-quotation-communications/record-send',     handler: 'sfa-quotation-communication.recordSend',           config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotation-communications/record-response', handler: 'sfa-quotation-communication.recordClientResponse',  config: { auth: false, policies: [] } },
    { method: 'POST', path: '/sfa-quotation-communications/by-quotation',    handler: 'sfa-quotation-communication.byQuotation',           config: { auth: false, policies: [] } },
  ],
};
