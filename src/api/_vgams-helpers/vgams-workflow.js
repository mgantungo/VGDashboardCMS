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
function runDateStates(publishingDates = [], placements = [], artwork = [], clearances = []) {
  const dates = [...new Set([
    ...(Array.isArray(publishingDates) ? publishingDates : []),
    ...artwork.map(a => a.runDate),
  ].filter(Boolean))].sort();

  return dates.map(date => {
    const placement = placements.find(p => p.publicationDate === date) || null;
    const art = artwork.find(a => a.runDate === date) || null;
    const cl = (clearances || []).find(c => c.runDate === date && c.status !== 'deferred') || null;
    return {
      // Copy Desk clearance for this run date (null = awaiting Copy Desk)
      clearance: cl,
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

// ─────────────────────────────────────────────────────────────────────────────
// Copy Desk clearance (advert-clearance) and layout status
// ─────────────────────────────────────────────────────────────────────────────

const CLEARANCE_UID = 'api::copy-desk.advert-clearance';
const PRESET_UID = 'api::ad-size-preset.ad-size-preset';

/**
 * Booked size from free text such as "26cm x 4col", "4 col x 20 cm",
 * "3cm x 1col". Only explicit units count — "4 x 20" is ambiguous and
 * returns null rather than a guess.
 */
function parseBookedSize(text) {
  const s = String(text || '').toLowerCase();
  const cm = s.match(/(\d+(?:\.\d+)?)\s*cm\b/);
  const col = s.match(/(\d+(?:\.\d+)?)\s*col/);
  if (!cm || !col) return null;
  return { columns: Number(col[1]), heightCm: Number(cm[1]) };
}

function sizeLabelOf(columns, heightCm) {
  if (!columns || !heightCm) return null;
  return `${Number(columns)} col × ${Number(heightCm)} cm`;
}

function shapeClearance(row) {
  if (!row) return null;
  return {
    id: row.id,
    runDate: row.run_date,
    status: row.status,
    sizeMode: row.size_mode,
    presetId: row.size_preset?.id ?? null,
    presetName: row.size_preset?.name ?? null,
    sizeLabel: row.size_label || null,
    columns: row.columns !== null && row.columns !== undefined ? Number(row.columns) : null,
    heightCm: row.height_cm !== null && row.height_cm !== undefined ? Number(row.height_cm) : null,
    pageFraction: row.page_fraction !== null && row.page_fraction !== undefined ? Number(row.page_fraction) : null,
    sizeDiffersReason: row.size_differs_reason || null,
    publicationId: row.publication?.id ?? null,
    pageNumber: row.page_number ?? null,
    position: row.position || null,
    clearedBy: row.cleared_by?.name || row.cleared_by?.email || null,
    clearedAt: row.cleared_at || null,
    changedAt: row.changed_at || null,
    changeNote: row.change_note || null,
    withdrawnReason: row.withdrawn_reason || null,
    deferredTo: row.deferred_to || null,
    deferReason: row.defer_reason || null,
    updatedAt: row.updatedAt || null,
  };
}

/** advertId → [shaped clearance rows], optionally only for some dates. */
async function clearancesFor(strapi, advertIds = [], dates = null) {
  const ids = [...new Set(advertIds.map(Number).filter(Boolean))];
  const out = new Map(ids.map(id => [id, []]));
  if (ids.length === 0) return out;
  const filters = { advert: { id: { $in: ids } } };
  if (Array.isArray(dates) && dates.length > 0) filters.run_date = { $in: dates };
  const rows = await strapi.entityService.findMany(CLEARANCE_UID, {
    filters,
    populate: {
      advert: { fields: ['id'] },
      size_preset: { fields: ['id', 'name'] },
      publication: { fields: ['id'] },
      cleared_by: { fields: ['id', 'name', 'email'] },
    },
    sort: { run_date: 'asc' },
    limit: -1,
  });
  for (const row of rows) {
    const aid = row.advert?.id;
    if (out.has(aid)) out.get(aid).push(shapeClearance(row));
  }
  return out;
}

/**
 * Keep clearances in step with the Pager. Called after an advert is placed
 * on, moved to, or removed from a page for publicationDate. A clearance that
 * already had a page and now gets a different one (or none) is marked
 * 'changed' so Design House notices; a first placement just fills the page in.
 */
async function syncClearancePlacement(strapi, advertIds, publicationDate, publicationId, pageNumber) {
  if (!publicationDate) return;
  try {
    const rows = await strapi.entityService.findMany(CLEARANCE_UID, {
      filters: { run_date: publicationDate, advert: { id: { $in: advertIds.map(Number) } }, status: { $in: ['cleared', 'changed'] } },
      populate: { publication: { fields: ['id'] } },
      limit: -1,
    });
    for (const row of rows) {
      const hadPage = row.page_number !== null && row.page_number !== undefined;
      const samePage = hadPage && Number(row.page_number) === Number(pageNumber) && (row.publication?.id ?? null) === (publicationId ?? null);
      if (samePage) continue;
      const data = {
        page_number: pageNumber ?? null,
        publication: publicationId ?? null,
      };
      if (hadPage) {
        data.status = 'changed';
        data.changed_at = new Date();
        data.change_note = pageNumber ? `Moved from page ${row.page_number} to page ${pageNumber}` : `Removed from page ${row.page_number}`;
      } else if (row.status === 'changed' && pageNumber) {
        // Taken off a page earlier, now placed again: say where it went
        const prev = String(row.change_note || '').match(/page (\d+)/);
        data.changed_at = new Date();
        data.change_note = prev ? `Moved from page ${prev[1]} to page ${pageNumber}` : `Now on page ${pageNumber}`;
      }
      await strapi.entityService.update(CLEARANCE_UID, row.id, { data });
    }
  } catch (err) {
    console.warn('⚠️ syncClearancePlacement failed:', err.message);
  }
}

function shapePreset(p) {
  const columns = p.columns !== null && p.columns !== undefined ? Number(p.columns) : null;
  const heightCm = p.height_cm !== null && p.height_cm !== undefined ? Number(p.height_cm) : null;
  return {
    id: p.id,
    name: p.name,
    appliesTo: p.applies_to || 'display',
    orientation: p.orientation || 'any',
    columns,
    heightCm,
    pageFraction: p.page_fraction !== null && p.page_fraction !== undefined ? Number(p.page_fraction) : null,
    productId: p.product?.id ?? null,
    sortOrder: p.sort_order ?? 100,
    label: columns && heightCm ? `${p.name} · ${columns} col × ${heightCm} cm` : p.name,
  };
}

/**
 * Active presets for a product: its own presets first, then the shared ones
 * (no product). A shared preset with the same name as a product preset is
 * hidden, so a masthead can override e.g. "Half page vertical".
 */
async function presetsFor(strapi, productId = null) {
  const rows = await strapi.entityService.findMany(PRESET_UID, {
    filters: { is_active: true },
    populate: { product: { fields: ['id'] } },
    sort: { sort_order: 'asc' },
    limit: -1,
  });
  const own = rows.filter(r => productId && r.product && Number(r.product.id) === Number(productId));
  const shared = rows.filter(r => !r.product);
  const ownNames = new Set(own.map(r => String(r.name).toLowerCase()));
  return [...own, ...shared.filter(r => !ownNames.has(String(r.name).toLowerCase()))]
    .map(shapePreset)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Preset whose columns × cm equal the booked size, if any. */
function matchPreset(presets, size) {
  if (!size) return null;
  return presets.find(p => p.columns && p.heightCm
    && Number(p.columns) === Number(size.columns) && Number(p.heightCm) === Number(size.heightCm)) || null;
}

/**
 * The layout(s) for a run date that apply to a product: publications on that
 * date whose product is this product, or that have no product set.
 */
async function layoutsFor(strapi, date, productId = null) {
  const pubs = await strapi.entityService.findMany('api::pager-publication.pager-publication', {
    filters: { publication_date: date },
    fields: ['id', 'publication_code', 'publication_date', 'masthead', 'status', 'total_pages'],
    populate: { product: { fields: ['id', 'product_name'] } },
    limit: -1,
  });
  return pubs.filter(p => !productId || !p.product || Number(p.product.id) === Number(productId));
}

/** { date: { status: 'none'|'open'|'confirmed', layouts: [...] } } */
async function layoutStatusFor(strapi, dates = [], productId = null) {
  const out = {};
  for (const date of [...new Set(dates.filter(isISODate))]) {
    const layouts = await layoutsFor(strapi, date, productId);
    const locked = layouts.filter(l => LOCKED_STATUSES.includes(l.status));
    out[date] = {
      status: layouts.length === 0 ? 'none' : (locked.length > 0 ? 'confirmed' : 'open'),
      layouts: layouts.map(l => ({
        id: l.id, code: l.publication_code, masthead: l.masthead, status: l.status,
        totalPages: l.total_pages, productId: l.product?.id ?? null, productName: l.product?.product_name ?? null,
      })),
    };
  }
  return out;
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
  // copy desk clearance
  CLEARANCE_UID,
  PRESET_UID,
  parseBookedSize,
  sizeLabelOf,
  shapeClearance,
  clearancesFor,
  syncClearancePlacement,
  layoutsFor,
  layoutStatusFor,
  shapePreset,
  presetsFor,
  matchPreset,
};
