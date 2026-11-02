'use strict';

/**
 * Production report — one row per print advert per run date, joining the
 * booking (client, sales person, payment) with Copy Desk (confirmation,
 * size, page, layout) and Design House (artwork) state.
 *
 *   POST /reports/production
 *   Body: { startDate, endDate, productId?, printAdClass? }   (run dates, max 93 days)
 *
 * Read-only. Used by the Copy Desk report, the Design House report and the
 * Booking Desk report's status views. Booking clerks only get rows for their
 * own bookings; every other allowed role sees all bookings.
 *
 * Adverts Copy Desk deferred away from a date in the range come back as
 * extra rows with copyDeskStatus 'deferred', so the date shows where they went.
 */

const {
  gateFilter,
  isISODate,
  requireRole,
  placementsFor,
  artworkFor,
  clearancesFor,
  parseBookedSize,
  sizeLabelOf,
  shapeClearance,
  LOCKED_STATUSES,
  CLEARANCE_UID,
  reply,
  todayISO,
} = require('../../_vgams-helpers/vgams-workflow');

const REPORT_ROLES = [
  'booking_clerk', 'sub_editor', 'design_house', 'design_house_manager',
  'advertising_manager', 'invoicing_officer', 'finance_team', 'sales_team',
];
const MAX_DAYS = 93;
const DAY_MS = 86400000;

const ADVERT_FIELDS = [
  'id', 'reference_number', 'bc_reference_number', 'advert_title', 'ad_size', 'ad_type',
  'status', 'start_date', 'end_date', 'publishing_dates', 'total_amount', 'payment_method',
  'print_ad_class', 'isPaid', 'isCanceled', 'invoice_stage', 'run_date_history', 'createdAt',
];
const ADVERT_POPULATE = {
  client: { fields: ['id', 'company_name'] },
  product: { fields: ['id', 'product_name'] },
  rate_card: { fields: ['id', 'size_dimension'] },
  vgams_user: { fields: ['id', 'name', 'email'] },
  vgams_sales_persons: { fields: ['id', 'name', 'email', 'bc_code'] },
};

function bodyOf(ctx) {
  const raw = ctx.request.body || {};
  return (raw.data && typeof raw.data === 'object') ? raw.data : raw;
}

function datesBetween(start, end) {
  const out = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

const daysFrom = (today, date) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);

/** Design batch (label, designer) and attach time per schedule row. */
async function scheduleDetailsFor(strapi, scheduleIds) {
  const out = new Map();
  const ids = [...new Set(scheduleIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const rows = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
    filters: { id: { $in: ids } },
    fields: ['id', 'createdAt', 'updatedAt'],
    populate: { source_batches: { fields: ['id', 'label'], populate: { designer: { fields: ['id', 'name', 'email'] } } } },
    limit: -1,
  });
  for (const r of rows) {
    const batch = (r.source_batches || [])[0] || null;
    out.set(r.id, {
      attachedAt: r.updatedAt || r.createdAt || null,
      batchLabel: batch?.label || '',
      designer: batch?.designer?.name || batch?.designer?.email || '',
    });
  }
  return out;
}

/** date → { all: {locked, code, status}, [productId]: {...} } from one publications query. */
async function layoutsByDate(strapi, dates) {
  const pubs = await strapi.entityService.findMany('api::pager-publication.pager-publication', {
    filters: { publication_date: { $in: dates } },
    fields: ['id', 'publication_code', 'publication_date', 'status'],
    populate: { product: { fields: ['id'] } },
    limit: -1,
  });
  const out = new Map();
  for (const p of pubs) {
    const m = out.get(p.publication_date) || [];
    m.push({ id: p.id, code: p.publication_code, status: p.status, productId: p.product?.id ?? null, locked: LOCKED_STATUSES.includes(p.status) });
    out.set(p.publication_date, m);
  }
  return out;
}

function baseRow(a, runDate) {
  const dates = (Array.isArray(a.publishing_dates) && a.publishing_dates.length ? a.publishing_dates : [a.start_date]).filter(Boolean).sort();
  const booked = parseBookedSize(a.ad_size) || parseBookedSize(a.rate_card?.size_dimension);
  const sales = a.vgams_sales_persons || [];
  return {
    key: `${a.id}:${runDate}`,
    advertId: a.id,
    runDate,
    reference: a.reference_number || '',
    bcReference: a.bc_reference_number || '',
    advertTitle: a.advert_title || '',
    clientName: a.client?.company_name || '—',
    productId: a.product?.id ?? null,
    productName: a.product?.product_name || '—',
    printAdClass: a.print_ad_class || 'unset',
    paymentMethod: a.payment_method || '',
    paymentStatus: a.isPaid ? 'Paid' : 'Unpaid',
    amount: Number(a.total_amount) || 0,
    bookedBy: a.vgams_user?.name || a.vgams_user?.email || '',
    salesPerson: sales.map(s => s.name || s.email).filter(Boolean).join(', ') || 'Unassigned',
    salesPersonCode: sales.map(s => s.bc_code).filter(Boolean).join(', '),
    bookedAt: a.createdAt || null,
    runIndex: dates.indexOf(runDate) + 1,
    runCount: dates.length,
    bookedSize: booked ? sizeLabelOf(booked.columns, booked.heightCm) : (a.ad_size || a.rate_card?.size_dimension || ''),
    invoiceStage: a.invoice_stage || 'not_ready',
  };
}

module.exports = {
  async production(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, REPORT_ROLES);
      if (!actor) return;

      const { startDate, endDate, productId, printAdClass } = bodyOf(ctx);
      if (!isISODate(startDate) || !isISODate(endDate) || startDate > endDate) {
        return reply(ctx, 400, { success: false, message: 'startDate and endDate (YYYY-MM-DD, start ≤ end) are required' });
      }
      const range = datesBetween(startDate, endDate);
      if (range.length > MAX_DAYS) {
        return reply(ctx, 400, { success: false, message: `Pick at most ${MAX_DAYS} days` });
      }
      const inRange = new Set(range);
      const mineOnly = actor.role === 'booking_clerk';

      const filters = {
        ...gateFilter(),
        isCanceled: false,
        product: { category: { category_type: 'print' }, ...(productId ? { id: Number(productId) } : {}) },
        start_date: { $lte: endDate },
        $or: [{ end_date: { $gte: startDate } }, { end_date: { $null: true } }],
        ...(printAdClass === 'display' || printAdClass === 'classified' ? { print_ad_class: printAdClass } : {}),
        ...(mineOnly ? { vgams_user: { id: actor.id } } : {}),
      };
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters, fields: ADVERT_FIELDS, populate: ADVERT_POPULATE, limit: -1,
      });

      // Advert × run date pairs inside the range
      const pairs = [];
      for (const a of adverts) {
        const dates = Array.isArray(a.publishing_dates) && a.publishing_dates.length ? a.publishing_dates : [a.start_date];
        for (const d of new Set(dates)) if (inRange.has(d)) pairs.push([a, d]);
      }

      // Deferred away from a date in range (the advert no longer runs that day)
      const deferredRows = await strapi.entityService.findMany(CLEARANCE_UID, {
        filters: { run_date: { $in: range }, status: 'deferred' },
        populate: { advert: { fields: ['id'] }, cleared_by: { fields: ['id', 'name', 'email'] }, size_preset: { fields: ['id', 'name'] }, publication: { fields: ['id'] } },
        limit: -1,
      });
      const knownIds = new Set(adverts.map(a => a.id));
      const extraIds = [...new Set(deferredRows.map(r => r.advert?.id).filter(id => id && !knownIds.has(id)))];
      const extra = extraIds.length
        ? await strapi.entityService.findMany('api::advert.advert', {
          filters: {
            id: { $in: extraIds },
            ...(mineOnly ? { vgams_user: { id: actor.id } } : {}),
            ...(productId ? { product: { id: Number(productId) } } : {}),
            ...(printAdClass === 'display' || printAdClass === 'classified' ? { print_ad_class: printAdClass } : {}),
          },
          fields: ADVERT_FIELDS, populate: ADVERT_POPULATE, limit: -1,
        })
        : [];
      const advertById = new Map([...adverts, ...extra].map(a => [a.id, a]));

      const ids = [...new Set(pairs.map(([a]) => a.id))];
      const [placements, artwork, clearances, layouts] = await Promise.all([
        placementsFor(strapi, ids, range),
        artworkFor(strapi, ids),
        clearancesFor(strapi, ids, range),
        layoutsByDate(strapi, range),
      ]);
      const scheduleIds = [];
      for (const list of artwork.values()) for (const s of list) if (inRange.has(s.runDate)) scheduleIds.push(s.scheduleId);
      const schedules = await scheduleDetailsFor(strapi, scheduleIds);

      const today = todayISO();
      const rows = [];

      for (const [a, runDate] of pairs) {
        const place = (placements.get(a.id) || []).find(p => p.publicationDate === runDate) || null;
        const art = (artwork.get(a.id) || []).find(s => s.runDate === runDate) || null;
        const cl = (clearances.get(a.id) || []).find(c => c.runDate === runDate && c.status !== 'deferred') || null;
        const dayLayouts = (layouts.get(runDate) || []).filter(l => !l.productId || l.productId === a.product?.id);
        const layoutLocked = dayLayouts.some(l => l.locked);
        const history = Array.isArray(a.run_date_history) ? a.run_date_history : [];
        const cameFrom = [...history].reverse().find(h => h.to === runDate) || null;
        const artworkState = art
          ? (art.dropped ? 'dropped' : (art.hasMedia ? (art.carried ? 'carried' : 'in') : 'awaiting'))
          : 'awaiting';
        const sched = art ? schedules.get(art.scheduleId) : null;
        const daysToRun = daysFrom(today, runDate);

        rows.push({
          ...baseRow(a, runDate),
          // Copy Desk
          copyDeskStatus: cl ? (cl.status === 'cleared' ? 'confirmed' : cl.status) : 'awaiting',
          confirmedSize: cl && cl.status !== 'withdrawn' ? (cl.presetName ? `${cl.presetName}${cl.sizeLabel && cl.sizeLabel !== cl.presetName ? ` · ${cl.sizeLabel}` : ''}` : (cl.sizeLabel || (cl.sizeMode === 'none' ? 'No size' : ''))) : '',
          pageFraction: cl?.pageFraction ?? null,
          position: cl?.position || '',
          sizeDiffersReason: cl?.sizeDiffersReason || '',
          confirmedBy: cl?.clearedBy || '',
          confirmedAt: cl?.clearedAt || null,
          changeNote: cl?.status === 'changed' ? (cl.changeNote || '') : '',
          withdrawnReason: cl?.status === 'withdrawn' ? (cl.withdrawnReason || '') : '',
          deferredFrom: cameFrom?.from || null,
          deferredTo: null,
          deferReason: cameFrom?.reason || '',
          // Pager
          onPager: !!place,
          pageNumber: place?.pageNumber ?? null,
          layoutCode: place?.publicationCode || (dayLayouts[0]?.code || ''),
          layoutStatus: dayLayouts.length === 0 ? 'none' : (layoutLocked ? 'confirmed' : 'open'),
          lateArrival: !place && layoutLocked,
          // Design House
          artwork: artworkState,
          artworkFiles: art?.mediaCount || 0,
          carriedFrom: art?.carriedFrom?.runDate || null,
          droppedReason: art?.droppedReason || '',
          attachedAt: art && art.mediaCount > 0 ? (sched?.attachedAt || null) : null,
          designer: sched?.designer || '',
          batchLabel: sched?.batchLabel || '',
          daysToRun,
          overdue: artworkState === 'awaiting' && daysToRun <= 0,
        });
      }

      for (const d of deferredRows) {
        const a = advertById.get(d.advert?.id);
        if (!a) continue;
        const c = shapeClearance(d);
        rows.push({
          ...baseRow(a, d.run_date),
          key: `${a.id}:${d.run_date}:deferred`,
          runIndex: null,
          copyDeskStatus: 'deferred',
          confirmedSize: c.presetName || c.sizeLabel || '',
          pageFraction: c.pageFraction,
          position: c.position || '',
          sizeDiffersReason: '',
          confirmedBy: c.clearedBy || '',
          confirmedAt: c.clearedAt,
          changeNote: '',
          withdrawnReason: '',
          deferredFrom: null,
          deferredTo: c.deferredTo,
          deferReason: c.deferReason || '',
          onPager: false,
          pageNumber: null,
          layoutCode: '',
          layoutStatus: (layouts.get(d.run_date) || []).some(l => l.locked) ? 'confirmed' : ((layouts.get(d.run_date) || []).length ? 'open' : 'none'),
          lateArrival: false,
          artwork: 'moved',
          artworkFiles: 0,
          carriedFrom: null,
          droppedReason: '',
          attachedAt: null,
          designer: '',
          batchLabel: '',
          daysToRun: daysFrom(today, d.run_date),
          overdue: false,
        });
      }

      rows.sort((x, y) => (x.runDate < y.runDate ? -1 : x.runDate > y.runDate ? 1 : x.advertId - y.advertId));

      return ctx.send({
        success: true,
        filters: { startDate, endDate, productId: productId || null, printAdClass: printAdClass || null, mineOnly },
        today,
        count: rows.length,
        data: rows,
      });
    } catch (error) {
      console.error('❌ production-report.production:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};
