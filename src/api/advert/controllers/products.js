// api/advert/controllers/products.js
'use strict';

module.exports = {
  async findByCategory(ctx) {
    try {
      const { categoryId } = ctx.params;
      const { isActive = true } = ctx.query;

      // Build filters
      const filters = {
        category: categoryId
      };
      
      if (isActive !== undefined) {
        filters.is_active = isActive === 'true' || isActive === true;
      }

      const products = await strapi.entityService.findMany(
        'api::product.product',
        {
          filters,
          populate: ['category', 'rate_cards'],
          sort: 'product_name:asc'
        }
      );

      return ctx.send(products);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async findAll(ctx) {
    try {
      const { categoryType, isActive = true } = ctx.query;

      // Build filters
      const filters = {};
      
      if (categoryType) {
        // If you want to filter by category type, you need to populate category first
        const categories = await strapi.entityService.findMany(
          'api::product-category.product-category',
          {
            filters: { category_type: categoryType },
            fields: ['id']
          }
        );
        
        const categoryIds = categories.map(cat => cat.id);
        filters.category = { $in: categoryIds };
      }
      
      if (isActive !== undefined) {
        filters.is_active = isActive === 'true' || isActive === true;
      }

      const products = await strapi.entityService.findMany(
        'api::product.product',
        {
          filters,
          populate: ['category', 'rate_cards'],
          sort: 'product_name:asc'
        }
      );

      return ctx.send(products);
    } catch (err) {
      ctx.throw(500, err);
    }
  }
};
