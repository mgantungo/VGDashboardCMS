'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::sfa-buy-in.sfa-buy-in',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-buy-ins/list
     * Returns the active product/service catalogue, optionally filtered.
     */
    async list(ctx) {
      const { filters = {} } = ctx.request.body;

      const items = await strapi.documents('api::sfa-buy-in.sfa-buy-in').findMany({
        filters: { is_active: true, ...filters },
        sort: ['category:asc', 'name:asc'],
      });

      return ctx.send(items);
    },

    /**
     * POST /api/sfa-buy-ins/create
     * Admin/manager only — add a new product to the catalogue.
     */
    async createBuyIn(ctx) {
      const { name, category, description, base_price, unit, is_active = true } = ctx.request.body;
      if (!name || !category) return ctx.badRequest('name and category are required.');

      const item = await strapi.documents('api::sfa-buy-in.sfa-buy-in').create({
        data: { name, category, description, base_price, unit, is_active },
      });

      return ctx.send({ data: item });
    },

    /**
     * POST /api/sfa-buy-ins/update
     */
    async updateBuyIn(ctx) {
      const { id, ...data } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const updated = await strapi.documents('api::sfa-buy-in.sfa-buy-in').update({
        documentId: id,
        data,
      });

      return ctx.send({ data: updated });
    },
  })
);
