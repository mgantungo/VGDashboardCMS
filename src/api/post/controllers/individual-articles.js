'use strict';
module.exports = {

 /*
 * get articles associated with and author within a given period. Default is 6months
 */ 
async findPostsByAuthorAndDate(ctx) {
    try {
      const { username, startdate, enddate } = ctx.params;

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
            fields: ['id', 'username', 'display_name']
          },
          categories: {
            fields: ['id', 'name', 'slug']
          },
          tags: {
            fields: ['id', 'name', 'slug']
          },
          featured_image: {
            fields: ['url', 'alternativeText', 'caption', 'credit']
          }
        },
        sort: { createdAt: 'desc' }
      });

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
      strapi.log.error('Error in findByAuthorAndDate:', error);
      return ctx.internalServerError('An error occurred while fetching articles');
    }
  }

}
