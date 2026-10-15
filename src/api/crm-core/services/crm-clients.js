'use strict';

/**
 * Client register (hub-and-spoke). Reads the existing `client` collection and
 * keeps all CRM-only data in crm-client-profile — the client schema is untouched.
 */
const {
  UID, num, today, nowIso, addDays, daysBetween, dedupeKey, similarity, normPhone, forbid, fail, uniq,
} = require('../utils/crm-helpers');

const CLIENT_FIELDS = ['company_name', 'contact_person', 'email', 'phone', 'address', 'clientTin', 'bc_no',
  'payment_terms', 'credit_approved', 'credit_limit', 'is_active'];

// every CRM collection that points at a client (used by merge)
const CLIENT_LINKED = ['assignment', 'contact', 'interaction', 'opportunity', 'proposal', 'lpo', 'contract',
  'invoice', 'document', 'project', 'commissionEntry'];

const health = (days, coldAfter) => {
  if (days === null || days === undefined) return 'unknown';
  if (days <= 14) return 'fresh';
  if (days <= coldAfter) return 'aging';
  return 'cold';
};

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const config = () => strapi.service('api::crm-core.crm-config');

  return {
    health,

    async profileFor(clientId, create = true) {
      let p = await store().first(UID.clientProfile, { filters: { client: { documentId: clientId } } });
      if (!p && create) {
        const c = await store().one(UID.client, clientId, { fields: ['company_name'] });
        if (!c) return null;
        p = await store().create(UID.clientProfile, {
          client: clientId, lifecycle: 'active', dedupe_key: dedupeKey(c.company_name),
        });
      }
      return p;
    },

    async touch(clientId, when = nowIso()) {
      const p = await this.profileFor(clientId);
      if (p) await store().update(UID.clientProfile, p.documentId, { last_contact_at: when });
    },

    async myClientIds(crm) {
      if (!crm.spId) return [];
      const rows = await store().rows(UID.assignment, {
        where: { sales_person: { documentId: crm.spId }, state: 'active' },
        populate: { client: { select: ['id', 'documentId'] } },
      });
      return uniq(rows.map((r) => r.client?.documentId));
    },

    /** Adds lead, lifecycle, open deals and contact health to a list of client docs. */
    async enrich(crm, clients) {
      const ids = clients.map((c) => c.documentId);
      if (!ids.length) return [];
      const settings = await config().settings();
      const [profiles, assigns, opps] = await Promise.all([
        store().rows(UID.clientProfile, { where: { client: { documentId: { $in: ids } } }, populate: { client: { select: ['id', 'documentId'] } } }),
        store().rows(UID.assignment, {
          where: { client: { documentId: { $in: ids } }, state: 'active' },
          populate: { client: { select: ['id', 'documentId'] }, sales_person: { select: ['id', 'documentId', 'name'] } },
        }),
        store().rows(UID.opportunity, {
          where: { client: { documentId: { $in: ids } }, state: 'open' },
          select: ['id', 'documentId', 'expected_revenue'],
          populate: { client: { select: ['id', 'documentId'] } },
        }),
      ]);
      const byClient = (rows) => rows.reduce((m, r) => { const k = r.client?.documentId; (m[k] = m[k] || []).push(r); return m; }, {});
      const P = byClient(profiles); const A = byClient(assigns); const O = byClient(opps);
      return clients.map((c) => {
        const prof = (P[c.documentId] || [])[0];
        const as = A[c.documentId] || [];
        const lead = as.find((a) => a.role === 'account_lead');
        const mine = as.find((a) => a.sales_person?.documentId === crm.spId);
        const days = prof?.last_contact_at ? daysBetween(prof.last_contact_at, today()) : null;
        const open = O[c.documentId] || [];
        return {
          id: c.documentId,
          company_name: c.company_name,
          contact_person: c.contact_person,
          phone: c.phone,
          email: c.email,
          lifecycle: prof?.lifecycle || 'active',
          category: prof?.category || null,
          industry: prof?.industry || null,
          lead: lead ? { id: lead.sales_person?.documentId, name: lead.sales_person?.name } : null,
          my_role: mine?.role || null,
          open_deals: open.length,
          open_value: open.reduce((a, o) => a + num(o.expected_revenue), 0),
          last_contact_days: days,
          health: health(days, settings.cold_after_days),
        };
      });
    },

    async list(crm, { q, scope = 'visible', limit = 50, start = 0 } = {}) {
      let ids;
      if (scope === 'mine') ids = await this.myClientIds(crm);
      else ids = await access().visibleClientIds(crm);
      const filters = {};
      if (ids !== null) filters.documentId = { $in: ids.length ? ids : ['__none__'] };
      if (q) {
        filters.$or = [
          { company_name: { $containsi: q } }, { email: { $containsi: q } }, { phone: { $contains: q } },
          { clientTin: { $containsi: q } }, { bc_no: { $containsi: q } }, { contact_person: { $containsi: q } },
        ];
      }
      const [docs, total] = await Promise.all([
        store().find(UID.client, { filters, sort: ['company_name:asc'], limit: Math.min(Number(limit) || 50, 200), start: Number(start) || 0, fields: CLIENT_FIELDS }),
        store().count(UID.client, filters),
      ]);
      return { items: await this.enrich(crm, docs), total };
    },

    /** Company directory search: names and account leads only, for every role. */
    async directory(crm, { q }) {
      if (!q || String(q).trim().length < 2) return { items: [] };
      const docs = await store().find(UID.client, {
        filters: { company_name: { $containsi: String(q).trim() } }, sort: ['company_name:asc'], limit: 15, fields: ['company_name', 'phone'],
      });
      const visible = await access().visibleClientIds(crm);
      const rich = await this.enrich(crm, docs);
      return {
        items: rich.map((c) => ({
          id: c.id, company_name: c.company_name, lead: c.lead,
          in_my_list: visible === null || visible.includes(c.id),
        })),
      };
    },

    async checkDuplicates({ name, phone, email, tin }, excludeId) {
      const or = [];
      const tokens = dedupeKey(name).split(' ').filter((t) => t.length >= 3);
      tokens.slice(0, 3).forEach((t) => or.push({ company_name: { $containsi: t } }));
      if (email) or.push({ email: { $eqi: email } });
      if (tin) or.push({ clientTin: { $eqi: tin } });
      const p = normPhone(phone);
      if (p && p.length >= 9 && p !== '0700000000') or.push({ phone: { $contains: p.slice(-9) } });
      if (!or.length) return [];
      const candidates = await store().find(UID.client, { filters: { $or: or }, limit: 50, fields: CLIENT_FIELDS });
      return candidates
        .filter((c) => c.documentId !== excludeId)
        .map((c) => {
          const reasons = [];
          const sim = similarity(name, c.company_name);
          if (sim >= 0.6) reasons.push(sim === 1 ? 'Same name' : 'Similar name');
          if (email && c.email && c.email.toLowerCase() === String(email).toLowerCase()) reasons.push('Same email');
          if (tin && c.clientTin && c.clientTin.toLowerCase() === String(tin).toLowerCase()) reasons.push('Same TIN');
          if (p && p.length >= 9 && p !== '0700000000' && normPhone(c.phone).endsWith(p.slice(-9))) reasons.push('Same phone');
          return { id: c.documentId, company_name: c.company_name, phone: c.phone, email: c.email, reasons, score: sim };
        })
        .filter((c) => c.reasons.length)
        .sort((a, b) => b.reasons.length - a.reasons.length || b.score - a.score)
        .slice(0, 5);
    },

    /** Creates the client in the existing collection (only its own fields), plus CRM profile and assignment. */
    async create(crm, data) {
      const name = String(data.company_name || '').trim();
      if (!name) fail('Client name is required.');
      if (!data.force) {
        const dups = await this.checkDuplicates({ name, phone: data.phone, email: data.email, tin: data.clientTin });
        if (dups.length) return { created: false, duplicates: dups };
      }
      const client = await store().create(UID.client, {
        company_name: name,
        contact_person: data.contact_person || null,
        email: data.email || null,
        phone: data.phone || '0700000000',
        address: data.address || null,
        clientTin: data.clientTin || null,
        is_active: true,
      });
      await store().create(UID.clientProfile, {
        client: client.documentId,
        category: data.category || 'corporate',
        industry: data.industry || null,
        region: data.region || null,
        source: data.source || 'crm',
        lifecycle: 'prospect',
        dedupe_key: dedupeKey(name),
      });
      if (crm.spId) {
        await store().create(UID.assignment, {
          client: client.documentId, sales_person: crm.spId, role: 'account_lead',
          business_unit: crm.buId, start_date: today(), state: 'active', assigned_by: crm.profileId,
          reason: 'Created the client',
        });
      }
      if (data.contact_person) {
        await store().create(UID.contact, {
          client: client.documentId, name: data.contact_person, phone: data.phone || null,
          email: data.email || null, is_primary: true, decision_role: 'decision_maker',
        });
      }
      crm.cache = {};
      await audit().log(crm, 'client.create', UID.client, client.documentId, null, { company_name: name });
      return { created: true, client: { id: client.documentId, company_name: name } };
    },

    async updateProfile(crm, clientId, data) {
      await access().assertClient(crm, clientId);
      const p = await this.profileFor(clientId);
      const patch = {};
      ['category', 'industry', 'region', 'lifecycle', 'notes', 'source'].forEach((k) => { if (data[k] !== undefined) patch[k] = data[k]; });
      const out = await store().update(UID.clientProfile, p.documentId, patch);
      await audit().log(crm, 'client.profile.update', UID.clientProfile, p.documentId, p, patch);
      return out;
    },

    async addContact(crm, clientId, data) {
      await access().assertClient(crm, clientId);
      if (!data.name) fail('Contact name is required.');
      const c = await store().create(UID.contact, {
        client: clientId, name: data.name, designation: data.designation || null, department: data.department || null,
        phone: data.phone || null, email: data.email || null, decision_role: data.decision_role || 'other', is_primary: Boolean(data.is_primary),
      });
      return c;
    },

    /** Everything about one client on one screen (Client 360). */
    async get360(crm, clientId) {
      await access().assertClient(crm, clientId);
      const s = store();
      const settings = await config().settings();
      const client = await s.must(UID.client, clientId, { fields: CLIENT_FIELDS }, 'Client');
      const profile = await this.profileFor(clientId);
      const byClient = { client: { documentId: clientId } };
      const [assignments, contacts, opportunities, proposals, projects, interactions, invoices, lpos] = await Promise.all([
        s.find(UID.assignment, { filters: { ...byClient, state: 'active' }, populate: ['sales_person', 'business_unit'] }),
        s.find(UID.contact, { filters: { ...byClient, is_active: true }, sort: ['is_primary:desc', 'name:asc'] }),
        s.find(UID.opportunity, { filters: { ...byClient, is_archived: false }, populate: { stage: true, lead_sales_person: true, contributors: { populate: ['sales_person', 'business_unit'] } }, sort: ['updatedAt:desc'] }),
        s.find(UID.proposal, { filters: byClient, populate: { current_version: true, accepted_version: true, opportunity: { fields: ['title'] } }, sort: ['updatedAt:desc'] }),
        s.find(UID.project, { filters: byClient, populate: { workstreams: { fields: ['name', 'state', 'is_required'] } }, sort: ['updatedAt:desc'] }),
        s.find(UID.interaction, { filters: byClient, populate: { sales_person: { fields: ['name'] }, opportunity: { fields: ['title'] } }, sort: ['occurred_at:desc'], limit: 40 }),
        s.find(UID.invoice, { filters: byClient, populate: { project: { fields: ['name'] } }, sort: ['due_date:asc'] }),
        s.find(UID.lpo, { filters: byClient, populate: { version: { fields: ['version_number'] } } }),
      ]);

      // money summary (finance track)
      const accepted = proposals.filter((p) => p.accepted_version);
      const contracted = accepted.reduce((a, p) => a + num(p.accepted_version.net_total), 0);
      const invoiced = invoices.filter((i) => !['requested', 'cancelled'].includes(i.state)).reduce((a, i) => a + num(i.amount), 0);
      const outstanding = invoices.filter((i) => !['requested', 'cancelled', 'written_off'].includes(i.state)).reduce((a, i) => a + num(i.balance), 0);
      const overdue = invoices.filter((i) => num(i.balance) > 0 && i.due_date && i.due_date < today() && !['requested', 'cancelled', 'written_off'].includes(i.state));
      const overdueAmount = overdue.reduce((a, i) => a + num(i.balance), 0);

      // blockers: what needs action, with the action that fixes it
      const blockers = [];
      overdue.forEach((i) => blockers.push({
        track: 'finance', kind: 'invoice_overdue', ref: i.documentId,
        text: `${i.number || 'Invoice'} is ${daysBetween(i.due_date, today())} days overdue`, amount: num(i.balance), action: 'remind',
      }));
      proposals.forEach((p) => {
        const v = p.current_version;
        if (v && v.state === 'submitted' && v.valid_until && daysBetween(today(), v.valid_until) <= settings.reminder_days_before_expiry) {
          blockers.push({ track: 'sales', kind: 'quote_expiring', ref: v.documentId, text: `${p.reference} v${v.version_number} expires ${v.valid_until}`, action: 'extend' });
        }
        if (p.accepted_version && !lpos.some((l) => l.version?.documentId === p.accepted_version.documentId)) {
          blockers.push({ track: 'finance', kind: 'lpo_missing', ref: p.accepted_version.documentId, text: `LPO missing for ${p.reference} — billing is held`, action: 'upload_lpo' });
        }
      });
      const versionIds = proposals.map((p) => p.current_version?.documentId).filter(Boolean);
      if (versionIds.length) {
        const pend = await s.count(UID.approval, { version: { documentId: { $in: versionIds } }, decision: 'pending' });
        if (pend) blockers.push({ track: 'sales', kind: 'approval_pending', text: `${pend} approval${pend > 1 ? 's' : ''} pending on this client's quotes`, action: 'view' });
      }
      const dups = await this.checkDuplicates({ name: client.company_name, phone: client.phone, email: client.email, tin: client.clientTin }, clientId);

      return {
        client: { ...client, id: client.documentId },
        profile,
        team: assignments.map((a) => ({ id: a.documentId, role: a.role, since: a.start_date, sales_person: a.sales_person, business_unit: a.business_unit })),
        contacts,
        opportunities,
        proposals,
        projects,
        interactions,
        invoices,
        money: { contracted, invoiced, received: Math.max(0, invoiced - outstanding), outstanding, overdue: overdueAmount },
        blockers,
        duplicates: dups,
        last_contact_days: profile?.last_contact_at ? daysBetween(profile.last_contact_at, today()) : null,
      };
    },

    /** CRM-side merge: re-points CRM records only. Rows in the existing client table are never edited or deleted. */
    async merge(crm, sourceId, targetId) {
      if (!['executive', 'senior_manager', 'admin'].includes(crm.role)) forbid('Only senior managers or administrators can merge clients.');
      if (sourceId === targetId) fail('Pick two different clients.');
      await store().must(UID.client, sourceId, { fields: ['company_name'] }, 'Client');
      await store().must(UID.client, targetId, { fields: ['company_name'] }, 'Client');
      const moved = {};
      for (const key of CLIENT_LINKED) {
        const uid = UID[key];
        const docs = await store().find(uid, { filters: { client: { documentId: sourceId } }, limit: 5000, fields: ['createdAt'] });
        for (const d of docs) {
          const patch = { client: targetId };
          if (key === 'assignment') Object.assign(patch, { state: 'ended', end_date: today(), reason: 'Client merged' });
          await store().update(uid, d.documentId, patch);
        }
        moved[key] = docs.length;
      }
      const src = await this.profileFor(sourceId);
      const tgt = await this.profileFor(targetId);
      await store().update(UID.clientProfile, src.documentId, { merged_into: tgt.documentId, lifecycle: 'closed' });
      await audit().log(crm, 'client.merge', UID.client, sourceId, { source: sourceId }, { target: targetId, moved });
      return { merged: true, moved };
    },

    remindOverdue: async (crm, invoiceId) => {
      const inv = await store().must(UID.invoice, invoiceId, { populate: ['client'] }, 'Invoice');
      await access().assertClient(crm, inv.client?.documentId);
      await store().create(UID.interaction, {
        client: inv.client.documentId, kind: 'note', occurred_at: nowIso(), logged_by: crm.profileId, sales_person: crm.spId,
        summary: `Payment reminder sent for ${inv.number || 'invoice'} (balance ${num(inv.balance)}).`,
        next_action: 'Check payment received', next_action_type: 'follow_up', next_action_due: addDays(null, 3), next_action_owner: crm.profileId,
      });
      return { ok: true };
    },
  };
};
