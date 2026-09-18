'use strict';

/**
 * Design House Controller
 * Handles all design house operations for adverts ready for design work.
 *
 * Filtering rules (corrected):
 *   - isPaid: true          → only paid adverts qualify
 *   - hasRun: false         → adverts that have already run drop out of the queue
 *   - isCanceled: false     → exclude cancelled adverts
 *   - product.category.category_type === scope → defaults to 'print' on every
 *                             endpoint below (Design House works on print layout
 *                             day-to-day); the front end can pass any other
 *                             category_type, or 'all' to lift the constraint.
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
    // Populated (ADVERT_POPULATE.rate_card) but previously not returned.
    // Consumers (e.g. the editor's Paid Adverts view) use this to detect
    // classifieds: ad_type/size_dimension containing "classified"/"per word".
    rateCard: advert.rate_card
      ? { adType: advert.rate_card.ad_type, sizeDimension: advert.rate_card.size_dimension }
      : null,
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
  handled_by_designer: {
    fields: ['id', 'name', 'email'],
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

/**
 * Design House defaults to print layout (Pager/LayoutX), but the queue can
 * be scoped to any product category — print, TV, radio, billboard, web,
 * whatever exists in product-category — via `scope`. `scope` is the raw
 * category_type value to filter on; pass 'all' (or omit) to lift the
 * constraint entirely. `productId` further narrows to one specific product
 * within whatever scope is active.
 */
function productFilter(productId, scope = 'print') {
  const productConstraints = {};
  if (scope && scope !== 'all') productConstraints.category = { category_type: scope };
  if (productId) productConstraints.id = productId;
  if (Object.keys(productConstraints).length === 0) return {};
  return { product: productConstraints };
}

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
      const { startDate, endDate, productId, scope } = body;
      const today = new Date().toISOString().split('T')[0];
      const scheduleStatus = strapi.service('api::advert.schedule-status');

      // Cheap DB-level filter — publishing_dates itself can't be queried in SQL
      const filters = {
        isPaid:     true,
        hasRun:     false,
        isCanceled: false,
        ...productFilter(productId, scope),
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
      const { date, productId, scope } = bodyOf(ctx);
      if (!date) {
        return ctx.badRequest({
          success: false,
          message: 'date is required in the request body',
          example: { date: '2026-08-03' },
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const scheduleStatus = strapi.service('api::advert.schedule-status');

      // DB-level filter on the three booleans (and product, when the design
      // team has scoped the queue to one masthead/product) — publishing_dates
      // (a JSON array) can't be queried in SQL, and start_date/end_date are
      // NOT a reliable stand-in for it: end_date isn't guaranteed to actually
      // span every entry in publishing_dates (e.g. a 4-day booking whose
      // end_date was left at the first day), which silently drops later dates
      // from this query before the publishing_dates check ever runs. So:
      // filter on the booleans (and product) here, then match the exact date
      // against publishing_dates in JS below.
      const raw = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid:     true,
          isActive:   true,
          isCanceled: false,
          ...productFilter(productId, scope),
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

      // Gate: a designer can no longer tick an advert off as handled without
      // having also produced and pinned its designed file to an ad slot -
      // "handled" now means both, not either.
      //
      // Queried from design-batch directly (filtered to batches containing
      // this advert), using the same two-level populate shape as
      // BATCH_POPULATE in design-batch.js's getBatchDetail/listBatches -
      // that path is proven to work. Traversing the other direction
      // (advert -> design_batches -> file_groups component -> adverts
      // relation) adds an extra populate hop through a component that
      // isn't reliable and was silently returning incomplete data, which
      // made this gate reject every advert regardless of whether it
      // actually had a file.
      const candidateBatches = await strapi.entityService.findMany('api::design-batch.design-batch', {
        filters: { adverts: { id: Number(id) } },
        fields:  ['id'],
        populate: {
          file_groups: {
            populate: {
              file:    { fields: ['id'] },
              adverts: { fields: ['id'] },
            },
          },
        },
        limit: -1,
      });

      const hasDesignedFile = (candidateBatches || []).some(batch =>
        (batch.file_groups || []).some(group =>
          !!group.file && (group.adverts || []).some(a => a.id === Number(id))
        )
      );
      if (!hasDesignedFile) {
        return ctx.badRequest({
          success: false,
          message: 'This advert needs a designed file uploaded to an ad slot before it can be marked complete. Add it to a group and upload the PDF first.',
        });
      }

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

      const handledAt = new Date();

      // Mark design as approved, and record who/when unconditionally -
      // previously this only happened as a side-effect comment, and only
      // when notes were also provided.
      await strapi.entityService.update('api::advert.advert', id, {
        data: {
          isApproved: true,
          ...(designerUserId ? { handled_by_designer: designerUserId } : {}),
          handled_at: handledAt,
        },
      });

      // Log a comment if notes were provided (unchanged existing behavior)
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

      // Audit trail - non-blocking, same convention as existing corrections
      try {
        await strapi.entityService.create('api::workflow-log.workflow-log', {
          data: {
            advert:      id,
            action:      'design_marked_handled',
            new_status:  'design_handled',
            ...(designerUserId ? { vgams_users: [designerUserId] } : {}),
            notes:       notes?.trim() || null,
            timestamp:   handledAt,
          },
        });
      } catch (logErr) {
        console.warn('⚠️ Could not write design_marked_handled workflow-log entry:', logErr.message);
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
   * Reverse an accidental "mark design complete" (isApproved: false).
   * The front end is expected to walk the user through two confirmation
   * steps before ever calling this - (1) type the advert's BC reference
   * code, (2) explicit confirm - but that's UX friction only. The actual
   * safeguard against unmarking the wrong advert lives here: the submitted
   * code is re-verified server-side against this specific advert's real
   * bc_reference_number before anything changes.
   *
   * BC references follow the "B-SO-<code>" convention (e.g. "B-SO-236997N"
   * — see the printed booking confirmations). The user only has to type the
   * <code> portion, not the full "B-SO-" prefix.
   *
   * POST /api/design-house/adverts/:id/unmark-complete
   * Body: { bcCodeSuffix: string, notes?: string }
   */
  async unmarkDesignComplete(ctx) {
    try {
      const { id } = ctx.params;
      if (!id) return ctx.badRequest({ success: false, message: 'Advert ID is required' });

      const { bcCodeSuffix, notes } = bodyOf(ctx);
      if (!bcCodeSuffix || !bcCodeSuffix.trim()) {
        return ctx.badRequest({ success: false, message: 'Enter the BC reference code to confirm' });
      }

      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields: ['id', 'reference_number', 'bc_reference_number', 'advert_title', 'isClosed', 'isApproved'],
      });

      if (!advert) return ctx.notFound({ success: false, message: `Advert ${id} not found` });
      if (advert.isClosed) return ctx.badRequest({ success: false, message: 'Advert is already closed' });
      if (!advert.isApproved) {
        return ctx.badRequest({ success: false, message: 'This advert is not currently marked as complete' });
      }

      const fullBcRef = (advert.bc_reference_number || '').trim();
      const expectedSuffix = fullBcRef.replace(/^b-so-/i, '').trim();
      const submittedSuffix = bcCodeSuffix.trim().replace(/^b-so-/i, '').trim();

      if (!expectedSuffix || submittedSuffix.toLowerCase() !== expectedSuffix.toLowerCase()) {
        return ctx.badRequest({ success: false, message: 'BC reference code does not match this advert' });
      }

      await strapi.entityService.update('api::advert.advert', id, {
        data: { isApproved: false, handled_by_designer: null, handled_at: null },
      });

      try {
        await strapi.entityService.create('api::comment.comment', {
          data: {
            content: notes?.trim()
              ? `Design completion unmarked (reversed) after verification. ${notes}`
              : 'Design completion unmarked (reversed) after verification.',
            advert: id,
          },
        });
      } catch (commentErr) {
        console.warn('⚠️ Could not create unmark-complete comment:', commentErr.message);
      }

      // Audit trail - non-blocking, same convention as existing corrections
      try {
        await strapi.entityService.create('api::workflow-log.workflow-log', {
          data: {
            advert:           id,
            action:           'design_unmarked_handled',
            previous_status:  'design_handled',
            new_status:       'design_pending',
            notes:            notes?.trim() || null,
            timestamp:        new Date(),
          },
        });
      } catch (logErr) {
        console.warn('⚠️ Could not write design_unmarked_handled workflow-log entry:', logErr.message);
      }

      return ctx.send({
        success:          true,
        message:          'Design completion unmarked',
        advertId:         id,
        referenceNumber:  advert.reference_number,
        isApproved:       false,
      });

    } catch (error) {
      console.error('❌ unmarkDesignComplete:', error);
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
      const { productId, scope } = bodyOf(ctx);
      const today = new Date().toISOString().split('T')[0];
      const scheduleStatus = strapi.service('api::advert.schedule-status');

      const baseFilter = {
        isPaid: true, hasRun: false, isCanceled: false,
        ...productFilter(productId, scope),
      };

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
          filters: {
            isPaid: true, isCanceled: false, isScheduled: true,
            ...productFilter(productId, scope),
          },
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

  /**
   * Per-designer "what have they handled" report for the Design House
   * dashboard - one row per designer for the date range, each with the
   * adverts they ticked off and the PDF (if any) it landed on.
   * POST /api/design-house/reports/by-designer
   * Body: { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
   */
  async getDesignerReport(ctx) {
    try {
      const { startDate, endDate } = bodyOf(ctx);
      if (!startDate || !endDate) {
        return ctx.badRequest({ success: false, message: 'startDate and endDate are required' });
      }

      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isApproved: true,
          handled_at: { $gte: `${startDate}T00:00:00.000Z`, $lte: `${endDate}T23:59:59.999Z` },
        },
        fields: ['id', 'reference_number', 'bc_reference_number', 'advert_title', 'handled_at'],
        populate: {
          handled_by_designer: { fields: ['id', 'name', 'email'] },
          client: { fields: ['id', 'company_name'] },
          design_batches: {
            populate: {
              file_groups: {
                populate: {
                  file:    { fields: ['id', 'name', 'url', 'size', 'mime', 'ext'] },
                  adverts: { fields: ['id'] },
                },
              },
            },
          },
        },
        limit: -1,
      });

      const byDesigner = new Map();

      for (const advert of adverts) {
        const designer = advert.handled_by_designer;
        const key = designer ? designer.id : 'unattributed';

        if (!byDesigner.has(key)) {
          byDesigner.set(key, {
            designer: designer ? { id: designer.id, name: designer.name, email: designer.email } : null,
            handledCount: 0,
            adverts: [],
          });
        }

        // The gate on markDesignComplete means this should always resolve
        // to a file for anything handled after this change went live -
        // adverts handled before it may still legitimately come back null.
        let matchedFile = null;
        for (const batch of advert.design_batches || []) {
          for (const group of batch.file_groups || []) {
            const inGroup = (group.adverts || []).some(a => a.id === advert.id);
            if (inGroup && group.file) {
              matchedFile = { id: group.file.id, name: group.file.name, url: group.file.url, size: group.file.size };
              break;
            }
          }
          if (matchedFile) break;
        }

        const entry = byDesigner.get(key);
        entry.handledCount += 1;
        entry.adverts.push({
          id:          advert.id,
          reference:   advert.reference_number,
          bcReference: advert.bc_reference_number || '',
          advertTitle: advert.advert_title,
          clientName:  advert.client?.company_name || '—',
          handledAt:   advert.handled_at,
          pdf:         matchedFile, // null => still pending
        });
      }

      return ctx.send({
        success:    true,
        startDate,
        endDate,
        designers:  [...byDesigner.values()].sort((a, b) => b.handledCount - a.handledCount),
      });

    } catch (error) {
      console.error('❌ getDesignerReport:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * List active products for the design-house product filter — the design
   * team works across multiple products/mastheads (New Vision, Bukedde, etc.)
   * and needs to scope the queue to one of them.
   * GET /api/design-house/products
   */
  async getProducts(ctx) {
    try {
      const scope = ctx.query.scope || 'print';

      const products = await strapi.entityService.findMany('api::product.product', {
        filters: {
          is_active: true,
          ...(scope !== 'all' ? { category: { category_type: scope } } : {}),
        },
        fields:  ['id', 'product_name', 'product_id'],
        populate: {
          category: { fields: ['id', 'category_name', 'category_type'] },
        },
        sort:  { product_name: 'asc' },
        limit: -1,
      });

      return ctx.send({
        success: true,
        products: products.map(p => ({
          id:        p.id,
          name:      p.product_name,
          productId: p.product_id,
          category:  p.category?.category_name || null,
          categoryType: p.category?.category_type || null,
        })),
      });

    } catch (error) {
      console.error('❌ getProducts:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * List every distinct product category — this powers the scope radio
   * buttons (Print / TV / Radio / Billboard / Web / … / All) on the front
   * end. Returns whatever actually exists in product-category, so the UI
   * never has to hardcode guessed category_type strings.
   * GET /api/design-house/product-categories
   */
  async getProductCategories(ctx) {
    try {
      const categories = await strapi.entityService.findMany('api::product-category.product-category', {
        fields: ['id', 'category_name', 'category_type'],
        sort:   { category_name: 'asc' },
        limit:  -1,
      });

      return ctx.send({
        success: true,
        categories: categories.map(c => ({
          id:   c.id,
          name: c.category_name,
          type: c.category_type,
        })),
      });

    } catch (error) {
      console.error('❌ getProductCategories:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};