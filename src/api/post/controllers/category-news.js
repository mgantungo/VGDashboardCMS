'use strict';

module.exports = {
  /**
   * Get articles by category slug with pagination
   * @param {Object} ctx - Koa context
   * @returns {Object} Formatted response with articles and pagination
   */
  async getCategoryArticles(ctx) {
    try {
      let { categorySlug } = ctx.params;
      const { page = 1, pageSize = 24 } = ctx.query;

      // Validate required parameter
      if (!categorySlug) {
        return ctx.send({
          error: 'categorySlug parameter is required',
          example: '/api/posts/category-articles/technology?page=1&pageSize=24'
        }, 400);
      }

      // Normalize slug: replace "-and-" with just "-"
      // This handles cases like "research-and-innovation" → "research-innovation"
      const originalSlug = categorySlug;
      //categorySlug = categorySlug.replace(/-and-/g, '-');

      console.log(`=== FETCHING ARTICLES FOR CATEGORY: ${categorySlug} ===`);
      if (originalSlug !== categorySlug) {
        console.log(`Slug normalized: ${originalSlug} → ${categorySlug}`);
      }
      console.log(`Pagination: page=${page}, pageSize=${pageSize}`);

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

        // Leave imageUrl as null if no featured image found
        // Frontend can handle null/missing images appropriately

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

      // Step 1: Verify the category exists and is active
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

      // Calculate pagination values
      const currentPage = Math.max(1, parseInt(page));
      const currentPageSize = Math.max(1, Math.min(100, parseInt(pageSize))); // Max 100 items per page
      const offset = (currentPage - 1) * currentPageSize;

      // Step 2: Get total count for pagination metadata
      const totalCount = await strapi.db.query('api::post.post').count({
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
      });

      console.log(`Total posts in category: ${totalCount}`);

      // Step 3: Fetch paginated articles for this category
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
          limit: currentPageSize,
          offset: offset,
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

        console.log(`Fetched ${categoryPosts.length} posts from database (page ${currentPage})`);

      } catch (error) {
        console.error('Error fetching category posts:', error);
        return ctx.send({
          error: 'Failed to fetch category articles',
          message: error.message
        }, 500);
      }

      // Step 4: Sort posts by date (wp_published_at takes priority)
      categoryPosts.sort((a, b) => {
        const dateA = new Date(a.wp_published_at || a.publishedAt || 0);
        const dateB = new Date(b.wp_published_at || b.publishedAt || 0);
        return dateB - dateA; // Descending order (newest first)
      });

      // Step 5: Remove duplicates based on slug
      const seenSlugs = new Set();
      const uniquePosts = categoryPosts.filter(post => {
        if (seenSlugs.has(post.slug)) {
          console.log(`Duplicate found and removed: ${post.slug}`);
          return false;
        }
        seenSlugs.add(post.slug);
        return true;
      });

      if (uniquePosts.length !== categoryPosts.length) {
        console.log(`Removed ${categoryPosts.length - uniquePosts.length} duplicate articles based on slug`);
      }

      // Step 6: Format the articles
      const articles = uniquePosts.map(post => formatArticle(post));

      // Step 7: Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / currentPageSize);
      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;

      // Step 8: Build and return response
      const response = {
        data: {
          category: {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description || ''
          },
          articles: articles,
          pagination: {
            currentPage: currentPage,
            pageSize: currentPageSize,
            totalArticles: totalCount,
            totalPages: totalPages,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage,
            nextPage: hasNextPage ? currentPage + 1 : null,
            prevPage: hasPrevPage ? currentPage - 1 : null,
            from: offset + 1,
            to: Math.min(offset + currentPageSize, totalCount)
          },
          meta: {
            sortedBy: 'wp_published_at (primary), publishedAt (fallback)',
            articlesReturned: articles.length,
            duplicatesRemoved: categoryPosts.length - uniquePosts.length,
            duplicateCheck: 'slug-based',
            timestamp: new Date().toISOString()
          }
        }
      };

      console.log(`=== CATEGORY ARTICLES RESPONSE ===`);
      console.log(`Category: ${category.name}`);
      console.log(`Articles returned: ${articles.length}`);
      console.log(`Pagination: ${currentPage}/${totalPages}`);
      console.log(`Range: ${offset + 1}-${Math.min(offset + currentPageSize, totalCount)} of ${totalCount}`);
      console.log(`Duplicates removed: ${categoryPosts.length - uniquePosts.length}`);
      
      if (articles.length > 0) {
        console.log(`Sample articles:`, articles.slice(0, 2).map(a => ({ 
          slug: a.slug, 
          title: a.title,
          date: a.date 
        })));
      }

      return ctx.send(response);

    } catch (error) {
      console.error('Error in getCategoryArticles:', error);
      console.error('Stack trace:', error.stack);
      ctx.throw(500, `Error fetching category articles: ${error.message}`);
    }
  },

  /**
   * Get all active categories with article counts
   * @param {Object} ctx - Koa context
   * @returns {Object} List of categories with metadata
   */
  async getAllCategories(ctx) {
    try {
      console.log('=== FETCHING ALL ACTIVE CATEGORIES ===');

      // Fetch all active categories
      const categories = await strapi.db.query('api::category.category').findMany({
        where: {
          isActive: true
        },
        select: ['id', 'name', 'slug', 'description', 'displayOrder', 'isFeatured'],
        orderBy: [
          { displayOrder: 'asc' },
          { name: 'asc' }
        ]
      });

      // Get article count for each category
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const articleCount = await strapi.db.query('api::post.post').count({
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
          });

          return {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description || '',
            isFeatured: category.isFeatured || false,
            articleCount: articleCount
          };
        })
      );

      console.log(`Found ${categoriesWithCounts.length} active categories`);

      return ctx.send({
        data: {
          categories: categoriesWithCounts,
          meta: {
            totalCategories: categoriesWithCounts.length,
            timestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Error in getAllCategories:', error);
      ctx.throw(500, `Error fetching categories: ${error.message}`);
    }
  }
};
