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

    // Get CMS base URL from config
    const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
    
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
          populate: {
            publications: { fields: ['id'] }
          }
        },
        categories: { fields: ['id', 'name'] },
        tags: { fields: ['id', 'name'] },
        featured_image: { fields: ['url', 'alternativeText', 'caption', 'formats', 'ext', 'mime', 'size'] }
      },
      sort: { id: 'desc' }, // Sort by ID descending to get highest ID first
      limit: 200 // Increase limit to ensure we get all duplicates
    });

    console.log(`📊 Found ${articles.length} total articles for author ${username}`);

    // Filter out duplicates - keep only the highest ID for each wp_id
    const uniqueArticlesMap = new Map();
    
    articles.forEach(article => {
      const wpId = article.wp_id;
      
      if (!wpId) {
        // If no wp_id, keep the article as is
        uniqueArticlesMap.set(article.id, article);
        return;
      }
      
      // Check if we already have an article with this wp_id
      const existingArticle = Array.from(uniqueArticlesMap.values())
        .find(item => item.wp_id === wpId);
      
      if (!existingArticle) {
        // First time seeing this wp_id, add it
        uniqueArticlesMap.set(article.id, article);
      } else if (article.id > existingArticle.id) {
        // Found a higher ID for the same wp_id, replace it
        uniqueArticlesMap.delete(existingArticle.id);
        uniqueArticlesMap.set(article.id, article);
        console.log(`🔄 Replaced wp_id ${wpId}: ${existingArticle.id} -> ${article.id}`);
      }
      // If existing article has higher ID, do nothing
    });

    const uniqueArticles = Array.from(uniqueArticlesMap.values());
    
    console.log(`✅ After deduplication: ${uniqueArticles.length} unique articles`);

    // Transform to desired format
    const formattedArticles = uniqueArticles.map(article => {
      
      // Get ALL authors of this article with their publication IDs
      const articleAuthors = [];
      let publicationIds = [];
      
      if (article.authors && article.authors.length > 0) {
        article.authors.forEach(author => {
          // Add author to the list
          articleAuthors.push({
            id: author.id,
            username: author.username,
            displayName: author.display_name || `${author.first_name} ${author.last_name}`.trim(),
            firstName: author.first_name,
            lastName: author.last_name,
            email: author.email,
            wpId: author.wp_id
          });
          
          // Collect publication IDs from this author
          if (author.publications && author.publications.length > 0) {
            author.publications.forEach(pub => {
              if (!publicationIds.includes(pub.id)) {
                publicationIds.push(pub.id);
              }
            });
          }
        });
      }

      // Format featured image with full URL
      let featuredImage = null;
      if (article.featured_image) {
        const img = article.featured_image;
        
        // Build full image URL - SIMPLIFIED LOGIC
        let imageUrl = img.url;
        
        // Always prepend base URL if it doesn't already start with http/https
        if (!imageUrl.startsWith('http')) {
          // Ensure the URL has a leading slash before appending
          if (!imageUrl.startsWith('/')) {
            imageUrl = '/' + imageUrl;
          }
          imageUrl = cmsBaseUrl + imageUrl;
        }
        
        // Check for different image formats if available
        const imageFormats = {};
        if (img.formats) {
          Object.keys(img.formats).forEach(format => {
            let formatUrl = img.formats[format].url;
            // Apply same logic to format URLs
            if (!formatUrl.startsWith('http')) {
              if (!formatUrl.startsWith('/')) {
                formatUrl = '/' + formatUrl;
              }
              formatUrl = cmsBaseUrl + formatUrl;
            }
            imageFormats[format] = {
              url: formatUrl,
              width: img.formats[format].width,
              height: img.formats[format].height,
              ext: img.formats[format].ext,
              size: img.formats[format].size
            };
          });
        }
        
        featuredImage = {
          url: imageUrl,
          alt: img.alternativeText || '',
          caption: img.caption || '',
          credit: '', // FUTURE: Add credit field to media
          formats: imageFormats,
          ext: img.ext,
          mime: img.mime,
          size: img.size,
          // Keep original URL for reference
          originalUrl: img.url
        };
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
        wp_id: article.wp_id, // Include wp_id in response for debugging
        title: article.title,
        status: article.publishedAt ? 'published' : 'draft',
        category: article.categories?.[0]?.id || null,
        
        // Return ALL authors of this article
        authors: articleAuthors,
        
        // For backward compatibility, also return author IDs array
        authorIds: articleAuthors.map(author => author.id),
        
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
        
        // Featured image with full URL starting with https://cms-vgad.visiongroup.co.ug/
        featuredImage: featuredImage,
        
        // FUTURE FIELD - CURRENT EMPTY ARRAY
        album: [],
        
        // FUTURE: Will be proper relation
        secondaryCategory: null,
        
        // Publication IDs from ALL authors of this article
        publicationIds: publicationIds,
        
        // Primary publication ID (first one found, if any)
        publicationId: publicationIds.length > 0 ? publicationIds[0] : null,
        
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        
        // Include duplicate flag if there were duplicates
        hadDuplicates: articles.some(a => a.wp_id === article.wp_id && a.id !== article.id)
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
