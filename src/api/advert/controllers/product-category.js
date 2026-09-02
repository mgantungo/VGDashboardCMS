'use strict';

module.exports = {
  async findCategories(ctx) {
    try {
      const { categoryType, isActive = true } = ctx.query;

      // Build filters
      const filters = {};
      
      if (categoryType) {
        filters.category_type = categoryType;
      }
      
      if (isActive !== undefined) {
        filters.is_active = isActive === 'true' || isActive === true;
      }

      const categories = await strapi.entityService.findMany(
        'api::product-category.product-category',
        {
          filters,
          populate: ['products'],
          sort: 'category_name:asc'
        }
      );

      return ctx.send(categories);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async findByType(ctx) {
    try {
      const { categoryType } = ctx.params;
      
      const categories = await strapi.entityService.findMany(
        'api::product-category.product-category',
        {
          filters: {
            category_type: categoryType,
            is_active: true
          },
          populate: ['products'],
          sort: 'category_name:asc'
        }
      );

      return ctx.send(categories);
    } catch (err) {
      ctx.throw(500, err);
    }
  }
};
