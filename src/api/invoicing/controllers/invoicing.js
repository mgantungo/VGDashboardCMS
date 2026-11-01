'use strict';

/**
 * Invoicing Officer — workflow re-order, step 5
 *
 *   POST /invoicing/queue        bookings by stage, split by payment method, with totals
 *   POST /invoicing/summary      totals only (header strip / Finance widget)
 *   POST /invoicing/:id/confirm  confirm one booking
 *   POST /invoicing/:id/invoice  create the VGAMS invoice for one booking
 *   POST /invoicing/bulk         confirm / invoice / both for a selection
 *
 * "Ready" is computed live from Copy Desk placement + Design House artwork,
 * so it is correct even for artwork attached through the original
 * /design-batches/:id/attach route. advert.invoice_stage stores the
 * officer's decisions (confirmed, invoiced) and caches 'ready'.
 *
 * Business Central is not touched (decision 1 Nov 2026: VGAMS-only for now).
 */

const {
  gateFilter,
  isISODate,
  todayISO,
  requireRole,
  placementsFor,
  artworkFor,
  runDateStates,
  logWorkflow,
  reply,
} = require('../../_vgams-helpers/vgams-workflow');

const INVOICING_ROLES = ['invoicing_officer', 'finance_team'];
const METHODS = ['credit', 'bank_transfer', 'cash', 'mobile_money', 'pdc'];
const STAGES = ['ready', 'held', 'confirmed', 'invoiced'];
const CREDIT_TERMS_DAYS = Number(process.env.VGAMS_CREDIT_TERMS_DAYS || 30);

function bodyOf(ctx) {
  const raw = ctx.request.body || {};
  return (raw.data && typeof raw.data === 'object') ? raw.data : raw;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

const ADVERT_FIELDS = [
  'id', 'reference_number', 'bc_reference_number', 'advert_title', 'ad_size', 'ad_type',
  'start_date', 'publishing_dates', 'total_amount', 'payment_method', 'print_ad_class',
  'isPaid', 'isCanceled', 'production_cleared', 'invoice_stage', 'invoice_confirmed_at', 'invoiced_at',
];

const ADVERT_POPULATE = {
  client: { fields: ['id', 'company_name'] },
  product: { fields: ['id', 'product_name'] },
  invoice_confirmed_by: { fields: ['id', 'name', 'email'] },
};

/** Load candidates and classify each into ready / held / confirmed / invoiced. */
async function buildQueue(strapi, { startDate, endDate, paymentMethod = null, productId = null }) {
  const productFilter = { category: { category_type: 'print' } };
  if (productId) productFilter.id = Number(productId);

  const filters = {
    ...gateFilter(),
    isCanceled: false,
    product: productFilter,
    start_date: { $lte: endDate },
  };
  if (paymentMethod && METHODS.includes(paymentMethod)) filters.payment_method = paymentMethod;

  const adverts = await strapi.entityService.findMany('api::advert.advert', {
    filters,
    fields: ADVERT_FIELDS,
    populate: ADVERT_POPULATE,
    sort: { start_date: 'asc' },
    limit: -1,
  });

  const inRange = d => d >= startDate && d <= endDate;
  const relevant = adverts.filter(a => {
    const dates = Array.isArray(a.publishing_dates) && a.publishing_dates.length ? a.publishing_dates : [a.start_date];
    if (a.invoice_stage === 'invoiced') {
      const at = a.invoiced_at ? String(a.invoiced_at).slice(0, 10) : null;
      return (at && inRange(at)) || dates.some(inRange);
    }
    return dates.some(inRange);
  });

  const ids = relevant.map(a => a.id);
  const [placements, artwork] = await Promise.all([placementsFor(strapi, ids), artworkFor(strapi, ids)]);

  return relevant.map(a => {
    const dates = Array.isArray(a.publishing_dates) && a.publishing_dates.length ? a.publishing_dates : [a.start_date];
    const states = runDateStates(dates, placements.get(a.id), artwork.get(a.id));
    const statesInRange = states.filter(s => inRange(s.date));
    const readyDates = statesInRange.filter(s => s.invoiceable).map(s => s.date);
    const heldDates = statesInRange.filter(s => s.locked && !s.invoiceable).map(s => s.date);

    let stage;
    if (a.invoice_stage === 'invoiced') stage = 'invoiced';
    else if (a.invoice_stage === 'confirmed') stage = 'confirmed';
    else if (readyDates.length > 0) stage = 'ready';
    else if (heldDates.length > 0) stage = 'held';
    else stage = null; // not on a confirmed layout yet — not the officer's work

    const firstReady = states.find(s => s.invoiceable);
    const art = firstReady
      ? (artwork.get(a.id) || []).find(x => x.scheduleId === firstReady.scheduleId)
      : null;

    return {
      id: a.id,
      reference: a.reference_number,
      bcReference: a.bc_reference_number || '',
      advertTitle: a.advert_title,
      clientName: a.client?.company_name || '—',
      productName: a.product?.product_name || '—',
      printAdClass: a.print_ad_class || null,
      adSize: a.ad_size,
      paymentMethod: a.payment_method || 'unknown',
      isPaid: !!a.isPaid,
      totalAmount: round2(a.total_amount),
      stage,
      storedStage: a.invoice_stage || 'not_ready',
      runDates: states,
      readyDates,
      heldDates,
      artworkPreview: art?.media?.[0] || null,
      confirmedBy: a.invoice_confirmed_by?.name || null,
      confirmedAt: a.invoice_confirmed_at || null,
      invoicedAt: a.invoiced_at || null,
    };
  }).filter(r => r.stage !== null);
}

function groupByMethod(rows) {
  const groups = {};
  for (const m of [...METHODS, 'unknown']) groups[m] = { paymentMethod: m, count: 0, amount: 0 };
  for (const r of rows) {
    const g = groups[r.paymentMethod] || (groups[r.paymentMethod] = { paymentMethod: r.paymentMethod, count: 0, amount: 0 });
    g.count += 1;
    g.amount += r.totalAmount;
  }
  return Object.values(groups)
    .filter(g => g.count > 0 || METHODS.includes(g.paymentMethod))
    .map(g => ({ ...g, amount: round2(g.amount) }));
}

function stageTotals(rows) {
  return Object.fromEntries(STAGES.map(s => {
    const subset = rows.filter(r => r.stage === s);
    return [s, { count: subset.length, amount: round2(subset.reduce((t, r) => t + r.totalAmount, 0)), byMethod: groupByMethod(subset) }];
  }));
}

function validateRange(ctx, body) {
  const startDate = body.startDate || todayISO();
  const endDate = body.endDate || startDate;
  if (!isISODate(startDate) || !isISODate(endDate) || startDate > endDate) {
    reply(ctx, 400, { success: false, message: 'startDate / endDate must be YYYY-MM-DD with startDate ≤ endDate' });
    return null;
  }
  return { startDate, endDate };
}

/** Live readiness check for one advert (used by confirm). */
async function readinessOf(strapi, advert) {
  const dates = Array.isArray(advert.publishing_dates) && advert.publishing_dates.length ? advert.publishing_dates : [advert.start_date];
  const [placements, artwork] = await Promise.all([placementsFor(strapi, [advert.id]), artworkFor(strapi, [advert.id])]);
  const states = runDateStates(dates, placements.get(advert.id), artwork.get(advert.id));
  return { states, ready: states.some(s => s.invoiceable) };
}

async function confirmOne(strapi, advertId, actor, notes = '') {
  const advert = await strapi.entityService.findOne('api::advert.advert', advertId, { fields: ADVERT_FIELDS });
  if (!advert) return { advertId, ok: false, message: 'Advert not found' };
  if (advert.isCanceled) return { advertId, ok: false, message: 'Advert is cancelled' };
  if (advert.invoice_stage === 'invoiced') return { advertId, ok: false, message: 'Already invoiced' };
  if (advert.invoice_stage === 'confirmed') return { advertId, ok: true, message: 'Already confirmed', stage: 'confirmed' };

  const { ready, states } = await readinessOf(strapi, advert);
  if (!ready) {
    return {
      advertId, ok: false,
      message: 'Not ready: needs a confirmed Copy Desk layout and artwork for at least one run date',
      runDates: states,
    };
  }

  await strapi.entityService.update('api::advert.advert', advert.id, {
    data: { invoice_stage: 'confirmed', invoice_confirmed_by: actor.id, invoice_confirmed_at: new Date() },
  });
  await logWorkflow(strapi, {
    advertId: advert.id,
    action: 'invoice_confirmed',
    actorId: actor.id,
    previousStatus: advert.invoice_stage || 'not_ready',
    newStatus: 'confirmed',
    notes: `Booking confirmed for invoicing (${advert.payment_method})${notes ? ` — ${notes}` : ''}`,
  });
  return { advertId: advert.id, ok: true, stage: 'confirmed' };
}

async function invoiceOne(strapi, advertId, actor, { dueDate = null, notes = '' } = {}) {
  const advert = await strapi.entityService.findOne('api::advert.advert', advertId, {
    fields: ADVERT_FIELDS,
    populate: { client: { fields: ['id'] } },
  });
  if (!advert) return { advertId, ok: false, message: 'Advert not found' };
  if (advert.invoice_stage === 'invoiced') return { advertId, ok: true, message: 'Already invoiced', stage: 'invoiced' };
  if (advert.invoice_stage !== 'confirmed') return { advertId, ok: false, message: 'Confirm the booking before invoicing it' };

  const today = todayISO();
  const total = round2(advert.total_amount);
  const onTerms = ['credit', 'pdc'].includes(advert.payment_method);
  const due = isISODate(dueDate) ? dueDate : (onTerms ? addDays(today, CREDIT_TERMS_DAYS) : today);

  // One invoice per advert. A BC-confirmed invoice (bc-sync-monitor) may
  // already exist — keep its number and never downgrade a paid status.
  const existing = await strapi.db.query('api::invoice.invoice').findOne({ where: { advert: advert.id } });
  let invoice;
  if (existing) {
    const alreadyPaid = existing.payment_status === 'paid';
    invoice = await strapi.db.query('api::invoice.invoice').update({
      where: { id: existing.id },
      data: {
        total_amount: total,
        ...(alreadyPaid ? {} : {
          amount_paid: advert.isPaid ? total : (Number(existing.amount_paid) || 0),
          balance: advert.isPaid ? 0 : round2(total - (Number(existing.amount_paid) || 0)),
          payment_status: advert.isPaid ? 'paid' : 'unpaid',
          due_date: due,
        }),
      },
    });
  } else {
    const safeRef = String(advert.reference_number || advert.id).replace(/[^A-Za-z0-9\-_.~]/g, '-');
    invoice = await strapi.db.query('api::invoice.invoice').create({
      data: {
        advert: advert.id,
        client: advert.client?.id || null,
        invoice_number: `VG-INV-${safeRef}`,
        invoice_date: today,
        due_date: due,
        total_amount: total,
        amount_paid: advert.isPaid ? total : 0,
        balance: advert.isPaid ? 0 : total,
        payment_status: advert.isPaid ? 'paid' : 'unpaid',
        currency: 'UGX',
      },
    });
  }

  await strapi.entityService.update('api::advert.advert', advert.id, {
    data: { invoice_stage: 'invoiced', invoiced_at: new Date(), invoice: invoice.id },
  });
  await logWorkflow(strapi, {
    advertId: advert.id,
    action: 'invoiced',
    actorId: actor.id,
    previousStatus: 'confirmed',
    newStatus: 'invoiced',
    notes: `Invoice ${invoice.invoice_number} (${advert.payment_method}, ${invoice.payment_status}, due ${invoice.due_date || due})${notes ? ` — ${notes}` : ''}`,
  });

  return {
    advertId: advert.id,
    ok: true,
    stage: 'invoiced',
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      paymentStatus: invoice.payment_status,
      dueDate: invoice.due_date,
      totalAmount: invoice.total_amount,
    },
  };
}

module.exports = {

  /**
   * POST /invoicing/queue
   * Body: { startDate?, endDate?, stage? (ready|held|confirmed|invoiced), paymentMethod?, productId? }
   */
  async queue(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, INVOICING_ROLES);
      if (!actor) return;
      const body = bodyOf(ctx);
      const range = validateRange(ctx, body);
      if (!range) return;

      const all = await buildQueue(strapi, { ...range, paymentMethod: body.paymentMethod, productId: body.productId });
      const stage = STAGES.includes(body.stage) ? body.stage : 'ready';
      const rows = all.filter(r => r.stage === stage);

      return ctx.send({
        success: true,
        filters: { ...range, stage, paymentMethod: body.paymentMethod || null },
        groups: groupByMethod(rows),
        totals: { count: rows.length, amount: round2(rows.reduce((t, r) => t + r.totalAmount, 0)) },
        stages: stageTotals(all),
        data: rows,
      });
    } catch (error) {
      console.error('❌ invoicing.queue:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /** POST /invoicing/summary  Body: { startDate?, endDate? } */
  async summary(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, INVOICING_ROLES);
      if (!actor) return;
      const body = bodyOf(ctx);
      const range = validateRange(ctx, body);
      if (!range) return;
      const all = await buildQueue(strapi, range);
      return ctx.send({ success: true, filters: range, stages: stageTotals(all) });
    } catch (error) {
      console.error('❌ invoicing.summary:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /** POST /invoicing/:id/confirm  Body: { notes?, userEmail } */
  async confirm(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, INVOICING_ROLES);
      if (!actor) return;
      const result = await confirmOne(strapi, Number(ctx.params.id), actor, String(bodyOf(ctx).notes || '').trim());
      return result.ok ? ctx.send({ success: true, ...result }) : reply(ctx, 400, { success: false, ...result });
    } catch (error) {
      console.error('❌ invoicing.confirm:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /** POST /invoicing/:id/invoice  Body: { dueDate?, notes?, confirm?: true, userEmail } */
  async invoice(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, INVOICING_ROLES);
      if (!actor) return;
      const body = bodyOf(ctx);
      const id = Number(ctx.params.id);
      const notes = String(body.notes || '').trim();

      if (body.confirm === true || body.confirm === 'true') {
        const c = await confirmOne(strapi, id, actor, notes);
        if (!c.ok) return reply(ctx, 400, { success: false, ...c });
      }
      const result = await invoiceOne(strapi, id, actor, { dueDate: body.dueDate, notes });
      return result.ok ? ctx.send({ success: true, ...result }) : reply(ctx, 400, { success: false, ...result });
    } catch (error) {
      console.error('❌ invoicing.invoice:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /invoicing/bulk
   * Body: { advertIds: number[], action: 'confirm' | 'invoice' | 'confirm_and_invoice', dueDate?, notes?, userEmail }
   * Each row succeeds or fails on its own; the response lists both.
   */
  async bulk(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, INVOICING_ROLES);
      if (!actor) return;
      const body = bodyOf(ctx);
      const ids = [...new Set((Array.isArray(body.advertIds) ? body.advertIds : []).map(Number).filter(Boolean))];
      const action = body.action;
      if (ids.length === 0) return reply(ctx, 400, { success: false, message: 'advertIds must be a non-empty array' });
      if (!['confirm', 'invoice', 'confirm_and_invoice'].includes(action)) {
        return reply(ctx, 400, { success: false, message: "action must be 'confirm', 'invoice' or 'confirm_and_invoice'" });
      }
      const notes = String(body.notes || '').trim();

      const results = [];
      for (const id of ids) {
        try {
          if (action === 'confirm') {
            results.push(await confirmOne(strapi, id, actor, notes));
          } else if (action === 'invoice') {
            results.push(await invoiceOne(strapi, id, actor, { dueDate: body.dueDate, notes }));
          } else {
            const c = await confirmOne(strapi, id, actor, notes);
            results.push(c.ok ? await invoiceOne(strapi, id, actor, { dueDate: body.dueDate, notes }) : c);
          }
        } catch (rowErr) {
          results.push({ advertId: id, ok: false, message: rowErr.message });
        }
      }

      const okCount = results.filter(r => r.ok).length;
      return ctx.send({
        success: okCount > 0,
        message: `${okCount} of ${ids.length} done`,
        succeeded: okCount,
        failed: ids.length - okCount,
        results,
      });
    } catch (error) {
      console.error('❌ invoicing.bulk:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};
