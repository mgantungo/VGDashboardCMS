'use strict';

/**
 * Billing schedule → invoice request → finance system → invoice/payment mirror.
 * The finance system stays the source of truth; this service requests,
 * mirrors and reconciles (blueprint 4.5, 7.5 and 10).
 */
const { UID, num, money, today, nowIso, daysBetween, fail, forbid, fmtM } = require('../utils/crm-helpers');

const FINANCE_ROLES = ['finance', 'executive', 'senior_manager'];

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const notify = () => strapi.service('api::crm-core.crm-notify');
  const approvals = () => strapi.service('api::crm-core.crm-approvals');
  const commission = () => strapi.service('api::crm-core.crm-commission');

  async function integrationLog(entry) {
    try { return await store().create(UID.integrationLog, entry); } catch (e) { strapi.log.warn(`[crm] integration log failed: ${e.message}`); return null; }
  }

  /** Adapter: send an invoice request to the finance system (webhook), or queue it for manual entry. */
  async function sendToFinance(invoice, project, client) {
    const url = process.env.CRM_FINANCE_WEBHOOK_URL;
    const payload = {
      crm_invoice_id: invoice.documentId, amount: num(invoice.amount), currency: 'UGX',
      client: { id: client?.documentId, name: client?.company_name, bc_no: client?.bc_no || null, tin: client?.clientTin || null },
      project: project ? { id: project.documentId, name: project.name } : null,
      reference: invoice.documentId,
    };
    if (!url || typeof fetch !== 'function') {
      await integrationLog({ system: 'finance', direction: 'outbound', record_type: 'invoice', record_id: invoice.documentId, outcome: 'queued', payload, error: 'No finance webhook configured: enter in the finance system, then mark issued.' });
      return 'queued';
    }
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-crm-secret': process.env.CRM_FINANCE_WEBHOOK_SECRET || '' }, body: JSON.stringify(payload) });
      const text = await res.text();
      await integrationLog({ system: 'finance', direction: 'outbound', record_type: 'invoice', record_id: invoice.documentId, outcome: res.ok ? 'sent' : 'failed', payload, response: { status: res.status, body: text.slice(0, 2000) }, attempts: 1 });
      return res.ok ? 'sent' : 'failed';
    } catch (e) {
      await integrationLog({ system: 'finance', direction: 'outbound', record_type: 'invoice', record_id: invoice.documentId, outcome: 'failed', payload, error: e.message, attempts: 1 });
      return 'failed';
    }
  }

  return {
    async overview(crm) {
      if (![...FINANCE_ROLES, 'admin'].includes(crm.role)) forbid('Finance views are for finance and senior management.');
      const [billing, invoices] = await Promise.all([
        store().find(UID.billingItem, {
          filters: { state: { $in: ['not_billed', 'requested'] } },
          populate: { project: { populate: { client: { fields: ['company_name'] } }, fields: ['name'] }, workstream: { fields: ['name', 'state'] } },
          sort: ['due_date:asc'], limit: 300,
        }),
        store().find(UID.invoice, { filters: { state: { $notIn: ['cancelled'] } }, populate: { client: { fields: ['company_name'] }, project: { fields: ['name'] } }, sort: ['due_date:asc'], limit: 1000 }),
      ]);
      const t = today();
      const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
      invoices.filter((i) => num(i.balance) > 0 && !['requested', 'written_off'].includes(i.state)).forEach((i) => {
        const late = i.due_date ? daysBetween(i.due_date, t) : 0;
        const b = num(i.balance);
        if (late <= 0) aging.current += b; else if (late <= 30) aging.d1_30 += b; else if (late <= 60) aging.d31_60 += b; else if (late <= 90) aging.d61_90 += b; else aging.d90_plus += b;
      });
      const monthStart = `${t.slice(0, 7)}-01`;
      const payments = await store().find(UID.payment, { filters: { paid_on: { $gte: monthStart } }, limit: 2000 });
      const lpoReady = {};
      for (const b of billing) lpoReady[b.documentId] = await this.billingReadiness(b);
      return {
        ready_to_bill: billing.filter((b) => b.state === 'not_billed' && b.due_date && b.due_date <= t).map((b) => ({ ...b, readiness: lpoReady[b.documentId] })),
        upcoming: billing.filter((b) => b.state === 'not_billed' && (!b.due_date || b.due_date > t)).slice(0, 50).map((b) => ({ ...b, readiness: lpoReady[b.documentId] })),
        requested: invoices.filter((i) => i.state === 'requested'),
        open_invoices: invoices.filter((i) => ['issued', 'part_paid', 'overdue'].includes(i.state)),
        aging,
        collected_this_month: payments.reduce((a, p) => a + num(p.amount), 0),
      };
    },

    /** Required-document rule for billing: verified LPO, signed contract, or approved exception. */
    async billingReadiness(billingItem) {
      if (billingItem.lpo_exception_approved) return { ok: true, why: 'Exception approved' };
      const rule = await store().first(UID.docRule, { filters: { applies_to: 'billing', is_active: true } });
      if (!rule || !rule.blocks) return { ok: true };
      const item = billingItem.project?.version ? billingItem : await store().one(UID.billingItem, billingItem.documentId, { populate: { project: { populate: ['version'] } } });
      const versionId = item.project?.version?.documentId;
      if (!versionId) return { ok: false, why: 'LPO missing — billing held' };
      const [lpo, contract] = await Promise.all([
        store().count(UID.lpo, { version: { documentId: versionId }, verification: { $in: ['verified', 'exception_approved'] } }),
        store().count(UID.contract, { version: { documentId: versionId }, state: { $in: ['signed', 'active'] } }),
      ]);
      return lpo + contract > 0 ? { ok: true } : { ok: false, why: 'LPO missing — billing held', exception_allowed: rule.exception_allowed };
    },

    async requestInvoice(crm, billingItemId) {
      if (![...FINANCE_ROLES, 'project_manager', 'supervisor'].includes(crm.role)) forbid('Your role cannot request invoices.');
      const b = await store().must(UID.billingItem, billingItemId, { populate: { project: { populate: ['client', 'version'] }, workstream: true } }, 'Billing item');
      await access().assertClient(crm, b.project?.client?.documentId);
      if (b.state !== 'not_billed') fail('An invoice has already been requested for this item.');
      const ready = await this.billingReadiness(b);
      if (!ready.ok) fail(`${ready.why}. Upload the LPO, or ask for an exception.`, { code: 'LPO_MISSING', exception_allowed: ready.exception_allowed });
      const lpo = await store().first(UID.lpo, { filters: { version: { documentId: b.project.version?.documentId } } });
      const contract = await store().first(UID.contract, { filters: { version: { documentId: b.project.version?.documentId } } });
      const client = await store().one(UID.client, b.project.client.documentId);
      const invoice = await store().create(UID.invoice, {
        client: client.documentId, billing_item: billingItemId, project: b.project.documentId, lpo: lpo?.documentId || null, contract: contract?.documentId || null,
        amount: money(b.amount), balance: money(b.amount), state: 'requested',
      });
      await store().update(UID.billingItem, billingItemId, { state: 'requested', invoice: invoice.documentId });
      const sent = await sendToFinance(invoice, b.project, client);
      await audit().log(crm, 'invoice.request', UID.invoice, invoice.documentId, null, { amount: num(b.amount), billing_item: billingItemId, sent });
      if (crm.role !== 'finance') await notify().toRole('finance', { event: 'invoice.requested', title: `Invoice requested: ${client.company_name}`, body: `${b.label} · UGX ${fmtM(b.amount)}`, link: '/crm/finance' });
      return { invoice: { id: invoice.documentId }, sent };
    },

    async requestBillingException(crm, billingItemId, reason) {
      const b = await store().must(UID.billingItem, billingItemId, { populate: { project: { populate: ['client'] } } }, 'Billing item');
      await access().assertClient(crm, b.project?.client?.documentId);
      if (!reason) fail('Explain why billing should go ahead without the LPO.');
      await approvals().request(crm, { trigger_type: 'lpo_exception', detail: `Bill ${b.label} without LPO: ${reason}`, subject_type: 'billing_item', subject_id: billingItemId });
      return { requested: true };
    },

    async onBillingExceptionDecision(crm, billingItemId, decision) {
      if (decision === 'approved') await store().update(UID.billingItem, billingItemId, { lpo_exception_approved: true });
      return { decision };
    },

    async markIssued(crm, invoiceId, data) {
      if (!FINANCE_ROLES.includes(crm.role)) forbid('Only finance can record issued invoices.');
      const inv = await store().must(UID.invoice, invoiceId, { populate: ['billing_item'] }, 'Invoice');
      await store().update(UID.invoice, invoiceId, {
        number: data.number || inv.number, external_id: data.external_id || inv.external_id, issued_on: data.issued_on || today(),
        due_date: data.due_date || inv.due_date, state: 'issued', cms_invoice: data.cms_invoice || null, tax: money(data.tax || inv.tax || 0),
        last_synced_at: nowIso(),
      });
      if (inv.billing_item) await store().update(UID.billingItem, inv.billing_item.documentId, { state: 'invoiced' });
      await audit().log(crm, 'invoice.issued', UID.invoice, invoiceId, { state: inv.state }, data);
      return this.recompute(invoiceId);
    },

    async recordPayment(crm, invoiceId, data) {
      if (!FINANCE_ROLES.includes(crm.role)) forbid('Only finance can record payments.');
      if (!(num(data.amount) > 0)) fail('Enter the amount received.');
      const p = await store().create(UID.payment, {
        invoice: invoiceId, amount: money(data.amount), paid_on: data.paid_on || today(), method: data.method || 'bank',
        reference: data.reference || null, external_id: data.external_id || null,
      });
      await audit().log(crm, 'payment.record', UID.payment, p.documentId, null, { invoice: invoiceId, amount: num(data.amount) });
      return this.recompute(invoiceId);
    },

    /** Balance, state and billing-item state from payments; then commission eligibility. */
    async recompute(invoiceId) {
      const inv = await store().must(UID.invoice, invoiceId, { populate: ['billing_item'] }, 'Invoice');
      const pays = await store().find(UID.payment, { filters: { invoice: { documentId: invoiceId } }, limit: 1000 });
      const paid = pays.reduce((a, p) => a + num(p.amount), 0);
      const balance = Math.max(0, num(inv.amount) - paid);
      let state = inv.state;
      if (!['cancelled', 'written_off', 'requested'].includes(state) || paid > 0) {
        if (balance === 0 && num(inv.amount) > 0) state = 'paid';
        else if (paid > 0) state = 'part_paid';
        else if (inv.due_date && inv.due_date < today()) state = 'overdue';
        else if (state === 'requested' && inv.number) state = 'issued';
      }
      await store().update(UID.invoice, invoiceId, { balance: money(balance), state });
      if (inv.billing_item) {
        const bstate = state === 'paid' ? 'paid' : state === 'part_paid' ? 'part_paid' : state === 'overdue' ? 'overdue' : (state === 'issued' ? 'invoiced' : inv.billing_item.state);
        await store().update(UID.billingItem, inv.billing_item.documentId, { state: bstate });
      }
      await commission().applyCollection(invoiceId);
      return { invoice: { id: invoiceId, state, balance, paid } };
    },

    /** Inbound sync from the finance system (webhook). Upserts invoices and payments by external id. */
    async sync(payload = {}) {
      const results = [];
      for (const row of payload.invoices || []) {
        let inv = null;
        if (row.crm_invoice_id) inv = await store().one(UID.invoice, row.crm_invoice_id);
        if (!inv && row.external_id) inv = await store().first(UID.invoice, { filters: { external_id: row.external_id } });
        if (!inv) { results.push({ external_id: row.external_id, ok: false, error: 'Unknown invoice' }); continue; }
        await store().update(UID.invoice, inv.documentId, {
          number: row.number ?? inv.number, external_id: row.external_id ?? inv.external_id, issued_on: row.issued_on ?? inv.issued_on,
          due_date: row.due_date ?? inv.due_date, amount: row.amount !== undefined ? money(row.amount) : inv.amount,
          tax: row.tax !== undefined ? money(row.tax) : inv.tax, state: row.state || (inv.state === 'requested' && row.number ? 'issued' : inv.state),
          last_synced_at: nowIso(),
        });
        for (const p of row.payments || []) {
          const exists = p.external_id ? await store().first(UID.payment, { filters: { external_id: p.external_id } }) : null;
          if (!exists) {
            await store().create(UID.payment, { invoice: inv.documentId, amount: money(p.amount), paid_on: p.paid_on || today(), method: p.method || 'bank', reference: p.reference || null, external_id: p.external_id || null });
          }
        }
        if (row.state === 'written_off') await commission().reverseForInvoice(inv.documentId, 'Bad debt written off');
        results.push({ id: inv.documentId, ...(await this.recompute(inv.documentId)).invoice });
      }
      await integrationLog({ system: 'finance', direction: 'inbound', record_type: 'invoice', outcome: 'ok', payload: { count: (payload.invoices || []).length }, response: { results: results.slice(0, 50) } });
      return { results };
    },

    async writeOff(crm, invoiceId, reason) {
      if (!FINANCE_ROLES.includes(crm.role)) forbid();
      await store().update(UID.invoice, invoiceId, { state: 'written_off' });
      await commission().reverseForInvoice(invoiceId, reason || 'Written off');
      await audit().log(crm, 'invoice.write_off', UID.invoice, invoiceId, null, { reason });
      return { ok: true };
    },

    async markOverdue() {
      const t = today();
      const late = await store().find(UID.invoice, { filters: { state: { $in: ['issued', 'part_paid'] }, due_date: { $lt: t } }, populate: ['billing_item'], limit: 5000 });
      for (const i of late) {
        if (num(i.balance) <= 0) continue;
        await store().update(UID.invoice, i.documentId, { state: 'overdue' });
        if (i.billing_item) await store().update(UID.billingItem, i.billing_item.documentId, { state: 'overdue' });
      }
      return { overdue: late.length };
    },
  };
};
