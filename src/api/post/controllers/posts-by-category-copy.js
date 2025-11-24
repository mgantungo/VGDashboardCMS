'use strict';

module.exports = {
  /**
   * Get recent posts by category slugs
   * Returns the 3 most recent posts for each specified category
   * 
   * GET /api/posts/by-categories
   */
  async byCategories(ctx) {
    try {
      const categorySlugs = [
        'agribusiness',
        'change-makers',
        'farming-tips',
        'markets',
        'research-innovations'
      ];

      const result = {};

      // Fetch posts for each category
      for (const slug of categorySlugs) {
        // First, find the category by slug
        const categories = await strapi.entityService.findMany('api::category.category', {
          filters: {
            slug: slug,
          },
          limit: 1,
        });

        if (categories && categories.length > 0) {
          const category = categories[0];

          // Fetch the 3 most recent posts for this category
          const posts = await strapi.entityService.findMany('api::post.post', {
            filters: {
              categories: {
                id: category.id,
              },
            },
            sort: { wp_published_at: 'desc' },
            limit: 3,
            populate: {
              featured_image: true,
              authors: {
                fields: ['name', 'slug'],
              },
              categories: {
                fields: ['name', 'slug'],
              },
              tags: {
                fields: ['name', 'slug'],
              },
            },
          });

          result[slug] = posts;
        } else {
          result[slug] = [];
        }
      }

      return {
        data: result,
        meta: {
          categorySlugs,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      ctx.throw(500, err);
    }
  },
};
