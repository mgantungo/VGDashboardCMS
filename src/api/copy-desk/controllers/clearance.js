'use strict';

/**
 * Copy Desk clearance — size, confirm and defer (workflow re-order, step 2)
 *
 *   GET  /copy-desk/size-presets?productId=   active size presets for a masthead
 *   POST /copy-desk/layout-status             { dates[], productId? } → open / confirmed per date
 *   POST /copy-desk/clear                     clear one advert for design (size + run dates)
 *   POST /copy-desk/clear-bulk                confirm several adverts for one date with their booked size
 *   POST /copy-desk/withdraw                  withdraw a clearance (reason required)
 *   POST /copy-desk/defer                     move one run date of an advert to another day
 *
 * Rules (decisions 1 Nov 2026):
 *   - Display adverts need a size to be cleared (a preset or custom columns × cm).
 *   - Classifieds may be confirmed with no size.
 *   - A size different from the booked one needs a reason; the price is not changed.
 *   - A confirmed (locked) layout takes no new adverts: late bookings are deferred.
 */

const {
  passesGate,
  isISODate,
  todayISO,
  requireRole,
  placementsFor,
  recomputeInvoiceStages,
  logWorkflow,
  reply,
  CLEARANCE_UID,
  PRESET_UID,
  parseBookedSize,
  sizeLabelOf,
  shapeClearance,
  shapePreset,
  presetsFor,
  matchPreset,
  layoutStatusFor,
} = require('../../_vgams-helpers/vgams-workflow');

const COPY_DESK_ROLES = ['sub_editor'];
const SCHEDULE_UID = 'api::advert-daily-schedule.advert-daily-schedule';

function bodyOf(ctx) {
  const raw = ctx.request.body || {};
  return (raw.data && typeof raw.data === 'object') ? raw.data : raw;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function loadAdvert(strapi, advertId) {
  return strapi.entityService.findOne('api::advert.advert', Number(advertId), {
    fields: ['id', 'advert_title', 'reference_number', 'ad_size', 'publishing_dates', 'start_date', 'end_date',
      'print_ad_class', 'isPaid', 'isCanceled', 'production_cleared', 'run_date_history'],
    populate: {
      product: { fields: ['id', 'product_name'], populate: { category: { fields: ['category_type'] } } },
      rate_card: { fields: ['id', 'size_dimension', 'ad_type'] },
    },
  });
}

function bookedSizeOf(advert) {
  return parseBookedSize(advert.ad_size) || parseBookedSize(advert.rate_card?.size_dimension);
}

function datesOf(advert) {
  return (Array.isArray(advert.publishing_dates) && advert.publishing_dates.length
    ? advert.publishing_dates
    : [advert.start_date]).filter(isISODate).sort();
}

/**
 * Resolve the size Copy Desk chose into stored fields.
 * Returns { ok, error?, code?, fields? }.
 */
async function resolveSize(strapi, advert, spec) {
  const mode = spec.sizeMode || 'none';
  const isClassified = advert.print_ad_class === 'classified';

  if (mode === 'none') {
    if (!isClassified) return { ok: false, code: 'size_required', error: 'Display adverts need a size: pick a preset or enter columns × cm.' };
    return { ok: true, fields: { size_mode: 'none', size_preset: null, size_label: spec.sizeLabel || advert.ad_size || null, columns: null, height_cm: null, page_fraction: null } };
  }

  if (mode === 'preset') {
    const preset = spec.presetId
      ? await strapi.entityService.findOne(PRESET_UID, Number(spec.presetId), { populate: { product: { fields: ['id'] } } })
      : null;
    if (!preset || preset.is_active === false) return { ok: false, code: 'preset_invalid', error: 'Choose an active size preset.' };
    if (preset.product && advert.product && Number(preset.product.id) !== Number(advert.product.id)) {
      return { ok: false, code: 'preset_invalid', error: `"${preset.name}" belongs to another masthead.` };
    }
    const p = shapePreset(preset);
    return { ok: true, chosen: p.columns && p.heightCm ? { columns: p.columns, heightCm: p.heightCm } : null,
      fields: { size_mode: 'preset', size_preset: p.id, size_label: p.label, columns: p.columns, height_cm: p.heightCm, page_fraction: p.pageFraction } };
  }

  if (mode === 'custom') {
    const columns = num(spec.columns);
    const heightCm = num(spec.heightCm);
    if (!columns || !heightCm) return { ok: false, code: 'size_required', error: 'Enter both columns and height in cm.' };
    return { ok: true, chosen: { columns, heightCm },
      fields: { size_mode: 'custom', size_preset: null, size_label: sizeLabelOf(columns, heightCm), columns, height_cm: heightCm, page_fraction: num(spec.pageFraction) } };
  }

  return { ok: false, code: 'size_invalid', error: "sizeMode must be 'preset', 'custom' or 'none'." };
}

/**
 * Write (or update) the clearance rows for an advert. Shared by /clear and
 * /clear-bulk. Never touches a date whose layout is confirmed unless the
 * advert is already placed on it.
 */
async function writeClearances(strapi, advert, dates, sizeFields, extra, actor) {
  const [placements, status] = await Promise.all([
    placementsFor(strapi, [advert.id], dates),
    layoutStatusFor(strapi, dates, advert.product?.id),
  ]);
  const existing = await strapi.entityService.findMany(CLEARANCE_UID, {
    filters: { advert: { id: advert.id }, run_date: { $in: dates }, status: { $ne: 'deferred' } },
    populate: { size_preset: { fields: ['id'] } },
    limit: -1,
  });

  const results = [];
  for (const date of dates) {
    const placement = (placements.get(advert.id) || []).find(p => p.publicationDate === date) || null;
    if (status[date]?.status === 'confirmed' && !placement) {
      results.push({ runDate: date, ok: false, code: 'layout_confirmed', message: `Layout for ${date} is confirmed — defer this advert or reopen the layout.` });
      continue;
    }
    const row = existing.find(r => r.run_date === date) || null;
    const sizeChanged = row && row.status !== 'withdrawn' && (
      (row.size_label || null) !== (sizeFields.size_label || null)
      || Number(row.columns || 0) !== Number(sizeFields.columns || 0)
      || Number(row.height_cm || 0) !== Number(sizeFields.height_cm || 0));

    const data = {
      ...sizeFields,
      size_differs_reason: extra.sizeDiffersReason || null,
      position: extra.position ?? row?.position ?? null,
      publication: placement?.publicationId ?? null,
      page_number: placement?.pageNumber ?? null,
      cleared_by: actor.id,
      withdrawn_reason: null,
    };
    let saved;
    if (row) {
      data.status = sizeChanged ? 'changed' : 'cleared';
      if (sizeChanged) {
        data.changed_at = new Date();
        data.change_note = `Size changed from ${row.size_label || 'none'} to ${sizeFields.size_label || 'none'}`;
      }
      if (row.status === 'withdrawn') data.cleared_at = new Date();
      saved = await strapi.entityService.update(CLEARANCE_UID, row.id, { data });
    } else {
      saved = await strapi.entityService.create(CLEARANCE_UID, {
        data: { ...data, advert: advert.id, run_date: date, status: 'cleared', cleared_at: new Date() },
      });
    }
    results.push({ runDate: date, ok: true, clearanceId: saved.id, status: data.status || 'cleared', pageNumber: placement?.pageNumber ?? null });
  }

  const written = results.filter(r => r.ok);
  if (written.length) {
    const changed = written.some(r => r.status === 'changed');
    await logWorkflow(strapi, {
      advertId: advert.id,
      action: changed ? 'clearance_changed' : 'cleared_for_design',
      actorId: actor.id,
      notes: `Cleared for design: ${sizeFields.size_label || 'no size (classified)'} — ${written.map(r => r.runDate).join(', ')}`
        + (extra.sizeDiffersReason ? ` — differs from booking: ${extra.sizeDiffersReason}` : ''),
    });
  }
  return results;
}

module.exports = {

  /** GET /copy-desk/size-presets?productId= */
  async sizePresets(ctx) {
    try {
      const productId = ctx.query?.productId ? Number(ctx.query.productId) : null;
      const presets = await presetsFor(strapi, productId);
      return ctx.send({ success: true, data: presets });
    } catch (error) {
      console.error('❌ clearance.sizePresets:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /** POST /copy-desk/layout-status  { dates: [], productId? } */
  async layoutStatus(ctx) {
    try {
      const { dates, productId } = bodyOf(ctx);
      const list = (Array.isArray(dates) ? dates : []).filter(isISODate).slice(0, 62);
      if (list.length === 0) return reply(ctx, 400, { message: 'dates must be a non-empty array of YYYY-MM-DD' });
      const data = await layoutStatusFor(strapi, list, productId ? Number(productId) : null);
      return ctx.send({ success: true, data });
    } catch (error) {
      console.error('❌ clearance.layoutStatus:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /copy-desk/clear
   * Body: { advertId, runDates[], carryForward? (default true), sizeMode, presetId?, columns?, heightCm?,
   *         pageFraction?, sizeLabel?, position?, sizeDiffersReason?, userEmail }
   */
  async clear(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, COPY_DESK_ROLES);
      if (!actor) return;
      const body = bodyOf(ctx);

      const advert = body.advertId ? await loadAdvert(strapi, body.advertId) : null;
      if (!advert) return reply(ctx, 404, { message: 'Advert not found' });
      if (advert.isCanceled) return reply(ctx, 400, { message: 'Advert is cancelled' });
      if (!passesGate(advert)) return reply(ctx, 400, { message: 'Advert is not cleared for production' });
      if (advert.product?.category?.category_type !== 'print') return reply(ctx, 400, { message: 'Only print adverts are cleared at Copy Desk' });

      const booked = datesOf(advert);
      const requested = (Array.isArray(body.runDates) ? body.runDates : [body.runDate]).filter(isISODate);
      let dates = requested.filter(d => booked.includes(d));
      if (dates.length === 0) return reply(ctx, 400, { message: 'Pick at least one run date of this booking', bookedDates: booked });
      if (body.carryForward !== false) {
        const first = [...dates].sort()[0];
        const today = todayISO();
        dates = [...new Set([...dates, ...booked.filter(d => d > first && d >= today)])];
      }
      dates.sort();

      const size = await resolveSize(strapi, advert, body);
      if (!size.ok) return reply(ctx, 400, { code: size.code, message: size.error });

      const bookedSize = bookedSizeOf(advert);
      const reason = String(body.sizeDiffersReason || '').trim();
      if (size.chosen && bookedSize
        && (Number(size.chosen.columns) !== Number(bookedSize.columns) || Number(size.chosen.heightCm) !== Number(bookedSize.heightCm))
        && !reason) {
        return reply(ctx, 400, {
          code: 'size_reason_required',
          message: `Booked as ${sizeLabelOf(bookedSize.columns, bookedSize.heightCm)}. Give a reason for clearing a different size (the price is not changed).`,
          bookedSize: { ...bookedSize, label: sizeLabelOf(bookedSize.columns, bookedSize.heightCm) },
        });
      }

      const results = await writeClearances(strapi, advert, dates, size.fields,
        { sizeDiffersReason: reason || null, position: body.position ? String(body.position).slice(0, 120) : null }, actor);
      const ok = results.filter(r => r.ok).length;
      return ctx.send({ success: ok > 0, message: `Cleared for ${ok} of ${results.length} date(s)`, results });
    } catch (error) {
      console.error('❌ clearance.clear:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /copy-desk/clear-bulk  { date, advertIds[], userEmail }
   * Confirms each advert for one date with the size it was booked at:
   *   classified → confirmed without a size
   *   display    → the matching preset, else the booked columns × cm, else skipped ("set size first")
   * Already-cleared adverts are skipped.
   */
  async clearBulk(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, COPY_DESK_ROLES);
      if (!actor) return;
      const { date, advertIds } = bodyOf(ctx);
      if (!isISODate(date)) return reply(ctx, 400, { message: 'date is required (YYYY-MM-DD)' });
      const ids = [...new Set((Array.isArray(advertIds) ? advertIds : []).map(Number).filter(Boolean))];
      if (ids.length === 0) return reply(ctx, 400, { message: 'advertIds must be a non-empty array' });

      const existing = await strapi.entityService.findMany(CLEARANCE_UID, {
        filters: { advert: { id: { $in: ids } }, run_date: date, status: { $in: ['cleared', 'changed'] } },
        populate: { advert: { fields: ['id'] } },
        limit: -1,
      });
      const already = new Set(existing.map(r => r.advert?.id));
      const presetCache = new Map();

      const results = [];
      for (const id of ids) {
        try {
          if (already.has(id)) { results.push({ advertId: id, ok: false, message: 'Already cleared' }); continue; }
          const advert = await loadAdvert(strapi, id);
          if (!advert || advert.isCanceled) { results.push({ advertId: id, ok: false, message: 'Not found or cancelled' }); continue; }
          if (!passesGate(advert)) { results.push({ advertId: id, ok: false, message: 'Not cleared for production' }); continue; }
          if (!datesOf(advert).includes(date)) { results.push({ advertId: id, ok: false, message: `Does not run on ${date}` }); continue; }

          let spec;
          if (advert.print_ad_class === 'classified') {
            spec = { sizeMode: 'none' };
          } else {
            const pid = advert.product?.id || null;
            if (!presetCache.has(pid)) presetCache.set(pid, await presetsFor(strapi, pid));
            const booked = bookedSizeOf(advert);
            const preset = matchPreset(presetCache.get(pid), booked);
            if (preset) spec = { sizeMode: 'preset', presetId: preset.id };
            else if (booked) spec = { sizeMode: 'custom', columns: booked.columns, heightCm: booked.heightCm };
            else { results.push({ advertId: id, ok: false, code: 'size_required', message: 'No booked size on record — set the size first' }); continue; }
          }
          const size = await resolveSize(strapi, advert, spec);
          if (!size.ok) { results.push({ advertId: id, ok: false, code: size.code, message: size.error }); continue; }
          const r = (await writeClearances(strapi, advert, [date], size.fields, {}, actor))[0];
          results.push({ advertId: id, ...r });
        } catch (rowErr) {
          results.push({ advertId: id, ok: false, message: rowErr.message });
        }
      }
      const ok = results.filter(r => r.ok).length;
      return ctx.send({ success: ok > 0, message: `${ok} of ${ids.length} cleared`, succeeded: ok, failed: ids.length - ok, results });
    } catch (error) {
      console.error('❌ clearance.clearBulk:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /** POST /copy-desk/withdraw  { advertId, runDate, reason, userEmail } */
  async withdraw(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, COPY_DESK_ROLES);
      if (!actor) return;
      const { advertId, runDate, reason } = bodyOf(ctx);
      if (!String(reason || '').trim()) return reply(ctx, 400, { message: 'A reason is required to withdraw a clearance' });
      const rows = await strapi.entityService.findMany(CLEARANCE_UID, {
        filters: { advert: { id: Number(advertId) }, run_date: runDate, status: { $in: ['cleared', 'changed'] } },
        limit: 1,
      });
      if (!rows[0]) return reply(ctx, 404, { message: 'No active clearance for that advert and date' });
      await strapi.entityService.update(CLEARANCE_UID, rows[0].id, {
        data: { status: 'withdrawn', withdrawn_reason: String(reason).trim(), changed_at: new Date() },
      });
      await logWorkflow(strapi, {
        advertId: Number(advertId), action: 'clearance_withdrawn', actorId: actor.id,
        notes: `Clearance for ${runDate} withdrawn: ${String(reason).trim()}`,
      });
      return ctx.send({ success: true, message: `Clearance for ${runDate} withdrawn` });
    } catch (error) {
      console.error('❌ clearance.withdraw:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /copy-desk/defer  { advertId, fromDate, toDate, reason, userEmail }
   *
   * Moves one run date of a booking to another day:
   *   - publishing_dates: fromDate replaced by toDate (start/end dates follow)
   *   - run_date_history: { from, to, reason, by, at } appended
   *   - Pager: the advert leaves fromDate's layout (even a confirmed one)
   *   - Artwork: the advert's own schedule row moves to toDate; if it shared
   *     an ad slot, it leaves the slot and gets its own row with the same file
   *   - Clearance: fromDate → status 'deferred'; its size carries to toDate
   */
  async defer(ctx) {
    try {
      const actor = await requireRole(strapi, ctx, COPY_DESK_ROLES);
      if (!actor) return;
      const { advertId, fromDate, toDate, reason } = bodyOf(ctx);
      const why = String(reason || '').trim();
      if (!why) return reply(ctx, 400, { message: 'A reason is required to defer an advert' });
      if (!isISODate(fromDate) || !isISODate(toDate)) return reply(ctx, 400, { message: 'fromDate and toDate must be YYYY-MM-DD' });
      if (fromDate === toDate) return reply(ctx, 400, { message: 'Pick a different date' });
      if (toDate < todayISO()) return reply(ctx, 400, { message: 'The new date cannot be in the past' });

      const advert = await loadAdvert(strapi, advertId);
      if (!advert) return reply(ctx, 404, { message: 'Advert not found' });
      if (advert.isCanceled) return reply(ctx, 400, { message: 'Advert is cancelled' });
      const dates = datesOf(advert);
      if (!dates.includes(fromDate)) return reply(ctx, 400, { message: `This booking does not run on ${fromDate}`, bookedDates: dates });
      if (dates.includes(toDate)) return reply(ctx, 400, { message: `This booking already runs on ${toDate}. Withdraw ${fromDate} instead.` });

      const target = (await layoutStatusFor(strapi, [toDate], advert.product?.id))[toDate];
      if (target?.status === 'confirmed') {
        return reply(ctx, 400, { code: 'target_confirmed', message: `The layout for ${toDate} is already confirmed. Pick another date.` });
      }

      // 1. Off fromDate's layout
      const placements = (await placementsFor(strapi, [advert.id], [fromDate])).get(advert.id) || [];
      for (const p of placements) {
        const page = await strapi.entityService.findOne('api::pager-page.pager-page', p.pageId, { populate: { adverts: { fields: ['id'] } } });
        if (!page) continue;
        await strapi.entityService.update('api::pager-page.pager-page', page.id, {
          data: { adverts: (page.adverts || []).map(a => a.id).filter(id => id !== advert.id) },
        });
      }

      // 2. Artwork rows
      const rows = await strapi.entityService.findMany(SCHEDULE_UID, {
        filters: { run_date: fromDate, adverts: { id: advert.id } },
        populate: { adverts: { fields: ['id'] }, media: { fields: ['id'] } },
        limit: -1,
      });
      let artworkMoved = false;
      for (const row of rows) {
        const others = (row.adverts || []).filter(a => a.id !== advert.id);
        if (others.length === 0) {
          await strapi.entityService.update(SCHEDULE_UID, row.id, { data: { run_date: toDate, page: 0 } });
        } else {
          await strapi.entityService.update(SCHEDULE_UID, row.id, { data: { adverts: { disconnect: [advert.id] } } });
          await strapi.entityService.create(SCHEDULE_UID, {
            data: {
              run_date: toDate, run_time: JSON.stringify(['00:00 AM']), is_published: false,
              adverts: [advert.id], media: (row.media || []).map(m => m.id), carried_from: row.id,
              artwork_dropped: false,
            },
          });
        }
        artworkMoved = artworkMoved || (row.media || []).length > 0;
      }

      // 3. Clearance
      const clearances = await strapi.entityService.findMany(CLEARANCE_UID, {
        filters: { advert: { id: advert.id }, run_date: fromDate, status: { $ne: 'deferred' } },
        populate: { size_preset: { fields: ['id'] } },
        limit: -1,
      });
      for (const c of clearances) {
        await strapi.entityService.update(CLEARANCE_UID, c.id, {
          data: { status: 'deferred', deferred_to: toDate, defer_reason: why, changed_at: new Date() },
        });
        if (c.status === 'cleared' || c.status === 'changed') {
          await strapi.entityService.create(CLEARANCE_UID, {
            data: {
              advert: advert.id, run_date: toDate, status: 'cleared',
              size_mode: c.size_mode, size_preset: c.size_preset?.id ?? null, size_label: c.size_label,
              columns: c.columns, height_cm: c.height_cm, page_fraction: c.page_fraction,
              size_differs_reason: c.size_differs_reason, position: c.position,
              cleared_by: actor.id, cleared_at: new Date(),
              change_note: `Deferred from ${fromDate}`,
            },
          });
        }
      }
      // Never cleared: still leave a 'deferred' record on the old date so that
      // day's list shows where the advert went.
      if (clearances.length === 0) {
        await strapi.entityService.create(CLEARANCE_UID, {
          data: {
            advert: advert.id, run_date: fromDate, status: 'deferred', size_mode: 'none',
            deferred_to: toDate, defer_reason: why, changed_at: new Date(),
          },
        });
      }

      // 4. The booking itself
      const nextDates = [...dates.filter(d => d !== fromDate), toDate].sort();
      const history = Array.isArray(advert.run_date_history) ? advert.run_date_history : [];
      await strapi.entityService.update('api::advert.advert', advert.id, {
        data: {
          publishing_dates: nextDates,
          start_date: nextDates[0],
          end_date: nextDates[nextDates.length - 1],
          run_date_history: [...history, {
            from: fromDate, to: toDate, reason: why,
            by: actor.name || actor.email, byEmail: actor.email, at: new Date().toISOString(),
          }],
        },
      });

      await strapi.service('api::advert.schedule-status').recomputeAdvertScheduleStatus(advert.id);
      await recomputeInvoiceStages(strapi, [advert.id]);
      await logWorkflow(strapi, {
        advertId: advert.id, action: 'run_date_deferred', actorId: actor.id,
        notes: `Run date ${fromDate} deferred to ${toDate}: ${why}${artworkMoved ? ' (artwork moved)' : ''}`,
      });

      return ctx.send({
        success: true,
        message: `Deferred from ${fromDate} to ${toDate}`,
        advertId: advert.id,
        publishingDates: nextDates,
        removedFromLayout: placements.length > 0,
        artworkMoved,
        targetLayout: target,
      });
    } catch (error) {
      console.error('❌ clearance.defer:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};
