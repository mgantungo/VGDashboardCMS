// api/advert/controllers/price-calculator.js
'use strict';

// Normalizes a rate card's ad_type/size_dimension string for comparison:
// lowercases, trims, and collapses underscores to spaces. This exists because
// real rate card records don't always match the exact casing/spacing the
// original code hardcoded against (e.g. "Classified Photo/Logo" vs the old
// literal check for 'classified photo/Logo' with a lowercase "classified" —
// that branch never actually matched real data before this fix).
const normalize = (str) => (str || '').toString().toLowerCase().trim().replace(/_/g, ' ');

// Resolves which pricing mode a rate card uses. ad_type-based checks run
// first because some ad_types (Semi-Display) don't carry a size_dimension
// value that maps cleanly to a generic unit (its size_dimension is literally
// "per col", not "per cm col"), so we key off the more reliable ad_type
// field for those two special cases. Everything else falls back to the
// original size_dimension checks, unchanged.
const resolveMode = (rateCard) => {
  const sizeDimension = normalize(rateCard.size_dimension);
  const adType = normalize(rateCard.ad_type);

  if (adType.includes('semi-display') || adType.includes('semi display')) {
    return 'semi_display';
  }
  if (adType.includes('photo') && adType.includes('logo')) {
    return 'photo_logo';
  }
  if (sizeDimension === 'per cm col') return 'per_cm_col';
  if (sizeDimension === 'per column' || sizeDimension === 'per col') return 'per_column';
  if (sizeDimension === 'per word') return 'per_word';
  return null;
};

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
        photos,
        // Sibling per-word rate card used to price accompanying classified
        // text when a "Photo/Logo" ad also includes a text block.
        wordRateCardId
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
      
      const mode = resolveMode(rateCard);
      
      let multiplier = 1;
      let calculationDetails = {};
      // adjustedBasePrice is normally basePrice * multiplier, but the
      // combined Photo/Logo + text case sums two independently-priced
      // components instead of using a single multiplier, so it's tracked
      // separately here.
      let adjustedBasePrice = null;
      
      // Handle different rate card types
      if (mode === 'per_cm_col' && cm && columns) {
        // Per centimeter column
        multiplier = cm * columns;
        calculationDetails = {
          cm: parseInt(cm),
          columns: parseInt(columns),
          totalCmCol: cm * columns
        };
      } else if (mode === 'semi_display' && cm && columns) {
        // Classified: Semi-Display — same cm x columns model as per_cm_col,
        // reached via ad_type instead of size_dimension.
        multiplier = cm * columns;
        calculationDetails = {
          cm: parseInt(cm),
          columns: parseInt(columns),
          totalCmCol: cm * columns
        };
      } else if (mode === 'per_column' && columns) {
        // Per column
        multiplier = columns;
        calculationDetails = {
          columns: parseInt(columns)
        };
      } else if (mode === 'per_word' && words) {
        // Per word
        multiplier = words;
        calculationDetails = {
          words: parseInt(words)
        };
      } else if (mode === 'photo_logo' && photos) {
        const photoSubtotal = basePrice * photos;

        if (words && wordRateCardId) {
          // Classified Photo/Logo accompanied by billable text: price the
          // text against its own sibling "Classified" (per word) rate card,
          // not the photo rate card's basePrice.
          const wordRateCard = await strapi.entityService.findOne(
            'api::rate-card.rate-card',
            wordRateCardId
          );

          if (!wordRateCard) {
            return ctx.badRequest('Word rate card not found for accompanying text');
          }

          const wordRate = adType === 'full_color' ? wordRateCard.price_fc : wordRateCard.price_bw;
          const wordSubtotal = wordRate * words;

          adjustedBasePrice = photoSubtotal + wordSubtotal;
          calculationDetails = {
            photos: parseInt(photos),
            photoRate: basePrice,
            photoSubtotal,
            words: parseInt(words),
            wordRateCardId: wordRateCard.id,
            wordRate,
            wordSubtotal
          };
        } else {
          // Photo/Logo only, no accompanying text
          multiplier = photos;
          calculationDetails = {
            photos: parseInt(photos)
          };
        }
      } else if (
        mode &&
        (!cm && !columns && !words && !photos)
      ) {
        // Special rate card type but no details provided
        return ctx.badRequest('Additional details required for this rate card type');
      }
      
      // Apply multiplier to base price (skipped when adjustedBasePrice was
      // already computed directly, as in the combined photo+text case).
      if (adjustedBasePrice === null) {
        adjustedBasePrice = basePrice * multiplier;
      }
      
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
