'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::sfa-opportunity-buy-in.sfa-opportunity-buy-in',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-opportunity-buy-ins/by-opportunity
     * Returns all buy-in lines for a given opportunity.
     */
    async byOpportunity(ctx) {
      const { opportunityId, populate = ['buy_in'] } = ctx.request.body;
      if (!opportunityId) return ctx.badRequest('opportunityId is required.');

      const lines = await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').findMany({
        filters: { opportunity: { documentId: { $eq: opportunityId } } },
        populate,
      });

      return ctx.send(lines);
    },

    /**
     * POST /api/sfa-opportunity-buy-ins/save
     * Replace all buy-in lines for an opportunity (delete + recreate).
     */
    async save(ctx) {
      const { opportunityId, lines = [] } = ctx.request.body;
      if (!opportunityId) return ctx.badRequest('opportunityId is required.');

      // Delete existing lines
      const existing = await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').findMany({
        filters: { opportunity: { documentId: { $eq: opportunityId } } },
      });
      for (const line of existing) {
        await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').delete({
          documentId: line.documentId,
        });
      }

      // Create new lines
      const created = [];
      for (const line of lines) {
        const subtotal = (line.quantity || 0) * (line.unit_price || 0);
        const newLine = await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').create({
          data: {
            opportunity:  opportunityId,
            buy_in:       line.buy_in,
            quantity:     line.quantity,
            unit_price:   line.unit_price,
            subtotal,
            notes:        line.notes || '',
            custom_offer: line.custom_offer || '',
          },
        });
        created.push(newLine);
      }

      return ctx.send(created);
    },
  })
);
