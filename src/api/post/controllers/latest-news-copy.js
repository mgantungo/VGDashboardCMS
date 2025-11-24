'use strict';

module.exports = {
  async getLatestNews(ctx) {
    try {
      const LATEST_COUNT = 6;
      const CATEGORY_ARTICLES_COUNT = 8;

      // Helper function to format a single article with consistent image handling
      const formatArticle = (post, source = 'unknown') => {
        const data = post;
        const postId = post.id;
        
        console.log(`[${source}] Formatting post: ${postId} - ${data.title}`);

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
          console.log(`[${source}] Error extracting author:`, e.message);
        }

        // Extract categories
        let categoryName = 'Uncategorized';
        let categorySlug = 'uncategorized';
        try {
          if (data.categories && Array.isArray(data.categories)) {
            if (data.categories.length > 0) {
              const firstCat = data.categories[0];
              categoryName = firstCat.name || 'Uncategorized';
              categorySlug = firstCat.slug || 'uncategorized';
            }
          }
        } catch (e) {
          console.log(`[${source}] Error extracting category:`, e.message);
        }

        // Extract featured image
        let imageUrl = null;
        let imageAlt = 'Featured image';
        
        try {
          if (data.featured_image) {
            let featuredImage = data.featured_image;
            
            // Method 1: Direct media object (most common)
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
            // Method 3: Nested data structure (Strapi v4 style)
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

            // Prepend server URL if needed (for local files)
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('//')) {
              imageUrl = `${strapi.config.server.url}${imageUrl}`;
            }
          }
        } catch (e) {
          console.log(`[${source}] Error extracting image for post ${postId}:`, e.message);
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
          console.log(`[${source}] Error calculating read time:`, e.message);
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
          console.log(`[${source}] Error formatting date:`, e.message);
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
          categorySlug: categorySlug,
          readTime: `${readTime} min read`,
          date: formattedDate,
          author: authorName,
          isPremium: data.isPremium || false,
        };
      };

      console.log('=== FETCHING LATEST POSTS BY wp_published_at ===');

      // Track used slugs to avoid duplicates
      const usedSlugs = new Set();

      // 1. Fetch the most recent published posts
      let latestPosts = [];
      try {
        latestPosts = await strapi.db.query('api::post.post').findMany({
          where: {
            $or: [
              { wp_published_at: { $notNull: true } },
              { publishedAt: { $notNull: true } }
            ]
          },
          orderBy: [
            { wp_published_at: 'desc' },
            { publishedAt: 'desc' }
          ],
          limit: LATEST_COUNT * 2, // Fetch more to account for potential duplicates
          populate: {
            authors: {
              select: ['id', 'display_name', 'username']
            },
            categories: {
              select: ['id', 'name', 'slug', 'isFeatured', 'isActive']
            },
            featured_image: {
              populate: ['*']
            }
          },
        });

        console.log(`Found ${latestPosts.length} potential latest posts`);

        // Remove duplicates by slug and limit to LATEST_COUNT
        const uniqueLatestPosts = [];
        for (const post of latestPosts) {
          if (!usedSlugs.has(post.slug) && uniqueLatestPosts.length < LATEST_COUNT) {
            uniqueLatestPosts.push(post);
            usedSlugs.add(post.slug);
          }
        }

        latestPosts = uniqueLatestPosts;
        console.log(`After deduplication: ${latestPosts.length} unique latest posts`);

      } catch (error) {
        console.error('Error fetching latest posts:', error);
        latestPosts = [];
      }

      // Format latest news
      const latestNews = latestPosts.map(post => formatArticle(post, 'latest'));

      console.log('=== FETCHING FEATURED CATEGORIES ===');

      // 2. Fetch featured categories
      let featuredCategories = [];
      try {
        featuredCategories = await strapi.db.query('api::category.category').findMany({
          where: {
            isActive: true,
            isFeatured: true,
          },
          orderBy: { name: 'asc' },
          limit: 10,
        });

        console.log(`Found ${featuredCategories.length} featured categories`);

        // If no featured categories, get some active categories
        if (featuredCategories.length === 0) {
          console.log('No featured categories, fetching active categories...');
          featuredCategories = await strapi.db.query('api::category.category').findMany({
            where: {
              isActive: true,
            },
            orderBy: { name: 'asc' },
            limit: 5,
          });
          console.log(`Found ${featuredCategories.length} active categories`);
        }

      } catch (error) {
        console.error('Error fetching categories:', error);
        featuredCategories = [];
      }

      // 3. For each category, fetch articles (excluding already shown ones by slug)
      const categorizedNews = [];

      for (const category of featuredCategories) {
        try {
          console.log(`=== FETCHING POSTS FOR CATEGORY: ${category.name} (ID: ${category.id}) ===`);
          
          const categoryPosts = await strapi.db.query('api::post.post').findMany({
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
                {
                  slug: {
                    $notIn: Array.from(usedSlugs), // Exclude already used slugs
                  },
                },
              ],
            },
            orderBy: [
              { wp_published_at: 'desc' },
              { publishedAt: 'desc' }
            ],
            limit: CATEGORY_ARTICLES_COUNT * 2, // Fetch more to account for potential duplicates
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

          console.log(`Found ${categoryPosts.length} potential posts for category ${category.name}`);

          // Remove duplicates by slug and limit to CATEGORY_ARTICLES_COUNT
          const uniqueCategoryPosts = [];
          for (const post of categoryPosts) {
            if (!usedSlugs.has(post.slug) && uniqueCategoryPosts.length < CATEGORY_ARTICLES_COUNT) {
              uniqueCategoryPosts.push(post);
              usedSlugs.add(post.slug);
            }
          }

          console.log(`After deduplication: ${uniqueCategoryPosts.length} unique posts for category ${category.name}`);

          // Only add category if it has articles
          if (uniqueCategoryPosts.length > 0) {
            const formattedCategoryArticles = uniqueCategoryPosts.map(post => formatArticle(post, `category-${category.name}`));
            
            categorizedNews.push({
              category: category.name,
              categorySlug: category.slug,
              articles: formattedCategoryArticles,
            });

            console.log(`Added ${uniqueCategoryPosts.length} articles to category ${category.name}`);
          }

        } catch (categoryError) {
          console.error(`Error fetching posts for category ${category.name}:`, categoryError);
        }
      }

      // 4. Return formatted response
      const response = {
        data: {
          latestNews,
          categorizedNews,
          meta: {
            latestCount: latestNews.length,
            categoryGroupsCount: categorizedNews.length,
            totalArticles: latestNews.length + 
              categorizedNews.reduce((sum, cat) => sum + cat.articles.length, 0),
            totalUniqueSlugs: usedSlugs.size,
            sortedBy: 'wp_published_at (primary), publishedAt (fallback)'
          },
        },
      };

      console.log('=== FINAL RESPONSE SUMMARY ===');
      console.log('Latest news:', latestNews.length, 'articles');
      console.log('Categorized news:', categorizedNews.length, 'categories');
      console.log('Total unique articles:', usedSlugs.size);
      
      // Log duplicate prevention summary
      categorizedNews.forEach(cat => {
        console.log(`- ${cat.category}: ${cat.articles.length} articles`);
      });

      return ctx.send(response);

    } catch (error) {
      console.error('Error in getLatestNews:', error);
      ctx.throw(500, `Error fetching latest news: ${error.message}`);
    }
  },

  async getLatestSimple(ctx) {
    try {
      const LATEST_COUNT = 20;

      console.log('Fetching latest simple posts sorted by wp_published_at...');

      // Use the same formatArticle function from above
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
        } catch (e) {}

        // Extract categories
        let categoryName = 'Uncategorized';
        try {
          if (data.categories && Array.isArray(data.categories)) {
            if (data.categories.length > 0) {
              const firstCat = data.categories[0];
              categoryName = firstCat.name || 'Uncategorized';
            }
          }
        } catch (e) {}

        // Extract featured image
        let imageUrl = null;
        try {
          if (data.featured_image) {
            let featuredImage = data.featured_image;
            
            if (featuredImage && featuredImage.url) {
              imageUrl = featuredImage.url;
            } else if (Array.isArray(featuredImage) && featuredImage.length > 0) {
              const firstImage = featuredImage[0];
              if (firstImage && firstImage.url) {
                imageUrl = firstImage.url;
              }
            } else if (featuredImage.data) {
              const mediaData = Array.isArray(featuredImage.data) 
                ? featuredImage.data[0] 
                : featuredImage.data;
              
              if (mediaData && mediaData.attributes) {
                imageUrl = mediaData.attributes.url;
              } else if (mediaData && mediaData.url) {
                imageUrl = mediaData.url;
              }
            }

            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('//')) {
              imageUrl = `${strapi.config.server.url}${imageUrl}`;
            }
          }
        } catch (e) {
          console.log('Error extracting image in simple format:', e.message);
        }

        // Use fallback image if no featured image found
        if (!imageUrl) {
          imageUrl = 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?q=80&w=2070';
        }

        // Calculate read time
        const text = data.content ? data.content.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, '') : '';
        const wordCount = text.trim().split(/\s+/).length;
        const readTime = Math.max(1, Math.ceil(wordCount / 200));

        // Format date
        const dateSource = data.wp_published_at || data.publishedAt || data.createdAt || data.updatedAt || Date.now();
        const publishDate = new Date(dateSource);
        const formattedDate = publishDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });

        return {
          id: postId,
          slug: data.slug,
          title: data.title || 'Untitled',
          excerpt: data.excerpt || '',
          image: imageUrl,
          category: categoryName,
          readTime: `${readTime} min read`,
          date: formattedDate,
          author: authorName,
          isPremium: data.isPremium || false,
        };
      };

      // Fetch latest posts sorted by wp_published_at
      const latestPosts = await strapi.db.query('api::post.post').findMany({
        where: {
          $or: [
            { wp_published_at: { $notNull: true } },
            { publishedAt: { $notNull: true } }
          ]
        },
        orderBy: [
          { wp_published_at: 'desc' },
          { publishedAt: 'desc' }
        ],
        limit: LATEST_COUNT * 2, // Fetch more to account for duplicates
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

      console.log(`Found ${latestPosts.length} potential posts for simple endpoint`);

      // Remove duplicates by slug
      const usedSlugs = new Set();
      const uniquePosts = [];
      
      for (const post of latestPosts) {
        if (!usedSlugs.has(post.slug) && uniquePosts.length < LATEST_COUNT) {
          uniquePosts.push(post);
          usedSlugs.add(post.slug);
        }
      }

      console.log(`After deduplication: ${uniquePosts.length} unique posts for simple endpoint`);

      const articles = uniquePosts.map(post => formatArticle(post, 'simple'));

      return ctx.send({
        data: {
          articles,
          meta: {
            count: articles.length,
            uniqueSlugs: usedSlugs.size,
            sortedBy: 'wp_published_at'
          },
        },
      });

    } catch (error) {
      console.error('Error in getLatestSimple:', error);
      ctx.throw(500, `Error fetching latest posts: ${error.message}`);
    }
  },

 // NEW: Alternative approach using Entity Service API (if DB Query doesn't work)
  async getLatestNewsAlt(ctx) {
    try {
      const LATEST_COUNT = 6;

      console.log('Fetching latest posts using Entity Service API...');

      // Using Strapi Entity Service instead of DB Query
      const latestPosts = await strapi.entityService.findMany('api::post.post', {
        filters: {
          $or: [
            { publishedAt: { $notNull: true } },
            { wp_published_at: { $notNull: true } }
          ]
        },
        sort: { publishedAt: 'desc' },
        limit: LATEST_COUNT,
        populate: {
          authors: {
            fields: ['id', 'display_name', 'username']
          },
          categories: {
            fields: ['id', 'name', 'slug', 'isFeatured', 'isActive']
          },
          featured_image: {
            fields: ['url', 'alternativeText', 'formats']
          }
        },
      });

      console.log(`Found ${latestPosts.length} posts using Entity Service`);
      
      // Debug the first post's image structure
      if (latestPosts.length > 0) {
        console.log('Entity Service - First post featured_image:', latestPosts[0].featured_image);
      }

      // Format the response
      const formattedPosts = latestPosts.map(post => {
        let imageUrl = 'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?q=80&w=2070';
        
        if (post.featured_image) {
          const url = post.featured_image.url;
          if (url) {
            imageUrl = url.startsWith('http') ? url : `${strapi.config.server.url}${url}`;
          }
        }

        return {
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          image: imageUrl,
          category: post.categories?.[0]?.name || 'Uncategorized',
          date: new Date(post.publishedAt || post.wp_published_at).toLocaleDateString('en-US'),
          author: post.authors?.[0]?.display_name || 'Anonymous',
          isPremium: post.isPremium || false,
        };
      });

      return ctx.send({
        data: {
          latestNews: formattedPosts,
          meta: {
            count: formattedPosts.length,
          },
        },
      });

    } catch (error) {
      console.error('Error in getLatestNewsAlt:', error);
      ctx.throw(500, `Error fetching latest news: ${error.message}`);
    }
  },
 async syncWordPressDates(ctx) {
    try {
      console.log('Starting WordPress date synchronization...');

      // Get all posts that have wp_published_at but may not be properly published
      const posts = await strapi.db.query('api::post.post').findMany({
        where: {
          wp_published_at: { $notNull: true }
        },
        select: ['id', 'title', 'slug', 'wp_published_at', 'publishedAt', 'createdAt', 'updatedAt']
      });

      console.log(`Found ${posts.length} posts with WordPress publication dates`);

      let syncedCount = 0;
      let alreadySyncedCount = 0;
      let errorCount = 0;

      for (const post of posts) {
        try {
          console.log(`Processing post: ${post.title}`);
          console.log(`- WordPress date: ${post.wp_published_at}`);
          console.log(`- Current publishedAt: ${post.publishedAt}`);

          // Check if dates are already in sync
          const wpDate = new Date(post.wp_published_at);
          const currentPublishedDate = post.publishedAt ? new Date(post.publishedAt) : null;

          if (currentPublishedDate && wpDate.getTime() === currentPublishedDate.getTime()) {
            console.log(`- Dates already in sync, skipping`);
            alreadySyncedCount++;
            continue;
          }

          // Update publishedAt to match wp_published_at
          await strapi.db.query('api::post.post').update({
            where: { id: post.id },
            data: {
              publishedAt: post.wp_published_at
            }
          });

          syncedCount++;
          console.log(`âœ… Synced: ${post.title} - ${post.wp_published_at}`);

        } catch (postError) {
          errorCount++;
          console.error(`âŒ Error syncing post ${post.id}:`, postError.message);
        }
      }

      return ctx.send({
        message: 'WordPress date synchronization completed',
        results: {
          totalProcessed: posts.length,
          successfullySynced: syncedCount,
          alreadySynced: alreadySyncedCount,
          errors: errorCount
        },
        summary: `Updated ${syncedCount} posts to use WordPress publication dates`
      });

    } catch (error) {
      console.error('Error in syncWordPressDates:', error);
      ctx.throw(500, `Error synchronizing WordPress dates: ${error.message}`);
    }
  },

  // NEW: Sync and publish posts in one operation
  async syncAndPublishPosts(ctx) {
    try {
      console.log('Starting WordPress date sync and publish operation...');

      const posts = await strapi.db.query('api::post.post').findMany({
        where: {
          wp_published_at: { $notNull: true }
        },
        select: ['id', 'title', 'slug', 'wp_published_at', 'publishedAt']
      });

      console.log(`Found ${posts.length} posts with WordPress dates`);

      let publishedCount = 0;
      let alreadyPublishedCount = 0;
      let errorCount = 0;

      for (const post of posts) {
        try {
          // Use entity service for proper publishing
          await strapi.entityService.update('api::post.post', post.id, {
            data: {
              publishedAt: post.wp_published_at // This both syncs the date and publishes the post
            }
          });

          // Verify the update
          const updatedPost = await strapi.db.query('api::post.post').findOne({
            where: { id: post.id },
            select: ['publishedAt']
          });

          if (updatedPost.publishedAt) {
            publishedCount++;
            console.log(`âœ… Published: ${post.title} with date ${post.wp_published_at}`);
          } else {
            errorCount++;
            console.log(`âŒ Failed to publish: ${post.title}`);
          }

        } catch (postError) {
          errorCount++;
          console.error(`âŒ Error publishing post ${post.id}:`, postError.message);
        }
      }

      return ctx.send({
        message: 'WordPress date sync and publish completed',
        results: {
          totalProcessed: posts.length,
          successfullyPublished: publishedCount,
          errors: errorCount
        },
        summary: `Published ${publishedCount} posts using WordPress dates`
      });

    } catch (error) {
      console.error('Error in syncAndPublishPosts:', error);
      ctx.throw(500, `Error: ${error.message}`);
    }
  },

  // NEW: Check date synchronization status
  async checkDateSyncStatus(ctx) {
    try {
      const posts = await strapi.db.query('api::post.post').findMany({
        where: {
          wp_published_at: { $notNull: true }
        },
        select: ['id', 'title', 'slug', 'wp_published_at', 'publishedAt', 'createdAt']
      });

      const status = {
        synced: 0,
        notSynced: 0,
        noWordPressDate: 0,
        details: []
      };

      for (const post of posts) {
        const wpDate = new Date(post.wp_published_at);
        const publishedDate = post.publishedAt ? new Date(post.publishedAt) : null;

        const isSynced = publishedDate && wpDate.getTime() === publishedDate.getTime();
        
        if (isSynced) {
          status.synced++;
        } else {
          status.notSynced++;
        }

        status.details.push({
          id: post.id,
          title: post.title,
          slug: post.slug,
          wp_published_at: post.wp_published_at,
          publishedAt: post.publishedAt,
          status: isSynced ? 'synced' : 'not-synced',
          difference: publishedDate ? 
            `${Math.abs((wpDate - publishedDate) / (1000 * 60 * 60 * 24)).toFixed(2)} days` : 
            'not-published'
        });
      }

      // Also count posts without WordPress dates
      const postsWithoutWpDates = await strapi.db.query('api::post.post').findMany({
        where: {
          wp_published_at: null
        },
        select: ['id']
      });

      status.noWordPressDate = postsWithoutWpDates.length;

      return ctx.send({
        summary: {
          totalPostsWithWordPressDates: posts.length,
          synced: status.synced,
          notSynced: status.notSynced,
          postsWithoutWordPressDates: status.noWordPressDate
        },
        details: status.details
      });

    } catch (error) {
      console.error('Error in checkDateSyncStatus:', error);
      ctx.throw(500, `Error: ${error.message}`);
    }
  },

  // NEW: Force sync all WordPress dates (overwrite publishedAt)
  async forceSyncWordPressDates(ctx) {
    try {
      const { confirm } = ctx.request.query;

      if (confirm !== 'true') {
        return ctx.send({
          warning: 'This will overwrite all publishedAt dates with wp_published_at values.',
          instruction: 'Add ?confirm=true to the URL to execute this operation.'
        });
      }

      console.log('Starting FORCE WordPress date synchronization...');

      const posts = await strapi.db.query('api::post.post').findMany({
        where: {
          wp_published_at: { $notNull: true }
        },
        select: ['id', 'title', 'wp_published_at', 'publishedAt']
      });

      let updatedCount = 0;

      for (const post of posts) {
        try {
          await strapi.db.query('api::post.post').update({
            where: { id: post.id },
            data: {
              publishedAt: post.wp_published_at
            }
          });

          updatedCount++;
          console.log(`âœ… Force synced: ${post.title}`);

        } catch (postError) {
          console.error(`âŒ Error force syncing post ${post.id}:`, postError.message);
        }
      }

      return ctx.send({
        message: 'Force synchronization completed',
        results: {
          totalProcessed: posts.length,
          successfullyUpdated: updatedCount
        },
        note: 'All WordPress dates have been applied to publishedAt fields'
      });

    } catch (error) {
      console.error('Error in forceSyncWordPressDates:', error);
      ctx.throw(500, `Error: ${error.message}`);
    }
  },

async getByCategories(ctx) {
    try {
      console.log('=== getByCategories called ===');
      
      const categorySlugs = [
        'agribusiness',
        'change-makers',
        'farming-tips',
        'markets',
        'research-innovations'
      ];

      const result = {};

      // Helper function to decode HTML entities
      const decodeHtmlEntities = (text) => {
        if (!text) return text;
        return text
          .replace(/&#8216;/g, "'")
          .replace(/&#8217;/g, "'")
          .replace(/&#8220;/g, '"')
          .replace(/&#8221;/g, '"')
          .replace(/&#8211;/g, '–')
          .replace(/&#8212;/g, '—')
          .replace(/&#038;/g, '&')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&hellip;/g, '…');
      };

      // Helper function to format article data
      const formatArticle = (post) => {
        const article = {
          id: post.id,
          documentId: post.documentId,
          title: decodeHtmlEntities(post.title || ''),
          slug: post.slug || '',
          excerpt: decodeHtmlEntities(post.excerpt || ''),
          thumbnail: null
        };

        // Extract thumbnail information from featured_image
        if (post.featured_image) {
          const image = post.featured_image;
          
          // Get thumbnail format if available
          const thumbnail = image.formats?.thumbnail;
          
          if (thumbnail) {
            article.thumbnail = {
              url: thumbnail.url,
              width: thumbnail.width,
              height: thumbnail.height,
              size: thumbnail.size,
              sizeInBytes: thumbnail.sizeInBytes,
              ext: thumbnail.ext
            };
          } else if (image.url) {
            // Fallback to main image if no thumbnail
            article.thumbnail = {
              url: image.url,
              width: image.width,
              height: image.height,
              size: image.size,
              sizeInBytes: image.size * 1024, // Convert KB to bytes if needed
              ext: image.ext
            };
          }
        }

        return article;
      };

      // Fetch posts for each category
      for (const slug of categorySlugs) {
        console.log(`\n--- Processing category: ${slug} ---`);
        
        try {
          // Find the category by slug
          console.log(`Searching for category with slug: ${slug}`);
          
          const category = await strapi.db.query('api::category.category').findOne({
            where: {
              slug: slug,
            },
          });

          console.log(`Category query result:`, category ? `Found ID ${category.id}` : 'Not found');

          if (category) {
            console.log(`Category details:`, JSON.stringify({
              id: category.id,
              name: category.name,
              slug: category.slug
            }));

            // Fetch the 3 most recent posts for this category
            console.log(`Fetching posts for category ID: ${category.id}`);
            
            const posts = await strapi.db.query('api::post.post').findMany({
              where: {
                categories: {
                  id: category.id,
                },
              },
              orderBy: { wp_published_at: 'desc' },
              limit: 3,
              populate: {
                featured_image: true,
              },
            });

            console.log(`Found ${posts ? posts.length : 0} posts for ${slug}`);
            
            // Format posts with only required fields
            result[slug] = posts ? posts.map(formatArticle) : [];
          } else {
            console.log(`Category "${slug}" not found in database`);
            result[slug] = [];
          }
        } catch (categoryError) {
          console.error(`Error processing category "${slug}":`, categoryError.message);
          console.error('Stack:', categoryError.stack);
          result[slug] = [];
        }
      }

      console.log('\n=== Final result summary ===');
      Object.keys(result).forEach(key => {
        console.log(`${key}: ${result[key].length} posts`);
      });

      ctx.body = {
        data: result,
        meta: {
          categorySlugs,
          timestamp: new Date().toISOString(),
        },
      };
      
      console.log('=== Response sent successfully ===');
    } catch (err) {
      console.error('=== FATAL ERROR in getByCategories ===');
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);
      
      ctx.body = {
        data: null,
        error: {
          status: 500,
          name: 'InternalServerError',
          message: err.message,
          details: err.toString()
        }
      };
      ctx.status = 500;
    }
  }


};
