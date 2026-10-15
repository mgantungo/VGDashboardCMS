'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  list: run((ctx, crm, svc) => svc('crm-pipeline').list(crm, ctx.query)),
  create: run((ctx, crm, svc) => svc('crm-pipeline').create(crm, body(ctx))),
  get: run((ctx, crm, svc) => svc('crm-pipeline').get(crm, ctx.params.id)),
  update: run((ctx, crm, svc) => svc('crm-pipeline').update(crm, ctx.params.id, body(ctx))),
  move: run((ctx, crm, svc) => svc('crm-pipeline').move(crm, ctx.params.id, body(ctx))),
  lost: run((ctx, crm, svc) => svc('crm-pipeline').markLost(crm, ctx.params.id, body(ctx).reason)),
  won: run((ctx, crm, svc) => svc('crm-proposals').acceptFromOpportunity(crm, ctx.params.id, body(ctx))),
  addContributor: run((ctx, crm, svc) => svc('crm-pipeline').addContributor(crm, ctx.params.id, body(ctx))),
  resolveOverlap: run((ctx, crm, svc) => svc('crm-pipeline').resolveOverlap(crm, ctx.params.id, body(ctx))),
  logInteraction: run((ctx, crm, svc) => svc('crm-interactions').log(crm, body(ctx))),
  completeAction: run((ctx, crm, svc) => svc('crm-interactions').completeNextAction(crm, ctx.params.id)),
});
