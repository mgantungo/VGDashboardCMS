'use strict';

const { run, body } = require('../utils/crm-handler');
const { UID } = require('../utils/crm-helpers');

module.exports = () => ({
  me: run(async (ctx, crm, svc) => {
    if (!crm.profile) return { needs_setup: true, user: crm.user };
    const [notes, approvals] = await Promise.all([
      svc('crm-notify').list(crm, { unreadOnly: true }),
      svc('crm-approvals').pendingCount(crm),
    ]);
    return {
      user: crm.user,
      profile: {
        id: crm.profileId, display_name: crm.profile.display_name || crm.spName, role: crm.role, is_active: crm.active,
        sales_person: crm.profile.sales_person ? { id: crm.spId, name: crm.profile.sales_person.name } : null,
        team: crm.profile.team ? { id: crm.teamId, name: crm.profile.team.name } : null,
        business_unit: crm.buId ? { id: crm.buId, name: crm.profile.business_unit?.name || crm.profile.team?.business_unit?.name } : null,
        monthly_target: crm.profile.monthly_target,
      },
      can: crm.can,
      mode: crm.can.manager ? 'manager' : (crm.role === 'salesperson' ? 'sales' : crm.role),
      counts: { notifications: notes.unread, approvals },
    };
  }),
  notifications: run((ctx, crm, svc) => svc('crm-notify').list(crm, { unreadOnly: ctx.query.unread === 'true' })),
  readNotifications: run((ctx, crm, svc) => svc('crm-notify').markRead(crm, body(ctx).ids)),
  lookups: run((ctx, crm, svc) => svc('crm-config').lookups(ctx.query.type)),
  stages: run((ctx, crm, svc) => svc('crm-config').stages()),
  settings: run(async (ctx, crm, svc) => svc('crm-config').settings()),
  products: run((ctx, crm, svc) => svc('crm-admin').products(crm, ctx.query)),
  businessUnits: run((ctx, crm, svc) => svc('crm-admin').businessUnits()),
  people: run(async (ctx, crm, svc) => {
    const filters = { is_active: true };
    if (ctx.query.role) filters.crm_role = { $in: String(ctx.query.role).split(',') };
    if (ctx.query.q) filters.display_name = { $containsi: ctx.query.q };
    return svc('crm-store').find(UID.profile, {
      filters, populate: { sales_person: { fields: ['name'] }, team: { fields: ['name'] }, business_unit: { fields: ['name'] } },
      sort: ['display_name:asc'], limit: 500,
    });
  }),
});
