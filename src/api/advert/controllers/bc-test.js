'use strict';

/**
 * bc-test controller — TEST-ONLY bypass for BC payment sync.
 *
 * The "invalid status" guard you're hitting when editing isPaid (or other
 * fields) in the admin panel is intentional — it stops someone from marking
 * an advert paid by hand when Business Central is supposed to be the source
 * of truth. This route exists purely so you can simulate "BC confirmed
 * payment" in dev/test without spending real money through BC, keying off
 * bc_reference_number the same way bc-sync-monitor's real endpoints do.
 *
 * Because this goes through strapi.entityService.update() directly (the
 * same path your other working payment endpoints already use), it bypasses
 * whatever admin-panel-only validation is blocking your direct edits.
 *
 * Gated behind ALLOW_BC_TEST_BYPASS=true in .env — unset (or any other
 * value) and this route 403s, so it can't be hit by accident in production.
 *
 * Extended to also set start_date / end_date / publishing_dates, so a test
 * booking can be reshaped (e.g. to simulate a multi-date booking) without
 * needing a real BC-driven update for those fields either.
 */

function isValidDateStr(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

module.exports = {

  /**
   * POST /bc/test/mark-paid
   * Body: {
   *   bc_reference_number: string (required),
   *   isPaid?: boolean (default true),
   *   isActive?: boolean (default true),
   *   start_date?: 'YYYY-MM-DD',
   *   end_date?: 'YYYY-MM-DD' | null,
   *   publishing_dates?: string[]  (array of 'YYYY-MM-DD')
   * }
   * Only the fields actually present in the body are updated — omit any of
   * start_date/end_date/publishing_dates to leave that field untouched.
   */
  async markPaidForTesting(ctx) {
    if (process.env.ALLOW_BC_TEST_BYPASS !== 'true') {
      return ctx.forbidden({
        success: false,
        message: 'Test bypass is disabled. Set ALLOW_BC_TEST_BYPASS=true in .env to enable it.',
      });
    }

    try {
      const body = ctx.request.body || {};
      const bc_reference_number = body.bc_reference_number;
      const isPaid   = body.isPaid   !== undefined ? !!body.isPaid   : true;
      const isActive = body.isActive !== undefined ? !!body.isActive : true;

      if (!bc_reference_number) {
        return ctx.badRequest({ success: false, message: 'bc_reference_number is required' });
      }

      // ── Validate optional date fields before touching the DB ──────────────
      const data = { isPaid, isActive };

      if (body.start_date !== undefined) {
        if (!isValidDateStr(body.start_date)) {
          return ctx.badRequest({ success: false, message: 'start_date must be a YYYY-MM-DD string' });
        }
        data.start_date = body.start_date;
      }

      if (body.end_date !== undefined) {
        if (body.end_date !== null && !isValidDateStr(body.end_date)) {
          return ctx.badRequest({ success: false, message: 'end_date must be a YYYY-MM-DD string or null' });
        }
        data.end_date = body.end_date;
      }

      if (body.publishing_dates !== undefined) {
        if (!Array.isArray(body.publishing_dates) || !body.publishing_dates.every(isValidDateStr)) {
          return ctx.badRequest({
            success: false,
            message: 'publishing_dates must be an array of YYYY-MM-DD strings',
          });
        }
        data.publishing_dates = [...body.publishing_dates].sort();
      }

      const matches = await strapi.entityService.findMany('api::advert.advert', {
        filters: { bc_reference_number },
        fields: [
          'id', 'reference_number', 'bc_reference_number',
          'isPaid', 'isActive', 'status',
          'start_date', 'end_date', 'publishing_dates',
        ],
        limit: 1,
      });

      if (matches.length === 0) {
        return ctx.notFound({
          success: false,
          message: `No advert found with bc_reference_number "${bc_reference_number}"`,
        });
      }

      const advert = matches[0];

      const updated = await strapi.entityService.update('api::advert.advert', advert.id, { data });

      // Recompute isScheduled if the shape of publishing_dates changed —
      // same source of truth every other write site uses, never a blind flip.
      if (data.publishing_dates !== undefined) {
        try {
          await strapi.service('api::advert.schedule-status').recomputeAdvertScheduleStatus(advert.id);
        } catch (e) {
          strapi.log.warn(`[bc-test] Could not recompute isScheduled for advert ${advert.id}: ${e.message}`);
        }
      }

      const final = await strapi.entityService.findOne('api::advert.advert', advert.id, {
        fields: [
          'id', 'reference_number', 'bc_reference_number',
          'isPaid', 'isActive', 'isScheduled', 'status',
          'start_date', 'end_date', 'publishing_dates',
        ],
      });

      strapi.log.warn(
        `[bc-test] TEST BYPASS: advert ${advert.id} (${advert.reference_number}) updated via /bc/test/mark-paid — ` +
        `fields: ${Object.keys(data).join(', ')}`
      );

      return ctx.send({
        success: true,
        message: `Test bypass applied — updated: ${Object.keys(data).join(', ')}`,
        advert: final,
      });
    } catch (error) {
      strapi.log.error('❌ bc-test.markPaidForTesting:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  /**
   * GET /bc/test/lookup/:bc_reference_number
   * Convenience lookup for the testing page — pre-fill current field values
   * before editing them, so you're not guessing at what's already there.
   */
  async lookupByBcReference(ctx) {
    if (process.env.ALLOW_BC_TEST_BYPASS !== 'true') {
      return ctx.forbidden({
        success: false,
        message: 'Test bypass is disabled. Set ALLOW_BC_TEST_BYPASS=true in .env to enable it.',
      });
    }

    try {
      const { bc_reference_number } = ctx.params;
      if (!bc_reference_number) {
        return ctx.badRequest({ success: false, message: 'bc_reference_number is required' });
      }

      const matches = await strapi.entityService.findMany('api::advert.advert', {
        filters: { bc_reference_number },
        fields: [
          'id', 'reference_number', 'bc_reference_number', 'advert_title',
          'isPaid', 'isActive', 'isScheduled', 'isCanceled', 'status',
          'start_date', 'end_date', 'publishing_dates',
        ],
        limit: 1,
      });

      if (matches.length === 0) {
        return ctx.notFound({
          success: false,
          message: `No advert found with bc_reference_number "${bc_reference_number}"`,
        });
      }

      return ctx.send({ success: true, advert: matches[0] });
    } catch (error) {
      strapi.log.error('❌ bc-test.lookupByBcReference:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

};
