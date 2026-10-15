'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  statement: run((ctx, crm, svc) => svc('crm-commission').statement(crm, ctx.query)),
  approve: run((ctx, crm, svc) => svc('crm-commission').approve(crm, body(ctx).ids)),
  markPaid: run((ctx, crm, svc) => svc('crm-commission').markPaid(crm, body(ctx).ids)),
  dispute: run((ctx, crm, svc) => svc('crm-commission').dispute(crm, ctx.params.id, body(ctx).reason)),
  disputes: run((ctx, crm, svc) => svc('crm-commission').disputes(crm)),
  decideDispute: run((ctx, crm, svc) => svc('crm-commission').decideDispute(crm, ctx.params.id, body(ctx))),
});
