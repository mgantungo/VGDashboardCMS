'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  inbox: run((ctx, crm, svc) => svc('crm-approvals').inbox(crm, ctx.query)),
  decide: run((ctx, crm, svc) => svc('crm-approvals').decide(crm, ctx.params.id, body(ctx))),
});
