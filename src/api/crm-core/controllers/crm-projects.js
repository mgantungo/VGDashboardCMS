'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  createFromVersion: run((ctx, crm, svc) => svc('crm-projects').createFromVersion(crm, ctx.params.id, body(ctx))),
  list: run((ctx, crm, svc) => svc('crm-projects').list(crm, ctx.query)),
  get: run((ctx, crm, svc) => svc('crm-projects').get(crm, ctx.params.id)),
  updateWorkstream: run((ctx, crm, svc) => svc('crm-projects').updateWorkstream(crm, ctx.params.id, body(ctx))),
  addMilestone: run((ctx, crm, svc) => svc('crm-projects').addMilestone(crm, ctx.params.id, body(ctx))),
  updateMilestone: run((ctx, crm, svc) => svc('crm-projects').updateMilestone(crm, ctx.params.id, body(ctx))),
  addTask: run((ctx, crm, svc) => svc('crm-projects').addTask(crm, body(ctx))),
  updateTask: run((ctx, crm, svc) => svc('crm-projects').updateTask(crm, ctx.params.id, body(ctx))),
  addCost: run((ctx, crm, svc) => svc('crm-projects').addCost(crm, ctx.params.id, body(ctx))),
  addRecurring: run((ctx, crm, svc) => svc('crm-projects').addRecurringRule(crm, ctx.params.id, body(ctx))),
  requestChange: run((ctx, crm, svc) => svc('crm-projects').requestChange(crm, ctx.params.id, body(ctx))),
  close: run((ctx, crm, svc) => svc('crm-projects').close(crm, ctx.params.id, body(ctx))),
  addContact: run((ctx, crm, svc) => svc('crm-projects').addContact(crm, ctx.params.id, body(ctx))),
});
