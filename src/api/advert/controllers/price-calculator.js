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

    // Get the product with populated rate cards
    const product = await strapi.entityService.findOne(
      'api::product.product',
      productId,
      {
        populate: ['rate_cards']
      }
    );

    if (!product) {
      return ctx.notFound('Product not found');
    }

    // Return rate cards
    const rateCards = product.rate_cards || [];

    // Filter active rate cards (optional)
    const activeRateCards = rateCards.filter(rateCard => {
      const today = new Date();
      const effectiveDate = rateCard.effective_date ? new Date(rateCard.effective_date) : null;
      const expiryDate = rateCard.expiry_date ? new Date(rateCard.expiry_date) : null;

      // Check if effective date has passed
      if (effectiveDate && today < effectiveDate) return false;
      
      // Check if expiry date has passed
      if (expiryDate && today > expiryDate) return false;

      return true;
    });

    return ctx.send(activeRateCards);
  } catch (err) {
    ctx.throw(500, err);
  }
}
};
