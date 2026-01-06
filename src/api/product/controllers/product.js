// api/product/controllers/product.js
'use strict';

module.exports = {
  async findAll(ctx) {
    try {
      const { category, is_active = true, populate = ['category', 'rate_cards'] } = ctx.query;
      
      const filters = {};
      
      if (category) {
        filters.category = category;
      }
      
      if (is_active !== undefined) {
        filters.is_active = is_active === 'true' || is_active === true;
      }

      const products = await strapi.entityService.findMany(
        'api::product.product',
        {
          filters,
          populate,
          sort: 'product_name:asc'
        }
      );

      return ctx.send(products);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async findByCategory(ctx) {
    try {
      const { categoryId } = ctx.params;
      const { is_active = true } = ctx.query;

      const products = await strapi.entityService.findMany(
        'api::product.product',
        {
          filters: {
            category: categoryId,
            is_active: is_active === 'true' || is_active === true
          },
          populate: ['category', 'rate_cards'],
          sort: 'product_name:asc'
        }
      );

      return ctx.send(products);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async findOne(ctx) {
    try {
      const { id } = ctx.params;
      
      const product = await strapi.entityService.findOne(
        'api::product.product',
        id,
        {
          populate: ['category', 'rate_cards']
        }
      );

      if (!product) {
        return ctx.notFound('Product not found');
      }

      return ctx.send(product);
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

/*
'use strict';

**
 * product controller
 *

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::product.product');

*/
