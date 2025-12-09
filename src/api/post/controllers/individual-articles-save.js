'use strict';

/**
 * Save Article Controller Methods
 * Handles creating and updating articles from the Vue Editor
 */

module.exports = {
  
  /**
   * Create or Update Article
   * POST /api/posts/save
   * 
   * Accepts article data from ArticleEditor.vue and creates/updates:
   * - Post entry
   * - Tag relations (creates tags if they don't exist)
   * - Author relations
   * - Category relations
   * - Featured image
   * - Publication relations
   */
  async saveArticle(ctx) {
    try {
      const articleData = ctx.request.body;
      
      console.log('📝 Saving article:', articleData.title);
      console.log('📊 Article data:', JSON.stringify(articleData, null, 2));

      // Validate required fields
      if (!articleData.title) {
        return ctx.badRequest('Article title is required');
      }

      if (!articleData.content) {
        return ctx.badRequest('Article content is required');
      }

      // Determine if this is create or update
      const isUpdate = !!articleData.id;
      
      if (isUpdate) {
        console.log('🔄 Updating existing article with ID:', articleData.id);
        return await this.updateExistingArticle(ctx, articleData);
      } else {
        console.log('✨ Creating new article');
        return await this.createNewArticle(ctx, articleData);
      }

    } catch (error) {
      console.error('❌ Error in saveArticle:', error);
      strapi.log.error('Error in saveArticle:', error);
      return ctx.internalServerError('An error occurred while saving the article');
    }
  },

  /**
   * Create New Article
   */
  async createNewArticle(ctx, articleData) {
    try {
      // Get next wp_id
      const nextWpId = await this.getNextWpId();
      console.log('🆔 Next wp_id:', nextWpId);

      // Process tags - create if they don't exist
      const tagIds = await this.processTagsForArticle(articleData.tags || []);
      console.log('🏷️ Processed tag IDs:', tagIds);

      // Process featured image
      const featuredImageId = await this.processFeaturedImage(articleData.featuredImage);
      console.log('🖼️ Featured image ID:', featuredImageId);

      // Process authors - convert from objects to IDs if needed
      const authorIds = await this.processAuthors(articleData.authors || []);
      console.log('👤 Author IDs:', authorIds);

      // Process categories
      const categoryIds = await this.processCategories(articleData.category, articleData.secondaryCategory);
      console.log('📁 Category IDs:', categoryIds);

      // Prepare article data for creation
      const createData = {
        title: articleData.title,
        slug: await this.generateUniqueSlug(articleData.title),
        content: articleData.content,
        excerpt: articleData.summary || this.extractExcerpt(articleData.content),
        wp_id: nextWpId,
        
        // Status and publishing
        wp_published_at: articleData.status === 'published' ? 
          (articleData.publishedAt || new Date().toISOString()) : null,
        
        // Premium flag
        isPremium: articleData.premium || false,
        
        // SEO fields
        seo_title: articleData.title,
        seo_description: articleData.summary || this.extractExcerpt(articleData.content),
        
        // Relations - connect using IDs
        authors: authorIds,
        categories: categoryIds,
        tags: tagIds,
        featured_image: featuredImageId,
      };

      console.log('💾 Creating article with data:', createData);

      // Create the article
      const createdArticle = await strapi.entityService.create('api::post.post', {
        data: createData,
        populate: {
          authors: true,
          categories: true,
          tags: true,
          featured_image: true
        }
      });

      console.log('✅ Article created successfully with ID:', createdArticle.id);

      // Return formatted response
      return this.formatArticleResponse(createdArticle, articleData);

    } catch (error) {
      console.error('❌ Error creating article:', error);
      throw error;
    }
  },

  /**
   * Update Existing Article
   */
  async updateExistingArticle(ctx, articleData) {
    try {
      const articleId = articleData.id;

      // Check if article exists
      const existingArticle = await strapi.entityService.findOne('api::post.post', articleId);
      
      if (!existingArticle) {
        return ctx.notFound('Article not found');
      }

      console.log('📝 Updating article:', existingArticle.title);

      // Process tags
      const tagIds = await this.processTagsForArticle(articleData.tags || []);

      // Process featured image
      const featuredImageId = await this.processFeaturedImage(articleData.featuredImage);

      // Process authors
      const authorIds = await this.processAuthors(articleData.authors || []);

      // Process categories
      const categoryIds = await this.processCategories(articleData.category, articleData.secondaryCategory);

      // Prepare update data
      const updateData = {
        title: articleData.title,
        content: articleData.content,
        excerpt: articleData.summary || this.extractExcerpt(articleData.content),
        
        // Status and publishing
        wp_published_at: articleData.status === 'published' ? 
          (articleData.publishedAt || new Date().toISOString()) : null,
        
        // Premium flag
        isPremium: articleData.premium || false,
        
        // SEO fields
        seo_title: articleData.title,
        seo_description: articleData.summary || this.extractExcerpt(articleData.content),
        
        // Relations
        authors: authorIds,
        categories: categoryIds,
        tags: tagIds,
      };

      // Only update featured image if it changed
      if (featuredImageId !== null) {
        updateData.featured_image = featuredImageId;
      }

      console.log('💾 Updating article with data:', updateData);

      // Update the article
      const updatedArticle = await strapi.entityService.update('api::post.post', articleId, {
        data: updateData,
        populate: {
          authors: true,
          categories: true,
          tags: true,
          featured_image: true
        }
      });

      console.log('✅ Article updated successfully');

      // Return formatted response
      return this.formatArticleResponse(updatedArticle, articleData);

    } catch (error) {
      console.error('❌ Error updating article:', error);
      throw error;
    }
  },

  /**
   * Get next available wp_id
   */
  async getNextWpId() {
    try {
      // Find the article with the highest wp_id
      const latestArticle = await strapi.entityService.findMany('api::post.post', {
        sort: { wp_id: 'desc' },
        limit: 1,
        fields: ['wp_id']
      });

      if (latestArticle && latestArticle.length > 0 && latestArticle[0].wp_id) {
        return latestArticle[0].wp_id + 1;
      }

      // If no articles exist or no wp_id, start from 1
      return 1;

    } catch (error) {
      console.error('Error getting next wp_id:', error);
      // Return a safe default
      return Date.now(); // Use timestamp as fallback
    }
  },

  /**
   * Process tags - create if they don't exist
   */
  async processTagsForArticle(tagNames) {
    try {
      if (!tagNames || tagNames.length === 0) {
        return [];
      }

      const tagIds = [];

      for (const tagName of tagNames) {
        // Clean the tag name
        const cleanTagName = tagName.trim();
        
        if (!cleanTagName) continue;

        // Try to find existing tag
        const existingTags = await strapi.entityService.findMany('api::tag.tag', {
          filters: { name: cleanTagName },
          limit: 1
        });

        if (existingTags && existingTags.length > 0) {
          // Tag exists, use it
          tagIds.push(existingTags[0].id);
          console.log('🏷️ Found existing tag:', cleanTagName);
        } else {
          // Tag doesn't exist, create it
          console.log('🏷️ Creating new tag:', cleanTagName);
          
          // Get next wp_id for tag
          const latestTag = await strapi.entityService.findMany('api::tag.tag', {
            sort: { wp_id: 'desc' },
            limit: 1,
            fields: ['wp_id']
          });
          
          const nextTagWpId = (latestTag && latestTag.length > 0 && latestTag[0].wp_id) 
            ? latestTag[0].wp_id + 1 
            : 1;

          const newTag = await strapi.entityService.create('api::tag.tag', {
            data: {
              name: cleanTagName,
              slug: this.slugify(cleanTagName),
              wp_id: nextTagWpId
            }
          });

          tagIds.push(newTag.id);
          console.log('✅ Created new tag with ID:', newTag.id);
        }
      }

      return tagIds;

    } catch (error) {
      console.error('Error processing tags:', error);
      return [];
    }
  },

  /**
   * Process featured image
   * Returns the media ID or null
   */
  async processFeaturedImage(featuredImageData) {
    try {
      if (!featuredImageData) {
        return null;
      }

      // If it's already an ID, return it
      if (typeof featuredImageData === 'number') {
        return featuredImageData;
      }

      // If it has an id property, return that
      if (featuredImageData.id) {
        return featuredImageData.id;
      }

      // FUTURE: Handle file upload if featuredImageData.file exists
      // For now, return null if no ID
      return null;

    } catch (error) {
      console.error('Error processing featured image:', error);
      return null;
    }
  },

  /**
   * Process authors
   * Convert author objects to IDs
   */
  async processAuthors(authors) {
    try {
      if (!authors || authors.length === 0) {
        return [];
      }

      return authors.map(author => {
        // If it's already an ID, return it
        if (typeof author === 'number') {
          return author;
        }
        
        // If it's an object with id, return the id
        if (author && author.id) {
          return author.id;
        }
        
        return null;
      }).filter(id => id !== null);

    } catch (error) {
      console.error('Error processing authors:', error);
      return [];
    }
  },

  /**
   * Process categories
   * Returns array of category IDs
   */
  async processCategories(primaryCategory, secondaryCategory) {
    try {
      const categoryIds = [];

      // Add primary category
      if (primaryCategory) {
        const catId = typeof primaryCategory === 'number' ? primaryCategory : primaryCategory.id;
        if (catId) categoryIds.push(catId);
      }

      // Add secondary category
      if (secondaryCategory) {
        const catId = typeof secondaryCategory === 'number' ? secondaryCategory : secondaryCategory.id;
        if (catId) categoryIds.push(catId);
      }

      return categoryIds;

    } catch (error) {
      console.error('Error processing categories:', error);
      return [];
    }
  },

  /**
   * Generate unique slug
   */
  async generateUniqueSlug(title, existingSlug = null) {
    try {
      let baseSlug = this.slugify(title);
      let slug = baseSlug;
      let counter = 1;

      // Check if slug exists
      while (true) {
        const existing = await strapi.entityService.findMany('api::post.post', {
          filters: { slug: slug },
          limit: 1
        });

        // If no existing article with this slug, or it's the same article, use it
        if (!existing || existing.length === 0) {
          break;
        }

        // Generate new slug with counter
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      return slug;

    } catch (error) {
      console.error('Error generating slug:', error);
      return this.slugify(title);
    }
  },

  /**
   * Slugify string
   */
  slugify(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')           // Replace spaces with -
      .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
      .replace(/\-\-+/g, '-')         // Replace multiple - with single -
      .replace(/^-+/, '')             // Trim - from start of text
      .replace(/-+$/, '');            // Trim - from end of text
  },

  /**
   * Extract excerpt from content
   */
  extractExcerpt(content, maxLength = 160) {
    if (!content) return '';
    
    // Remove HTML tags
    const stripped = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Truncate to maxLength
    if (stripped.length <= maxLength) {
      return stripped;
    }
    
    return stripped.substring(0, maxLength - 3) + '...';
  },

  /**
   * Format article response to match frontend expectations
   */
  formatArticleResponse(article, originalData) {
    // Get CMS base URL
    const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
    
    // Format featured image with full URL
    let featuredImage = null;
    if (article.featured_image) {
      const img = article.featured_image;
      let imageUrl = img.url;
      
      if (!imageUrl.startsWith('http')) {
        imageUrl = imageUrl.startsWith('/') 
          ? `${cmsBaseUrl}${imageUrl}` 
          : `${cmsBaseUrl}/${imageUrl}`;
      }
      
      featuredImage = {
        url: imageUrl,
        alt: img.alternativeText || '',
        caption: img.caption || '',
        credit: '',
        originalUrl: img.url
      };
    }

    // Format authors
    const authors = article.authors?.map(author => ({
      id: author.id,
      username: author.username,
      displayName: author.display_name || `${author.first_name} ${author.last_name}`.trim(),
      firstName: author.first_name,
      lastName: author.last_name,
      email: author.email,
      wpId: author.wp_id
    })) || [];

    return {
      id: article.id,
      wp_id: article.wp_id,
      title: article.title,
      status: article.wp_published_at ? 'published' : 'draft',
      category: article.categories?.[0]?.id || null,
      
      authors: authors,
      authorIds: authors.map(a => a.id),
      
      publishedAt: article.wp_published_at,
      live: !!article.wp_published_at,
      
      featured: false, // FUTURE
      breakingNews: false, // FUTURE
      breakingDuration: null, // FUTURE
      
      premium: article.isPremium || false,
      
      tags: article.tags?.map(tag => tag.name) || [],
      summary: article.excerpt || '',
      content: article.content || '',
      
      featuredImage: featuredImage,
      
      album: [], // FUTURE
      secondaryCategory: article.categories?.[1]?.id || null,
      
      publicationId: originalData.publicationId || null,
      
      createdAt: article.createdAt,
      updatedAt: article.updatedAt
    };
  }
};
