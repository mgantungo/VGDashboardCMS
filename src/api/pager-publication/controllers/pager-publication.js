'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const {
  assertValidPageIncrement,
  assertValidPageDecrement,
  buildReaderSpreadLayout,
  isPrintEligible,
} = require('../../_pager-helpers/pager-utils');

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

  // POST /pager-publications/:id/queue-adverts   body: { advertIds: [] }
  // Auto-distributes the given adverts round-robin across this publication's
  // non-cover pages, skipping any already placed anywhere in the publication
  // and any that aren't print-eligible.
  async queueAdverts(ctx) {
    const { id } = ctx.params;
    const { advertIds } = ctx.request.body || {};
    if (!Array.isArray(advertIds) || advertIds.length === 0) {
      return ctx.badRequest('advertIds must be a non-empty array');
    }

    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', id);
    if (!publication) return ctx.notFound('Publication not found');

    const pages = await strapi.entityService.findMany('api::pager-page.pager-page', {
      filters: { publication: id, is_cover: false, is_back_cover: false },
      sort: { page_number: 'asc' },
      populate: { adverts: true },
    });
    if (pages.length === 0) {
      return ctx.badRequest('This publication has no assignable pages');
    }

    const alreadyPlaced = new Set(pages.flatMap((p) => (p.adverts || []).map((a) => a.id)));

    const assigned = [];
    const skipped = [];
    let cursor = 0;

    for (const rawId of advertIds) {
      const advertId = Number(rawId);

      if (alreadyPlaced.has(advertId)) {
        skipped.push({ advertId, reason: 'already placed in this publication' });
        continue;
      }

      const advert = await strapi.entityService.findOne('api::advert.advert', advertId);
      if (!advert) {
        skipped.push({ advertId, reason: 'advert not found' });
        continue;
      }
      if (!isPrintEligible(advert)) {
        skipped.push({ advertId, reason: 'not print-eligible' });
        continue;
      }

      const targetPage = pages[cursor % pages.length];
      cursor += 1;

      const nextAdvertIds = [...(targetPage.adverts || []).map((a) => a.id), advertId];
      try {
        await strapi.entityService.update('api::pager-page.pager-page', targetPage.id, {
          data: { adverts: nextAdvertIds },
        });
        targetPage.adverts = nextAdvertIds.map((aid) => ({ id: aid }));
        alreadyPlaced.add(advertId);
        assigned.push({ advertId, pageId: targetPage.id, page_number: targetPage.page_number });
      } catch (e) {
        skipped.push({ advertId, reason: e.message });
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
