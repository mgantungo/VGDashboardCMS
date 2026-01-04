// api/advert/controllers/price-calculator.js
'use strict';

module.exports = {
  async calculate(ctx) {
    try {
      const { productId, rateCardId, frequency, adType } = ctx.request.body;

      // Get rate card
      const rateCard = await strapi.entityService.findOne(
        'api::rate-card.rate-card',
        rateCardId
      );

      if (!rateCard) {
        return ctx.badRequest('Rate card not found');
      }

      // Calculate base price
      let basePrice = adType === 'full_color' ? rateCard.price_fc : rateCard.price_bw;

      // Apply frequency multiplier
      const subtotal = basePrice * frequency;

      // Calculate surcharge if applicable
      const surcharge = rateCard.surcharge_percentage 
        ? subtotal * (rateCard.surcharge_percentage / 100)
        : 0;

      // Calculate total
      const total = subtotal + surcharge;

      return ctx.send({
        basePrice,
        frequency,
        subtotal,
        surcharge,
        surchargePercentage: rateCard.surcharge_percentage || 0,
        total,
        currency: rateCard.currency
      });
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async getRateCards(ctx) {
    try {
      const { productId } = ctx.params;

      const rateCards = await strapi.entityService.findMany(
        'api::rate-card.rate-card',
        {
          filters: {
            product: productId,
            effective_date: {
              $lte: new Date()
            },
            $or: [
              { expiry_date: { $gte: new Date() } },
              { expiry_date: null }
            ]
          },
          populate: ['product']
        }
      );

      return ctx.send(rateCards);
    } catch (err) {
      ctx.throw(500, err);
    }
  }
};
