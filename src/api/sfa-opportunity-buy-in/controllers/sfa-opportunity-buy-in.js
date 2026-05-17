'use strict';
// src/api/sfa-opportunity-buy-in/controllers/sfa-opportunity-buy-in.js

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveSfaProfile }    = require('../../../_sfa-helpers/sfa-profile');

module.exports = createCoreController(
  'api::sfa-opportunity-buy-in.sfa-opportunity-buy-in',
  ({ strapi }) => ({

    // POST /api/sfa-opportunity-buy-ins/by-opportunity
    async byOpportunity(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { opportunityId, populate = ['buy_in'] } = ctx.request.body;
      if (!opportunityId) return ctx.badRequest('opportunityId is required.');

      const lines = await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').findMany({
        filters: { opportunity: { documentId: { $eq: opportunityId } } },
        populate,
      });

      return ctx.send(lines);
    },

    // POST /api/sfa-opportunity-buy-ins/save  — replaces all lines for an opportunity
    async save(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { opportunityId, lines = [] } = ctx.request.body;
      if (!opportunityId) return ctx.badRequest('opportunityId is required.');

      // Delete existing
      const existing = await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').findMany({
        filters: { opportunity: { documentId: { $eq: opportunityId } } },
      });
      for (const line of existing) {
        await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').delete({
          documentId: line.documentId,
        });
      }

      // Create new
      const created = [];
      for (const line of lines) {
        const newLine = await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').create({
          data: {
            opportunity:  opportunityId,
            buy_in:       line.buy_in,
            quantity:     line.quantity,
            unit_price:   line.unit_price,
            subtotal:     (line.quantity || 0) * (line.unit_price || 0),
            notes:        line.notes        || '',
            custom_offer: line.custom_offer || '',
          },
        });
        created.push(newLine);
      }

      return ctx.send(created);
    },
  })
);
