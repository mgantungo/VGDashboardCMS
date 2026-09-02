'use strict';

module.exports = {
  /**
   * Get articles by category slug with pagination, sorted newest first.
   *
   * ─── Sorting Fix ──────────────────────────────────────────────────────────
   *
   * Sorting is done at the DATABASE level inside findMany() via the `orderBy`
   * option, NOT in JavaScript after the fetch.
   *
   * Why this matters for pagination:
   * If you sort in JS after fetching, each page gets its own independently
   * sorted batch of rows. Page 1 sorts rows 1–100, page 2 sorts rows 101–200,
   * but the overall order across pages is wrong — you can get a newer article
   * on page 2 than on page 1. Moving the sort into the DB query ensures the
   * database applies ORDER BY before LIMIT/OFFSET, so pagination is globally
   * consistent and newest articles always appear first.
   *
   * Sort priority:
   *   1. wp_published_at DESC  — original WordPress publish date (most articles)
   *   2. publishedAt DESC      — Strapi publish date (fallback for native content)
   *
   * Note: On PostgreSQL, NULLs sort first in DESC order. If wp_published_at is
   * NULL for some posts and they bubble to the top, add a COALESCE via a raw
   * query or switch the primary sort to a computed field.
   *
   * @param {Object} ctx - Koa context
   */
  async getCategoryArticles(ctx) {
    try {
      let { categorySlug } = ctx.params;
      const { page = 1, pageSize = 24 } = ctx.query;

      // ── Validate ─────────────────────────────────────────────────────────

      if (!categorySlug) {
        return ctx.send({
          error: 'categorySlug parameter is required',
          example: '/api/posts/category-articles/technology?page=1&pageSize=24'
        }, 400);
      }

      const originalSlug = categorySlug;
      console.log(`=== FETCHING ARTICLES FOR CATEGORY: ${categorySlug} ===`);
      if (originalSlug !== categorySlug) {
        console.log(`Slug normalized: ${originalSlug} → ${categorySlug}`);
      }
      console.log(`Pagination: page=${page}, pageSize=${pageSize}`);

      // ── Format Helper ─────────────────────────────────────────────────────

      const formatArticle = (post) => {
        const data = post;
        const postId = post.id;

        // Extract author
        let authorName = 'Anonymous';
        try {
          if (Array.isArray(data.authors) && data.authors.length > 0) {
            const firstAuthor = data.authors[0];
            authorName = firstAuthor.display_name || firstAuthor.username || 'Anonymous';
          }
        } catch (e) {
          console.log(`Error extracting author for post ${postId}:`, e.message);
        }

        // Extract category
        let categoryName = 'Uncategorized';
        let currentCategorySlug = 'uncategorized';
        try {
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            const firstCat = data.categories[0];
            categoryName = firstCat.name || 'Uncategorized';
            currentCategorySlug = firstCat.slug || 'uncategorized';
          }
        } catch (e) {
          console.log(`Error extracting category for post ${postId}:`, e.message);
        }

        // Extract featured image (handles three Strapi response shapes)
        let imageUrl = null;
        let imageAlt = 'Featured image';
        try {
          if (data.featured_image) {
            const featuredImage = data.featured_image;

            if (featuredImage.url) {
              // Shape 1: direct media object
              imageUrl = featuredImage.url;
              imageAlt = featuredImage.alternativeText || featuredImage.caption || data.title;
            } else if (Array.isArray(featuredImage) && featuredImage[0]?.url) {
              // Shape 2: array of media objects
              imageUrl = featuredImage[0].url;
              imageAlt = featuredImage[0].alternativeText || featuredImage[0].caption || data.title;
            } else if (featuredImage.data) {
              // Shape 3: nested { data: { attributes } }
              const mediaData = Array.isArray(featuredImage.data)
                ? featuredImage.data[0]
                : featuredImage.data;
              if (mediaData?.attributes) {
                imageUrl = mediaData.attributes.url;
                imageAlt = mediaData.attributes.alternativeText || mediaData.attributes.caption || data.title;
              } else if (mediaData?.url) {
                imageUrl = mediaData.url;
                imageAlt = mediaData.alternativeText || mediaData.caption || data.title;
              }
            }

            // Prepend server URL for relative paths
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('//')) {
              imageUrl = `${strapi.config.server.url}${imageUrl}`;
            }
          }
        } catch (e) {
          console.log(`Error extracting image for post ${postId}:`, e.message);
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

        // Format date — wp_published_at takes priority
        let formattedDate = 'Recently';
        try {
          const dateSource = data.wp_published_at || data.publishedAt || data.createdAt || data.updatedAt || Date.now();
          formattedDate = new Date(dateSource).toLocaleDateString('en-US', {
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
          imageAlt,
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

      // ── Step 1: Verify category ───────────────────────────────────────────

      const category = await strapi.db.query('api::category.category').findOne({
        where: { slug: categorySlug, isActive: true },
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

      // ── Step 2: Pagination values ─────────────────────────────────────────

      const currentPage = Math.max(1, parseInt(page));
      const currentPageSize = Math.max(1, Math.min(100, parseInt(pageSize)));
      const offset = (currentPage - 1) * currentPageSize;

      // Shared where clause used for both count and findMany
      const whereClause = {
        $and: [
          {
            $or: [
              { wp_published_at: { $notNull: true } },
              { publishedAt: { $notNull: true } }
            ]
          },
          {
            categories: { id: category.id }
          }
        ]
      };

      // ── Step 3: Total count ───────────────────────────────────────────────

      const totalCount = await strapi.db.query('api::post.post').count({
        where: whereClause
      });

      console.log(`Total posts in category: ${totalCount}`);

      // ── Step 4: Fetch paginated articles — sorted at DB level ─────────────
      //
      // ORDER BY is applied INSIDE the query so the database sorts all matching
      // rows first, then applies LIMIT + OFFSET. This guarantees correct global
      // ordering across all pages — newest articles always on page 1, oldest
      // always on the last page, regardless of which page is requested.
      //
      // Primary sort:   wp_published_at DESC  (WordPress publish date)
      // Secondary sort: publishedAt DESC      (Strapi publish date — fallback
      //                                        for posts without wp_published_at)

      let categoryPosts = [];
      try {
        categoryPosts = await strapi.db.query('api::post.post').findMany({
          where: whereClause,
          orderBy: [
            { wp_published_at: 'desc' },
            { publishedAt: 'desc' }
          ],
          limit: currentPageSize,
          offset,
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
          }
        });

        console.log(`Fetched ${categoryPosts.length} posts from DB (page ${currentPage}, offset ${offset})`);

      } catch (error) {
        console.error('Error fetching category posts:', error);
        return ctx.send({
          error: 'Failed to fetch category articles',
          message: error.message
        }, 500);
      }

      // ── Step 5: Remove duplicates ─────────────────────────────────────────
      //
      // Deduplication still runs after the DB fetch to catch any duplicate
      // slugs that may exist in the data. Note: because we deduplicate AFTER
      // applying LIMIT, the returned count may be slightly less than pageSize
      // if duplicates exist within the fetched page. This is acceptable — the
      // alternative (over-fetching) adds complexity with minimal benefit.

      const seenSlugs = new Set();
      const uniquePosts = categoryPosts.filter(post => {
        if (seenSlugs.has(post.slug)) {
          console.log(`Duplicate removed: ${post.slug}`);
          return false;
        }
        seenSlugs.add(post.slug);
        return true;
      });

      const duplicatesRemoved = categoryPosts.length - uniquePosts.length;
      if (duplicatesRemoved > 0) {
        console.log(`Removed ${duplicatesRemoved} duplicate(s) from page ${currentPage}`);
      }

      // ── Step 6: Format articles ───────────────────────────────────────────

      const articles = uniquePosts.map(post => formatArticle(post));

      // ── Step 7: Pagination metadata ───────────────────────────────────────

      const totalPages = Math.ceil(totalCount / currentPageSize);
      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;

      // ── Step 8: Response ──────────────────────────────────────────────────

      const response = {
        data: {
          category: {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description || ''
          },
          articles,
          pagination: {
            currentPage,
            pageSize: currentPageSize,
            totalArticles: totalCount,
            totalPages,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? currentPage + 1 : null,
            prevPage: hasPrevPage ? currentPage - 1 : null,
            from: offset + 1,
            to: Math.min(offset + currentPageSize, totalCount)
          },
          meta: {
            sortedBy: 'wp_published_at DESC, publishedAt DESC (database-level)',
            articlesReturned: articles.length,
            duplicatesRemoved,
            duplicateCheck: 'slug-based',
            timestamp: new Date().toISOString()
          }
        }
      };

      console.log(`=== CATEGORY ARTICLES RESPONSE ===`);
      console.log(`Category: ${category.name}`);
      console.log(`Articles returned: ${articles.length}`);
      console.log(`Pagination: ${currentPage}/${totalPages}`);
      console.log(`Range: ${offset + 1}–${Math.min(offset + currentPageSize, totalCount)} of ${totalCount}`);
      console.log(`Duplicates removed: ${duplicatesRemoved}`);

      if (articles.length > 0) {
        console.log('Sample articles:', articles.slice(0, 2).map(a => ({
          slug: a.slug,
          title: a.title,
          date: a.date,
          wp_published_at: a.wp_published_at
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
   * Get all active categories with article counts.
   * @param {Object} ctx - Koa context
   */
  async getAllCategories(ctx) {
    try {
      console.log('=== FETCHING ALL ACTIVE CATEGORIES ===');

      const categories = await strapi.db.query('api::category.category').findMany({
        where: { isActive: true },
        select: ['id', 'name', 'slug', 'description', 'displayOrder', 'isFeatured'],
        orderBy: [
          { displayOrder: 'asc' },
          { name: 'asc' }
        ]
      });

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
                { categories: { id: category.id } }
              ]
            }
          });

          return {
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description || '',
            isFeatured: category.isFeatured || false,
            articleCount
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
