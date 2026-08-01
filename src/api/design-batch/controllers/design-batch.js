'use strict';

/**
 * Design Batch Controller
 *
 * A design-batch is the design house's working unit: one target run date,
 * one or more "file groups" (a designed file + the adverts it contains).
 * Attaching a batch to a schedule snapshots its current file groups into
 * the advert-daily-schedule row for that date — the batch itself stays
 * editable/reusable for other dates afterwards.
 */

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

const ADVERT_SUMMARY_FIELDS = [
  'id', 'reference_number', 'bc_reference_number', 'advert_title',
  'ad_size', 'ad_type', 'publishing_dates', 'isApproved', 'isScheduled',
];

const BATCH_POPULATE = {
  designer: { fields: ['id', 'name', 'email'] },
  file_groups: {
    populate: {
      file: { fields: ['id', 'name', 'url', 'size', 'mime', 'ext'] },
      // Strapi doesn't support a second populate level inside a component
      // relation — adverts here come back with bare fields only. Detail
      // views enrich them with a separate query (see enrichFileGroups).
      adverts: { fields: ADVERT_SUMMARY_FIELDS },
    },
  },
  daily_schedules: { fields: ['id', 'run_date', 'is_published'] },
};

/** Every advert id referenced anywhere across a batch's file groups, deduped. */
function collectAdvertIds(fileGroups = []) {
  const ids = new Set();
  fileGroups.forEach(g => (g.adverts || []).forEach(a => ids.add(a.id)));
  return [...ids];
}

/**
 * file_groups.adverts can't carry client/attachments (nested-populate
 * limitation on component relations) — fetch those separately and merge.
 */
async function enrichFileGroups(fileGroups = []) {
  const advertIds = collectAdvertIds(fileGroups);
  if (advertIds.length === 0) return fileGroups;

  const fullAdverts = await strapi.entityService.findMany('api::advert.advert', {
    filters: { id: { $in: advertIds } },
    fields: ADVERT_SUMMARY_FIELDS,
    populate: {
      client: { fields: ['id', 'company_name'] },
      attachments: { fields: ['id', 'name', 'url', 'size', 'mime'] },
    },
  });
  const byId = new Map(fullAdverts.map(a => [a.id, a]));

  return fileGroups.map(g => ({
    ...g,
    adverts: (g.adverts || []).map(a => byId.get(a.id) || a),
  }));
}

function summarizeBatch(batch) {
  const advertIds = collectAdvertIds(batch.file_groups);
  const fileCount = (batch.file_groups || []).filter(g => !!g.file).length;
  return {
    id: batch.id,
    reference: batch.reference_number,
    label: batch.label,
    status: batch.status,
    targetRunDate: batch.target_run_date,
    designer: batch.designer ? { id: batch.designer.id, name: batch.designer.name } : null,
    notes: batch.notes,
    advertsCount: advertIds.length,
    fileGroupsCount: (batch.file_groups || []).length,
    filesCount: fileCount,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

module.exports = {

  /**
   * POST /design-batches
   * Body: { label, targetRunDate, designerId?, notes? }
   */
  async createBatch(ctx) {
    try {
      const { label, targetRunDate, designerId, notes } = ctx.request.body || {};
      if (!label || !targetRunDate) {
        return ctx.badRequest({ success: false, message: 'label and targetRunDate are required' });
      }

      const batch = await strapi.entityService.create('api::design-batch.design-batch', {
        data: {
          label,
          target_run_date: targetRunDate,
          notes: notes || '',
          status: 'draft',
          ...(designerId ? { designer: designerId } : {}),
          file_groups: [],
        },
      });

      return ctx.send({ success: true, message: 'Batch created', batch: summarizeBatch({ ...batch, file_groups: [] }) });
    } catch (error) {
      console.error('❌ createBatch:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * GET /design-batches?status=draft&date=2026-08-03
   */
  async listBatches(ctx) {
    try {
      const { status, date } = ctx.request.query || {};
      const filters = {};
      if (status) filters.status = status;
      if (date) filters.target_run_date = date;

      const batches = await strapi.entityService.findMany('api::design-batch.design-batch', {
        filters,
        populate: BATCH_POPULATE,
        sort: { updatedAt: 'desc' },
        limit: -1,
      });

      return ctx.send({
        success: true,
        count: batches.length,
        batches: batches.map(summarizeBatch),
      });
    } catch (error) {
      console.error('❌ listBatches:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * GET /design-batches/:id
   * Full detail — file groups with enriched advert data (BC order #, ad
   * label, client, attachments) and attach history.
   */
  async getBatchDetail(ctx) {
    try {
      const { id } = ctx.params;
      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        populate: BATCH_POPULATE,
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const fileGroups = await enrichFileGroups(batch.file_groups || []);

      return ctx.send({
        success: true,
        batch: {
          ...summarizeBatch(batch),
          fileGroups: fileGroups.map(g => ({
            id: g.id,
            label: g.label,
            file: g.file ? {
              id: g.file.id, name: g.file.name, url: g.file.url,
              size: g.file.size, sizeFormatted: formatFileSize((g.file.size || 0) * 1024), mime: g.file.mime,
            } : null,
            adverts: (g.adverts || []).map(a => ({
              id: a.id,
              reference: a.reference_number,
              bcOrderNumber: a.bc_reference_number,
              adLabel: a.advert_title,
              client: a.client?.company_name || '—',
              adSize: a.ad_size,
              adType: a.ad_type,
              attachments: (a.attachments || []).map(f => ({ id: f.id, name: f.name, url: f.url, size: f.size })),
            })),
          })),
          dailySchedules: (batch.daily_schedules || []).map(s => ({ id: s.id, runDate: s.run_date, isPublished: s.is_published })),
        },
      });
    } catch (error) {
      console.error('❌ getBatchDetail:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * PUT /design-batches/:id
   * Body: { label?, targetRunDate?, designerId?, notes?, status? }
   */
  async updateBatch(ctx) {
    try {
      const { id } = ctx.params;
      const { label, targetRunDate, designerId, notes, status } = ctx.request.body || {};

      const data = {};
      if (label !== undefined) data.label = label;
      if (targetRunDate !== undefined) data.target_run_date = targetRunDate;
      if (designerId !== undefined) data.designer = designerId;
      if (notes !== undefined) data.notes = notes;
      if (status !== undefined) data.status = status;

      const batch = await strapi.entityService.update('api::design-batch.design-batch', id, { data });
      return ctx.send({ success: true, message: 'Batch updated', batch: summarizeBatch({ ...batch, file_groups: batch.file_groups || [] }) });
    } catch (error) {
      console.error('❌ updateBatch:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * DELETE /design-batches/:id
   * Only drafts can be deleted outright — once attached, a batch is part
   * of the historical record for whatever date(s) it ran on.
   */
  async deleteBatch(ctx) {
    try {
      const { id } = ctx.params;
      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, { fields: ['id', 'status'] });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });
      if (batch.status === 'attached') {
        return ctx.badRequest({ success: false, message: 'Cannot delete a batch that has been attached to a schedule — archive it instead' });
      }
      await strapi.entityService.delete('api::design-batch.design-batch', id);
      return ctx.send({ success: true, message: 'Batch deleted' });
    } catch (error) {
      console.error('❌ deleteBatch:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /design-batches/:id/file-groups
   * Body: { label? }
   */
  async addFileGroup(ctx) {
    try {
      const { id } = ctx.params;
      const { label } = ctx.request.body || {};

      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        populate: { file_groups: { populate: { file: { fields: ['id'] }, adverts: { fields: ['id'] } } } },
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const existingGroups = (batch.file_groups || []).map(g => ({
        id: g.id, label: g.label, file: g.file?.id || null, adverts: (g.adverts || []).map(a => a.id),
      }));

      const updated = await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { file_groups: [...existingGroups, { label: label || `File Group ${existingGroups.length + 1}`, adverts: [] }] },
      });

      return ctx.send({ success: true, message: 'File group added', fileGroups: updated.file_groups });
    } catch (error) {
      console.error('❌ addFileGroup:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * DELETE /design-batches/:id/file-groups/:groupId
   */
  async removeFileGroup(ctx) {
    try {
      const { id, groupId } = ctx.params;
      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        populate: { file_groups: { populate: { file: { fields: ['id'] }, adverts: { fields: ['id'] } } } },
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const remaining = (batch.file_groups || [])
        .filter(g => String(g.id) !== String(groupId))
        .map(g => ({ id: g.id, label: g.label, file: g.file?.id || null, adverts: (g.adverts || []).map(a => a.id) }));

      const updated = await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { file_groups: remaining },
      });

      return ctx.send({ success: true, message: 'File group removed', fileGroups: updated.file_groups });
    } catch (error) {
      console.error('❌ removeFileGroup:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /design-batches/:id/file-groups/:groupId/adverts
   * Body: { advertId }
   *
   * Guard rail: an advert can only join a group whose batch target_run_date
   * is one of that advert's own remaining pendingDates — this is what makes
   * "the same advert in different file groups on different dates" safe.
   */
  async addAdvertToFileGroup(ctx) {
    try {
      const { id, groupId } = ctx.params;
      const { advertId } = ctx.request.body || {};
      if (!advertId) return ctx.badRequest({ success: false, message: 'advertId is required' });

      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        fields: ['id', 'target_run_date'],
        populate: { file_groups: { populate: { file: { fields: ['id'] }, adverts: { fields: ['id'] } } } },
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const advert = await strapi.entityService.findOne('api::advert.advert', advertId, {
        fields: ['id', 'publishing_dates', 'isPaid', 'isCanceled'],
        populate: { advert_daily_schedules: { fields: ['id', 'run_date'] } },
      });
      if (!advert) return ctx.notFound({ success: false, message: `Advert ${advertId} not found` });
      if (!advert.isPaid || advert.isCanceled) {
        return ctx.badRequest({ success: false, message: 'Advert must be paid and not cancelled' });
      }

      const scheduleStatus = strapi.service('api::advert.schedule-status');
      const scheduledDates = (advert.advert_daily_schedules || []).map(s => s.run_date).filter(Boolean);
      const pendingDates = scheduleStatus.computePendingDates(advert.publishing_dates, scheduledDates);

      if (!pendingDates.includes(batch.target_run_date)) {
        return ctx.badRequest({
          success: false,
          message: `Advert ${advertId} is not booked to run on ${batch.target_run_date}`,
          pendingDates,
        });
      }

      const groups = (batch.file_groups || []).map(g => {
        const advertIds = (g.adverts || []).map(a => a.id);
        if (String(g.id) === String(groupId) && !advertIds.includes(Number(advertId))) {
          advertIds.push(Number(advertId));
        }
        return { id: g.id, label: g.label, file: g.file?.id || null, adverts: advertIds };
      });

      const updated = await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { file_groups: groups, adverts: [...new Set(groups.flatMap(g => g.adverts))] },
      });

      return ctx.send({ success: true, message: 'Advert added to file group', fileGroups: updated.file_groups });
    } catch (error) {
      console.error('❌ addAdvertToFileGroup:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * DELETE /design-batches/:id/file-groups/:groupId/adverts/:advertId
   */
  async removeAdvertFromFileGroup(ctx) {
    try {
      const { id, groupId, advertId } = ctx.params;
      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        populate: { file_groups: { populate: { file: { fields: ['id'] }, adverts: { fields: ['id'] } } } },
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const groups = (batch.file_groups || []).map(g => {
        let advertIds = (g.adverts || []).map(a => a.id);
        if (String(g.id) === String(groupId)) {
          advertIds = advertIds.filter(aid => String(aid) !== String(advertId));
        }
        return { id: g.id, label: g.label, file: g.file?.id || null, adverts: advertIds };
      });

      const updated = await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { file_groups: groups, adverts: [...new Set(groups.flatMap(g => g.adverts))] },
      });

      return ctx.send({ success: true, message: 'Advert removed from file group', fileGroups: updated.file_groups });
    } catch (error) {
      console.error('❌ removeAdvertFromFileGroup:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /design-batches/:id/file-groups/:groupId/upload
   * Multipart, field name "file" — one file per group.
   */
  async uploadFileToGroup(ctx) {
    try {
      const { id, groupId } = ctx.params;
      const uploaded = ctx.request.files?.file;
      if (!uploaded) return ctx.badRequest({ success: false, message: 'No file provided (field name "file")' });

      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        populate: { file_groups: { populate: { file: { fields: ['id'] }, adverts: { fields: ['id'] } } } },
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const [result] = await strapi.plugins.upload.services.upload.upload({
        data: {},
        files: uploaded,
      });

      const groups = (batch.file_groups || []).map(g => ({
        id: g.id,
        label: g.label,
        file: String(g.id) === String(groupId) ? result.id : (g.file?.id || null),
        adverts: (g.adverts || []).map(a => a.id),
      }));

      const updated = await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { file_groups: groups },
      });

      return ctx.send({
        success: true,
        message: 'File uploaded to group',
        file: { id: result.id, name: result.name, url: result.url, size: result.size },
        fileGroups: updated.file_groups,
      });
    } catch (error) {
      console.error('❌ uploadFileToGroup:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /design-batches/:id/attach
   * Body: { runTime? }  — runDate is always the batch's own target_run_date.
   *
   * Finds or creates the advert-daily-schedule row for that date, merges
   * this batch's files/adverts into it, and recomputes isScheduled on every
   * affected advert from its actual remaining pendingDates (never a blind
   * true/false write).
   */
  async attachToSchedule(ctx) {
    try {
      const { id } = ctx.params;
      const { runTime } = ctx.request.body || {};

      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        populate: { file_groups: { populate: { file: { fields: ['id'] }, adverts: { fields: ['id'] } } } },
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const runDate = batch.target_run_date;
      const fileIds = [...new Set((batch.file_groups || []).filter(g => g.file).map(g => g.file.id))];
      const advertIds = collectAdvertIds(batch.file_groups);

      if (advertIds.length === 0) {
        return ctx.badRequest({ success: false, message: 'Batch has no adverts to attach' });
      }

      let schedule = (await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
        filters: { run_date: runDate },
        populate: { adverts: { fields: ['id'] }, media: { fields: ['id'] } },
        limit: 1,
      }))[0];

      if (schedule) {
        const mergedAdverts = [...new Set([...(schedule.adverts || []).map(a => a.id), ...advertIds])];
        const mergedMedia = [...new Set([...(schedule.media || []).map(m => m.id), ...fileIds])];
        schedule = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
          data: { adverts: mergedAdverts, media: mergedMedia, source_batches: { connect: [id] } },
        });
      } else {
        schedule = await strapi.entityService.create('api::advert-daily-schedule.advert-daily-schedule', {
          data: {
            run_date: runDate,
            run_time: JSON.stringify(['00:00 AM']),
            is_published: false,
            adverts: advertIds,
            media: fileIds,
            source_batches: { connect: [id] },
          },
        });
      }

      await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { status: 'attached' },
      });

      const scheduleStatus = strapi.service('api::advert.schedule-status');
      const recomputed = await scheduleStatus.recomputeMany(advertIds);

      return ctx.send({
        success: true,
        message: `Batch attached to ${runDate}`,
        scheduleId: schedule.id,
        runDate,
        advertsAttached: advertIds.length,
        filesAttached: fileIds.length,
        advertStatuses: recomputed,
      });
    } catch (error) {
      console.error('❌ attachToSchedule:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /design-batches/:id/mark-ready
   */
  async markReady(ctx) {
    try {
      const { id } = ctx.params;
      const batch = await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { status: 'ready' },
      });
      return ctx.send({ success: true, message: 'Batch marked ready', status: batch.status });
    } catch (error) {
      console.error('❌ markReady:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * POST /design-batches/:id/archive
   */
  async archiveBatch(ctx) {
    try {
      const { id } = ctx.params;
      const batch = await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { status: 'archived' },
      });
      return ctx.send({ success: true, message: 'Batch archived', status: batch.status });
    } catch (error) {
      console.error('❌ archiveBatch:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};
