'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  today: run((ctx, crm, svc) => svc('crm-dashboard').today(crm)),
  manager: run((ctx, crm, svc) => svc('crm-dashboard').manager(crm)),
  teamMap: run((ctx, crm, svc) => svc('crm-assignments').teamMap(crm, ctx.query)),
  companyMap: run((ctx, crm, svc) => svc('crm-assignments').companyMap(crm, ctx.query)),
  assign: run((ctx, crm, svc) => svc('crm-assignments').assign(crm, body(ctx))),
  bulkAssign: run((ctx, crm, svc) => svc('crm-assignments').bulkAssign(crm, body(ctx))),
  endAssignment: run((ctx, crm, svc) => svc('crm-assignments').endAssignment(crm, ctx.params.id, body(ctx).reason)),
});
