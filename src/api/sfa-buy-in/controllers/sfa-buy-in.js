'use strict';
// src/api/sfa-buy-in/controllers/sfa-buy-in.js

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveSfaProfile }    = require('../../../_sfa-helpers/sfa-profile');

module.exports = createCoreController(
  'api::sfa-buy-in.sfa-buy-in',
  ({ strapi }) => ({

    // POST /api/sfa-buy-ins/list  — returns active catalogue, cached on frontend
    async list(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { filters = {} } = ctx.request.body;

      const items = await strapi.documents('api::sfa-buy-in.sfa-buy-in').findMany({
        filters: { is_active: true, ...filters },
        sort:    ['category:asc', 'name:asc'],
      });

      return ctx.send(items);
    },

    // POST /api/sfa-buy-ins/create  — manager/admin only
    async createBuyIn(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      if (!['manager', 'admin'].includes(caller.role)) {
        return ctx.forbidden('Only managers and administrators can add catalogue items.');
      }

      const { name, category, description, base_price, unit, is_active = true } = ctx.request.body;
      if (!name || !category) return ctx.badRequest('name and category are required.');

      const item = await strapi.documents('api::sfa-buy-in.sfa-buy-in').create({
        data: { name, category, description, base_price, unit, is_active },
      });

      return ctx.send({ data: item });
    },

    // POST /api/sfa-buy-ins/update  — manager/admin only
    async updateBuyIn(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      if (!['manager', 'admin'].includes(caller.role)) {
        return ctx.forbidden('Only managers and administrators can update catalogue items.');
      }

      const { id, sfaProfileDocumentId, ...data } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const updated = await strapi.documents('api::sfa-buy-in.sfa-buy-in').update({
        documentId: id, data,
      });

      return ctx.send({ data: updated });
    },
  })
);
