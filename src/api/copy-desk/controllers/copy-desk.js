'use strict';

/**
 * Copy Desk (stored role: sub_editor) — workflow re-order, step 2
 *
 *   POST /copy-desk/bookings-by-date              cleared print bookings running on a date
 *   POST /copy-desk/confirm-layout                lock a publication (= layout confirmed)
 *   POST /copy-desk/reopen-layout                 unlock it again (reason required)
 *   GET  /pager-pages/:id/available-adverts-cleared  cleared-only feed for the Pager
 *
 * The ad layout itself is the existing pager-publication / pager-page model.
 * What changes is the source of its adverts: bookings come straight from the
 * clerk (cleared at booking) instead of waiting for Design House to attach.
 */

const { isPrintEligible } = require('../../_pager-helpers/pager-utils');
const {
  gateFilter,
  isISODate,
  requireRole,
  placementsFor,
  artworkFor,
  runDateStates,
  recomputeInvoiceStages,
  logWorkflow,
  LOCKED_STATUSES,
  reply,
} = require('../../_vgams-helpers/vgams-workflow');

const COPY_DESK_ROLES = ['sub_editor'];

function bodyOf(ctx) {
  const raw = ctx.request.body || {};
  return (raw.data && typeof raw.data === 'object') ? raw.data : raw;
}

/** Adverts sharing one ad-slot schedule row on a date must move together. */
async function slotMapFor(strapi, date) {
  const map = new Map();
  if (!date) return map;
  const rows = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
    filters: { run_date: date },
    populate: { adverts: { fields: ['id'] } },
    limit: -1,
  });
  for (const row of rows) {
    const ids = (row.adverts || []).map(a => a.id);
    if (ids.length <= 1) continue;
    for (const id of ids) map.set(id, { slotKey: `schedule:${row.id}`, slotSize: ids.length, allIds: ids });
  }
  return map;
}

/** Cleared, non-cancelled print adverts whose publishing_dates include `date`. */
async function clearedPrintAdvertsOn(strapi, date, { productId = null, printAdClass = null } = {}) {
  const productFilter = { category: { category_type: 'print' } };
  if (productId) productFilter.id = Number(productId);

  const filters = {
    ...gateFilter(),
    isCanceled: false,
    product: productFilter,
    start_date: { $lte: date },
  };
  if (printAdClass === 'display' || printAdClass === 'classified') filters.print_ad_class = printAdClass;

  const adverts = await strapi.entityService.findMany('api::advert.advert', {
    filters,
    fields: [
      'id', 'reference_number', 'bc_reference_number', 'advert_title', 'ad_size', 'ad_type',
      'status', 'start_date', 'end_date', 'publishing_dates', 'total_amount', 'payment_method',
      'print_ad_class', 'special_instructions', 'isPaid', 'production_cleared', 'invoice_stage',
    ],
    populate: {
      client: { fields: ['id', 'company_name'] },
      product: { fields: ['id', 'product_name'] },
      rate_card: { fields: ['id', 'ad_type', 'size_dimension'] },
    },
    sort: { createdAt: 'asc' },
    limit: -1,
  });

  return adverts.filter(a => Array.isArray(a.publishing_dates) && a.publishing_dates.includes(date));
}

module.exports = {

  /**
   * POST /copy-desk/bookings-by-date
   * Body: { date (required), productId?, publicationId?, printAdClass? }
   */
  async bookingsByDate(ctx) {
    try {
      const body = bodyOf(ctx);
      let { date, productId, publicationId, printAdClass } = body;

      let publication = null;
      if (publicationId) {
        publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', publicationId, {
          fields: ['id', 'publication_code', 'publication_date', 'masthead', 'status', 'total_pages'],
          populate: { product: { fields: ['id', 'product_name'] } },
        });
        if (!publication) return reply(ctx, 404, { success: false, message: `Publication ${publicationId} not found` });
        date = date || publication.publication_date;
        productId = productId || publication.product?.id || null;
      }
      if (!isISODate(date)) return reply(ctx, 400, { success: false, message: 'date is required (YYYY-MM-DD)' });

      const adverts = await clearedPrintAdvertsOn(strapi, date, { productId, printAdClass });
      const ids = adverts.map(a => a.id);
      const [placements, artwork, slotMap] = await Promise.all([
        placementsFor(strapi, ids, [date]),
        artworkFor(strapi, ids),
        slotMapFor(strapi, date),
      ]);

      const rows = adverts.map(a => {
        const state = runDateStates([date], placements.get(a.id), (artwork.get(a.id) || []).filter(x => x.runDate === date))[0];
        const sortedDates = [...a.publishing_dates].sort();
        return {
          id: a.id,
          reference: a.reference_number,
          bcReference: a.bc_reference_number || '',
          advertTitle: a.advert_title,
          clientName: a.client?.company_name || '—',
          productId: a.product?.id || null,
          productName: a.product?.product_name || '—',
          printAdClass: a.print_ad_class || null,
          adSize: a.ad_size,
          adType: a.ad_type,
          paymentMethod: a.payment_method,
          isPaid: !!a.isPaid,
          totalAmount: a.total_amount,
          specialInstructions: a.special_instructions || '',
          runIndex: sortedDates.indexOf(date) + 1,
          runCount: sortedDates.length,
          printEligible: isPrintEligible(a),
          placement: state.placed
            ? { publicationId: state.publicationId, pageNumber: state.pageNumber, masthead: state.masthead, status: state.publicationStatus }
            : null,
          artwork: state.artwork, // in | carried | awaiting | dropped
          scheduleId: state.scheduleId,
          slot: slotMap.get(a.id) || null,
          invoiceStage: a.invoice_stage || 'not_ready',
        };
      });

      const counts = {
        total: rows.length,
        display: rows.filter(r => r.printAdClass === 'display').length,
        classified: rows.filter(r => r.printAdClass === 'classified').length,
        unplaced: rows.filter(r => !r.placement).length,
        awaitingArtwork: rows.filter(r => r.artwork === 'awaiting' || r.artwork === 'dropped').length,
        byPaymentMethod: rows.reduce((acc, r) => ({ ...acc, [r.paymentMethod]: (acc[r.paymentMethod] || 0) + 1 }), {}),
      };

      return ctx.send({ success: true, date, publication, counts, data: rows });
    } catch (error) {
      console.error('❌ copy-desk.bookingsByDate:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /copy-desk/confirm-layout
   * Body: { publicationId, reason?, userEmail }
   * Same section check as PUT /pager-publications/:id/lock. If any placed
   * advert has no artwork for this date yet, a reason is required (it is
   * allowed — decision 1 Nov 2026 — but recorded).
   */
  async confirmLayout(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, COPY_DESK_ROLES);
      if (!actor) return;

      const { publicationId, reason } = bodyOf(ctx);
      if (!publicationId) return reply(ctx, 400, { success: false, message: 'publicationId is required' });

      const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', publicationId, {
        populate: { pages: { populate: { adverts: { fields: ['id', 'advert_title'] } } } },
      });
      if (!publication) return reply(ctx, 404, { success: false, message: 'Publication not found' });

      const pages = publication.pages || [];
      const noSection = pages.filter(p => !p.section);
      if (noSection.length > 0) {
        return reply(ctx, 400, {
          success: false,
          message: `Cannot confirm — ${noSection.length} page(s) have no section (e.g. page ${noSection[0].page_number})`,
        });
      }

      const date = publication.publication_date;
      const placed = pages.flatMap(p => (p.adverts || []).map(a => ({ advertId: a.id, title: a.advert_title, pageNumber: p.page_number })));
      const ids = [...new Set(placed.map(p => p.advertId))];
      const artwork = await artworkFor(strapi, ids);

      const missing = placed.filter(p => {
        const row = (artwork.get(p.advertId) || []).find(x => x.runDate === date);
        return !row || !row.hasMedia;
      });
      const trimmedReason = String(reason || '').trim();
      if (missing.length > 0 && !trimmedReason) {
        return reply(ctx, 400, {
          success: false,
          code: 'reason_required',
          message: `${missing.length} placed advert(s) have no artwork for ${date} yet. Give a reason to confirm anyway.`,
          missing,
        });
      }

      const previousStatus = publication.status;
      await strapi.entityService.update('api::pager-publication.pager-publication', publication.id, {
        data: { status: 'locked' },
      });

      // Mirror page numbers onto the advert's own schedule rows for this date
      for (const p of placed) {
        const row = (artwork.get(p.advertId) || []).find(x => x.runDate === date);
        if (row && row.page !== p.pageNumber) {
          await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', row.scheduleId, {
            data: { page: p.pageNumber },
          });
        }
      }

      const invoiceStages = await recomputeInvoiceStages(strapi, ids);
      for (const p of placed) {
        const isMissing = missing.some(m => m.advertId === p.advertId);
        await logWorkflow(strapi, {
          advertId: p.advertId,
          action: 'layout_confirmed',
          actorId: actor.id,
          previousStatus,
          newStatus: 'locked',
          notes: `Layout ${publication.publication_code || publication.id} (${date}) confirmed — page ${p.pageNumber}`
            + (isMissing ? ` — confirmed without artwork: ${trimmedReason}` : ''),
        });
      }

      return ctx.send({
        success: true,
        message: `Layout for ${date} confirmed (${ids.length} advert(s), ${missing.length} without artwork)`,
        publicationId: publication.id,
        status: 'locked',
        placedCount: ids.length,
        missingArtwork: missing,
        invoiceStages,
      });
    } catch (error) {
      console.error('❌ copy-desk.confirmLayout:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /copy-desk/reopen-layout
   * Body: { publicationId, reason (required), userEmail }
   * Sends a confirmed layout back to in_progress. Adverts that were only
   * 'ready' for invoicing because of this layout drop back to not_ready;
   * 'confirmed' / 'invoiced' adverts are left alone.
   */
  async reopenLayout(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, COPY_DESK_ROLES);
      if (!actor) return;

      const { publicationId, reason } = bodyOf(ctx);
      if (!publicationId) return reply(ctx, 400, { success: false, message: 'publicationId is required' });
      if (!String(reason || '').trim()) return reply(ctx, 400, { success: false, message: 'A reason is required to reopen a layout' });

      const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', publicationId, {
        populate: { pages: { populate: { adverts: { fields: ['id'] } } } },
      });
      if (!publication) return reply(ctx, 404, { success: false, message: 'Publication not found' });
      if (!LOCKED_STATUSES.includes(publication.status)) {
        return reply(ctx, 400, { success: false, message: `Layout is ${publication.status}, not confirmed` });
      }
      if (publication.status === 'published') {
        return reply(ctx, 400, { success: false, message: 'A published layout cannot be reopened' });
      }

      await strapi.entityService.update('api::pager-publication.pager-publication', publication.id, {
        data: { status: 'in_progress' },
      });

      const ids = [...new Set((publication.pages || []).flatMap(p => (p.adverts || []).map(a => a.id)))];
      const invoiceStages = await recomputeInvoiceStages(strapi, ids);
      for (const advertId of ids) {
        await logWorkflow(strapi, {
          advertId,
          action: 'layout_reopened',
          actorId: actor.id,
          previousStatus: publication.status,
          newStatus: 'in_progress',
          notes: `Layout ${publication.publication_code || publication.id} (${publication.publication_date}) reopened: ${String(reason).trim()}`,
        });
      }

      return ctx.send({ success: true, message: 'Layout reopened', publicationId: publication.id, status: 'in_progress', invoiceStages });
    } catch (error) {
      console.error('❌ copy-desk.reopenLayout:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * GET /pager-pages/:id/available-adverts-cleared
   * Same response shape as GET /pager-pages/:id/available-adverts
   * ({ data, groups, ungrouped }) but only cleared print adverts that are
   * booked to run on this publication's date and not yet placed in it.
   * The original route loads every advert in the system and is untouched.
   */
  async availableForPage(ctx) {
    try {
      const { id } = ctx.params;
      const page = await strapi.entityService.findOne('api::pager-page.pager-page', id, {
        populate: { publication: { populate: { product: { fields: ['id'] } } } },
      });
      if (!page) return ctx.notFound('Page not found');

      const publication = page.publication;
      const date = publication?.publication_date;
      if (!date) return ctx.send({ data: [], groups: [], ungrouped: [] });

      const siblingPages = await strapi.entityService.findMany('api::pager-page.pager-page', {
        filters: { publication: publication.id },
        populate: { adverts: { fields: ['id'] } },
        limit: -1,
      });
      const used = new Set(siblingPages.flatMap(p => (p.adverts || []).map(a => a.id)));

      const productId = ctx.query?.productId || publication.product?.id || null;
      const candidates = await clearedPrintAdvertsOn(strapi, date, { productId, printAdClass: ctx.query?.printAdClass || null });

      // Pager cards read client.company_name, as with the original route
      const withClient = await strapi.entityService.findMany('api::advert.advert', {
        filters: { id: { $in: candidates.map(a => a.id) } },
        populate: { client: true },
        limit: -1,
      });
      const available = withClient.filter(a => !used.has(a.id) && isPrintEligible(a));

      const slotMap = await slotMapFor(strapi, date);
      const groups = new Map();
      const ungrouped = [];
      for (const advert of available) {
        const slot = slotMap.get(advert.id);
        if (!slot) { ungrouped.push(advert); continue; }
        if (!groups.has(slot.slotKey)) groups.set(slot.slotKey, { slotKey: slot.slotKey, adverts: [] });
        groups.get(slot.slotKey).adverts.push(advert);
      }

      ctx.body = { data: available, groups: [...groups.values()], ungrouped };
    } catch (error) {
      console.error('❌ copy-desk.availableForPage:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};
