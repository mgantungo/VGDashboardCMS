'use strict';

/**
 * CRM administration: link logins to sales persons, teams, catalogue,
 * one-off setup (seed), the migration backfill of client ownership from
 * existing adverts, and scheduled jobs.
 */
const { UID, num, money, today, addDays, daysBetween, fail, forbid, uniq } = require('../utils/crm-helpers');

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const config = () => strapi.service('api::crm-core.crm-config');
  const notify = () => strapi.service('api::crm-core.crm-notify');

  const requireAdmin = (crm) => { if (!['admin', 'executive'].includes(crm.role)) forbid('CRM administration is for administrators.'); };

  return {
    requireAdmin,

    /**
     * People who can use the CRM:
     *  - everyone who has signed in through the VGAMS login (sales persons and VGAMS staff);
     *    their row id is "p:<CRM profile documentId>", and
     *  - Strapi Users & Permissions logins (integrations), as before.
     */
    async users(crm, { q } = {}) {
      requireAdmin(crm);
      const where = q ? { $or: [{ username: { $containsi: q } }, { email: { $containsi: q } }] } : {};
      const users = await store().rows(UID.user, { where, select: ['id', 'documentId', 'username', 'email', 'blocked'], orderBy: { username: 'asc' }, limit: 500 });
      const profiles = await store().find(UID.profile, {
        populate: { user: true, sales_person: true, vgams_user: { fields: ['name', 'email', 'role', 'isActive'] }, team: true, business_unit: true },
        limit: 2000,
      });
      const shape = (p) => (p ? {
        id: p.documentId, crm_role: p.crm_role, is_active: p.is_active, monthly_target: num(p.monthly_target), discount_authority_pct: num(p.discount_authority_pct),
        sales_person: p.sales_person ? { id: p.sales_person.documentId, name: p.sales_person.name } : null,
        vgams_user: p.vgams_user ? { id: p.vgams_user.documentId, name: p.vgams_user.name, role: p.vgams_user.role } : null,
        team: p.team ? { id: p.team.documentId, name: p.team.name } : null,
        business_unit: p.business_unit ? { id: p.business_unit.documentId, name: p.business_unit.name } : null,
      } : null);
      const rows = users.map((u) => ({
        user: { id: u.documentId, username: u.username, email: u.email, blocked: u.blocked },
        profile: shape(profiles.find((x) => x.user?.id === u.id)),
      }));
      const needle = q ? String(q).toLowerCase() : '';
      profiles
        .filter((p) => !p.user)
        .map((p) => {
          const email = p.sales_person?.email || p.vgams_user?.email || '';
          const name = p.display_name || p.sales_person?.name || p.vgams_user?.name || email;
          const vgamsActive = p.sales_person?.isActive === true || p.vgams_user?.isActive === true;
          return { p, email, name, blocked: !vgamsActive };
        })
        .filter((r) => !needle || [r.name, r.email].some((v) => String(v || '').toLowerCase().includes(needle)))
        .forEach((r) => rows.push({ user: { id: `p:${r.p.documentId}`, username: r.name, email: r.email, blocked: r.blocked }, profile: shape(r.p) }));
      return rows.sort((x, y) => String(x.user.username || '').localeCompare(String(y.user.username || '')));
    },

    /** Read-only list of the existing VGAMS sales persons. */
    async salesPersons(crm, { q } = {}) {
      const filters = q ? { $or: [{ name: { $containsi: q } }, { email: { $containsi: q } }, { bc_code: { $containsi: q } }] } : {};
      const sps = await store().find(UID.salesPerson, { filters, sort: ['name:asc'], fields: ['name', 'email', 'bc_code', 'isActive'], limit: 500 });
      const linked = await store().rows(UID.profile, { populate: { sales_person: { select: ['id', 'documentId'] } } });
      const taken = new Set(linked.map((p) => p.sales_person?.documentId).filter(Boolean));
      return sps.map((s) => ({ id: s.documentId, name: s.name, email: s.email, bc_code: s.bc_code, isActive: s.isActive, linked: taken.has(s.documentId) }));
    },

    async upsertProfile(crm, data) {
      requireAdmin(crm);
      if (!data.user) fail('Choose the person.');
      const patch = {};
      ['crm_role', 'team', 'business_unit', 'sales_person', 'display_name', 'phone', 'is_active', 'commission_eligible'].forEach((k) => { if (data[k] !== undefined) patch[k] = data[k] || (k === 'is_active' ? false : null); });
      if (data.monthly_target !== undefined) patch.monthly_target = money(data.monthly_target);
      if (data.discount_authority_pct !== undefined) patch.discount_authority_pct = num(data.discount_authority_pct);

      let existing; let createBase;
      if (String(data.user).startsWith('p:')) {
        // Someone who signed in through the VGAMS login: edit their CRM profile directly.
        existing = await store().first(UID.profile, { filters: { documentId: String(data.user).slice(2) } });
        if (!existing) fail('CRM profile not found.');
        if (patch.sales_person) {
          const taken = await store().first(UID.profile, { filters: { sales_person: { documentId: patch.sales_person }, documentId: { $ne: existing.documentId } } });
          if (taken) fail('That sales person is already linked to another CRM profile.');
        }
        if (existing.documentId === crm.profileId && patch.crm_role && patch.crm_role !== 'admin' && crm.role === 'admin') fail('You cannot remove your own admin role.');
        if (existing.documentId === crm.profileId && patch.is_active === false) fail('You cannot deactivate your own CRM profile.');
      } else {
        const user = await store().first(UID.user, { filters: { documentId: data.user } });
        if (!user) fail('Login not found.');
        if (data.sales_person) {
          const taken = await store().first(UID.profile, { filters: { sales_person: { documentId: data.sales_person }, user: { documentId: { $ne: data.user } } } });
          if (taken) fail('That sales person is already linked to another login.');
        }
        existing = await store().first(UID.profile, { filters: { user: { documentId: data.user } } });
        if (!patch.display_name && data.sales_person) {
          const sp = await store().one(UID.salesPerson, data.sales_person, { fields: ['name'] });
          patch.display_name = sp?.name || user.username;
        }
        createBase = { user: data.user, display_name: user.username, crm_role: 'salesperson' };
      }
      let out;
      if (existing) out = await store().update(UID.profile, existing.documentId, patch);
      else out = await store().create(UID.profile, { ...createBase, ...patch });
      await audit().log(crm, existing ? 'profile.update' : 'profile.create', UID.profile, out.documentId, existing, patch);
      return out;
    },

    async teams(crm) {
      return store().find(UID.team, { populate: ['supervisor', 'business_unit', 'members'], sort: ['name:asc'], limit: 500 });
    },

    async upsertTeam(crm, data) {
      requireAdmin(crm);
      if (!data.name) fail('Name the team.');
      const patch = { name: data.name, region: data.region || null, business_unit: data.business_unit || null, supervisor: data.supervisor || null, is_active: data.is_active !== false };
      const out = data.id ? await store().update(UID.team, data.id, patch) : await store().create(UID.team, patch);
      await audit().log(crm, data.id ? 'team.update' : 'team.create', UID.team, out.documentId, null, patch);
      return out;
    },

    async businessUnits() {
      return store().find(UID.businessUnit, { filters: { is_active: true }, sort: ['name:asc'] });
    },

    async products(crm, { q, all } = {}) {
      const filters = all ? {} : { is_active: true };
      if (q) filters.name = { $containsi: q };
      return store().find(UID.product, { filters, populate: { business_unit: { fields: ['name'] }, preferred_provider: { fields: ['name', 'approval_state'] } }, sort: ['name:asc'], limit: 500 });
    },

    async upsertProduct(crm, data) {
      if (!['admin', 'product_manager', 'executive'].includes(crm.role)) forbid('Product managers maintain the catalogue.');
      if (crm.role === 'product_manager' && data.business_unit && data.business_unit !== crm.buId) forbid('You can only edit your own unit\'s products.');
      const patch = {};
      ['name', 'code', 'short_label', 'package_note', 'description', 'product_type', 'unit', 'business_unit', 'preferred_provider', 'default_duration_type', 'deliverables', 'requires_approval', 'is_active']
        .forEach((k) => { if (data[k] !== undefined) patch[k] = data[k]; });
      ['list_price', 'floor_price', 'standard_cost'].forEach((k) => { if (data[k] !== undefined) patch[k] = money(data[k]); });
      if (data.default_quantity !== undefined) patch.default_quantity = num(data.default_quantity);
      if (data.tax_rate !== undefined) patch.tax_rate = num(data.tax_rate);
      const out = data.id ? await store().update(UID.product, data.id, patch) : await store().create(UID.product, patch);
      await audit().log(crm, data.id ? 'product.update' : 'product.create', UID.product, out.documentId, null, patch);
      return out;
    },

    async seed(crm, opts) {
      requireAdmin(crm);
      const res = await config().seed(opts || {});
      await audit().log(crm, 'crm.seed', UID.setting, null, null, res);
      return res;
    },

    /**
     * Migration step 3 of the blueprint: derive client ↔ sales person pairs from
     * existing adverts (read-only on adverts). Busiest seller becomes account lead.
     */
    async backfillAssignments(crm, { dryRun = true } = {}) {
      requireAdmin(crm);
      if (!store().hasModel(UID.advert)) return { skipped: true, reason: 'No advert collection found.' };
      const attrs = strapi.contentTypes[UID.advert].attributes;
      if (!attrs.client || !attrs.vgams_sales_persons) return { skipped: true, reason: 'Adverts do not link clients and sales persons.' };
      const pairs = {};
      let offset = 0; let unmapped = 0; let total = 0;
      for (;;) {
        const rows = await store().rows(UID.advert, {
          select: ['id'], limit: 1000, offset,
          populate: { client: { select: ['id', 'documentId'] }, vgams_sales_persons: { select: ['id', 'documentId'] } },
        });
        if (!rows.length) break;
        for (const r of rows) {
          total += 1;
          const c = r.client?.documentId;
          const sps = (r.vgams_sales_persons || []).map((s) => s.documentId);
          if (!c || !sps.length) { unmapped += 1; continue; }
          pairs[c] = pairs[c] || {};
          sps.forEach((s) => { pairs[c][s] = (pairs[c][s] || 0) + 1; });
        }
        offset += rows.length;
      }
      const existing = await store().rows(UID.assignment, { where: { state: 'active' }, populate: { client: { select: ['id', 'documentId'] }, sales_person: { select: ['id', 'documentId'] } } });
      const has = new Set(existing.map((a) => `${a.client?.documentId}:${a.sales_person?.documentId}`));
      const leadSet = new Set(existing.filter((a) => a.role === 'account_lead').map((a) => a.client?.documentId));
      let leads = 0; let associates = 0;
      for (const [clientId, counts] of Object.entries(pairs)) {
        const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        for (let i = 0; i < ranked.length; i += 1) {
          const [spId] = ranked[i];
          if (has.has(`${clientId}:${spId}`)) continue;
          const role = i === 0 && !leadSet.has(clientId) ? 'account_lead' : 'associated_seller';
          if (role === 'account_lead') leads += 1; else associates += 1;
          if (!dryRun) {
            await store().create(UID.assignment, { client: clientId, sales_person: spId, role, start_date: today(), state: 'active', assigned_by: crm.profileId, reason: 'Backfilled from adverts' });
          }
        }
        if (!dryRun) {
          const prof = await store().first(UID.clientProfile, { filters: { client: { documentId: clientId } } });
          if (!prof) await store().create(UID.clientProfile, { client: clientId, lifecycle: 'active', source: 'advert history' });
        }
      }
      const result = { dryRun, adverts: total, clients: Object.keys(pairs).length, account_leads: leads, associated_sellers: associates, adverts_without_client_or_seller: unmapped };
      if (!dryRun) await audit().log(crm, 'assignment.backfill', UID.assignment, null, null, result);
      return result;
    },

    /** Daily jobs: overdue invoices, recurring tasks, quote expiry and reminders. */
    async runJobs(crm) {
      const settings = await config().settings();
      const out = {};
      out.invoices = await strapi.service('api::crm-core.crm-finance').markOverdue();
      out.recurring = await strapi.service('api::crm-core.crm-projects').runRecurring();
      const t = today();
      // expire quotes past their validity
      const live = await store().find(UID.proposal, { filters: { state: { $in: ['submitted', 'negotiating'] } }, populate: ['current_version', 'owner', 'client'], limit: 5000 });
      let expired = 0; let reminded = 0;
      for (const p of live) {
        const v = p.current_version;
        if (!v?.valid_until) continue;
        const left = daysBetween(t, v.valid_until);
        if (left < 0) { await store().update(UID.proposal, p.documentId, { state: 'expired' }); expired += 1; }
        else if (left === settings.reminder_days_before_expiry && p.owner) {
          await notify().toProfiles([p.owner.documentId], { event: 'proposal.expiring', title: `${p.reference} expires in ${left} days`, body: p.client?.company_name, link: `/crm/proposals/${p.documentId}` });
          reminded += 1;
        }
      }
      out.quotes = { expired, reminded };
      // overdue project tasks
      const tasks = await store().find(UID.task, { filters: { state: { $in: ['pending', 'in_progress'] }, due_date: { $eq: addDays(t, -1) } }, populate: ['assignee'], limit: 5000 });
      for (const tk of tasks) if (tk.assignee) await notify().toProfiles([tk.assignee.documentId], { event: 'task.overdue', title: `Overdue: ${tk.title}`, link: '/crm' });
      out.overdue_tasks = tasks.length;
      // refresh project health
      const projects = await store().find(UID.project, { filters: { state: 'active' }, limit: 5000, fields: ['name'] });
      for (const p of projects) await strapi.service('api::crm-core.crm-projects').refreshProject(p.documentId);
      out.projects = projects.length;
      if (crm) await audit().log(crm, 'crm.jobs', UID.setting, null, null, out);
      return out;
    },

    async audit(crm, { target_id, action, limit = 100 } = {}) {
      if (!['admin', 'executive', 'finance', 'senior_manager'].includes(crm.role)) forbid();
      const filters = {};
      if (target_id) filters.target_id = target_id;
      if (action) filters.action = { $startsWith: action };
      return store().find(UID.audit, { filters, populate: { actor: { fields: ['display_name'] } }, sort: ['occurred_at:desc'], limit: Math.min(Number(limit) || 100, 500) });
    },

    uniq,
  };
};
