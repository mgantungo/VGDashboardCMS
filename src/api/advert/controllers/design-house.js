'use strict';

/**
 * Design House Controller
 * Handles all design house operations for adverts ready for design work.
 *
 * Filtering rules:
 *   - isPaid: true          → only paid adverts qualify
 *   - isCanceled: false     → exclude cancelled adverts
 *   - date range overlap    → advert's [start_date … end_date] overlaps the requested [startDate … endDate]
 *   - isApproved            → TRUE means design work is signed off; advert moves to scheduling queue
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

  // Derive platform label from product → category
  const platform = advert.product?.category?.category_type
    || advert.product?.category?.category_name
    || advert.product?.product_name
    || '—';

  const salesAgents = (advert.vgams_sales_persons || []).map(sp => sp.name || sp.email || '');

  return {
    id:                  advert.id,
    reference:           advert.reference_number,
    advertTitle:         advert.advert_title,
    clientName:          advert.client?.company_name || '—',
    clientRef:           advert.client_reference_no || '',
    platform,
    category:            advert.product?.category?.category_name || '—',
    product:             advert.product?.product_name || '—',
    adSize:              advert.ad_size,
    adType:              advert.ad_type,
    frequency:           advert.frequency,
    startDate,
    endDate,
    publishingDates,                       // ← NEW: array of ISO date strings
    totalAmount:         advert.total_amount,
    paymentMethod:       advert.payment_method,
    specialInstructions: advert.special_instructions || '',
    status:              advert.status,
    isActive:            advert.isActive,
    isPaid:              advert.isPaid,
    isApproved:          advert.isApproved,   // design approved → next stage
    isScheduled:         advert.isScheduled,
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
  'id', 'reference_number', 'advert_title',
  'frequency', 'ad_size', 'ad_type',
  'start_date', 'end_date',
  'base_price', 'surcharge', 'discount', 'total_amount',
  'payment_method', 'special_instructions',
  'publishing_dates',                      // ← NEW
  'status',
  'isActive', 'isPaid', 'isClosed', 'isCanceled', 'isApproved',
  'hasRun', 'isScheduled',
  'publish_onweb', 'revenue_stream', 'cost_stream',
  'office_location', 'client_reference_no',
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
    fields: ['id', 'content', 'createdAt', 'updatedAt'],
    sort: { createdAt: 'desc' },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {

  /**
   * GET active adverts for design work.
   * POST /api/design-house/active-adverts
   * Body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
   *
   * Returns ALL paid, non-cancelled adverts whose date range overlaps the
   * requested window. Each record carries runningNow / isUpcoming flags so the
   * frontend can bucket them without an extra round-trip.
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

      // Core filter: paid, not cancelled, date range overlaps window
      const filters = {
        isPaid:     true,
        isCanceled: false,
        $and: [
          { start_date: { $lte: endDate   } },
          { end_date:   { $gte: startDate } },
        ],
      };

      const raw = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        fields:   ADVERT_FIELDS,
        populate:  ADVERT_POPULATE,
        sort:      { start_date: 'asc' },
        limit:    -1,
      });

      const adverts = raw.map(a => transformAdvert(a, today));

      // Quick summary counts
      const summary = {
        total:            adverts.length,
        runningNow:       adverts.filter(a => a.runningNow).length,
        upcoming:         adverts.filter(a => a.isUpcoming).length,
        pendingDesign:    adverts.filter(a => !a.isApproved).length,
        designApproved:   adverts.filter(a =>  a.isApproved).length,
        readyToSchedule:  adverts.filter(a =>  a.isApproved && !a.isScheduled).length,
        scheduled:        adverts.filter(a =>  a.isScheduled).length,
        withFiles:        adverts.filter(a =>  a.attachmentsCount > 0).length,
        withoutFiles:     adverts.filter(a =>  a.attachmentsCount === 0).length,
        urgent:           adverts.filter(a => {
          if (!a.endDate) return false;
          const daysLeft = Math.ceil((new Date(a.endDate) - new Date()) / 86400000);
          return daysLeft >= 0 && daysLeft <= 3;
        }).length,
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

      const baseFilter = { isPaid: true, isCanceled: false, ...dateFilter };

      // Parallel queries for counts
      const [allAdverts, approvedAdverts, scheduledAdverts, advertsForFiles] = await Promise.all([
        strapi.entityService.findMany('api::advert.advert', {
          filters: baseFilter,
          fields:  ['id', 'start_date', 'end_date', 'isApproved', 'isScheduled'],
          limit:   -1,
        }),
        strapi.entityService.findMany('api::advert.advert', {
          filters: { ...baseFilter, isApproved: true },
          fields:  ['id'],
          limit:   -1,
        }),
        strapi.entityService.findMany('api::advert.advert', {
          filters: { isPaid: true, isCanceled: false, isScheduled: true },
          fields:  ['id'],
          limit:   -1,
        }),
        strapi.entityService.findMany('api::advert.advert', {
          filters:  { isPaid: true, isCanceled: false },
          populate: { attachments: { fields: ['id'] } },
          fields:   ['id'],
          limit:    -1,
        }),
      ]);

      const runningNow = allAdverts.filter(a => a.start_date <= today && a.end_date >= today).length;
      const upcoming   = allAdverts.filter(a => a.start_date > today).length;
      const totalFiles = advertsForFiles.reduce((s, a) => s + (a.attachments?.length || 0), 0);

      return ctx.send({
        success: true,
        statistics: {
          running:          runningNow,
          upcoming,
          pendingDesign:    allAdverts.filter(a => !a.isApproved).length,
          designApproved:   approvedAdverts.length,
          readyToSchedule:  allAdverts.filter(a => a.isApproved && !a.isScheduled).length,
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
