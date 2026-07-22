'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { isPrintEligible } = require('../../_pager-helpers/pager-utils');

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
  async assignAdvert(ctx) {
    const { id } = ctx.params;
    const { advertId } = ctx.request.body || {};
    if (!advertId) return ctx.badRequest('advertId is required');

    const advert = await strapi.entityService.findOne('api::advert.advert', advertId);
    if (!advert) return ctx.notFound('Advert not found');
    if (!isPrintEligible(advert)) {
      return ctx.badRequest('This advert is not eligible for pager assignment');
    }

    const page = await strapi.entityService.findOne('api::pager-page.pager-page', id, {
      populate: { adverts: true },
    });
    if (!page) return ctx.notFound('Page not found');

    const alreadyOnPage = (page.adverts || []).some((a) => a.id === Number(advertId));
    if (alreadyOnPage) {
      return ctx.badRequest('This advert is already on this page');
    }

    const nextAdvertIds = [...(page.adverts || []).map((a) => a.id), Number(advertId)];

    try {
      const updated = await strapi.entityService.update('api::pager-page.pager-page', id, {
        data: { adverts: nextAdvertIds },
        populate: { adverts: { populate: { client: true } } },
      });
      ctx.body = updated;
    } catch (e) {
      ctx.badRequest(e.message);
    }
  },

  // DELETE /pager-pages/:id/advert/:advertId
  async unassignAdvert(ctx) {
    const { id, advertId } = ctx.params;

    const page = await strapi.entityService.findOne('api::pager-page.pager-page', id, {
      populate: { adverts: true },
    });
    if (!page) return ctx.notFound('Page not found');

    const remainingIds = (page.adverts || [])
      .map((a) => a.id)
      .filter((aid) => aid !== Number(advertId));

    const updated = await strapi.entityService.update('api::pager-page.pager-page', id, {
      data: { adverts: remainingIds },
      populate: { adverts: { populate: { client: true } } },
    });
    ctx.body = updated;
  },

  // GET /pager-pages/:id/available-adverts
  // Print-eligible adverts not already placed anywhere in this page's publication.
  async getAvailableAdverts(ctx) {
    const { id } = ctx.params;

    const page = await strapi.entityService.findOne('api::pager-page.pager-page', id, {
      populate: { publication: true },
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
      populate: { client: true },
      filters: { isCanceled: false },
    });

    const available = candidates.filter((a) => !usedAdvertIds.has(a.id) && isPrintEligible(a));
    ctx.body = { data: available };
  },

}));
