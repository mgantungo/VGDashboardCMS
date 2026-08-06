'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const {
  assertValidPageIncrement,
  assertValidPageDecrement,
  buildReaderSpreadLayout,
  isPrintEligible,
} = require('../../_pager-helpers/pager-utils');

/**
 * After an advert is placed on a pager page via queueAdverts, reflect that
 * back onto the advert's own advert-daily-schedule row for this
 * publication's date — see the identical helper in pager-page.js (the two
 * files are separate controllers, so this is intentionally duplicated
 * rather than shared, to avoid touching _pager-helpers/pager-utils.js
 * blind).
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
 * Map of advertId -> { slotKey, slotSize, file, label } for every advert
 * whose advert-daily-schedule row (for this publication's date) represents
 * an ad slot — meaning it either has a design file attached (media) or has
 * more than one advert sharing it. Either way, the Pager should show the
 * SLOT (and its file, if any) rather than listing individual adverts out —
 * that's the whole point of a slot from the print side: one thing to open,
 * not N adverts to read through.
 *
 * label resolution: source_file_group_id (added alongside the one-row-per-
 * ad-slot attachToSchedule rewrite) lets us look up the ad slot's own
 * label from the design-batch it came from, not just fall back to the raw
 * filename — a batch's file_groups[].label is the human-chosen name
 * ("Classifieds — Motoring"), which is what an editor actually wants to
 * see, not "classifieds-motoring-v2-final.pdf".
 */
async function buildSlotMap(strapi, publicationDate) {
  const map = new Map();
  if (!publicationDate) return map;

  const schedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
    filters: { run_date: publicationDate },
    populate: {
      adverts: { fields: ['id'] },
      media: true,
      source_batches: { populate: { file_groups: true } },
    },
  });

  for (const s of schedules) {
    const advertIds = (s.adverts || []).map(a => a.id);
    if (advertIds.length === 0) continue;

    const file = (s.media || [])[0] || null;
    if (!file && advertIds.length <= 1) continue; // a plain single advert with no file — nothing slot-like about it

    const fileInfo = file
      ? { id: file.id, name: file.name, url: file.url, size: file.size, mime: file.mime }
      : null;

    // Prefer the design-batch's own label for this slot; fall back to the
    // filename if this schedule row wasn't created via a batch attach (e.g.
    // legacy/manual scheduling), or the group's label was left blank.
    let label = file?.name || null;
    if (s.source_file_group_id) {
      for (const batch of (s.source_batches || [])) {
        const group = (batch.file_groups || []).find(g => g.id === s.source_file_group_id);
        if (group?.label) { label = group.label; break; }
      }
    }

    for (const aid of advertIds) {
      map.set(aid, { slotKey: `schedule:${s.id}`, slotSize: advertIds.length, file: fileInfo, label });
    }
  }
  return map;

}

/** Stamps slotKey/slotSize/slotFile/slotLabel onto each advert of each page in a pages array, in place. */
function enrichPagesWithSlotInfo(pages, slotMap) {
  for (const page of pages) {
    for (const advert of (page.adverts || [])) {
      const slot = slotMap.get(advert.id);
      advert.slotKey = slot?.slotKey || null;
      advert.slotSize = slot?.slotSize || 1;
      advert.slotFile = slot?.file || null;
      advert.slotLabel = slot?.label || null;
    }
  }
}

module.exports = createCoreController('api::pager-publication.pager-publication', ({ strapi }) => ({

  // POST /pager-publications — overrides the core action so the request body
  // is flat (not Strapi's default { data: {...} } wrapper) and the response
  // is flat too, consistent with every other custom action in this module.
  // Also auto-generates the publication's pager-page rows here directly,
  // rather than in a content-type lifecycle, since we have the created row
  // (and its real id) in hand rather than depending on the lifecycle event shape.
  async create(ctx) {
    const { masthead, publication_date, total_pages, notes } = ctx.request.body || {};
    try {
      const publication = await strapi.entityService.create('api::pager-publication.pager-publication', {
        data: { masthead, publication_date, total_pages, notes },
      });

      const publicationId = publication.id;
      const totalPages = publication.total_pages;

      strapi.log.info(`[Pager] Auto-generating ${totalPages} pages for publication ${publication.publication_code}`);

      for (let n = 1; n <= totalPages; n++) {
        await strapi.entityService.create('api::pager-page.pager-page', {
          data: {
            publication: { connect: [publicationId] },
            page_number: n,
            is_cover: n === 1,
            is_back_cover: n === totalPages,
            section: n === 1 ? 'Cover Page' : (n === totalPages ? 'Back Cover Page' : null),
          },
        });
      }

      ctx.body = publication;
    } catch (e) {
      ctx.badRequest(e.message);
    }
  },

  // GET /pager-publications/:id — deep populate for the editor view
  async findOne(ctx) {
    const { id } = ctx.params;
    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', id, {
      populate: {
        pages: {
          populate: {
            adverts: {
              populate: { client: true },
            },
          },
        },
      },
    });
    if (!publication) return ctx.notFound('Publication not found');

    const slotMap = await buildSlotMap(strapi, publication.publication_date);
    enrichPagesWithSlotInfo(publication.pages || [], slotMap);

    ctx.body = publication;
  },

  // GET /pager-publications/:id/layout — pages pre-sorted into the reader-spread columns
  async getLayout(ctx) {
    const { id } = ctx.params;
    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', id, {
      populate: {
        pages: {
          populate: {
            adverts: {
              populate: { client: true },
            },
          },
        },
      },
    });
    if (!publication) return ctx.notFound('Publication not found');

    const { left, right, mid } = buildReaderSpreadLayout(publication.pages, publication.total_pages);

    // Ad-slot grouping — so PagerPageCard can render adverts that share one
    // physical file as a single visual block with one shared remove action,
    // instead of separate chips a person could accidentally split apart.
    const slotMap = await buildSlotMap(strapi, publication.publication_date);
    enrichPagesWithSlotInfo(left, slotMap);
    enrichPagesWithSlotInfo(right, slotMap);

    ctx.body = {
      publication: {
        id: publication.id,
        publication_code: publication.publication_code,
        masthead: publication.masthead,
        publication_date: publication.publication_date,
        total_pages: publication.total_pages,
        status: publication.status,
        mid_page: mid,
      },
      left,
      right,
    };
  },

  // GET /pager-publications/:id/export-to-layoutx
  // Reshapes this publication's ad slots into LayoutX's own
  // { publicationDetails, pages } contract — the exact shape
  // loadPublicationFromCMS already returns from the Naviga side, so
  // LayoutX's downstream canvas/save/resave code doesn't need to know or
  // care which system a layout was pulled from.
  //
  // One ad slot = one artwork (not one artwork per advert): a slot is a
  // single physical file, which is what LayoutX actually positions on the
  // page. Multi-advert slots collapse into that one artwork with a joined
  // clientName. There's no positioning data in the Pager at all today, so
  // every pulled-in artwork lands at a default tiled offset — this is a
  // seed to start positioning from, not a finished layout.
  //
  // ASSUMPTIONS baked in here that may need correcting:
  //  - masthead -> { publication, template } lookup is hardcoded below.
  //  - sourceUrl is left as whatever Strapi's media url resolves to via
  //    server.url — confirm this is actually reachable (CORS, auth) from
  //    LayoutX's origin before relying on this in production.
  async exportToLayoutX(ctx) {
    const { id } = ctx.params;
    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', id, {
      populate: {
        pages: {
          populate: {
            adverts: { populate: { client: true } },
          },
        },
      },
    });
    if (!publication) return ctx.notFound('Publication not found');

    const slotMap = await buildSlotMap(strapi, publication.publication_date);
    enrichPagesWithSlotInfo(publication.pages || [], slotMap);

    // masthead -> LayoutX's { publication, template } fields.
    // TODO confirm this mapping and whether template varies per publication.
    const MASTHEAD_LOOKUP = {
      NV: { publication: 'New Vision', template: 'newvision.indd' },
      BK: { publication: 'Bukedde',    template: 'bukedde.indd' },
    };
    const mastheadInfo = MASTHEAD_LOOKUP[publication.masthead] || {
      publication: publication.masthead,
      template: `${String(publication.masthead || 'unknown').toLowerCase()}.indd`,
    };

    const serverUrl = strapi.config.get('server.url', '');
    const resolveMediaUrl = (url) => {
      if (!url) return null;
      if (/^https?:\/\//i.test(url)) return url;
      return `${serverUrl}${url}`;
    };

    // Default box size for a pulled-in artwork with no real positioning
    // data yet — matches this app's own existing fallback pattern
    // (artworkData.width || 100) elsewhere, since artwork.width is used as
    // a division denominator during PDF scaling and must never be null/0.
    const DEFAULT_ARTWORK_WIDTH = 150;
    const DEFAULT_ARTWORK_HEIGHT = 100;

    const pageSections = {};
    const pages = [];

    const sortedPages = [...(publication.pages || [])].sort((a, b) => a.page_number - b.page_number);

    for (const page of sortedPages) {
      const pageId = `page-${page.page_number}`;
      if (page.section) pageSections[pageId] = page.section;

      // Cluster this page's adverts by slotKey — one artwork per ad slot,
      // never one per advert (matches how the Pager itself treats a slot
      // as one atomic, inseparable file).
      const bySlot = new Map();
      for (const advert of (page.adverts || [])) {
        if (!advert.slotKey) continue; // no file behind this advert — nothing LayoutX can position
        if (!bySlot.has(advert.slotKey)) {
          bySlot.set(advert.slotKey, { file: advert.slotFile, label: advert.slotLabel, clients: [] });
        }
        bySlot.get(advert.slotKey).clients.push(advert.client?.company_name || advert.advert_title || 'Unknown');
      }

      const artworks = [];
      let tileIndex = 0;
      for (const [slotKey, slot] of bySlot) {
        if (!slot.file) continue; // slot has no actual file to place — skip rather than place an empty box

        // No positioning data exists in the Pager — default to a simple
        // tiled offset so multiple artworks on one page don't stack
        // exactly on top of each other. Whoever pulls this in still needs
        // to actually position these by hand.
        const x = 20 + (tileIndex % 3) * 220;
        const y = 20 + Math.floor(tileIndex / 3) * 170;
        tileIndex += 1;

        artworks.push({
          id:          `slot-${slotKey}`,
          filename:    slot.file.name,
          // NOTE: the field is s3Url, not sourceUrl — LayoutX's own
          // background PDF-render pipeline specifically checks
          // `if (!artwork.s3Url) continue` to know which artworks to fetch
          // and render; the wrong field name here means every pulled-in
          // artwork silently stays a placeholder forever.
          s3Url:       resolveMediaUrl(slot.file.url),
          clientName:  slot.label || slot.clients.join(', ') || 'Unknown Client',
          adType:      'Display',
          isImported:  true, // LayoutX should fetch/render from s3Url, not expect a local File blob
          x, y,
          width:  DEFAULT_ARTWORK_WIDTH,
          height: DEFAULT_ARTWORK_HEIGHT,
        });
      }

      pages.push({
        id:       pageId,
        name:     `Page ${page.page_number}`,
        artworks,
      });
    }

    ctx.body = {
      publicationDetails: {
        publication:    mastheadInfo.publication,
        template:       mastheadInfo.template,
        date:           publication.publication_date,
        publicationref: publication.publication_code,
        totalpages:     publication.total_pages,
        pageSections,
      },
      pages,
    };
  },

  // PUT /pager-publications/:id/increase-pages   body: { additionalPages }
  async increasePages(ctx) {
    const { id } = ctx.params;
    const { additionalPages } = ctx.request.body || {};

    let increment;
    try {
      increment = assertValidPageIncrement(additionalPages);
    } catch (e) {
      return ctx.badRequest(e.message);
    }

    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', id);
    if (!publication) return ctx.notFound('Publication not found');
    if (publication.status === 'locked' || publication.status === 'published') {
      return ctx.badRequest(`Cannot add pages to a ${publication.status} publication`);
    }

    const oldTotal = publication.total_pages;
    const newTotal = oldTotal + increment;

    // Undo the old back-cover lock — it moves to the new last page.
    const oldBackCover = await strapi.entityService.findMany('api::pager-page.pager-page', {
      filters: { publication: id, page_number: oldTotal },
      limit: 1,
    });
    if (oldBackCover[0]) {
      await strapi.entityService.update('api::pager-page.pager-page', oldBackCover[0].id, {
        data: { is_back_cover: false, section: null },
      });
    }

    // Create the new pages; the lifecycle will lock the new last page as back cover.
    for (let n = oldTotal + 1; n <= newTotal; n++) {
      await strapi.entityService.create('api::pager-page.pager-page', {
        data: { publication: { connect: [id] }, page_number: n },
      });
    }

    const updated = await strapi.entityService.update('api::pager-publication.pager-publication', id, {
      data: { total_pages: newTotal },
    });

    ctx.body = updated;
  },

  // PUT /pager-publications/:id/decrease-pages   body: { reducePages }
  // Only removes trailing pages, and only if none of them carry adverts.
  async decreasePages(ctx) {
    const { id } = ctx.params;
    const { reducePages } = ctx.request.body || {};

    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', id);
    if (!publication) return ctx.notFound('Publication not found');
    if (publication.status === 'locked' || publication.status === 'published') {
      return ctx.badRequest(`Cannot remove pages from a ${publication.status} publication`);
    }

    let decrement;
    try {
      decrement = assertValidPageDecrement(reducePages, publication.total_pages);
    } catch (e) {
      return ctx.badRequest(e.message);
    }

    const newTotal = publication.total_pages - decrement;

    // The pages being removed — the trailing block above the new total.
    const pagesToRemove = await strapi.entityService.findMany('api::pager-page.pager-page', {
      filters: { publication: id, page_number: { $gt: newTotal } },
      populate: { adverts: true },
    });

    const withAdverts = pagesToRemove.find((p) => (p.adverts || []).length > 0);
    if (withAdverts) {
      return ctx.badRequest(
        `Cannot remove pages — page ${withAdverts.page_number} still has adverts assigned. Remove them first.`
      );
    }

    for (const page of pagesToRemove) {
      await strapi.entityService.delete('api::pager-page.pager-page', page.id);
    }

    // The new last page becomes the back cover.
    const newLastPage = await strapi.entityService.findMany('api::pager-page.pager-page', {
      filters: { publication: id, page_number: newTotal },
      limit: 1,
    });
    if (newLastPage[0]) {
      await strapi.entityService.update('api::pager-page.pager-page', newLastPage[0].id, {
        data: { is_back_cover: true, section: 'Back Cover Page' },
      });
    }

    const updated = await strapi.entityService.update('api::pager-publication.pager-publication', id, {
      data: { total_pages: newTotal },
    });

    ctx.body = updated;
  },

  // POST /pager-publications/:id/queue-adverts
  // Body: { units: [{ advertIds: [...] }, ...] }  — each unit is one
  // printable item: a design-batch ad slot (several adverts, one physical
  // file — its adverts must land on the same page TOGETHER, never split
  // across two pages) or a single ungrouped advert (a unit of one).
  //
  // Round-robins by UNIT across non-cover pages, wrapping back to page 1
  // once every page has had a turn — so a page CAN end up holding more than
  // one unit (an ad slot plus an ungrouped advert, two ungrouped adverts,
  // etc.). That's intentional: this endpoint is a fast starting layout, not
  // a hard page-composition rule. Final page composition is always at the
  // editor's discretion via the manual assign/unassign endpoints in
  // pager-page.js, which were never restricted and can freely move any
  // advert onto or off of any page regardless of what this auto-placement
  // did first.
  //
  // After each successful placement, every affected advert's own
  // advert-daily-schedule row (for this publication's date) gets its
  // "Page / Slot" number synced to match — see syncScheduleRowPage.
  //
  // Backward compatible: a flat { advertIds: [...] } body is still accepted
  // and treated as one unit per advert (the old per-advert behavior).
  async queueAdverts(ctx) {
    const { id } = ctx.params;
    const body = ctx.request.body || {};

    let units = body.units;
    if (!Array.isArray(units)) {
      if (Array.isArray(body.advertIds) && body.advertIds.length > 0) {
        units = body.advertIds.map((advertId) => ({ advertIds: [advertId] }));
      } else {
        return ctx.badRequest('units (or advertIds) must be a non-empty array');
      }
    }
    if (units.length === 0) {
      return ctx.badRequest('units must be a non-empty array');
    }
    for (const u of units) {
      if (!Array.isArray(u.advertIds) || u.advertIds.length === 0) {
        return ctx.badRequest('Every unit must have a non-empty advertIds array');
      }
    }

    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', id);
    if (!publication) return ctx.notFound('Publication not found');

    const allPages = await strapi.entityService.findMany('api::pager-page.pager-page', {
      filters: { publication: id },
      sort: { page_number: 'asc' },
      populate: { adverts: true },
    });
    const pages = allPages.filter((p) => !p.is_cover && !p.is_back_cover);
    if (pages.length === 0) {
      return ctx.badRequest('This publication has no assignable pages');
    }

    const placedOnPage = new Map();
    for (const p of allPages) {
      for (const a of (p.adverts || [])) {
        placedOnPage.set(a.id, p.page_number);
      }
    }

    const assigned = [];
    const skipped = [];
    let cursor = 0;

    for (const unit of units) {
      const unitAdvertIds = unit.advertIds.map((rawId) => Number(rawId));
      const failures = [];

      for (const advertId of unitAdvertIds) {
        if (placedOnPage.has(advertId)) {
          failures.push({
            advertId,
            reason: `already assigned to page ${placedOnPage.get(advertId)} in this publication`,
            conflictPageNumber: placedOnPage.get(advertId),
          });
          continue;
        }
        const advert = await strapi.entityService.findOne('api::advert.advert', advertId);
        if (!advert) {
          failures.push({ advertId, reason: 'advert not found' });
          continue;
        }
        if (!isPrintEligible(advert)) {
          failures.push({ advertId, reason: 'not print-eligible' });
        }
      }

      if (failures.length > 0) {
        for (const advertId of unitAdvertIds) {
          const failure = failures.find((f) => f.advertId === advertId);
          skipped.push(failure || { advertId, reason: 'skipped — another member of this group failed validation' });
        }
        continue;
      }

      const targetPage = pages[cursor % pages.length];
      cursor += 1;

      const nextAdvertIds = [...(targetPage.adverts || []).map((a) => a.id), ...unitAdvertIds];
      try {
        await strapi.entityService.update('api::pager-page.pager-page', targetPage.id, {
          data: { adverts: nextAdvertIds },
        });
        targetPage.adverts = nextAdvertIds.map((aid) => ({ id: aid }));
        for (const advertId of unitAdvertIds) {
          placedOnPage.set(advertId, targetPage.page_number);
          assigned.push({ advertId, pageId: targetPage.id, page_number: targetPage.page_number });
          await syncScheduleRowPage(strapi, advertId, publication.publication_date, targetPage.page_number);
        }
      } catch (e) {
        for (const advertId of unitAdvertIds) {
          skipped.push({ advertId, reason: e.message });
        }
      }
    }

    ctx.body = { assigned, skipped };
  },

  // PUT /pager-publications/:id/lock
  async lock(ctx) {
    const { id } = ctx.params;
    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', id, {
      populate: { pages: true },
    });
    if (!publication) return ctx.notFound('Publication not found');

    const unassigned = (publication.pages || []).filter((p) => !p.section);
    if (unassigned.length > 0) {
      return ctx.badRequest(
        `Cannot lock — ${unassigned.length} page(s) have no section assigned (e.g. page ${unassigned[0].page_number})`
      );
    }

    const updated = await strapi.entityService.update('api::pager-publication.pager-publication', id, {
      data: { status: 'locked' },
    });
    ctx.body = updated;
  },

  // PUT /pager-publications/:id/status   body: { status }
  async setStatus(ctx) {
    const { id } = ctx.params;
    const { status } = ctx.request.body || {};
    const allowed = ['draft', 'in_progress', 'locked', 'published'];
    if (!allowed.includes(status)) {
      return ctx.badRequest(`status must be one of: ${allowed.join(', ')}`);
    }
    const updated = await strapi.entityService.update('api::pager-publication.pager-publication', id, {
      data: { status },
    });
    ctx.body = updated;
  },

}));
