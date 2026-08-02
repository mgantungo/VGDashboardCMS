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
 * whatever admin-panel-only validation is blocking your direct edits. If
 * "invalid status" turns out to actually be a beforeUpdate lifecycle hook
 * rather than an admin customization, this route would hit that too — if
 * this doesn't work, that's the next thing to check.
 *
 * Gated behind ALLOW_BC_TEST_BYPASS=true in .env — unset (or any other
 * value) and this route 403s, so it can't be hit by accident in production.
 */
module.exports = {

  /**
   * POST /bc/test/mark-paid
   * Body: { bc_reference_number, isPaid?: boolean (default true), isActive?: boolean (default true) }
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
      const isPaid = body.isPaid !== undefined ? !!body.isPaid : true;
      const isActive = body.isActive !== undefined ? !!body.isActive : true;

      if (!bc_reference_number) {
        return ctx.badRequest({ success: false, message: 'bc_reference_number is required' });
      }

      const matches = await strapi.entityService.findMany('api::advert.advert', {
        filters: { bc_reference_number },
        fields: ['id', 'reference_number', 'bc_reference_number', 'isPaid', 'isActive', 'status'],
        limit: 1,
      });

      if (matches.length === 0) {
        return ctx.notFound({
          success: false,
          message: `No advert found with bc_reference_number "${bc_reference_number}"`,
        });
      }

      const advert = matches[0];

      const updated = await strapi.entityService.update('api::advert.advert', advert.id, {
        data: { isPaid, isActive },
      });

      strapi.log.warn(
        `[bc-test] TEST BYPASS: advert ${advert.id} (${advert.reference_number}) ` +
        `set isPaid=${isPaid} isActive=${isActive} manually via /bc/test/mark-paid`
      );

      return ctx.send({
        success: true,
        message: `Test bypass applied — advert marked isPaid=${isPaid}, isActive=${isActive}`,
        advert: {
          id:                   updated.id,
          reference_number:     updated.reference_number,
          bc_reference_number:  updated.bc_reference_number,
          isPaid:               updated.isPaid,
          isActive:             updated.isActive,
          status:               updated.status,
        },
      });
    } catch (error) {
      strapi.log.error('❌ bc-test.markPaidForTesting:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

};
