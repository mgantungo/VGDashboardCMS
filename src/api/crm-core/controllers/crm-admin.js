'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  users: run((ctx, crm, svc) => svc('crm-admin').users(crm, ctx.query)),
  salesPersons: run((ctx, crm, svc) => svc('crm-admin').salesPersons(crm, ctx.query)),
  upsertProfile: run((ctx, crm, svc) => svc('crm-admin').upsertProfile(crm, body(ctx))),
  teams: run((ctx, crm, svc) => svc('crm-admin').teams(crm)),
  upsertTeam: run((ctx, crm, svc) => svc('crm-admin').upsertTeam(crm, body(ctx))),
  upsertProduct: run((ctx, crm, svc) => svc('crm-admin').upsertProduct(crm, body(ctx))),
  seed: run((ctx, crm, svc) => svc('crm-admin').seed(crm, body(ctx))),
  backfill: run((ctx, crm, svc) => svc('crm-admin').backfillAssignments(crm, body(ctx))),
  runJobs: run((ctx, crm, svc) => { svc('crm-admin').requireAdmin(crm); return svc('crm-admin').runJobs(crm); }),
  audit: run((ctx, crm, svc) => svc('crm-admin').audit(crm, ctx.query)),
});
