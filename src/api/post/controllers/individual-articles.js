'use strict';
module.exports = {

 /*
 * get articles associated with and author within a given period. Default is 6months
 */ 

  async findPostsByAuthorAndDate(ctx) {
    try {
      const { username, startdate, enddate } = ctx.params;

      console.log('🔄 Fetching articles for author:', username, 'from', startdate, 'to', enddate);

      // Validate parameters
      if (!username) {
        return ctx.badRequest('Username parameter is required');
      }

      // Calculate date range (default to last 6 months)
      let startDate = startdate;
      let endDate = enddate;

      if (!endDate) {
        endDate = new Date().toISOString().split('T')[0];
      }
      if (!startDate) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        startDate = sixMonthsAgo.toISOString().split('T')[0];
      }

      console.log('📅 Using date range:', startDate, 'to', endDate);

      // Find articles by author and date range using createdAt only
      const articles = await strapi.entityService.findMany('api::post.post', {
        filters: {
          authors: {
            username: username
          },
          createdAt: {
            $gte: `${startDate}T00:00:00.000Z`,
            $lte: `${endDate}T23:59:59.999Z`
          }
        },
        populate: {
          authors: {
            fields: ['id', 'username', 'display_name', 'first_name', 'last_name']
          },
          categories: {
            fields: ['id', 'name', 'slug']
          },
          tags: {
            fields: ['id', 'name', 'slug']
          },
          featured_image: {
            fields: ['url', 'alternativeText', 'caption']
          },
          // Add these if they exist in your content type
          album: {
            populate: ['*']
          },
          secondary_category: true,
          publication: true
        },
        sort: { createdAt: 'desc' },
        limit: 100
      });

      console.log(`✅ Found ${articles.length} articles for author ${username}`);

      // Format the response to match desired structure
      const formattedArticles = articles.map(article => {
        return {
          id: article.id,
          title: article.title,
          status: article.publishedAt ? 'published' : 'draft',
          category: article.categories?.[0]?.id || null,
          authors: article.authors?.map(author => author.id) || [],
          publishedAt: article.publishedAt || null,
          live: article.publishedAt ? true : false,
          featured: article.isFeatured || false, // Assuming you have an isFeatured field
          breakingNews: article.isBreakingNews || false, // Assuming you have an isBreakingNews field
          breakingDuration: article.breakingDuration || null,
          premium: article.isPremium || false,
          tags: article.tags?.map(tag => tag.name) || [],
          summary: article.excerpt || '',
          content: article.content || '',
          featuredImage: article.featured_image ? {
            url: article.featured_image.url || '',
            alt: article.featured_image.alternativeText || '',
            caption: article.featured_image.caption || '',
            credit: article.featured_image.credit || '' // Add credit field if exists
          } : null,
          album: article.album?.map((media, index) => ({
            id: media.id || index,
            url: media.url || '',
            alt: media.alternativeText || '',
            caption: media.caption || '',
            credit: media.credit || '',
            order: media.order || index
          })) || [],
          secondaryCategory: article.secondary_category?.id || null,
          publicationId: article.publication?.id || null,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt
        };
      });

      // If you want to return just the array of formatted articles
      return formattedArticles;

      // If you want to keep metadata but in a different format
      // return {
      //   articles: formattedArticles,
      //   meta: {
      //     author: username,
      //     dateRange: {
      //       start: startDate,
      //       end: endDate
      //     },
      //     total: formattedArticles.length
      //   }
      // };

    } catch (error) {
      console.error('❌ Error in findByAuthorAndDate:', error);
      strapi.log.error('Error in findByAuthorAndDate:', error);
      return ctx.internalServerError('An error occurred while fetching articles');
    }
  }



 
 /*
async findPostsByAuthorAndDate(ctx) {
    try {
      const { username, startdate, enddate } = ctx.params;

      console.log('🔄 Fetching articles for author:', username, 'from', startdate, 'to', enddate);

      // Validate parameters
      if (!username) {
        return ctx.badRequest('Username parameter is required');
      }

      // Calculate date range (default to last 6 months)
      let startDate = startdate;
      let endDate = enddate;

      if (!endDate) {
        endDate = new Date().toISOString().split('T')[0];
      }
      if (!startDate) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        startDate = sixMonthsAgo.toISOString().split('T')[0];
      }

      console.log('📅 Using date range:', startDate, 'to', endDate);

      // Find articles by author and date range using createdAt only
      const articles = await strapi.entityService.findMany('api::post.post', {
        filters: {
          authors: {
            username: username
          },
          createdAt: {
            $gte: `${startDate}T00:00:00.000Z`,
            $lte: `${endDate}T23:59:59.999Z`
          }
        },
        populate: {
          authors: {
            fields: ['id', 'username', 'display_name', 'first_name', 'last_name']
          },
          categories: {
            fields: ['id', 'name', 'slug']
          },
          tags: {
            fields: ['id', 'name', 'slug']
          },
          featured_image: {
            fields: ['url', 'alternativeText', 'caption']
          }
        },
        sort: { createdAt: 'desc' },
        limit: 100
      });

      console.log(`✅ Found ${articles.length} articles for author ${username}`);

      return {
        articles: articles,
        meta: {
          author: username,
          dateRange: {
            start: startDate,
            end: endDate
          },
          total: articles.length
        }
      };

    } catch (error) {
      console.error('❌ Error in findByAuthorAndDate:', error);
      strapi.log.error('Error in findByAuthorAndDate:', error);
      return ctx.internalServerError('An error occurred while fetching articles');
    }
  }
*/
}
