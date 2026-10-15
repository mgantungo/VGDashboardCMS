'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  overview: run((ctx, crm, svc) => svc('crm-finance').overview(crm)),
  requestInvoice: run((ctx, crm, svc) => svc('crm-finance').requestInvoice(crm, ctx.params.id)),
  requestException: run((ctx, crm, svc) => svc('crm-finance').requestBillingException(crm, ctx.params.id, body(ctx).reason)),
  markIssued: run((ctx, crm, svc) => svc('crm-finance').markIssued(crm, ctx.params.id, body(ctx))),
  recordPayment: run((ctx, crm, svc) => svc('crm-finance').recordPayment(crm, ctx.params.id, body(ctx))),
  writeOff: run((ctx, crm, svc) => svc('crm-finance').writeOff(crm, ctx.params.id, body(ctx).reason)),
  sync: run((ctx, crm, svc) => svc('crm-finance').sync(body(ctx))),
});
