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
          fields: ['id', 'username', 'display_name', 'first_name', 'last_name', 'email'],
          populate: {
            publications: { fields: ['id', 'name', 'slug'] }
          }
        },
        categories: { fields: ['id', 'name', 'slug'] },
        tags: { fields: ['id', 'name', 'slug'] },
        featured_image: { fields: ['url', 'alternativeText', 'caption', 'formats'] }
      },
      sort: { createdAt: 'desc' },
      limit: 100
    });

    console.log(`✅ Found ${articles.length} articles for author ${username}`);

    // Transform to desired format
    const formattedArticles = articles.map(article => {
      
      // Extract all authors with their details
      const authors = article.authors?.map(author => ({
        id: author.id,
        username: author.username,
        displayName: author.display_name || `${author.first_name} ${author.last_name}`.trim(),
        firstName: author.first_name,
        lastName: author.last_name,
        email: author.email,
        // Get publication IDs from this author
        publicationIds: author.publications?.map(pub => pub.id) || []
      })) || [];

      // Get all unique publication IDs from all authors
      const allPublicationIds = authors.reduce((ids, author) => {
        author.publicationIds.forEach(id => {
          if (!ids.includes(id)) ids.push(id);
        });
        return ids;
      }, []);

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
        categoryName: article.categories?.[0]?.name || null,
        categorySlug: article.categories?.[0]?.slug || null,
        
        // Return all authors with their details
        authors: authors,
        
        // For backward compatibility, also return author IDs array
        authorIds: authors.map(author => author.id),
        
        // All publication IDs from all authors
        publicationIds: allPublicationIds,
        
        // Primary publication ID (first one found, if any)
        publicationId: allPublicationIds.length > 0 ? allPublicationIds[0] : null,
        
        publishedAt: article.publishedAt,
        live: !!article.publishedAt,
        
        // FUTURE FIELDS - CURRENT PLACEHOLDERS
        featured: false,
        breakingNews: false,
        breakingDuration: null,
        
        // EXISTING FIELD
        premium: article.isPremium || false,
        
        tags: article.tags?.map(tag => ({
          id: tag.id,
          name: tag.name,
          slug: tag.slug
        })) || [],
        
        tagNames: article.tags?.map(tag => tag.name) || [],
        
        summary: article.excerpt || '',
        content: article.content || '',
        
        featuredImage: article.featured_image ? {
          url: article.featured_image.url,
          alt: article.featured_image.alternativeText || '',
          caption: article.featured_image.caption || '',
          formats: article.featured_image.formats || {},
          credit: '' // FUTURE: Add credit field to media
        } : null,
        
        // FUTURE FIELD - CURRENT EMPTY ARRAY
        album: [],
        
        // FUTURE: Will be proper relation
        secondaryCategory: null,
        
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        wpId: article.wp_id || null
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
