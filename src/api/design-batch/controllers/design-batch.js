'use strict';

/**
 * Design Batch Controller
 *
 * A design-batch is the design house's working unit: one target run date,
 * one or more "ad slots" (a designed file + the adverts it contains).
 * Attaching a batch to a schedule snapshots its current ad slots into
 * the advert-daily-schedule row for that date — the batch itself stays
 * editable/reusable for other dates afterwards.
 */

// Workflow re-order: production gate + placement/invoice helpers
const {
  passesGate,
  isClearedGate,
  placementsFor,
  recomputeInvoiceStages,
  logWorkflow,
  findActor,
  isISODate,
  reply,
} = require('../../_vgams-helpers/vgams-workflow');

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
      uploaded_by: { fields: ['id', 'name', 'email'] },
    },
  },
  daily_schedules: { fields: ['id', 'run_date', 'is_published'] },
};

/** Every advert id referenced anywhere across a batch's ad slots, deduped. */
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
   * Full detail — ad slots with enriched advert data (BC order #, ad
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
        data: { file_groups: [...existingGroups, { label: label || `Ad Slot ${existingGroups.length + 1}`, adverts: [] }] },
      });

      return ctx.send({ success: true, message: 'Ad slot added', fileGroups: updated.file_groups });
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

      return ctx.send({ success: true, message: 'Ad slot removed', fileGroups: updated.file_groups });
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
   * "the same advert in different ad slots on different dates" safe.
   */
  async addAdvertToFileGroup(ctx) {
    try {
      const { id, groupId } = ctx.params;
      const { advertId, designerEmail } = ctx.request.body || {};
      if (!advertId) return ctx.badRequest({ success: false, message: 'advertId is required' });

      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        fields: ['id', 'target_run_date'],
        populate: { file_groups: { populate: { file: { fields: ['id'] }, adverts: { fields: ['id'] } } } },
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const advert = await strapi.entityService.findOne('api::advert.advert', advertId, {
        fields: ['id', 'publishing_dates', 'isPaid', 'isCanceled', 'production_cleared'],
        populate: { advert_daily_schedules: { fields: ['id', 'run_date'] } },
      });
      if (!advert) return ctx.notFound({ success: false, message: `Advert ${advertId} not found` });
      if (!passesGate(advert) || advert.isCanceled) {
        return ctx.badRequest({
          success: false,
          message: isClearedGate()
            ? 'Advert must be cleared for production and not cancelled'
            : 'Advert must be paid and not cancelled',
        });
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

      // Audit trail - non-blocking, same convention as existing corrections.
      // adverts.manyToMany on a component can't carry per-relation metadata,
      // so "who added this one" lives here rather than on the schema.
      let actorUserId = null;
      if (designerEmail) {
        const users = await strapi.entityService.findMany('api::vgams-user.vgams-user', {
          filters: { email: designerEmail },
          fields:  ['id'],
          limit:   1,
        });
        if (users?.length > 0) actorUserId = users[0].id;
      }
      try {
        const groupLabel = groups.find(g => String(g.id) === String(groupId))?.label || groupId;
        await strapi.entityService.create('api::workflow-log.workflow-log', {
          data: {
            advert:      advertId,
            action:      'design_group_added',
            new_status:  'design_group_added',
            ...(actorUserId ? { vgams_users: [actorUserId] } : {}),
            notes:       `Added to ad slot "${groupLabel}" in batch ${batch.id}`,
            timestamp:   new Date(),
          },
        });
      } catch (logErr) {
        console.warn('⚠️ Could not write design_group_added workflow-log entry:', logErr.message);
      }

      return ctx.send({ success: true, message: 'Advert added to ad slot', fileGroups: updated.file_groups });
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
      // DELETE requests carry this as a query param from the frontend
      // (?designerEmail=...) rather than a body - accept either.
      const designerEmail = ctx.query?.designerEmail || (ctx.request.body || {}).designerEmail;

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

      // Audit trail - non-blocking, same convention as existing corrections
      let actorUserId = null;
      if (designerEmail) {
        const users = await strapi.entityService.findMany('api::vgams-user.vgams-user', {
          filters: { email: designerEmail },
          fields:  ['id'],
          limit:   1,
        });
        if (users?.length > 0) actorUserId = users[0].id;
      }
      try {
        await strapi.entityService.create('api::workflow-log.workflow-log', {
          data: {
            advert:      advertId,
            action:      'design_group_removed',
            new_status:  'design_group_removed',
            ...(actorUserId ? { vgams_users: [actorUserId] } : {}),
            notes:       `Removed from ad slot ${groupId} in batch ${batch.id}`,
            timestamp:   new Date(),
          },
        });
      } catch (logErr) {
        console.warn('⚠️ Could not write design_group_removed workflow-log entry:', logErr.message);
      }

      return ctx.send({ success: true, message: 'Advert removed from ad slot', fileGroups: updated.file_groups });
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
      const { designerEmail } = ctx.request.body || {};

      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        populate: { file_groups: { populate: { file: { fields: ['id'] }, adverts: { fields: ['id'] } } } },
      });
      if (!batch) return ctx.notFound({ success: false, message: `Batch ${id} not found` });

      const [result] = await strapi.plugins.upload.services.upload.upload({
        data: {},
        files: uploaded,
      });

      // Resolve uploader once, same lookup convention used everywhere else
      let uploaderUserId = null;
      if (designerEmail) {
        const users = await strapi.entityService.findMany('api::vgams-user.vgams-user', {
          filters: { email: designerEmail },
          fields:  ['id'],
          limit:   1,
        });
        if (users?.length > 0) uploaderUserId = users[0].id;
      }
      const uploadedAt = new Date();

      let targetGroupAdvertIds = [];
      const groups = (batch.file_groups || []).map(g => {
        const isTarget = String(g.id) === String(groupId);
        if (isTarget) targetGroupAdvertIds = (g.adverts || []).map(a => a.id);
        return {
          id: g.id,
          label: g.label,
          file: isTarget ? result.id : (g.file?.id || null),
          adverts: (g.adverts || []).map(a => a.id),
          // Replacing a file overwrites this to the latest uploader by
          // design - it's "who uploaded the current file", not history.
          // The workflow-log entries below carry the history.
          ...(isTarget ? { uploaded_by: uploaderUserId, uploaded_at: uploadedAt } : {}),
        };
      });

      const updated = await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { file_groups: groups },
      });

      // Audit trail - non-blocking. One entry per advert already pinned to
      // this group at upload time; if the file lands before any advert is
      // pinned, there's nothing to log yet (the group-add call logs it then).
      if (targetGroupAdvertIds.length > 0) {
        try {
          const groupLabel = groups.find(g => String(g.id) === String(groupId))?.label || groupId;
          await Promise.all(targetGroupAdvertIds.map(advertId =>
            strapi.entityService.create('api::workflow-log.workflow-log', {
              data: {
                advert:      advertId,
                action:      'design_file_uploaded',
                new_status:  'design_file_uploaded',
                ...(uploaderUserId ? { vgams_users: [uploaderUserId] } : {}),
                notes:       `File "${result.name}" uploaded to ad slot "${groupLabel}"`,
                timestamp:   uploadedAt,
              },
            })
          ));
        } catch (logErr) {
          console.warn('⚠️ Could not write design_file_uploaded workflow-log entries:', logErr.message);
        }
      }

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
   * One schedule row PER AD SLOT, not one shared row per date. The
   * editor's atomic unit is the ad slot — it has its own file, its own
   * page number, its own publish state, and unscheduling it should never
   * touch an unrelated group that just happens to run the same day. (Groups
   * can still end up sharing the same PAGER page later via the print-queue
   * round-robin — that's a different, independent concept from this.)
   *
   * Idempotent by design: each group's schedule row is found by
   * (run_date, source_file_group_id), so re-attaching after editing a
   * batch (adding/removing a file, moving an advert to a different group)
   * finds and updates that group's own row rather than creating a
   * duplicate or touching any other group's row.
   *
   * isScheduled is recomputed for every advert affected in either
   * direction — newly connected AND newly disconnected — since removing an
   * advert from a group needs its isScheduled reconsidered too. Never a
   * blind true/false write.
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
      const groupsWithAdverts = (batch.file_groups || []).filter(g => (g.adverts || []).length > 0);

      if (groupsWithAdverts.length === 0) {
        return ctx.badRequest({ success: false, message: 'Batch has no ad slots with adverts to attach' });
      }

      const scheduleStatus = strapi.service('api::advert.schedule-status');
      const groupResults = [];
      const affectedAdvertIds = new Set();

      for (const group of groupsWithAdverts) {
        const groupAdvertIds = (group.adverts || []).map(a => a.id);
        const fileId = group.file?.id || null;

        // This group's own schedule row — matched by (run_date, source_file_group_id),
        // never by run_date alone, so unrelated groups on the same date never collide.
        let schedule = (await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
          filters: { run_date: runDate, source_file_group_id: group.id },
          populate: { adverts: { fields: ['id'] } },
          limit: 1,
        }))[0];

        const previousAdvertIds = schedule ? (schedule.adverts || []).map(a => a.id) : [];
        let created = false;

        if (!schedule) {
          created = true;
          schedule = await strapi.entityService.create('api::advert-daily-schedule.advert-daily-schedule', {
            data: {
              run_date: runDate,
              run_time: JSON.stringify([runTime || '00:00 AM']),
              is_published: false,
              adverts: groupAdvertIds,
              media: fileId ? [fileId] : [],
              source_batches: { connect: [id] },
              source_file_group_id: group.id,
            },
          });
        } else {
          const toConnect    = groupAdvertIds.filter(aid => !previousAdvertIds.includes(aid));
          const toDisconnect = previousAdvertIds.filter(aid => !groupAdvertIds.includes(aid));
          schedule = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
            data: {
              adverts: { connect: toConnect, disconnect: toDisconnect },
              media: fileId ? [fileId] : [],
              source_batches: { connect: [id] },
            },
          });
        }

        groupAdvertIds.forEach(aid => affectedAdvertIds.add(aid));
        previousAdvertIds.forEach(aid => affectedAdvertIds.add(aid)); // covers anyone disconnected too

        groupResults.push({
          groupId: group.id,
          label: group.label || null,
          scheduleId: schedule.id,
          created,
          advertCount: groupAdvertIds.length,
        });
      }

      await strapi.entityService.update('api::design-batch.design-batch', id, {
        data: { status: 'attached' },
      });

      const recomputed = await scheduleStatus.recomputeMany([...affectedAdvertIds]);

      return ctx.send({
        success: true,
        message: `Batch synced to ${runDate} — ${groupResults.length} ad slot(s), each on its own schedule row`,
        runDate,
        groups: groupResults,
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
   * POST /design-batches/:id/attach-multi
   * Body: { runDates?: string[] | 'all_pending', runTime?, userEmail? }
   *
   * Workflow re-order: the batch-level version of "carry artwork forward".
   * The batch's own target_run_date is always attached (exactly as /attach
   * does). Each extra date gets its own schedule row per ad slot, holding
   * the same file and carried_from → the target-date row, but only for the
   * adverts in that slot that are actually booked to run on that date.
   * /attach itself is left untouched.
   */
  async attachMulti(ctx) {
    try {
      const { id } = ctx.params;
      const body = ctx.request.body || {};
      const runTime = body.runTime || null;

      const batch = await strapi.entityService.findOne('api::design-batch.design-batch', id, {
        populate: {
          file_groups: {
            populate: {
              file: { fields: ['id'] },
              adverts: { fields: ['id', 'publishing_dates', 'isCanceled'] },
            },
          },
        },
      });
      if (!batch) return reply(ctx, 404, { success: false, message: `Batch ${id} not found` });

      const targetDate = batch.target_run_date;
      const groupsWithAdverts = (batch.file_groups || []).filter(g => (g.adverts || []).length > 0);
      if (groupsWithAdverts.length === 0) {
        return reply(ctx, 400, { success: false, message: 'Batch has no ad slots with adverts to attach' });
      }

      // Every date any advert in the batch is booked for, from the target date on
      const bookedDates = [...new Set(groupsWithAdverts.flatMap(g =>
        (g.adverts || []).flatMap(a => (Array.isArray(a.publishing_dates) ? a.publishing_dates : []))
      ))].filter(d => isISODate(d) && d >= targetDate).sort();

      let requested;
      if (body.runDates === 'all_pending' || body.runDates === undefined) {
        requested = bookedDates;
      } else if (Array.isArray(body.runDates)) {
        requested = body.runDates.filter(isISODate);
      } else {
        return reply(ctx, 400, { success: false, message: "runDates must be an array of YYYY-MM-DD or 'all_pending'" });
      }
      const runDates = [...new Set([targetDate, ...requested])].sort();

      const scheduleStatus = strapi.service('api::advert.schedule-status');
      const affectedAdvertIds = new Set();
      const results = [];

      for (const group of groupsWithAdverts) {
        const fileId = group.file?.id || null;
        let targetRowId = null;

        for (const runDate of runDates) {
          const advertIds = (group.adverts || [])
            .filter(a => !a.isCanceled)
            .filter(a => runDate === targetDate
              || (Array.isArray(a.publishing_dates) && a.publishing_dates.includes(runDate)))
            .map(a => a.id);
          if (advertIds.length === 0) continue;

          let row = (await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
            filters: { run_date: runDate, source_file_group_id: group.id },
            populate: { adverts: { fields: ['id'] } },
            limit: 1,
          }))[0];

          const previousIds = row ? (row.adverts || []).map(a => a.id) : [];
          const carried = runDate !== targetDate && targetRowId ? { carried_from: targetRowId } : {};

          if (!row) {
            row = await strapi.entityService.create('api::advert-daily-schedule.advert-daily-schedule', {
              data: {
                run_date: runDate,
                run_time: JSON.stringify([runTime || '00:00 AM']),
                is_published: false,
                adverts: advertIds,
                media: fileId ? [fileId] : [],
                source_batches: { connect: [id] },
                source_file_group_id: group.id,
                artwork_dropped: false,
                ...carried,
              },
            });
          } else {
            row = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', row.id, {
              data: {
                adverts: {
                  connect: advertIds.filter(aid => !previousIds.includes(aid)),
                  disconnect: previousIds.filter(aid => !advertIds.includes(aid)),
                },
                media: fileId ? [fileId] : [],
                source_batches: { connect: [id] },
                artwork_dropped: false,
                ...carried,
              },
            });
          }
          if (runDate === targetDate) targetRowId = row.id;

          // If Copy Desk already placed these adverts for this date, mirror the page
          const placements = await placementsFor(strapi, advertIds, [runDate]);
          const page = advertIds.map(aid => placements.get(aid)?.[0]?.pageNumber).find(n => n);
          if (page) {
            await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', row.id, {
              data: { page },
            });
          }

          advertIds.forEach(aid => affectedAdvertIds.add(aid));
          previousIds.forEach(aid => affectedAdvertIds.add(aid));
          results.push({ groupId: group.id, label: group.label || null, runDate, scheduleId: row.id, advertIds, advertCount: advertIds.length, carried: !!carried.carried_from });
        }
      }

      await strapi.entityService.update('api::design-batch.design-batch', id, { data: { status: 'attached' } });

      const ids = [...affectedAdvertIds];
      const advertStatuses = await scheduleStatus.recomputeMany(ids);
      const invoiceStages = await recomputeInvoiceStages(strapi, ids);

      const actor = await findActor(strapi, ctx);
      for (const aid of ids) {
        const dates = results.filter(r => r.advertIds.includes(aid)).map(r => r.runDate);
        await logWorkflow(strapi, {
          advertId: aid,
          action: 'artwork_attached',
          actorId: actor?.id || null,
          notes: `Batch ${batch.id} attached to ${[...new Set(dates)].join(', ')}`,
        });
      }

      return ctx.send({
        success: true,
        message: `Batch attached to ${runDates.length} date(s)`,
        runDates,
        rows: results,
        advertStatuses,
        invoiceStages,
      });
    } catch (error) {
      console.error('❌ attachMulti:', error);
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