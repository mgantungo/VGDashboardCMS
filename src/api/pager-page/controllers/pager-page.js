'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { isPrintEligible } = require('../../_pager-helpers/pager-utils');

/**
 * After an advert is placed on (or removed from) a pager page, reflect that
 * back onto the advert's own advert-daily-schedule row for the publication's
 * date — so the Schedule Queue's "Page / Slot" number always shows where
 * this advert actually landed in the Pager, without the editor having to
 * check both places. If the advert isn't on any schedule row for this date
 * (e.g. it was placed on the pager directly, bypassing the design-batch/
 * ad-slot flow entirely), this is a silent no-op — nothing to sync.
 */
async function syncScheduleRowPage(strapi, advertId, publicationDate, pageNumberOrNull) {
  if (!publicationDate) return;
  const rows = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
    filters: { run_date: publicationDate, adverts: { id: advertId } },
    limit: 1,
  });
  const row = rows[0];
  if (!row) return;
  await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', row.id, {
    data: { page: pageNumberOrNull ?? 0 },
  });
}

/**
 * Every ad slot (design-batch file group, now one schedule row per group —
 * see attachToSchedule) that has 2+ adverts sharing it makes those adverts
 * inseparable in the Pager too: they were combined into one physical file,
 * so they must always be assigned to / removed from a page together, never
 * split. This computes, for a given publication date, a map of
 * advertId -> { slotKey, slotSize } for every advert whose schedule row has
 * more than one advert on it. Adverts not in this map are ungrouped
 * (slotSize 1, free to place independently).
 */
async function buildSlotMap(strapi, publicationDate) {
  const map = new Map();
  if (!publicationDate) return map;

  const schedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
    filters: { run_date: publicationDate },
    populate: { adverts: { fields: ['id'] } },
  });

  for (const s of schedules) {
    const advertIds = (s.adverts || []).map(a => a.id);
    if (advertIds.length <= 1) continue; // only worth flagging when adverts actually share a slot
    for (const aid of advertIds) {
      map.set(aid, { slotKey: `schedule:${s.id}`, slotSize: advertIds.length, allIds: advertIds });
    }
  }
  return map;
}

module.exports = createCoreController('api::pager-page.pager-page', ({ strapi }) => ({

  // GET /pager-pages/:id
  async findOne(ctx) {
    const { id } = ctx.params;
    const page = await strapi.entityService.findOne('api::pager-page.pager-page', id, {
      populate: {
        publication: true,
        adverts: { populate: { client: true } },
      },
    });
    if (!page) return ctx.notFound('Page not found');
    ctx.body = page;
  },

  // PUT /pager-pages/:id/section   body: { section }
  async updateSection(ctx) {
    const { id } = ctx.params;
    const { section } = ctx.request.body || {};
    if (!section) return ctx.badRequest('section is required');

    try {
      const updated = await strapi.entityService.update('api::pager-page.pager-page', id, {
        data: { section },
      });
      ctx.body = updated;
    } catch (e) {
      ctx.badRequest(e.message);
    }
  },

  // POST /pager-pages/:id/assign-advert   body: { advertId }
  // Single-advert convenience wrapper — for adverts that aren't part of an
  // ad slot with siblings. Prefer assignAdverts (plural) from the UI, which
  // enforces "a whole slot moves together, never split" up front.
  async assignAdvert(ctx) {
    const { advertId } = ctx.request.body || {};
    if (!advertId) return ctx.badRequest('advertId is required');
    ctx.request.body = { advertIds: [advertId] };
    return this.assignAdverts(ctx);
  },

  // POST /pager-pages/:id/assign-adverts   body: { advertIds: [...] }
  // All-or-nothing: every id in advertIds lands on this page together, or
  // none do. This is how an ad slot's adverts (sharing one physical file)
  // get placed as a single unit — the caller is expected to have already
  // resolved the full sibling set (see getAvailableAdverts's groups/
  // ungrouped shape) rather than pass a partial slot.
  async assignAdverts(ctx) {
    const { id } = ctx.params;
    const { advertIds } = ctx.request.body || {};
    if (!Array.isArray(advertIds) || advertIds.length === 0) {
      return ctx.badRequest('advertIds must be a non-empty array');
    }
    const ids = advertIds.map((v) => Number(v));

    const page = await strapi.entityService.findOne('api::pager-page.pager-page', id, {
      populate: { adverts: true, publication: { populate: { product: true } } },
    });
    if (!page) return ctx.notFound('Page not found');

    const existingIds = (page.adverts || []).map((a) => a.id);
    const alreadyOnPage = ids.filter((aid) => existingIds.includes(aid));
    if (alreadyOnPage.length > 0) {
      return ctx.badRequest(`Advert(s) ${alreadyOnPage.join(', ')} already on this page`);
    }

    const publicationProductId = page.publication?.product?.id ?? null;

    for (const advertId of ids) {
      const advert = await strapi.entityService.findOne('api::advert.advert', advertId, {
        populate: { product: true },
      });
      if (!advert) return ctx.notFound(`Advert ${advertId} not found`);
      if (!isPrintEligible(advert, { publicationProductId })) {
        return ctx.badRequest(`Advert ${advertId} is not eligible for pager assignment`);
      }
    }

    const nextAdvertIds = [...existingIds, ...ids];

    try {
      const updated = await strapi.entityService.update('api::pager-page.pager-page', id, {
        data: { adverts: nextAdvertIds },
        populate: { adverts: { populate: { client: true } } },
      });

      for (const advertId of ids) {
        await syncScheduleRowPage(strapi, advertId, page.publication?.publication_date, page.page_number);
      }

      ctx.body = updated;
    } catch (e) {
      ctx.badRequest(e.message);
    }
  },

  // DELETE /pager-pages/:id/advert/:advertId
  // Single-advert convenience wrapper — see unassignAdverts for the
  // slot-aware version the UI should actually call.
  async unassignAdvert(ctx) {
    const { advertId } = ctx.params;
    ctx.request.body = { advertIds: [advertId] };
    return this.unassignAdverts(ctx);
  },

  // POST /pager-pages/:id/unassign-adverts   body: { advertIds: [...] }
  // Removes every listed id from this page in one update — used to pull an
  // entire ad slot off a page together, never just one of its members.
  async unassignAdverts(ctx) {
    const { id } = ctx.params;
    const { advertIds } = ctx.request.body || {};
    if (!Array.isArray(advertIds) || advertIds.length === 0) {
      return ctx.badRequest('advertIds must be a non-empty array');
    }
    const ids = advertIds.map((v) => Number(v));

    const page = await strapi.entityService.findOne('api::pager-page.pager-page', id, {
      populate: { adverts: true, publication: true },
    });
    if (!page) return ctx.notFound('Page not found');

    const remainingIds = (page.adverts || [])
      .map((a) => a.id)
      .filter((aid) => !ids.includes(aid));

    const updated = await strapi.entityService.update('api::pager-page.pager-page', id, {
      data: { adverts: remainingIds },
      populate: { adverts: { populate: { client: true } } },
    });

    for (const advertId of ids) {
      await syncScheduleRowPage(strapi, advertId, page.publication?.publication_date, null);
    }

    ctx.body = updated;
  },

  // GET /pager-pages/:id/available-adverts
  // Print-eligible adverts not already placed anywhere in this page's
  // publication — grouped by ad slot, matching the shape the Print Queue
  // Selection table and Schedule Queue already use, so the picker can show
  // "3 adverts · file.jpg" as one selectable unit instead of three separate
  // rows a person could accidentally split across pages.
  //
  // Scoped to this publication's product (when it has one) via
  // isPrintEligible's publicationProductId option, same as assignAdverts —
  // an advert from a different product never shows up as available here in
  // the first place, rather than being selectable and then rejected on
  // assign.
  async getAvailableAdverts(ctx) {
    const { id } = ctx.params;

    const page = await strapi.entityService.findOne('api::pager-page.pager-page', id, {
      populate: { publication: { populate: { product: true } } },
    });
    if (!page) return ctx.notFound('Page not found');

    const siblingPages = await strapi.entityService.findMany('api::pager-page.pager-page', {
      filters: { publication: page.publication.id },
      populate: { adverts: true },
    });
    const usedAdvertIds = new Set(
      siblingPages.flatMap((p) => (p.adverts || []).map((a) => a.id))
    );

    const candidates = await strapi.entityService.findMany('api::advert.advert', {
      populate: { client: true, product: true },
      filters: { isCanceled: false },
    });

    const publicationProductId = page.publication?.product?.id ?? null;
    const available = candidates.filter(
      (a) => !usedAdvertIds.has(a.id) && isPrintEligible(a, { publicationProductId })
    );

    const slotMap = await buildSlotMap(strapi, page.publication?.publication_date);
    const groups = new Map(); // slotKey -> { adverts: [] }
    const ungrouped = [];

    for (const advert of available) {
      const slot = slotMap.get(advert.id);
      if (!slot) {
        ungrouped.push(advert);
        continue;
      }
      if (!groups.has(slot.slotKey)) groups.set(slot.slotKey, { slotKey: slot.slotKey, adverts: [] });
      groups.get(slot.slotKey).adverts.push(advert);
    }

    ctx.body = {
      data: available, // kept for backward compatibility with any other caller
      groups: [...groups.values()],
      ungrouped,
    };
  },

}));
