// src/api/_vgams-helpers/vgams-workflow.js
//
// Shared helpers for the print workflow re-order:
//   Booking → Copy Desk layout → Design (parallel) → Artwork → Invoicing.
//
// Plain CommonJS module (not a Strapi service) so it can be required from
// lifecycles, controllers in any api folder, and the standalone scripts in
// /scripts alike. Every function that touches the DB takes `strapi` as its
// first argument rather than relying on the global.
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Production gate
// ─────────────────────────────────────────────────────────────────────────────
//
// VGAMS_PRODUCTION_GATE=paid     → legacy behaviour (isPaid gates Design / editor)
// VGAMS_PRODUCTION_GATE=cleared  → production_cleared gates them instead
//
// Read on every call so a .env change + restart flips it with no code change.

/** Every payment method is cleared for production at booking (decision 1 Nov 2026). */
const CLEARED_METHODS = ['mobile_money', 'bank_transfer', 'credit', 'cash', 'pdc'];

const PRINT_AD_CLASSES = ['display', 'classified'];

function productionGateMode() {
  return String(process.env.VGAMS_PRODUCTION_GATE || 'paid').trim().toLowerCase();
}

function isClearedGate() {
  return productionGateMode() === 'cleared';
}

/**
 * Filter fragment that replaces the literal `isPaid: true` in queue queries.
 * withActive reproduces getBookingsByDate's legacy `isPaid + isActive` pair.
 */
function gateFilter({ withActive = false } = {}) {
  if (isClearedGate()) return { production_cleared: true };
  return withActive ? { isPaid: true, isActive: true } : { isPaid: true };
}

/** Same rule as gateFilter, applied to an already-loaded advert record. */
function passesGate(advert) {
  if (!advert) return false;
  return isClearedGate() ? !!advert.production_cleared : !!advert.isPaid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Display vs Classified
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Same signal the frontend's isClassifiedAdvert() has always used:
 * rate card ad_type contains "classified" or size_dimension contains "per word".
 * Returns 'classified' | 'display' | null (null = no rate card to judge by).
 */
function classifyFromRateCard(rateCard) {
  if (!rateCard) return null;
  const adType = String(rateCard.ad_type || rateCard.adType || '').toLowerCase();
  const size   = String(rateCard.size_dimension || rateCard.sizeDimension || '').toLowerCase();
  return (adType.includes('classified') || size.includes('per word')) ? 'classified' : 'display';
}

function normaliseAdClass(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'display' || v === 'display_ad' || v === 'display ad') return 'display';
  if (v === 'classified' || v === 'classifieds') return 'classified';
  return null;
}

/**
 * Best-effort id from any Strapi 5 relation payload shape:
 * 12 | '12' | { id } | { connect: [..] } | { set: [..] } | [..]
 */
function relationId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return /^\d+$/.test(value) ? Number(value) : null;
  if (Array.isArray(value)) return relationId(value[0]);
  if (typeof value === 'object') {
    if (value.id !== undefined) return relationId(value.id);
    if (Array.isArray(value.connect)) return relationId(value.connect[0]);
    if (Array.isArray(value.set)) return relationId(value.set[0]);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity (same stateless pattern as requireAdmin in vgams-user.js)
// ─────────────────────────────────────────────────────────────────────────────

function actorEmailFrom(ctx) {
  return String(
    ctx.request.header['x-user-email'] ||
    ctx.request.body?.userEmail ||
    ctx.request.body?.designerEmail ||
    ctx.request.body?.adminEmail ||
    ctx.request.query?.userEmail ||
    ''
  ).toLowerCase().trim();
}

/**
 * Resolve the calling vgams-user and check their role.
 * administrator always passes. On failure it answers the request (403) and
 * returns null, so callers do `const actor = await requireRole(...); if (!actor) return;`
 */
async function requireRole(strapi, ctx, allowedRoles = []) {
  const email = actorEmailFrom(ctx);
  if (!email) {
    ctx.forbidden('Your user email is required (x-user-email header).');
    return null;
  }
  const user = await strapi.db.query('api::vgams-user.vgams-user').findOne({
    where: { email },
    select: ['id', 'name', 'email', 'role', 'isActive'],
  });
  if (!user || !user.isActive) {
    ctx.forbidden('This action needs an active VGAMS account.');
    return null;
  }
  if (user.role !== 'administrator' && !allowedRoles.includes(user.role)) {
    ctx.forbidden(`This action is not available to the ${user.role} role.`);
    return null;
  }
  return user;
}

/** Optional actor lookup — never fails the request. */
async function findActor(strapi, ctx) {
  const email = actorEmailFrom(ctx);
  if (!email) return null;
  try {
    return await strapi.db.query('api::vgams-user.vgams-user').findOne({
      where: { email },
      select: ['id', 'name', 'email', 'role', 'isActive'],
    });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit trail — non-blocking, same convention as design-batch.js
// ─────────────────────────────────────────────────────────────────────────────

async function logWorkflow(strapi, { advertId, action, notes = '', actorId = null, previousStatus = null, newStatus = null }) {
  try {
    await strapi.entityService.create('api::workflow-log.workflow-log', {
      data: {
        advert: advertId,
        action,
        previous_status: previousStatus,
        new_status: newStatus || action,
        ...(actorId ? { vgams_users: [actorId] } : {}),
        notes,
        timestamp: new Date(),
      },
    });
  } catch (err) {
    console.warn(`⚠️ Could not write ${action} workflow-log entry for advert ${advertId}:`, err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Placement (Copy Desk) and artwork (Design House) lookups
// ─────────────────────────────────────────────────────────────────────────────

const LOCKED_STATUSES = ['locked', 'published'];

/**
 * advertId → [{ publicationId, publicationDate, masthead, publicationStatus, locked, pageId, pageNumber, section }]
 * Optionally narrowed to a set of publication dates.
 */
async function placementsFor(strapi, advertIds = [], dates = null) {
  const ids = [...new Set(advertIds.map(Number).filter(Boolean))];
  const out = new Map(ids.map(id => [id, []]));
  if (ids.length === 0) return out;

  const filters = { adverts: { id: { $in: ids } } };
  if (Array.isArray(dates) && dates.length > 0) {
    filters.publication = { publication_date: { $in: dates } };
  }

  const pages = await strapi.entityService.findMany('api::pager-page.pager-page', {
    filters,
    fields: ['id', 'page_number', 'section'],
    populate: {
      publication: { fields: ['id', 'publication_date', 'masthead', 'status', 'publication_code'] },
      adverts: { fields: ['id'] },
    },
    limit: -1,
  });

  for (const page of pages) {
    const pub = page.publication;
    if (!pub) continue;
    for (const a of page.adverts || []) {
      if (!out.has(a.id)) continue;
      out.get(a.id).push({
        publicationId: pub.id,
        publicationCode: pub.publication_code || null,
        publicationDate: pub.publication_date,
        masthead: pub.masthead,
        publicationStatus: pub.status,
        locked: LOCKED_STATUSES.includes(pub.status),
        pageId: page.id,
        pageNumber: page.page_number,
        section: page.section || null,
      });
    }
  }
  return out;
}

/**
 * advertId → [{ scheduleId, runDate, hasMedia, mediaCount, carried, carriedFrom, dropped, droppedReason, page }]
 */
async function artworkFor(strapi, advertIds = []) {
  const ids = [...new Set(advertIds.map(Number).filter(Boolean))];
  const out = new Map(ids.map(id => [id, []]));
  if (ids.length === 0) return out;

  const rows = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
    filters: { adverts: { id: { $in: ids } } },
    fields: ['id', 'run_date', 'page', 'artwork_dropped', 'artwork_dropped_reason'],
    populate: {
      adverts: { fields: ['id'] },
      media: { fields: ['id', 'name', 'url', 'mime', 'size'] },
      carried_from: { fields: ['id', 'run_date'] },
    },
    limit: -1,
  });

  for (const row of rows) {
    const media = row.media || [];
    for (const a of row.adverts || []) {
      if (!out.has(a.id)) continue;
      out.get(a.id).push({
        scheduleId: row.id,
        runDate: row.run_date,
        hasMedia: media.length > 0 && !row.artwork_dropped,
        mediaCount: media.length,
        media: media.map(m => ({ id: m.id, name: m.name, url: m.url, mime: m.mime, size: m.size })),
        carried: !!row.carried_from,
        carriedFrom: row.carried_from ? { scheduleId: row.carried_from.id, runDate: row.carried_from.run_date } : null,
        dropped: !!row.artwork_dropped,
        droppedReason: row.artwork_dropped_reason || null,
        page: row.page ? Number(row.page) : null,
      });
    }
  }
  return out;
}

/**
 * Per-date production state for one advert, joining its booked dates with
 * Copy Desk placement and Design House artwork.
 */
function runDateStates(publishingDates = [], placements = [], artwork = []) {
  const dates = [...new Set([
    ...(Array.isArray(publishingDates) ? publishingDates : []),
    ...artwork.map(a => a.runDate),
  ].filter(Boolean))].sort();

  return dates.map(date => {
    const placement = placements.find(p => p.publicationDate === date) || null;
    const art = artwork.find(a => a.runDate === date) || null;
    return {
      date,
      placed: !!placement,
      locked: !!placement?.locked,
      pageNumber: placement?.pageNumber ?? null,
      masthead: placement?.masthead ?? null,
      publicationId: placement?.publicationId ?? null,
      publicationStatus: placement?.publicationStatus ?? null,
      artwork: art
        ? (art.dropped ? 'dropped' : (art.hasMedia ? (art.carried ? 'carried' : 'in') : 'awaiting'))
        : 'awaiting',
      scheduleId: art?.scheduleId ?? null,
      // A date can go to invoicing once it sits on a confirmed layout with artwork.
      invoiceable: !!placement?.locked && !!art?.hasMedia,
    };
  });
}

/**
 * Move invoice_stage between not_ready and ready from the advert's current
 * placement + artwork. Never touches 'confirmed' or 'invoiced' — those are
 * the Invoicing Officer's decisions. Returns the stage after the check.
 */
async function recomputeInvoiceStage(strapi, advertId) {
  const advert = await strapi.entityService.findOne('api::advert.advert', advertId, {
    fields: ['id', 'publishing_dates', 'invoice_stage', 'isCanceled', 'production_cleared', 'isPaid'],
  });
  if (!advert) return null;
  const current = advert.invoice_stage || 'not_ready';
  if (current === 'confirmed' || current === 'invoiced') return current;

  const [placements, artwork] = await Promise.all([
    placementsFor(strapi, [advert.id]),
    artworkFor(strapi, [advert.id]),
  ]);
  const states = runDateStates(advert.publishing_dates, placements.get(advert.id), artwork.get(advert.id));
  const ready = !advert.isCanceled && passesGate(advert) && states.some(s => s.invoiceable);
  const next = ready ? 'ready' : 'not_ready';

  if (next !== current) {
    await strapi.entityService.update('api::advert.advert', advert.id, { data: { invoice_stage: next } });
  }
  return next;
}

async function recomputeInvoiceStages(strapi, advertIds = []) {
  const result = {};
  for (const id of [...new Set(advertIds.map(Number).filter(Boolean))]) {
    try {
      result[id] = await recomputeInvoiceStage(strapi, id);
    } catch (err) {
      console.warn(`⚠️ recomputeInvoiceStage(${id}) failed:`, err.message);
      result[id] = null;
    }
  }
  return result;
}

/**
 * Send an error with a structured JSON body. Strapi 5's ctx.badRequest(obj)
 * replaces an object message with "Bad Request", losing fields the
 * frontend needs (e.g. code: 'reason_required', missing: [...]).
 */
function reply(ctx, status, body = {}) {
  ctx.status = status;
  ctx.body = { success: false, ...body };
  return ctx.body;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function isISODate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

module.exports = {
  CLEARED_METHODS,
  PRINT_AD_CLASSES,
  LOCKED_STATUSES,
  productionGateMode,
  isClearedGate,
  gateFilter,
  passesGate,
  classifyFromRateCard,
  normaliseAdClass,
  relationId,
  actorEmailFrom,
  requireRole,
  findActor,
  logWorkflow,
  placementsFor,
  artworkFor,
  runDateStates,
  recomputeInvoiceStage,
  recomputeInvoiceStages,
  reply,
  todayISO,
  isISODate,
};
