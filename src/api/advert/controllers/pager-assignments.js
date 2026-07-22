// api/advert/controllers/pager-assignments.js
//
// Standalone controller file — Strapi auto-registers every file in
// controllers/ as its own controller ID (the filename). This means it
// does NOT need to touch or extend your existing advert.js controller.
'use strict';

module.exports = {
  // GET /adverts/:id/pager-assignments
  // Returns every pager-page (across every publication) this advert is placed on.
  async getPagerAssignments(ctx) {
    const { id } = ctx.params;

    const advert = await strapi.entityService.findOne('api::advert.advert', id);
    if (!advert) return ctx.notFound('Advert not found');

    const pages = await strapi.entityService.findMany('api::pager-page.pager-page', {
      filters: { adverts: { id } },
      populate: { publication: true },
    });

    ctx.body = {
      data: pages.map((p) => ({
        pageId: p.id,
        page_number: p.page_number,
        section: p.section,
        publication_id: p.publication?.id,
        publication_code: p.publication?.publication_code,
        publication_date: p.publication?.publication_date,
        masthead: p.publication?.masthead,
      })),
    };
  },
};
