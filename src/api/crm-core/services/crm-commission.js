'use strict';

/**
 * Rules-driven commission (blueprint 4.7, 7.5): accrued on acceptance from the
 * frozen lines and contributor shares, eligible as the client pays, approved
 * and paid by finance, reversed on bad debt. Salespeople see only their own.
 */
const { UID, num, money, round2, monthKey, nowIso, fail, forbid, uniq, fmtM } = require('../utils/crm-helpers');

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const config = () => strapi.service('api::crm-core.crm-config');
  const notify = () => strapi.service('api::crm-core.crm-notify');

  /** Most specific rule wins: product > business unit; role-specific > any. */
  function pickRule(policy, line, role) {
    const rules = policy?.rules || [];
    const score = (r) => {
      if (r.product && r.product.documentId !== line.product?.documentId) return -1;
      if (r.business_unit && r.business_unit.documentId !== (line.business_unit?.documentId || line.product?.business_unit?.documentId)) return -1;
      if (r.role && r.role !== 'any' && r.role !== role) return -1;
      return (r.product ? 4 : 0) + (r.business_unit ? 2 : 0) + (r.role && r.role !== 'any' ? 1 : 0);
    };
    return rules.map((r) => ({ r, s: score(r) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s)[0]?.r || null;
  }

  return {
    async accrueForVersion(crm, versionId) {
      const already = await store().count(UID.commissionEntry, { version: { documentId: versionId } });
      if (already) return { created: 0 };
      const policy = await config().commissionPolicy();
      if (!policy) return { created: 0, warning: 'No active commission policy.' };
      const v = await store().must(UID.version, versionId, {
        populate: {
          proposal: { populate: ['client', 'sales_person'] },
          lines: { populate: { product: { populate: ['business_unit'] }, business_unit: true, contributors: { populate: ['sales_person'] } } },
        },
      }, 'Proposal version');
      let created = 0;
      for (const line of v.lines || []) {
        let contributors = (line.contributors || []).filter((c) => c.sales_person);
        if (!contributors.length && v.proposal.sales_person) contributors = [{ sales_person: v.proposal.sales_person, role: 'originator', percentage: 100 }];
        const basis = policy.discount_treatment === 'ignore' ? num(line.selling_price) : num(line.net_price);
        for (const c of contributors) {
          const rule = pickRule(policy, line, c.role);
          const rate = num(rule?.rate ?? policy.default_rate);
          const weight = num(rule?.role_weight ?? 100);
          let amount = Math.round(basis * (rate / 100) * (num(c.percentage) / 100) * (weight / 100));
          if (rule?.cap && num(rule.cap) > 0) amount = Math.min(amount, num(rule.cap));
          const eligibleNow = policy.payment_trigger === 'acceptance';
          await store().create(UID.commissionEntry, {
            sales_person: c.sales_person.documentId, client: v.proposal.client.documentId, proposal_line: line.documentId,
            line_contributor: c.documentId || null, version: versionId, policy: policy.documentId, rule: rule?.documentId || null,
            role: c.role, basis_amount: money(basis), rate, share_pct: num(c.percentage), amount: money(amount),
            eligible_amount: money(eligibleNow ? amount : 0), paid_amount: '0', state: eligibleNow ? 'eligible' : 'accrued',
            period: monthKey(), rule_snapshot: { policy: policy.name, version: policy.version_label, basis: policy.basis, trigger: policy.payment_trigger, rule: rule?.name || 'default', rate, weight },
          });
          created += 1;
        }
      }
      await audit().log(crm, 'commission.accrue', UID.version, versionId, null, { entries: created, policy: policy.documentId });
      return { created };
    },

    /** Re-computes eligible amounts for every entry on the project this invoice belongs to. */
    async applyCollection(invoiceId) {
      const inv = await store().one(UID.invoice, invoiceId, { populate: { project: { populate: ['version'] } } });
      const versionId = inv?.project?.version?.documentId;
      if (!versionId) return { updated: 0 };
      const policy = await config().commissionPolicy();
      if (policy?.payment_trigger === 'acceptance') return { updated: 0 };
      const invoices = await store().find(UID.invoice, {
        filters: { project: { documentId: inv.project.documentId }, state: { $notIn: ['cancelled', 'written_off'] } },
        populate: { billing_item: { populate: { workstream: { populate: ['proposal_lines'] } } } },
      });
      const lines = await store().find(UID.line, { filters: { version: { documentId: versionId } } });
      const lineNet = Object.fromEntries(lines.map((l) => [l.documentId, num(l.net_price)]));
      const totalNet = lines.reduce((a, l) => a + num(l.net_price), 0) || 1;
      const credited = {};
      for (const i of invoices) {
        const pays = await store().find(UID.payment, { filters: { invoice: { documentId: i.documentId } } });
        const base = policy?.payment_trigger === 'invoiced' && !['requested'].includes(i.state) ? num(i.amount) : pays.reduce((a, p) => a + num(p.amount), 0);
        if (!base) continue;
        const wsLines = i.billing_item?.workstream?.proposal_lines || [];
        const targets = wsLines.length ? wsLines.map((l) => l.documentId) : lines.map((l) => l.documentId);
        const targetNet = targets.reduce((a, id) => a + (lineNet[id] || 0), 0) || totalNet;
        targets.forEach((id) => { credited[id] = (credited[id] || 0) + base * ((lineNet[id] || 0) / targetNet); });
      }
      const entries = await store().find(UID.commissionEntry, { filters: { version: { documentId: versionId }, state: { $in: ['accrued', 'eligible', 'approved'] } }, populate: ['proposal_line'], limit: 5000 });
      let updated = 0;
      for (const e of entries) {
        const lid = e.proposal_line?.documentId;
        const ratio = lineNet[lid] ? Math.min(1, (credited[lid] || 0) / lineNet[lid]) : 0;
        const eligible = Math.round(num(e.amount) * ratio);
        if (eligible !== num(e.eligible_amount)) {
          await store().update(UID.commissionEntry, e.documentId, { eligible_amount: money(eligible), state: e.state === 'approved' ? 'approved' : (eligible > 0 ? 'eligible' : 'accrued') });
          updated += 1;
        }
      }
      return { updated };
    },

    async reverseForInvoice(invoiceId, reason) {
      const policy = await config().commissionPolicy();
      if (policy?.bad_debt_treatment === 'keep') return { reversed: 0 };
      const inv = await store().one(UID.invoice, invoiceId, { populate: { project: { populate: ['version'] }, billing_item: { populate: { workstream: { populate: ['proposal_lines'] } } } } });
      const versionId = inv?.project?.version?.documentId;
      if (!versionId) return { reversed: 0 };
      const lineIds = (inv.billing_item?.workstream?.proposal_lines || []).map((l) => l.documentId);
      const filters = { version: { documentId: versionId }, state: { $in: ['accrued', 'eligible'] } };
      if (lineIds.length) filters.proposal_line = { documentId: { $in: lineIds } };
      const entries = await store().find(UID.commissionEntry, { filters, limit: 5000 });
      for (const e of entries) await store().update(UID.commissionEntry, e.documentId, { state: 'reversed', note: reason });
      return { reversed: entries.length };
    },

    async statement(crm, { sales_person: spQuery, period } = {}) {
      let spIds;
      if (crm.can.commission === 'all') spIds = spQuery ? [spQuery] : null;
      else if (crm.can.commission === 'team') {
        const team = await access().visibleSalesPersonIds(crm);
        if (spQuery && !team.includes(spQuery)) forbid('This person is not in your team.');
        spIds = spQuery ? [spQuery] : team;
      } else if (crm.can.commission === 'own') {
        if (!crm.spId) return { entries: [], totals: {} };
        if (spQuery && spQuery !== crm.spId) forbid('You can only see your own commission.');
        spIds = [crm.spId];
      } else forbid('Commission is not visible to your role.');
      const filters = {};
      if (spIds) filters.sales_person = { documentId: { $in: spIds.length ? spIds : ['__none__'] } };
      if (period) filters.period = period;
      const entries = await store().find(UID.commissionEntry, {
        filters, sort: ['createdAt:desc'], limit: 2000,
        populate: { client: { fields: ['company_name'] }, sales_person: { fields: ['name'] }, proposal_line: { fields: ['description', 'net_price'] }, policy: { fields: ['name', 'version_label'] } },
      });
      const sum = (k, f = () => true) => entries.filter(f).reduce((a, e) => a + num(e[k]), 0);
      const live = (e) => e.state !== 'reversed';
      const nextPayout = sum('eligible_amount', (e) => e.state === 'approved') - sum('paid_amount', (e) => e.state === 'approved');
      return {
        entries: entries.map((e) => ({
          ...e,
          explanation: `${fmtM(e.basis_amount)} × ${round2(e.rate)}% × ${round2(e.share_pct)}% share = ${fmtM(e.amount)}`,
          next: e.state === 'paid' ? 'Paid' : e.state === 'approved' ? 'In the next payroll' : e.state === 'eligible' ? 'Waiting for finance approval' : e.state === 'reversed' ? (e.note || 'Reversed') : 'Paid as the client pays',
        })),
        totals: {
          accrued: sum('amount', live), eligible: sum('eligible_amount', live), paid: sum('paid_amount', live),
          next_payout: Math.max(0, nextPayout), reversed: sum('amount', (e) => e.state === 'reversed'),
        },
        policy: entries[0]?.policy || null,
      };
    },

    async approve(crm, ids = []) {
      if (crm.role !== 'finance' && crm.role !== 'executive') forbid('Finance approves commission payouts.');
      let n = 0;
      for (const id of ids) {
        const e = await store().one(UID.commissionEntry, id);
        if (!e || e.state !== 'eligible') continue;
        await store().update(UID.commissionEntry, id, { state: 'approved', approved_by: crm.profileId, approved_at: nowIso() });
        n += 1;
      }
      await audit().log(crm, 'commission.approve', UID.commissionEntry, null, null, { ids });
      return { approved: n };
    },

    async markPaid(crm, ids = []) {
      if (crm.role !== 'finance') forbid('Finance records commission payouts.');
      let n = 0;
      for (const id of ids) {
        const e = await store().one(UID.commissionEntry, id, { populate: ['sales_person'] });
        if (!e || e.state !== 'approved') continue;
        const paid = num(e.eligible_amount);
        await store().update(UID.commissionEntry, id, { paid_amount: money(paid), paid_at: nowIso(), state: paid >= num(e.amount) ? 'paid' : 'eligible' });
        await notify().toSalesPersons([e.sales_person?.documentId], { event: 'commission.paid', title: `Commission paid: UGX ${fmtM(paid - num(e.paid_amount))}`, link: '/crm/earnings' });
        n += 1;
      }
      await audit().log(crm, 'commission.paid', UID.commissionEntry, null, null, { ids });
      return { paid: n };
    },

    async dispute(crm, entryId, reason) {
      const e = await store().must(UID.commissionEntry, entryId, { populate: ['sales_person'] }, 'Commission entry');
      if (crm.can.commission === 'own' && e.sales_person?.documentId !== crm.spId) forbid();
      if (!reason) fail('Explain what looks wrong.');
      const d = await store().create(UID.commissionDispute, { entry: entryId, claimant: crm.profileId, reason, state: 'open' });
      await notify().toRole('finance', { event: 'commission.dispute', title: `Commission dispute from ${crm.spName}`, body: reason, link: '/crm/earnings' }, crm.profileId);
      await audit().log(crm, 'commission.dispute', UID.commissionDispute, d.documentId, null, { entry: entryId, reason });
      return { dispute: { id: d.documentId } };
    },

    async decideDispute(crm, disputeId, { state, decision }) {
      if (!['finance', 'executive', 'senior_manager'].includes(crm.role)) forbid();
      if (!['upheld', 'rejected'].includes(state)) fail('Choose upheld or rejected.');
      await store().update(UID.commissionDispute, disputeId, { state, decision, decided_by: crm.profileId, decided_at: nowIso() });
      await audit().log(crm, 'commission.dispute.decide', UID.commissionDispute, disputeId, null, { state, decision });
      return { ok: true };
    },

    async disputes(crm) {
      const filters = crm.can.commission === 'own' ? { claimant: { documentId: crm.profileId } } : {};
      return store().find(UID.commissionDispute, { filters, populate: { entry: { populate: { client: { fields: ['company_name'] } } }, claimant: { fields: ['display_name'] } }, sort: ['createdAt:desc'], limit: 200 });
    },

    uniq,
  };
};
