'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  create: run((ctx, crm, svc) => svc('crm-proposals').create(crm, body(ctx))),
  quickQuote: run((ctx, crm, svc) => svc('crm-proposals').quickQuote(crm, body(ctx))),
  get: run((ctx, crm, svc) => svc('crm-proposals').get(crm, ctx.params.id, ctx.query)),
  getVersion: run(async (ctx, crm, svc) => {
    const v = await svc('crm-store').must('api::crm-proposal-version.crm-proposal-version', ctx.params.id, { populate: ['proposal'] }, 'Proposal version');
    return svc('crm-proposals').get(crm, v.proposal.documentId, { version: ctx.params.id });
  }),
  compare: run((ctx, crm, svc) => svc('crm-proposals').compare(crm, ctx.params.id, ctx.query.with)),
  updateVersion: run((ctx, crm, svc) => svc('crm-proposals').updateVersion(crm, ctx.params.id, body(ctx))),
  addLine: run((ctx, crm, svc) => svc('crm-proposals').addLine(crm, ctx.params.id, body(ctx))),
  updateLine: run((ctx, crm, svc) => svc('crm-proposals').updateLine(crm, ctx.params.id, body(ctx))),
  removeLine: run((ctx, crm, svc) => svc('crm-proposals').removeLine(crm, ctx.params.id, ctx.query.lock)),
  setContributors: run((ctx, crm, svc) => svc('crm-proposals').setLineContributors(crm, ctx.params.id, body(ctx).contributors)),
  submit: run((ctx, crm, svc) => svc('crm-proposals').submit(crm, ctx.params.id)),
  revise: run((ctx, crm, svc) => svc('crm-proposals').revise(crm, ctx.params.id, body(ctx))),
  extend: run((ctx, crm, svc) => svc('crm-proposals').extendValidity(crm, ctx.params.id, body(ctx).days)),
  accept: run((ctx, crm, svc) => svc('crm-proposals').accept(crm, ctx.params.id, body(ctx))),
});
