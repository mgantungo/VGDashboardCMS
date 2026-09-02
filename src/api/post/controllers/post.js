//'use strict';

/**
 * post controller
 */

//const { createCoreController } = require('@strapi/strapi').factories;

//module.exports = createCoreController('api::post.post');
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::post.post', ({ strapi }) => ({
  async updateFeaturedImages(ctx) {
    try {
      const postService = strapi.service('api::post.post');
      const result = await postService.updateFeaturedImages();
      
      ctx.send(result);
    } catch (error) {
      ctx.throw(500, error);
    }
  },

/**
 * Get posts for authenticated author
 */
  async findMyPosts(ctx) {
    try {
      const authorId = ctx.state.user.id;
      const { 
        page, 
        pageSize, 
        publication, 
        status, 
        category,
        search 
      } = ctx.params;

      const start = (parseInt(page) - 1) * parseInt(pageSize);
      
      // Build filters
      const filters = {
        authors: { id: authorId }
      };

      // Status filter
      if (status && status !== 'null') {
        if (status === 'published') {
          filters.publishedAt = { $notNull: true };
        } else if (status === 'draft') {
          filters.publishedAt = { $null: true };
        }
      }

      // Publication filter
      if (publication && publication !== 'null') {
        filters.categories = {
          publications: { id: parseInt(publication) }
        };
      }

      // Category filter
      if (category && category !== 'null') {
        filters.categories = {
          ...filters.categories,
          id: parseInt(category)
        };
      }

      // Search filter
      if (search && search !== 'null') {
        filters.$or = [
          { title: { $containsi: search } },
          { excerpt: { $containsi: search } },
          { content: { $containsi: search } }
        ];
      }

      const [posts, total] = await Promise.all([
        strapi.db.query('api::post.post').findMany({
          where: filters,
          populate: [
            'categories',
            'categories.publications', 
            'tags',
            'featured_image',
            'authors'
          ],
          limit: parseInt(pageSize),
          offset: start,
          orderBy: { createdAt: 'desc' }
        }),
        strapi.db.query('api::post.post').count({
          where: filters
        })
      ]);

      return {
        success: true,
        data: posts,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pageCount: Math.ceil(total / parseInt(pageSize)),
          total
        }
      };

    } catch (error) {
      console.error('💥 Find my posts error:', error);
      return ctx.internalServerError('Failed to fetch posts');
    }
  },

  /**
   * Update authenticated author's post - UPDATED with path param
   */
  async updateMyPost(ctx) {
    try {
      const authorId = ctx.state.user.id;
      const { id } = ctx.params;
      const updateData = ctx.request.body.data;

      // Verify author owns this post
      const existingPost = await strapi.db.query('api::post.post').findOne({
        where: { id: parseInt(id) },
        populate: ['authors']
      });

      if (!existingPost) {
        return ctx.notFound('Post not found');
      }

      const authorOwnsPost = existingPost.authors.some(author => author.id === authorId);
      if (!authorOwnsPost) {
        return ctx.forbidden('You do not have permission to update this post');
      }

      // Verify category access if categories are being updated
      if (updateData.categories) {
        const author = await strapi.db.query('api::author.author').findOne({
          where: { id: authorId },
          populate: ['publications.categories']
        });

        const authorCategoryIds = author.publications.flatMap(pub => 
          pub.categories.map(cat => cat.id)
        );

        const invalidCategories = updateData.categories.filter(
          catId => !authorCategoryIds.includes(parseInt(catId))
        );

        if (invalidCategories.length > 0) {
          return ctx.forbidden('You do not have access to some categories');
        }
      }

      const updatedPost = await strapi.entityService.update('api::post.post', parseInt(id), {
        data: updateData,
        populate: ['categories', 'authors', 'tags', 'featured_image']
      });

      return {
        success: true,
        data: updatedPost
      };

    } catch (error) {
      console.error('💥 Update my post error:', error);
      return ctx.internalServerError('Failed to update post');
    }
  }
}));
