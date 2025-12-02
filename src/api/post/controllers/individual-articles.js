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

    // First, get the author to access their publications
    const author = await strapi.entityService.findMany('api::author.author', {
      filters: {
        username: username
      },
      populate: {
        publications: { fields: ['id', 'name'] }
      },
      limit: 1
    });

    if (!author || author.length === 0) {
      console.log(`❌ Author ${username} not found`);
      return [];
    }

    const authorData = author[0];
    const authorPublications = authorData.publications || [];
    
    // Get the first publication ID (or handle multiple if needed)
    const primaryPublicationId = authorPublications.length > 0 ? authorPublications[0].id : null;
    
    // FUTURE ENHANCEMENT: Add these fields to populate when they exist
    // album: true,
    // secondary_category: { fields: ['id'] },
    
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
          fields: ['id'],
          populate: {
            publications: { fields: ['id'] }
          }
        },
        categories: { fields: ['id', 'name'] },
        tags: { fields: ['id', 'name'] },
        featured_image: { fields: ['url', 'alternativeText', 'caption'] }
      },
      sort: { createdAt: 'desc' },
      limit: 100
    });

    console.log(`✅ Found ${articles.length} articles for author ${username}`);

    // Transform to desired format
    const formattedArticles = articles.map(article => {
      
      // Get publication ID from the author's publications
      // Since each article can have multiple authors, we need to check all of them
      let publicationId = null;
      
      if (article.authors && article.authors.length > 0) {
        // Check each author for publications
        for (const author of article.authors) {
          if (author.publications && author.publications.length > 0) {
            // Use the first publication found
            publicationId = author.publications[0].id;
            break;
          }
        }
      }
      
      // If no publication found in the populated authors, use the primary one from earlier
      if (!publicationId) {
        publicationId = primaryPublicationId;
      }

      // FUTURE: When these fields exist, populate them properly
      // const album = article.album?.map((item, index) => ({
      //   id: item.id,
      //   url: item.url,
      //   alt: item.alternativeText,
      //   caption: item.caption,
      //   credit: item.credit || '',
      //   order: index
      // })) || [];
      
      // const secondaryCategory = article.secondary_category?.id || null;
      // const featured = article.isFeatured || false;
      // const breakingNews = article.isBreakingNews || false;
      // const breakingDuration = article.breakingDuration || null;

      // CURRENT: Using placeholders for future fields
      return {
        id: article.id,
        title: article.title,
        status: article.publishedAt ? 'published' : 'draft',
        category: article.categories?.[0]?.id || null,
        authors: article.authors?.map(author => author.id) || [],
        publishedAt: article.publishedAt,
        live: !!article.publishedAt,
        
        // FUTURE FIELDS - CURRENT PLACEHOLDERS
        featured: false,
        breakingNews: false,
        breakingDuration: null,
        
        // EXISTING FIELD
        premium: article.isPremium || false,
        
        tags: article.tags?.map(tag => tag.name) || [],
        summary: article.excerpt || '',
        content: article.content || '',
        
        featuredImage: article.featured_image ? {
          url: article.featured_image.url,
          alt: article.featured_image.alternativeText || '',
          caption: article.featured_image.caption || '',
          credit: '' // FUTURE: Add credit field to media
        } : null,
        
        // FUTURE FIELD - CURRENT EMPTY ARRAY
        album: [],
        
        // FUTURE: Will be proper relation
        secondaryCategory: null,
        
        // Now properly populated from author's publications
        publicationId: publicationId,
        
        createdAt: article.createdAt,
        updatedAt: article.updatedAt
      };
    });

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
