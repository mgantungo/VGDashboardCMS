'use strict';

module.exports = {


async getCategoryArticles(ctx) {
  try {
    const { categorySlug } = ctx.params;
    const ARTICLES_COUNT = 24;

    if (!categorySlug) {
      return ctx.send({
        error: 'categorySlug parameter is required',
        example: '/api/posts/category-articles/technology'
      }, 400);
    }

    console.log(`=== FETCHING ARTICLES FOR CATEGORY: ${categorySlug} ===`);

    // Helper function to format a single article
    const formatArticle = (post) => {
      const data = post;
      const postId = post.id;

      // Extract authors
      let authorName = 'Anonymous';
      try {
        if (data.authors && Array.isArray(data.authors)) {
          if (data.authors.length > 0) {
            const firstAuthor = data.authors[0];
            authorName = firstAuthor.display_name || firstAuthor.username || 'Anonymous';
          }
        }
      } catch (e) {
        console.log(`Error extracting author for post ${postId}:`, e.message);
      }

      // Extract categories
      let categoryName = 'Uncategorized';
      let currentCategorySlug = 'uncategorized';
      try {
        if (data.categories && Array.isArray(data.categories)) {
          if (data.categories.length > 0) {
            const firstCat = data.categories[0];
            categoryName = firstCat.name || 'Uncategorized';
            currentCategorySlug = firstCat.slug || 'uncategorized';
          }
        }
      } catch (e) {
        console.log(`Error extracting category for post ${postId}:`, e.message);
      }

      // Extract featured image
      let imageUrl = null;
      let imageAlt = 'Featured image';
      
      try {
        if (data.featured_image) {
          let featuredImage = data.featured_image;
          
          // Method 1: Direct media object
          if (featuredImage && featuredImage.url) {
            imageUrl = featuredImage.url;
            imageAlt = featuredImage.alternativeText || featuredImage.caption || data.title;
          }
          // Method 2: Array of media objects
          else if (Array.isArray(featuredImage) && featuredImage.length > 0) {
            const firstImage = featuredImage[0];
            if (firstImage && firstImage.url) {
              imageUrl = firstImage.url;
              imageAlt = firstImage.alternativeText || firstImage.caption || data.title;
            }
          }
          // Method 3: Nested data structure
          else if (featuredImage.data) {
            const mediaData = Array.isArray(featuredImage.data) 
              ? featuredImage.data[0] 
              : featuredImage.data;
            
            if (mediaData && mediaData.attributes) {
              imageUrl = mediaData.attributes.url;
              imageAlt = mediaData.attributes.alternativeText || mediaData.attributes.caption || data.title;
            } else if (mediaData && mediaData.url) {
              imageUrl = mediaData.url;
              imageAlt = mediaData.alternativeText || mediaData.caption || data.title;
            }
          }

          // Prepend server URL if needed
          if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('//')) {
            imageUrl = `${strapi.config.server.url}${imageUrl}`;
          }
        }
      } catch (e) {
        console.log(`Error extracting image for post ${postId}:`, e.message);
      }

      // Use fallback image if no featured image found
      if (!imageUrl) {
        imageUrl = 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?q=80&w=2070';
      }

      // Calculate read time
      let readTime = 5;
      try {
        if (data.content) {
          const text = data.content.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '');
          const wordCount = text.trim().split(/\s+/).length;
          readTime = Math.max(1, Math.ceil(wordCount / 200));
        }
      } catch (e) {
        console.log(`Error calculating read time for post ${postId}:`, e.message);
      }

      // Format date - PRIORITIZE wp_published_at
      let formattedDate = 'Recently';
      try {
        const dateSource = data.wp_published_at || data.publishedAt || data.createdAt || data.updatedAt || Date.now();
        const publishDate = new Date(dateSource);
        formattedDate = publishDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      } catch (e) {
        console.log(`Error formatting date for post ${postId}:`, e.message);
      }

      return {
        id: postId,
        slug: data.slug,
        title: data.title || 'Untitled',
        excerpt: data.excerpt || '',
        content: data.content || '',
        image: imageUrl,
        imageAlt: imageAlt,
        category: categoryName,
        categorySlug: currentCategorySlug,
        readTime: `${readTime} min read`,
        date: formattedDate,
        author: authorName,
        isPremium: data.isPremium || false,
        wp_published_at: data.wp_published_at,
        publishedAt: data.publishedAt,
      };
    };

    // 1. First, verify the category exists
    const category = await strapi.db.query('api::category.category').findOne({
      where: {
        slug: categorySlug,
        isActive: true
      },
      select: ['id', 'name', 'slug', 'description']
    });

    if (!category) {
      return ctx.send({
        error: 'Category not found or not active',
        requestedSlug: categorySlug,
        suggestion: 'Check the category slug or try another category'
      }, 404);
    }

    console.log(`Found category: ${category.name} (ID: ${category.id})`);

    // 2. Fetch the most recent articles for this category
    let categoryPosts = [];
    try {
      categoryPosts = await strapi.db.query('api::post.post').findMany({
        where: {
          $and: [
            {
              $or: [
                { wp_published_at: { $notNull: true } },
                { publishedAt: { $notNull: true } }
              ]
            },
            {
              categories: {
                id: category.id,
              },
            },
          ],
        },
        orderBy: [
          { wp_published_at: 'desc' },
          { publishedAt: 'desc' }
        ],
        limit: ARTICLES_COUNT,
        populate: {
          authors: {
            select: ['id', 'display_name', 'username']
          },
          categories: {
            select: ['id', 'name', 'slug']
          },
          featured_image: {
            populate: ['*']
          }
        },
      });

      console.log(`Found ${categoryPosts.length} posts for category ${category.name}`);

    } catch (error) {
      console.error('Error fetching category posts:', error);
      return ctx.send({
        error: 'Failed to fetch category articles',
        message: error.message
      }, 500);
    }

    // 3. Format the articles
    const articles = categoryPosts.map(post => formatArticle(post));

    // 4. Return formatted response
    const response = {
      data: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description || ''
        },
        articles: articles,
        meta: {
          totalArticles: articles.length,
          requestedCount: ARTICLES_COUNT,
          sortedBy: 'wp_published_at (primary), publishedAt (fallback)',
          timestamp: new Date().toISOString()
        }
      }
    };

    console.log(`=== CATEGORY ARTICLES RESPONSE ===`);
    console.log(`Category: ${category.name}`);
    console.log(`Articles returned: ${articles.length}`);
    console.log(`Sample articles:`, articles.slice(0, 3).map(a => ({ title: a.title, date: a.date })));

    return ctx.send(response);

  } catch (error) {
    console.error('Error in getCategoryArticles:', error);
    ctx.throw(500, `Error fetching category articles: ${error.message}`);
  }
}

}
