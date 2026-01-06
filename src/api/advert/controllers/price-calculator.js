// api/advert/controllers/price-calculator.js
'use strict';

module.exports = {
  async calculate(ctx) {
    try {
      const { 
        productId, 
        rateCardId, 
        frequency, 
        adType,
        // New parameters from modal
        cm,
        columns,
        words,
        photos
      } = ctx.request.body;

      // Get rate card
      const rateCard = await strapi.entityService.findOne(
        'api::rate-card.rate-card',
        rateCardId,
        {
          populate: ['product']
        }
      );

      if (!rateCard) {
        return ctx.badRequest('Rate card not found');
      }

      // Get the product for additional info
      const product = await strapi.entityService.findOne(
        'api::product.product',
        productId
      );

      if (!product) {
        return ctx.badRequest('Product not found');
      }

      // Calculate base price based on ad type
      let basePrice = adType === 'full_color' ? rateCard.price_fc : rateCard.price_bw;
      
      // Check if we need to apply size/quantity multipliers
      const sizeDimension = rateCard.size_dimension;
      const adTypeSpecific = rateCard.ad_type;
      
      let multiplier = 1;
      let calculationDetails = {};
      
      // Handle different rate card types
      if (sizeDimension === 'per cm col' && cm && columns) {
        // Per centimeter column
        multiplier = cm * columns;
        calculationDetails = {
          cm: parseInt(cm),
          columns: parseInt(columns),
          totalCmCol: cm * columns
        };
      } else if (sizeDimension === 'per column' && columns) {
        // Per column
        multiplier = columns;
        calculationDetails = {
          columns: parseInt(columns)
        };
      } else if (sizeDimension === 'per word' && words) {
        // Per word
        multiplier = words;
        calculationDetails = {
          words: parseInt(words)
        };
      } else if (adTypeSpecific === 'classified photo/Logo' && photos) {
        // Per photo/logo
        multiplier = photos;
        calculationDetails = {
          photos: parseInt(photos)
        };
      } else if (
        (sizeDimension === 'per cm col' || 
         sizeDimension === 'per column' || 
         sizeDimension === 'per word' ||
         adTypeSpecific === 'classified photo/Logo') &&
        (!cm && !columns && !words && !photos)
      ) {
        // Special rate card type but no details provided
        return ctx.badRequest('Additional details required for this rate card type');
      }
      
      // Apply multiplier to base price
      const adjustedBasePrice = basePrice * multiplier;
      
      // Apply frequency multiplier
      const subtotal = adjustedBasePrice * frequency;
      
      // Calculate surcharge if applicable
      const surchargePercentage = rateCard.surcharge_percentage || 0;
      const surcharge = surchargePercentage > 0 
        ? subtotal * (surchargePercentage / 100)
        : 0;
      
      // Calculate total
      const total = subtotal + surcharge;
      
      // Prepare response
      const response = {
        basePrice: adjustedBasePrice,
        frequency,
        subtotal,
        surcharge,
        surchargePercentage,
        total,
        currency: rateCard.currency || 'UGX',
        rateCardName: rateCard.name,
        productName: product.product_name || product.name,
        sizeDimension: rateCard.size_dimension,
        adType: rateCard.ad_type,
        calculationDetails
      };
      
      return ctx.send(response);
    } catch (err) {
      console.error('Price calculation error:', err);
      ctx.throw(500, 'Internal server error');
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
      }).map(rateCard => ({
        id: rateCard.id,
        name: rateCard.name,
        price_fc: rateCard.price_fc,
        price_bw: rateCard.price_bw,
        currency: rateCard.currency,
        size_dimension: rateCard.size_dimension,
        ad_type: rateCard.ad_type,
        effective_date: rateCard.effective_date,
        expiry_date: rateCard.expiry_date,
        surcharge_percentage: rateCard.surcharge_percentage,
        is_active: rateCard.is_active
      }));
      
      return ctx.send(activeRateCards);
    } catch (err) {
      console.error('Get rate cards error:', err);
      ctx.throw(500, 'Internal server error');
    }
  }
};
