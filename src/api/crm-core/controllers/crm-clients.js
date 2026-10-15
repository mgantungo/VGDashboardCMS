'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  list: run((ctx, crm, svc) => svc('crm-clients').list(crm, ctx.query)),
  directory: run((ctx, crm, svc) => svc('crm-clients').directory(crm, ctx.query)),
  duplicates: run(async (ctx, crm, svc) => ({ items: await svc('crm-clients').checkDuplicates({ name: ctx.query.name, phone: ctx.query.phone, email: ctx.query.email, tin: ctx.query.tin }) })),
  create: run((ctx, crm, svc) => svc('crm-clients').create(crm, body(ctx))),
  get: run((ctx, crm, svc) => svc('crm-clients').get360(crm, ctx.params.id)),
  updateProfile: run((ctx, crm, svc) => svc('crm-clients').updateProfile(crm, ctx.params.id, body(ctx))),
  addContact: run((ctx, crm, svc) => svc('crm-clients').addContact(crm, ctx.params.id, body(ctx))),
  merge: run((ctx, crm, svc) => svc('crm-clients').merge(crm, ctx.params.id, body(ctx).into)),
  interactions: run((ctx, crm, svc) => svc('crm-interactions').listForClient(crm, ctx.params.id)),
  remindInvoice: run((ctx, crm, svc) => svc('crm-clients').remindOverdue(crm, ctx.params.invoiceId)),
});
