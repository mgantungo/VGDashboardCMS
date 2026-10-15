'use strict';

const { run, body } = require('../utils/crm-handler');

module.exports = () => ({
  upload: run((ctx, crm, svc) => {
    const files = ctx.request.files || {};
    const file = files.file || Object.values(files)[0];
    return svc('crm-contracts').upload(crm, Array.isArray(file) ? file[0] : file, body(ctx));
  }),
  documents: run((ctx, crm, svc) => svc('crm-contracts').documents(crm, ctx.query)),
  recordLpo: run((ctx, crm, svc) => svc('crm-contracts').recordLpo(crm, body(ctx))),
  resolveLpo: run((ctx, crm, svc) => svc('crm-contracts').resolveLpo(crm, ctx.params.id, body(ctx))),
  createContract: run((ctx, crm, svc) => svc('crm-contracts').createContract(crm, body(ctx))),
  updateContract: run((ctx, crm, svc) => svc('crm-contracts').updateContract(crm, ctx.params.id, body(ctx))),
  addAmendment: run((ctx, crm, svc) => svc('crm-contracts').addAmendment(crm, ctx.params.id, body(ctx))),
});
