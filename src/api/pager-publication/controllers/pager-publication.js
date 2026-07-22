'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const {
  assertValidPageIncrement,
  buildReaderSpreadLayout,
} = require('../../_pager-helpers/pager-utils');

module.exports = createCoreController('api::pager-publication.pager-publication', ({ strapi }) => ({

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
        data: { publication: id, page_number: n },
      });
    }

    const updated = await strapi.entityService.update('api::pager-publication.pager-publication', id, {
      data: { total_pages: newTotal },
    });

    ctx.body = updated;
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
