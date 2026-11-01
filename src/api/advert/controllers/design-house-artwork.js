'use strict';

/**
 * Design House — artwork per run date (workflow re-order, steps 3–4)
 *
 *   POST /design-house/adverts/:id/artwork        attach artwork to any booking, new or old
 *   POST /design-house/schedules/:scheduleId/drop drop one day's artwork (row stays, flagged)
 *   POST /design-house/placements                 Copy Desk placement + artwork state per advert
 *
 * Design House works in parallel with Copy Desk, so none of these depend on
 * an advert having been placed first. When it has been placed, the page
 * number is mirrored onto the schedule row so both desks see the same page.
 */

const {
  passesGate,
  isClearedGate,
  isISODate,
  todayISO,
  placementsFor,
  artworkFor,
  runDateStates,
  recomputeInvoiceStages,
  logWorkflow,
  findActor,
  reply,
} = require('../../_vgams-helpers/vgams-workflow');

const SCHEDULE_UID = 'api::advert-daily-schedule.advert-daily-schedule';

function parseList(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }
  return [value];
}

function truthy(value) {
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'on';
}

async function uploadFiles(strapi, files) {
  if (!files) return [];
  const list = Array.isArray(files) ? files : [files];
  const uploadService = strapi.plugins['upload'].services.upload;
  const ids = [];
  for (const file of list) {
    const uploaded = await uploadService.upload({ data: {}, files: file });
    if (uploaded && uploaded.length > 0) ids.push(uploaded[0].id);
  }
  return ids;
}

module.exports = {

  /**
   * POST /design-house/adverts/:id/artwork   (multipart/form-data or JSON)
   *   files             — one or more files (field name "files")
   *   existingMediaIds  — JSON array of media ids to reuse instead of uploading
   *   runDates          — JSON array of YYYY-MM-DD; defaults to every remaining run date
   *   carryForward      — 'true' (default) fills every later remaining run date too
   *   replaceOwn        — 'true' overwrites dates that already have their own artwork
   *   userEmail         — designer, for the audit trail
   */
  async attachArtwork(ctx) {
    try {
      const { id } = ctx.params;
      const body = ctx.request.body || {};
      const files = ctx.request.files?.files || ctx.request.files?.file || null;

      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields: ['id', 'reference_number', 'advert_title', 'publishing_dates', 'start_date',
          'isPaid', 'isCanceled', 'production_cleared'],
      });
      if (!advert) return reply(ctx, 404, { success: false, message: `Advert ${id} not found` });
      if (advert.isCanceled) return reply(ctx, 400, { success: false, message: 'Advert is cancelled' });
      if (!passesGate(advert)) {
        return reply(ctx, 400, {
          success: false,
          message: isClearedGate() ? 'Advert is not cleared for production' : 'Advert is not paid',
        });
      }

      const booked = (Array.isArray(advert.publishing_dates) && advert.publishing_dates.length > 0
        ? advert.publishing_dates
        : [advert.start_date]).filter(isISODate).sort();
      const today = todayISO();

      const requested = parseList(body.runDates).filter(isISODate);
      const carryForward = body.carryForward === undefined ? true : truthy(body.carryForward);
      const replaceOwn = truthy(body.replaceOwn);

      let dates = requested.length > 0 ? requested.filter(d => booked.includes(d)) : booked.filter(d => d >= today);
      if (dates.length === 0) {
        return reply(ctx, 400, { success: false, message: 'None of the chosen dates is a run date of this booking', bookedDates: booked });
      }
      if (carryForward) {
        const first = dates[0];
        dates = [...new Set([...dates, ...booked.filter(d => d > first && d >= today)])];
      }
      dates.sort();

      // Media: new uploads, else ids passed in, else nothing to attach
      let mediaIds = await uploadFiles(strapi, files);
      if (mediaIds.length === 0) mediaIds = parseList(body.existingMediaIds).map(Number).filter(Boolean);
      if (mediaIds.length === 0) {
        return reply(ctx, 400, { success: false, message: 'Attach at least one file (files) or pass existingMediaIds' });
      }

      const existingRows = await strapi.entityService.findMany(SCHEDULE_UID, {
        filters: { adverts: { id: advert.id }, run_date: { $in: dates } },
        populate: { adverts: { fields: ['id'] }, media: { fields: ['id'] }, carried_from: { fields: ['id'] } },
        limit: -1,
      });
      const placements = (await placementsFor(strapi, [advert.id], dates)).get(advert.id) || [];

      const results = [];
      let anchorRowId = null;

      for (const runDate of dates) {
        const isAnchor = anchorRowId === null;
        const page = placements.find(p => p.publicationDate === runDate)?.pageNumber || null;
        const row = existingRows.find(r => r.run_date === runDate) || null;
        const sharedSlot = row && (row.adverts || []).length > 1;
        const ownArtwork = row && !sharedSlot && (row.media || []).length > 0 && !row.carried_from && !row.artwork_dropped;

        // A shared ad slot belongs to a design batch: never overwrite its file.
        if (sharedSlot && !requested.includes(runDate)) {
          results.push({ runDate, scheduleId: row.id, outcome: 'kept_ad_slot' });
          if (isAnchor) anchorRowId = row.id;
          continue;
        }
        // A later date that already has its own artwork is kept unless asked to replace it.
        if (ownArtwork && !isAnchor && !replaceOwn && !requested.includes(runDate)) {
          results.push({ runDate, scheduleId: row.id, outcome: 'kept_own_artwork' });
          continue;
        }

        const carried = !isAnchor && anchorRowId ? { carried_from: anchorRowId } : { carried_from: null };
        let saved;

        if (row && !sharedSlot) {
          saved = await strapi.entityService.update(SCHEDULE_UID, row.id, {
            data: {
              media: mediaIds,
              artwork_dropped: false,
              artwork_dropped_reason: null,
              ...carried,
              ...(page ? { page } : {}),
            },
          });
        } else {
          if (sharedSlot) {
            // Explicitly requested on a shared slot: take this advert out of the
            // slot for that date and give it its own row.
            await strapi.entityService.update(SCHEDULE_UID, row.id, {
              data: { adverts: { disconnect: [advert.id] } },
            });
          }
          saved = await strapi.entityService.create(SCHEDULE_UID, {
            data: {
              run_date: runDate,
              run_time: JSON.stringify(['00:00 AM']),
              is_published: false,
              adverts: [advert.id],
              media: mediaIds,
              artwork_dropped: false,
              ...carried,
              ...(page ? { page } : {}),
            },
          });
        }
        if (isAnchor) anchorRowId = saved.id;
        results.push({ runDate, scheduleId: saved.id, outcome: isAnchor ? 'attached' : 'carried', page });
      }

      const scheduleStatus = strapi.service('api::advert.schedule-status');
      const scheduleState = await scheduleStatus.recomputeAdvertScheduleStatus(advert.id);
      const invoiceStages = await recomputeInvoiceStages(strapi, [advert.id]);

      const actor = await findActor(strapi, ctx);
      const written = results.filter(r => r.outcome === 'attached' || r.outcome === 'carried');
      await logWorkflow(strapi, {
        advertId: advert.id,
        action: written.length > 1 ? 'artwork_carried' : 'artwork_attached',
        actorId: actor?.id || null,
        notes: `Artwork for ${written.map(r => r.runDate).join(', ')}${body.notes ? ` — ${body.notes}` : ''}`,
      });

      return ctx.send({
        success: true,
        message: `Artwork attached to ${written.length} date(s)`,
        advertId: advert.id,
        mediaIds,
        dates: results,
        schedule: scheduleState,
        invoiceStage: invoiceStages[advert.id] || null,
      });
    } catch (error) {
      console.error('❌ design-house-artwork.attachArtwork:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /design-house/schedules/:scheduleId/drop
   * Body: { reason (required), userEmail? }
   * Flags the row as dropped and clears its media so it can't be printed by
   * mistake. The row stays so the run date is not reported as "pending" and
   * Copy Desk can see the gap.
   */
  async dropRunDate(ctx) {
    try {
      const { scheduleId } = ctx.params;
      const { reason } = ctx.request.body || {};
      if (!reason || !String(reason).trim()) {
        return reply(ctx, 400, { success: false, message: 'A reason is required to drop a run date' });
      }

      const row = await strapi.entityService.findOne(SCHEDULE_UID, scheduleId, {
        populate: { adverts: { fields: ['id'] } },
      });
      if (!row) return reply(ctx, 404, { success: false, message: `Schedule ${scheduleId} not found` });

      await strapi.entityService.update(SCHEDULE_UID, row.id, {
        data: { artwork_dropped: true, artwork_dropped_reason: String(reason).trim(), media: [] },
      });

      const advertIds = (row.adverts || []).map(a => a.id);
      const invoiceStages = await recomputeInvoiceStages(strapi, advertIds);
      const actor = await findActor(strapi, ctx);
      for (const advertId of advertIds) {
        await logWorkflow(strapi, {
          advertId,
          action: 'artwork_dropped',
          actorId: actor?.id || null,
          notes: `Artwork dropped for ${row.run_date}: ${String(reason).trim()}`,
        });
      }

      return ctx.send({ success: true, message: `Run date ${row.run_date} dropped`, scheduleId: row.id, runDate: row.run_date, invoiceStages });
    } catch (error) {
      console.error('❌ design-house-artwork.dropRunDate:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /design-house/placements
   * Body: { advertIds: number[] }
   * → { data: { [advertId]: { runDates: [...], placed, nextPlacement } } }
   * Powers the "Page 7 · NV Tue 3 Nov" / "Not on layout yet" badges.
   */
  async getPlacements(ctx) {
    try {
      const raw = ctx.request.body?.advertIds;
      const ids = [...new Set(parseList(raw).map(Number).filter(Boolean))].slice(0, 500);
      if (ids.length === 0) return ctx.send({ success: true, data: {} });

      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: { id: { $in: ids } },
        fields: ['id', 'publishing_dates', 'start_date'],
        limit: -1,
      });
      const [placements, artwork] = await Promise.all([placementsFor(strapi, ids), artworkFor(strapi, ids)]);
      const today = todayISO();

      const data = {};
      for (const a of adverts) {
        const dates = Array.isArray(a.publishing_dates) && a.publishing_dates.length > 0 ? a.publishing_dates : [a.start_date];
        const states = runDateStates(dates, placements.get(a.id), artwork.get(a.id));
        const upcoming = states.filter(s => s.date >= today);
        data[a.id] = {
          runDates: states,
          placed: upcoming.some(s => s.placed),
          nextPlacement: upcoming.find(s => s.placed) || null,
          nextUnplaced: upcoming.find(s => !s.placed) || null,
        };
      }
      return ctx.send({ success: true, data });
    } catch (error) {
      console.error('❌ design-house-artwork.getPlacements:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};
