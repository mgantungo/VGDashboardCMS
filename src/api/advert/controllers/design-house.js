'use strict';

/**
 * Design House Controller
 * Handles all design house operations for adverts ready for design work.
 *
 * Filtering rules:
 *   - isPaid: true          → only paid adverts qualify
 *   - hasRun: false         → the whole booking hasn't finished all its runs
 *   - isCanceled: false     → exclude cancelled adverts
 *   - pendingDates          → publishing_dates entries with no matching
 *                             advert_daily_schedule row yet. An advert stays
 *                             in the queue until every booked date is
 *                             covered, not just the first one.
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
 * Normalise a raw Strapi advert record into the camelCase shape the frontend expects.
 * @param {object} advert  - raw record from entityService
 * @param {string} today   - YYYY-MM-DD string for today
 */
function transformAdvert(advert, today) {
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

  // Publishing dates – stored as JSON array of YYYY-MM-DD strings
  const publishingDates = Array.isArray(advert.publishing_dates)
    ? [...advert.publishing_dates].sort()
    : [];

  // Dates that already have a schedule entry
  const scheduledDates = (advert.advert_daily_schedules || [])
    .map(s => s.run_date)
    .filter(Boolean)
    .sort();

  // Dates booked but not yet attached to any schedule — this, not the
  // isScheduled boolean, is what should drive queue inclusion for
  // multi-date bookings.
  const scheduledSet = new Set(scheduledDates);
  const pendingDates = publishingDates.filter(d => !scheduledSet.has(d));

  // Derive platform label from product → category
  const platform = advert.product?.category?.category_type
    || advert.product?.category?.category_name
    || advert.product?.product_name
    || '—';

  const salesAgents = (advert.vgams_sales_persons || []).map(sp => sp.name || sp.email || '');

  return {
    id:                  advert.id,
    reference:           advert.reference_number,
    bcOrderNumber:       advert.bc_reference_number,
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
    isScheduled:         advert.isScheduled,  // fully scheduled (all dates covered)
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
   * GET active adverts for design work — the "everything still pending"
   * overview, independent of any one date.
   * POST /api/design-house/active-adverts
   * Body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
   *
   * startDate/endDate remain a coarse DB-level prefilter (an advert whose
   * whole booking window falls outside it can't matter), but inclusion is
   * ultimately decided by pendingDates, not the date-range overlap alone —
   * an advert with 4 publishing_dates and 1 still open stays in the queue
   * even after its first date has passed.
   */
  async getActiveAdverts(ctx) {
    try {
      const body = ctx.request.body || {};
      const { startDate, endDate } = body;

      if (!startDate || !endDate) {
        return ctx.badRequest({
          success: false,
          message: 'Both startDate and endDate are required in the request body',
          example: { startDate: '2026-01-01', endDate: '2026-01-31' },
        });
      }

      const today = new Date().toISOString().split('T')[0];

      const filters = {
        isPaid:     true,
        isCanceled: false,
        hasRun:     false,
        $and: [
          { start_date: { $lte: endDate   } },
          { end_date:   { $gte: startDate } },
        ],
      };

      const raw = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        fields:   ADVERT_FIELDS,
        populate:  ADVERT_POPULATE,
        sort:      { start_date: 'desc' },
        limit:    -1,
      });

      const adverts = raw
        .map(a => transformAdvert(a, today))
        // Keep it in the queue only while it still has an uncovered date
        // ahead of today — fixes adverts vanishing after their first run.
        .filter(a => a.pendingDates.some(d => d >= today));

      const summary = {
        total:              adverts.length,
        runningNow:         adverts.filter(a => a.runningNow).length,
        upcoming:           adverts.filter(a => a.isUpcoming).length,
        pendingDesign:      adverts.filter(a => !a.isApproved).length,
        designApproved:     adverts.filter(a =>  a.isApproved).length,
        readyToSchedule:    adverts.filter(a =>  a.isApproved && a.pendingDates.length > 0).length,
        partiallyScheduled: adverts.filter(a =>  a.scheduledDates.length > 0 && a.pendingDates.length > 0).length,
        withFiles:          adverts.filter(a =>  a.attachmentsCount > 0).length,
      };

      return ctx.send({
        success:  true,
        count:    adverts.length,
        adverts,
        summary,
        dateRange: { startDate, endDate },
      });

    } catch (error) {
      console.error('❌ getActiveAdverts:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * The day-first view: every advert booked to run on one specific date,
   * whether it still needs design or is already scheduled for that date.
   * POST /api/design-house/adverts/by-date
   * Body: { date: 'YYYY-MM-DD' }
   */
  async getBookingsByDate(ctx) {
    try {
      const { date } = ctx.request.body || {};
      if (!date) {
        return ctx.badRequest({ success: false, message: 'date is required (YYYY-MM-DD)' });
      }

      const today = new Date().toISOString().split('T')[0];

      // Coarse DB prefilter — the booking's window must at least span the date.
      const filters = {
        isPaid:     true,
        isCanceled: false,
        hasRun:     false,
        start_date: { $lte: date },
        end_date:   { $gte: date },
      };

      const raw = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        fields:   ADVERT_FIELDS,
        populate:  ADVERT_POPULATE,
        sort:      { advert_title: 'asc' },
        limit:    -1,
      });

      const bookings = raw
        .map(a => transformAdvert(a, today))
        // publishing_dates is a JSON array — can't filter it in the DB,
        // so narrow down to an exact match here.
        .filter(a => a.publishingDates.includes(date))
        .map(a => ({
          ...a,
          scheduledForThisDate: a.scheduledDates.includes(date),
        }));

      return ctx.send({
        success: true,
        date,
        count: bookings.length,
        needsDesign: bookings.filter(b => !b.scheduledForThisDate).length,
        alreadyScheduled: bookings.filter(b => b.scheduledForThisDate).length,
        bookings,
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

      const raw = await strapi.entityService.findOne('api::advert.advert', id, {
        fields:   ADVERT_FIELDS,
        populate:  ADVERT_POPULATE,
      });

      if (!raw) return ctx.notFound({ success: false, message: `Advert ${id} not found` });

      return ctx.send({ success: true, advert: transformAdvert(raw, today) });

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

      const { notes, designerEmail } = ctx.request.body || {};

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
   * Body: { startDate?: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD' }
   */
  async getDesignStats(ctx) {
    try {
      const body       = ctx.request.body || {};
      const today      = new Date().toISOString().split('T')[0];
      const startDate  = body.startDate || today;
      const endDate    = body.endDate   || today;

      const dateFilter = {
        $and: [
          { start_date: { $lte: endDate   } },
          { end_date:   { $gte: startDate } },
        ],
      };

      const baseFilter = { isPaid: true, isCanceled: false, hasRun: false, ...dateFilter };

      const [allAdverts, advertsForFiles] = await Promise.all([
        strapi.entityService.findMany('api::advert.advert', {
          filters: baseFilter,
          fields:  ['id', 'start_date', 'end_date', 'publishing_dates', 'isApproved', 'isScheduled'],
          populate: { advert_daily_schedules: { fields: ['id', 'run_date'] } },
          limit:   -1,
        }),
        strapi.entityService.findMany('api::advert.advert', {
          filters:  { isPaid: true, isCanceled: false },
          populate: { attachments: { fields: ['id'] } },
          fields:   ['id'],
          limit:    -1,
        }),
      ]);

      const withDates = allAdverts.map(a => {
        const publishingDates = Array.isArray(a.publishing_dates) ? a.publishing_dates : [];
        const scheduledDates  = (a.advert_daily_schedules || []).map(s => s.run_date).filter(Boolean);
        const scheduledSet    = new Set(scheduledDates);
        const pendingDates    = publishingDates.filter(d => !scheduledSet.has(d));
        return { ...a, publishingDates, scheduledDates, pendingDates };
      });

      const runningNow = withDates.filter(a => a.start_date <= today && a.end_date >= today).length;
      const upcoming   = withDates.filter(a => a.start_date > today).length;
      const totalFiles = advertsForFiles.reduce((s, a) => s + (a.attachments?.length || 0), 0);

      return ctx.send({
        success: true,
        statistics: {
          running:            runningNow,
          upcoming,
          pendingDesign:      withDates.filter(a => !a.isApproved).length,
          designApproved:     withDates.filter(a =>  a.isApproved).length,
          readyToSchedule:    withDates.filter(a =>  a.isApproved && a.pendingDates.length > 0).length,
          scheduled:          withDates.filter(a =>  a.publishingDates.length > 0 && a.pendingDates.length === 0).length,
          partiallyScheduled: withDates.filter(a =>  a.scheduledDates.length > 0 && a.pendingDates.length > 0).length,
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
