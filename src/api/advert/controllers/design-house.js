'use strict';

/**
 * Design House Controller
 * Handles all design house operations for adverts ready for design work.
 *
 * Filtering rules (corrected):
 *   - isPaid: true          → only paid adverts qualify
 *   - hasRun: false         → adverts that have already run drop out of the queue
 *   - isCanceled: false     → exclude cancelled adverts
 *   - pendingDates          → publishing_dates minus dates already covered by an
 *                             advert-daily-schedule row; queue membership requires
 *                             at least one pendingDate after today.
 *
 * publishing_dates is a JSON array, so pendingDates can't be filtered in the
 * DB query — isPaid/hasRun/isCanceled narrow it at the DB level, then the
 * pendingDates test runs in JS via the shared schedule-status service (the
 * same source of truth that maintains isScheduled).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Accepts either a flat JSON body or Strapi's conventional {data:{...}}
 * wrapper — see the same helper in design-batch.js for why this exists.
 */
function bodyOf(ctx) {
  const raw = ctx.request.body || {};
  return (raw.data && typeof raw.data === 'object') ? raw.data : raw;
}

/**
 * Normalise a raw Strapi advert record into the camelCase shape the frontend expects.
 * @param {object} advert        - raw record from entityService
 * @param {string} today         - YYYY-MM-DD string for today
 * @param {object} scheduleStatus - strapi.service('api::advert.schedule-status')
 */
function transformAdvert(advert, today, scheduleStatus) {
  const attachments = (advert.attachments || []).map(f => ({
    id:        f.id,
    name:      f.name,
    url:       f.url,
    size:      f.size,
    mime:      f.mime,
    ext:       f.ext,
    createdAt: f.createdAt,
  }));

  const totalBytes    = attachments.reduce((s, f) => s + (f.size || 0), 0);
  const startDate     = advert.start_date;  // YYYY-MM-DD
  const endDate       = advert.end_date;    // YYYY-MM-DD

  const runningNow  = !!startDate && !!endDate && startDate <= today && endDate >= today;
  const isUpcoming  = !!startDate && startDate > today;

  // Publishing dates – stored as JSON array of YYYY-MM-DD strings.
  // This is the source of truth for what the client actually paid for.
  const publishingDates = Array.isArray(advert.publishing_dates)
    ? [...advert.publishing_dates].sort()
    : [];

  // Dates that already have a schedule entry
  const scheduledDates = (advert.advert_daily_schedules || [])
    .map(s => s.run_date)
    .filter(Boolean)
    .sort();

  // publishing_dates minus scheduledDates — a multi-date booking stays
  // "pending" until every one of its dates is covered, not just the first.
  const pendingDates = scheduleStatus.computePendingDates(publishingDates, scheduledDates);

  // Derive platform label from product → category
  const platform = advert.product?.category?.category_type
    || advert.product?.category?.category_name
    || advert.product?.product_name
    || '—';

  const salesAgents = (advert.vgams_sales_persons || []).map(sp => sp.name || sp.email || '');

  return {
    id:                  advert.id,
    reference:           advert.reference_number,
    bcReference:         advert.bc_reference_number || '',
    advertTitle:         advert.advert_title,
    clientName:          advert.client?.company_name || '—',
    contactPerson:       advert.contact_person  || advert.client?.contact_person || '',
    contactNumber:       advert.contact_number  || '',
    contactEmail:        advert.contact_email   || '',
    clientRef:           advert.client_reference_no || '',
    platform,
    category:            advert.product?.category?.category_name || '—',
    product:             advert.product?.product_name || '—',
    adSize:              advert.ad_size,
    adType:              advert.ad_type,
    frequency:           advert.frequency,
    startDate,
    endDate,
    publishingDates,
    scheduledDates,                        // dates that already have a schedule
    pendingDates,                          // dates still needing a schedule
    totalAmount:         advert.total_amount,
    paymentMethod:       advert.payment_method,
    specialInstructions: advert.special_instructions || '',
    status:              advert.status,
    isActive:            advert.isActive,
    isPaid:              advert.isPaid,
    isApproved:          advert.isApproved,   // design approved → next stage
    isScheduled:         advert.isScheduled,  // derived by schedule-status, never blindly flipped
    hasRun:              advert.hasRun,
    isClosed:            advert.isClosed,
    isCanceled:          advert.isCanceled,
    attachments,
    attachmentsCount:    attachments.length,
    totalFileSize:       formatFileSize(totalBytes),
    createdBy:           advert.vgams_user?.name || advert.vgams_user?.email || '',
    salesAgents,
    hasBrief:            !!(advert.special_instructions?.trim()),
    // Derived display fields
    runningNow,                             // today within advert date range
    isUpcoming,                             // advert starts in the future
    designStatus:        advert.isApproved ? 'approved' : 'pending',
    createdAt:           advert.createdAt,
    updatedAt:           advert.updatedAt,
  };
}

/** Fields to always request from entityService */
const ADVERT_FIELDS = [
  'id', 'reference_number', 'bc_reference_number', 'advert_title',
  'frequency', 'ad_size', 'ad_type',
  'start_date', 'end_date',
  'base_price', 'surcharge', 'discount', 'total_amount',
  'payment_method', 'special_instructions',
  'publishing_dates',
  'status',
  'isActive', 'isPaid', 'isClosed', 'isCanceled', 'isApproved',
  'hasRun', 'isScheduled',
  'publish_onweb', 'revenue_stream', 'cost_stream',
  'office_location', 'client_reference_no',
  'contact_person', 'contact_number', 'contact_email',
  'createdAt', 'updatedAt',
];

const ADVERT_POPULATE = {
  client: {
    fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'address'],
  },
  product: {
    fields: ['id', 'product_name', 'description'],
    populate: {
      category: { fields: ['id', 'category_name', 'category_type', 'description'] },
    },
  },
  rate_card: {
    fields: ['id', 'price_fc', 'price_bw', 'ad_type', 'size_dimension', 'duration', 'time_slot', 'currency'],
  },
  attachments: {
    fields: ['id', 'name', 'url', 'size', 'mime', 'ext', 'createdAt', 'updatedAt'],
  },
  vgams_user: {
    fields: ['id', 'name', 'email', 'role'],
  },
  vgams_sales_persons: {
    fields: ['id', 'name', 'email'],
  },
  comments: {
    fields: ['id', 'comment_text', 'createdAt', 'updatedAt'],
    sort: { createdAt: 'desc' },
  },
  advert_daily_schedules: {
    fields: ['id', 'run_date'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {

  /**
   * The full "still pending, across all dates" queue.
   * POST /api/design-house/active-adverts
   * Body: { startDate?, endDate? } — optional; if given, narrows results to
   * adverts with at least one pendingDate inside the window. If omitted,
   * returns every advert with any pendingDate still in the future.
   */
  async getActiveAdverts(ctx) {
    try {
      const body = bodyOf(ctx);
      const { startDate, endDate } = body;
      const today = new Date().toISOString().split('T')[0];
      const scheduleStatus = strapi.service('api::advert.schedule-status');

      // Cheap DB-level filter — publishing_dates itself can't be queried in SQL
      const filters = {
        isPaid:     true,
        hasRun:     false,
        isCanceled: false,
      };

      const raw = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        fields:   ADVERT_FIELDS,
        populate:  ADVERT_POPULATE,
        sort:      { start_date: 'desc' },
        limit:    -1,
      });

      let adverts = raw.map(a => transformAdvert(a, today, scheduleStatus));

      // Queue membership: at least one pending date after today
      adverts = adverts.filter(a => a.pendingDates.some(d => d > today));

      // Optional narrowing to a window, if the caller passed one
      if (startDate && endDate) {
        adverts = adverts.filter(a => a.pendingDates.some(d => d >= startDate && d <= endDate));
      }

      // Quick summary counts
      const summary = {
        total:            adverts.length,
        runningNow:       adverts.filter(a => a.runningNow).length,
        upcoming:         adverts.filter(a => a.isUpcoming).length,
        pendingDesign:    adverts.filter(a => !a.isApproved).length,
        designApproved:   adverts.filter(a =>  a.isApproved).length,
        readyToSchedule:  adverts.filter(a =>  a.isApproved && a.pendingDates.length > 0).length,
        scheduled:        adverts.filter(a =>  a.pendingDates.length === 0).length,
        withFiles:        adverts.filter(a =>  a.attachmentsCount > 0).length,
        withoutFiles:     adverts.filter(a =>  a.attachmentsCount === 0).length,
        urgent:           adverts.filter(a => {
          const next = a.pendingDates[0];
          if (!next) return false;
          const daysLeft = Math.ceil((new Date(next) - new Date(today)) / 86400000);
          return daysLeft >= 0 && daysLeft <= 3;
        }).length,
      };

      return ctx.send({
        success:  true,
        count:    adverts.length,
        adverts,
        summary,
        dateRange: (startDate && endDate) ? { startDate, endDate } : null,
      });

    } catch (error) {
      console.error('❌ getActiveAdverts:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * Day-first working view: every advert actually booked to run on one exact
   * date, regardless of its other dates. This is what the designer's day
   * switcher drives — pick a date, see everything touching that day.
   * POST /api/design-house/adverts/by-date
   * Body: { date: 'YYYY-MM-DD' }
   */
  async getBookingsByDate(ctx) {
    try {
      const { date } = bodyOf(ctx);
      if (!date) {
        return ctx.badRequest({
          success: false,
          message: 'date is required in the request body',
          example: { date: '2026-08-03' },
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const scheduleStatus = strapi.service('api::advert.schedule-status');

      // DB-level filter on the three booleans only — publishing_dates (a JSON
      // array) can't be queried in SQL, and start_date/end_date are NOT a
      // reliable stand-in for it: end_date isn't guaranteed to actually span
      // every entry in publishing_dates (e.g. a 4-day booking whose end_date
      // was left at the first day), which silently drops later dates from
      // this query before the publishing_dates check ever runs. So: filter
      // on the booleans here, then match the exact date against
      // publishing_dates in JS below.
      const raw = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid:     true,
          isActive:   true,
          isCanceled: false,
        },
        fields:   ADVERT_FIELDS,
        populate:  ADVERT_POPULATE,
        limit:    -1,
      });

      // The only real gate: publishing_dates (the JSON array) must actually contain this date
      const adverts = raw
        .filter(a => Array.isArray(a.publishing_dates) && a.publishing_dates.includes(date))
        .map(a => {
          const transformed = transformAdvert(a, today, scheduleStatus);
          return {
            ...transformed,
            scheduledForThisDate: transformed.scheduledDates.includes(date),
          };
        });

      return ctx.send({
        success:         true,
        date,
        count:           adverts.length,
        needsDesign:     adverts.filter(a => !a.scheduledForThisDate).length,
        alreadyScheduled: adverts.filter(a =>  a.scheduledForThisDate).length,
        adverts,
      });

    } catch (error) {
      console.error('❌ getBookingsByDate:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * Get specific advert details for design work.
   * GET /api/design-house/adverts/:id
   */
  async getAdvertDetails(ctx) {
    try {
      const { id } = ctx.params;
      if (!id) return ctx.badRequest({ success: false, message: 'Advert ID is required' });

      const today = new Date().toISOString().split('T')[0];
      const scheduleStatus = strapi.service('api::advert.schedule-status');

      const raw = await strapi.entityService.findOne('api::advert.advert', id, {
        fields:   ADVERT_FIELDS,
        populate:  ADVERT_POPULATE,
      });

      if (!raw) return ctx.notFound({ success: false, message: `Advert ${id} not found` });

      return ctx.send({ success: true, advert: transformAdvert(raw, today, scheduleStatus) });

    } catch (error) {
      console.error('❌ getAdvertDetails:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * Upload design files for an advert.
   * POST /api/design-house/adverts/:id/upload
   */
  async uploadDesignFiles(ctx) {
    try {
      const { id } = ctx.params;
      if (!id) return ctx.badRequest({ success: false, message: 'Advert ID is required' });

      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields:  ['id', 'reference_number', 'advert_title', 'isPaid', 'isCanceled'],
        populate: { attachments: { fields: ['id'] } },
      });

      if (!advert)        return ctx.notFound({ success: false, message: `Advert ${id} not found` });
      if (advert.isCanceled) return ctx.badRequest({ success: false, message: 'Cannot upload files for a cancelled advert' });

      // Strapi handles multipart via ctx.request.files
      const uploadedFiles = ctx.request.files?.files;
      if (!uploadedFiles) return ctx.badRequest({ success: false, message: 'No files provided' });

      const filesArray = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];

      // Upload each file via Strapi's upload plugin
      const uploadResults = [];
      for (const file of filesArray) {
        const result = await strapi.plugins.upload.services.upload.upload({
          data: { ref: 'api::advert.advert', refId: id, field: 'attachments' },
          files: file,
        });
        uploadResults.push(...(Array.isArray(result) ? result : [result]));
      }

      return ctx.send({
        success:      true,
        message:      `${uploadResults.length} file(s) uploaded successfully`,
        uploadedFiles: uploadResults.map(f => ({ id: f.id, name: f.name, url: f.url, size: f.size })),
        advertId:     id,
        reference:    advert.reference_number,
      });

    } catch (error) {
      console.error('❌ uploadDesignFiles:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * Mark design work as complete (sets isApproved = true).
   * POST /api/design-house/adverts/:id/complete
   * Body: { notes?: string, designerEmail?: string }
   */
  async markDesignComplete(ctx) {
    try {
      const { id } = ctx.params;
      if (!id) return ctx.badRequest({ success: false, message: 'Advert ID is required' });

      const { notes, designerEmail } = bodyOf(ctx);

      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields: ['id', 'reference_number', 'advert_title', 'isClosed', 'isApproved'],
      });

      if (!advert) return ctx.notFound({ success: false, message: `Advert ${id} not found` });
      if (advert.isClosed) return ctx.badRequest({ success: false, message: 'Advert is already closed' });

      // Optionally resolve designer
      let designerUserId = null;
      if (designerEmail) {
        const users = await strapi.entityService.findMany('api::vgams-user.vgams-user', {
          filters: { email: designerEmail },
          fields:  ['id', 'name', 'email'],
          limit:   1,
        });
        if (users?.length > 0) designerUserId = users[0].id;
      }

      // Mark design as approved
      await strapi.entityService.update('api::advert.advert', id, {
        data: { isApproved: true },
      });

      // Log a comment if notes were provided
      if (notes?.trim()) {
        try {
          await strapi.entityService.create('api::comment.comment', {
            data: {
              content: `Design approved. ${notes}`,
              advert:  id,
              ...(designerUserId ? { user: designerUserId } : {}),
            },
          });
        } catch (commentErr) {
          console.warn('⚠️ Could not create design-complete comment:', commentErr.message);
        }
      }

      return ctx.send({
        success:          true,
        message:          'Design marked as approved',
        advertId:         id,
        referenceNumber:  advert.reference_number,
        isApproved:       true,
      });

    } catch (error) {
      console.error('❌ markDesignComplete:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * Get design statistics.
   * POST /api/design-house/stats
   * Body: { startDate?: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD' } — accepted for
   * backward compatibility but no longer gates the core queue counts, which
   * are now pendingDates-based rather than date-range-overlap-based.
   */
  async getDesignStats(ctx) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const scheduleStatus = strapi.service('api::advert.schedule-status');

      const baseFilter = { isPaid: true, hasRun: false, isCanceled: false };

      const [queueCandidates, scheduledAdverts] = await Promise.all([
        strapi.entityService.findMany('api::advert.advert', {
          filters: baseFilter,
          fields:  ['id', 'start_date', 'end_date', 'isApproved', 'publishing_dates'],
          populate: {
            advert_daily_schedules: { fields: ['id', 'run_date'] },
            attachments: { fields: ['id'] },
          },
          limit:   -1,
        }),
        // isScheduled is now correctly maintained by schedule-status, safe to trust directly
        strapi.entityService.findMany('api::advert.advert', {
          filters: { isPaid: true, isCanceled: false, isScheduled: true },
          fields:  ['id'],
          limit:   -1,
        }),
      ]);

      const withPending = queueCandidates.map(a => {
        const scheduledDates = (a.advert_daily_schedules || []).map(s => s.run_date).filter(Boolean);
        const pendingDates = scheduleStatus.computePendingDates(a.publishing_dates, scheduledDates);
        return { ...a, pendingDates };
      });

      const inQueue = withPending.filter(a => a.pendingDates.some(d => d > today));

      const runningNow = inQueue.filter(a => a.start_date <= today && a.end_date >= today).length;
      const upcoming   = inQueue.filter(a => a.start_date > today).length;
      const totalFiles = withPending.reduce((s, a) => s + (a.attachments?.length || 0), 0);

      return ctx.send({
        success: true,
        statistics: {
          running:          runningNow,
          upcoming,
          pendingDesign:    inQueue.filter(a => !a.isApproved).length,
          designApproved:   inQueue.filter(a =>  a.isApproved).length,
          readyToSchedule:  inQueue.filter(a =>  a.isApproved).length,
          scheduled:        scheduledAdverts.length,
          totalFiles,
          lastUpdated:      new Date().toISOString(),
        },
      });

    } catch (error) {
      console.error('❌ getDesignStats:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};
