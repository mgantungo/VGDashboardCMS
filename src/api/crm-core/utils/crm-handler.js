'use strict';

/**
 * Wraps a controller action: runs it with the CRM context, shapes the output
 * (ids, money, cost stripping) and maps optimistic-lock conflicts to HTTP 409.
 */
const { clean } = require('./crm-helpers');

const run = (fn) => async function crmAction(ctx) {
  const crm = ctx.state.crm || null;
  try {
    const out = await fn(ctx, crm, (name) => strapi.service(`api::crm-core.${name}`));
    const body = out === undefined ? { ok: true } : out;
    ctx.body = crm ? strapi.service('api::crm-core.crm-access').shape(crm, body) : clean(body);
  } catch (e) {
    if (e && e.status === 409) {
      ctx.status = 409;
      ctx.body = { data: null, error: { status: 409, name: 'ConflictError', message: e.message } };
      return;
    }
    throw e;
  }
};

const body = (ctx) => ctx.request.body || {};

module.exports = { run, body };
