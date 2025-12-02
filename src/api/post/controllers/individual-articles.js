'use strict';
module.exports = {

 /*
 * get articles associated with and author within a given period. Default is 6months
 */ 

  async findPostsByAuthorAndDate(ctx) {
    try {
      const { username, startdate, enddate } = ctx.params;

      console.log('🔄 Fetching articles for author:', username, 'from', startdate, 'to', enddate);

      if (!username) {
        return ctx.badRequest('Username parameter is required');
      }

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

      // Find articles by author and date range
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
            fields: ['id']
          },
          categories: {
            fields: ['id', 'name']
          },
          tags: {
            fields: ['id', 'name']
          },
          featured_image: {
            fields: ['url', 'alternativeText', 'caption']
          }
        },
        sort: { createdAt: 'desc' },
        limit: 100
      });

      console.log(`✅ Found ${articles.length} articles for author ${username}`);

      // Format the response to match desired structure
      const formattedArticles = articles.map(article => {
        // Get publication ID - will be null since it's not directly linked to posts
        const publicationId = null;
        
        // Get secondary category (second category if exists)
        const secondaryCategory = article.categories && article.categories.length > 1 
          ? article.categories[1].id 
          : null;

        return {
          id: article.id,
          title: article.title,
          status: article.publishedAt ? 'published' : 'draft',
          category: article.categories?.[0]?.id || null,
          authors: article.authors?.map(author => author.id) || [],
          publishedAt: article.publishedAt || null,
          live: article.publishedAt ? true : false,
          
          // Fields that will be added in the future - providing defaults
          featured: false, // Will be added as isFeatured
          breakingNews: false, // Will be added as isBreakingNews
          breakingDuration: null, // Will be added as breakingDuration
          
          // Existing field
          premium: article.isPremium || false,
          
          tags: article.tags?.map(tag => tag.name) || [],
          summary: article.excerpt || '',
          content: article.content || '', // Keeping as is (richtext format)
          
          featuredImage: article.featured_image ? {
            url: article.featured_image.url || '',
            alt: article.featured_image.alternativeText || '',
            caption: article.featured_image.caption || '',
            credit: '' // Will be added to media fields
          } : null,
          
          album: [], // Will be added as media multiple field
          secondaryCategory: secondaryCategory,
          publicationId: publicationId, // Will be linked in future
          createdAt: article.createdAt,
          updatedAt: article.updatedAt
        };
      });

      // Return as array
      return formattedArticles;

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
