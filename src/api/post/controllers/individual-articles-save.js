'use strict';

/**
 * Save Article Controller Methods
 * Handles creating and updating articles from the Vue Editor
 */

module.exports = {
  
  /**
   * Create or Update Article
   * POST /api/posts/save
   */


async saveArticle(ctx) {
    try {
      console.log('📝 Save article request received');
      console.log('📋 Content-Type:', ctx.request.headers['content-type']);
      
      // Check if it's multipart/form-data
      if (ctx.is('multipart/form-data')) {
        console.log('✅ Is multipart/form-data');
        
        // Parse multipart data
        let data, files;
        try {
          const uploadService = strapi.plugin('upload').service('upload');
          const parsed = await uploadService.parseMultipartData(ctx);
          data = parsed.data;
          files = parsed.files;
          console.log('✅ Successfully parsed multipart data');
        } catch (parseError) {
          console.error('❌ Error parsing multipart data:', parseError);
          data = ctx.request.body;
          files = ctx.request.files;
        }
        
        console.log('📊 Parsed data:', data);
        console.log('📁 Parsed files:', files ? Object.keys(files) : 'No files');
        
        // Parse JSON data from FormData
        let articleData;
        if (data && data.data) {
          try {
            articleData = JSON.parse(data.data);
            console.log('✅ Parsed JSON from data.data:', articleData.title);
          } catch (parseError) {
            console.error('❌ Error parsing data.data JSON:', parseError);
            return ctx.badRequest('Invalid JSON in data field');
          }
        } else if (data) {
          articleData = data;
          console.log('✅ Using data directly:', articleData);
        } else {
          console.error('❌ No data found in request');
          return ctx.badRequest('No data provided');
        }
        
        // FIX 1: Process featured image from files
        if (files && files.featuredImage) {
          console.log('🖼️ Processing featured image upload');
          const featuredImageResult = await this.processFeaturedImageUpload(files.featuredImage);
          if (featuredImageResult) {
            articleData.featuredImageId = featuredImageResult.id;
            console.log('✅ Featured image uploaded with ID:', featuredImageResult.id);
          }
        } else if (articleData.featuredImage?.id) {
          // Use existing featured image ID
          articleData.featuredImageId = articleData.featuredImage.id;
          console.log('🆔 Using existing featured image ID:', articleData.featuredImageId);
        }
        
        // Validate required fields
        if (!articleData.title || articleData.title.trim() === '') {
          console.error('❌ Title validation failed. Title:', articleData.title);
          return ctx.badRequest('Article title is required');
        }

        if (!articleData.content || articleData.content.trim() === '') {
          return ctx.badRequest('Article content is required');
        }
        
        // FIX 2: Validate publicationId
        if (!articleData.publicationId) {
          console.error('❌ PublicationId validation failed');
          return ctx.badRequest('Publication is required');
        }
        
        console.log('✅ All validations passed');
        console.log('📰 Publication ID:', articleData.publicationId);
        console.log('📄 Title:', articleData.title);
        console.log('📝 Content length:', articleData.content?.length || 0);
        
        // Determine if this is create or update
        const isUpdate = !!articleData.id;
        
        if (isUpdate) {
          console.log('🔄 Updating existing article with ID:', articleData.id);
          return await this.updateExistingArticle(ctx, articleData);
        } else {
          console.log('✨ Creating new article');
          return await this.createNewArticle(ctx, articleData);
        }
        
      } else {
        // Handle regular JSON request
        console.log('📄 Handling JSON request');
        const articleData = ctx.request.body;
        
        // Validate required fields
        if (!articleData.title) {
          return ctx.badRequest('Article title is required');
        }

        if (!articleData.content) {
          return ctx.badRequest('Article content is required');
        }
        
        if (!articleData.publicationId) {
          return ctx.badRequest('Publication is required');
        }
        
        const isUpdate = !!articleData.id;
        
        if (isUpdate) {
          console.log('🔄 Updating existing article with ID:', articleData.id);
          return await this.updateExistingArticle(ctx, articleData);
        } else {
          console.log('✨ Creating new article');
          return await this.createNewArticle(ctx, articleData);
        }
      }

    } catch (error) {
      console.error('❌ Error in saveArticle:', error);
      console.error('❌ Error stack:', error.stack);
      strapi.log.error('Error in saveArticle:', error);
      return ctx.internalServerError('An error occurred while saving the article');
    }
  },

  /**
   * Process featured image upload
   * FIX: Properly upload to media library and return ID
   */
  async processFeaturedImageUpload(featuredImageFile) {
    try {
      if (!featuredImageFile) {
        return null;
      }

      console.log('📤 Processing featured image upload:', featuredImageFile.name || 'Unnamed file');
      
      const uploadService = strapi.plugin('upload').service('upload');
      
      // Upload to Strapi media library
      const uploadedFiles = await uploadService.upload({
        data: {
          fileInfo: {
            name: featuredImageFile.name || 'featured-image',
            alternativeText: 'Featured image for article',
            caption: ''
          }
        },
        files: featuredImageFile
      });

      if (uploadedFiles && uploadedFiles.length > 0) {
        const uploadedFile = uploadedFiles[0];
        console.log('✅ Featured image uploaded to media library with ID:', uploadedFile.id);
        
        const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
        const imageUrl = uploadedFile.url.startsWith('http') 
          ? uploadedFile.url 
          : `${cmsBaseUrl}${uploadedFile.url}`;
        
        return {
          id: uploadedFile.id,
          url: imageUrl,
          originalUrl: uploadedFile.url,
          alternativeText: uploadedFile.alternativeText || '',
          caption: uploadedFile.caption || '',
          name: uploadedFile.name,
          mime: uploadedFile.mime,
          size: uploadedFile.size,
          width: uploadedFile.width,
          height: uploadedFile.height
        };
      }

      return null;
    } catch (error) {
      console.error('Error uploading featured image:', error);
      console.error('Error stack:', error.stack);
      return null;
    }
  },

  /**
   * FIX: Extract and upload inline images from content
   * This processes base64 images in the content and uploads them to media library
   */
  async processContentImages(content, articleId) {
    try {
      if (!content) return content;
      
      // Extract base64 images from content
      const base64Regex = /data:image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml);base64,([^"'\s<>]+)/gi;
      const matches = [...content.matchAll(base64Regex)];
      
      if (matches.length === 0) {
        console.log('ℹ️ No base64 images found in content');
        return content;
      }

      console.log(`🖼️ Found ${matches.length} base64 images in content`);
      
      let processedContent = content;
      const uploadService = strapi.plugin('upload').service('upload');
      const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
      
      for (let i = 0; i < matches.length; i++) {
        const [fullMatch, format, base64Data] = matches[i];
        
        try {
          // Convert base64 to buffer
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Create filename
          const timestamp = Date.now();
          const random = Math.random().toString(36).substr(2, 9);
          const filename = `content-image-${articleId || 'new'}-${timestamp}-${random}.${format}`;
          
          console.log(`📤 Uploading inline image ${i + 1}/${matches.length}: ${filename}`);
          
          // Create a temporary file object for upload
          const fileData = {
            name: filename,
            type: `image/${format}`,
            size: buffer.length,
            path: buffer
          };
          
          // Upload to media library
          const uploadedFiles = await uploadService.upload({
            data: {
              fileInfo: {
                name: filename,
                alternativeText: `Content image ${i + 1} for article ${articleId || 'new'}`,
                caption: ''
              }
            },
            files: fileData
          });

          if (uploadedFiles && uploadedFiles.length > 0) {
            const uploadedFile = uploadedFiles[0];
            const imageUrl = uploadedFile.url.startsWith('http') 
              ? uploadedFile.url 
              : `${cmsBaseUrl}${uploadedFile.url}`;
            
            console.log(`✅ Uploaded inline image ${i + 1}: ${imageUrl}`);
            
            // Replace base64 image with uploaded image URL
            processedContent = processedContent.replace(fullMatch, imageUrl);
          }
        } catch (imgError) {
          console.error(`❌ Error processing inline image ${i + 1}:`, imgError);
          // Continue with other images even if one fails
        }
      }
      
      console.log(`✅ Processed ${matches.length} inline images`);
      return processedContent;
      
    } catch (error) {
      console.error('Error processing content images:', error);
      return content; // Return original content if processing fails
    }
  },

  /**
   * Create New Article
   * FIX: Properly handle publication relationship and featured image
   */
  async createNewArticle(ctx, articleData) {
    try {
      // Get next wp_id
      const nextWpId = await this.getNextWpId();
      console.log('🆔 Next wp_id:', nextWpId);

      // Process tags
      const tagIds = await this.processTagsForArticle(articleData.tags || []);
      console.log('🏷️ Processed tag IDs:', tagIds);

      // Process authors
      const authorIds = await this.processAuthors(articleData.authors || []);
      console.log('👤 Author IDs:', authorIds);

      // Process categories
      const categoryIds = await this.processCategories(articleData.category, articleData.secondaryCategory);
      console.log('📁 Category IDs:', categoryIds);

      // Process album images
      const albumImageIds = await this.processAlbumForArticle(articleData.album || []);
      console.log('📸 Album image IDs:', albumImageIds);

      // Generate unique slug
      const slug = await this.generateUniqueSlug(articleData.title);
      console.log('🔗 Generated slug:', slug);

      // FIX: Process inline images BEFORE saving
      console.log('🖼️ Processing inline images in content...');
      const processedContent = await this.processContentImages(articleData.content, 'new');

      // Prepare article data for creation
      const createData = {
        title: articleData.title,
        slug: slug,
        content: processedContent, // Use processed content with uploaded images
        excerpt: articleData.summary || this.extractExcerpt(processedContent, 200),
        wp_id: nextWpId,
        
        // Status and publishing
        view_status: articleData.status || 'draft',
        wp_published_at: articleData.status === 'published' ? 
          (articleData.publishedAt || new Date().toISOString()) : null,
        
        // Live flag
        live: articleData.live || false,
        
        // Premium flag
        isPremium: articleData.premium || false,
        
        // Feature flags
        featured: articleData.featured || false,
        breakingNews: articleData.breakingNews || false,
        breakingDuration: articleData.breakingDuration || null,
        
        // SEO fields
        seo_title: articleData.title,
        seo_description: articleData.summary || this.extractExcerpt(processedContent, 160),
        
        // Views counter
        views: 0,
        
        // Relations
        authors: authorIds,
        categories: categoryIds,
        tags: tagIds,
      };

      // FIX: Add featured image if exists (use the ID)
      if (articleData.featuredImageId) {
        createData.featured_image = articleData.featuredImageId;
        console.log('🖼️ Adding featured image ID:', articleData.featuredImageId);
      }

      // Add album if exists
      if (albumImageIds.length > 0) {
        createData.album = albumImageIds;
      }

      // FIX: Add publication relationship
      if (articleData.publicationId) {
        createData.publication = [articleData.publicationId];
        console.log('📰 Adding publication relationship:', articleData.publicationId);
      }

      console.log('💾 Creating article with data:', {
        title: createData.title,
        status: createData.view_status,
        authors: createData.authors,
        categories: createData.categories,
        publication: createData.publication,
        featured_image: createData.featured_image
      });

      // Create the article
      const createdArticle = await strapi.entityService.create('api::post.post', {
        data: createData,
        populate: {
          authors: true,
          categories: true,
          tags: true,
          featured_image: true,
          album: true,
          publication: true
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
   * FIX: Properly handle publication relationship and featured image
   */
  async updateExistingArticle(ctx, articleData) {
    try {
      const articleId = articleData.id;

      // Check if article exists
      const existingArticle = await strapi.entityService.findOne('api::post.post', articleId, {
        populate: {
          authors: true,
          categories: true,
          tags: true,
          featured_image: true,
          album: true,
          publication: true
        }
      });
      
      if (!existingArticle) {
        return ctx.notFound('Article not found');
      }

      console.log('📝 Updating article:', existingArticle.title, '(ID:', articleId, ')');

      // Process tags
      const tagIds = await this.processTagsForArticle(articleData.tags || []);

      // Process authors
      const authorIds = await this.processAuthors(articleData.authors || []);

      // Process categories
      const categoryIds = await this.processCategories(articleData.category, articleData.secondaryCategory);

      // Process album images
      const albumImageIds = await this.processAlbumForArticle(articleData.album || []);

      // FIX: Process inline images
      console.log('🖼️ Processing inline images in content...');
      const processedContent = await this.processContentImages(articleData.content, articleId);

      // Prepare update data
      const updateData = {
        title: articleData.title,
        content: processedContent,
        excerpt: articleData.summary || this.extractExcerpt(processedContent, 200),
        
        // Status and publishing
        view_status: articleData.status || 'draft',
        wp_published_at: articleData.status === 'published' ? 
          (articleData.publishedAt || new Date().toISOString()) : null,
        
        // Live flag
        live: articleData.live || false,
        
        // Premium flag
        isPremium: articleData.premium || false,
        
        // Feature flags
        featured: articleData.featured || false,
        breakingNews: articleData.breakingNews || false,
        breakingDuration: articleData.breakingDuration || null,
        
        // SEO fields
        seo_title: articleData.title,
        seo_description: articleData.summary || this.extractExcerpt(processedContent, 160),
        
        // Relations
        authors: authorIds,
        categories: categoryIds,
        tags: tagIds,
      };

      // FIX: Update featured image if provided
      if (articleData.featuredImageId) {
        updateData.featured_image = articleData.featuredImageId;
        console.log('🖼️ Updating featured image ID:', articleData.featuredImageId);
      }

      // Update album if provided
      if (albumImageIds.length > 0) {
        updateData.album = albumImageIds;
      }

      // FIX: Update publication relationship
      if (articleData.publicationId) {
        updateData.publication = [articleData.publicationId];
        console.log('📰 Updating publication relationship:', articleData.publicationId);
      }

      console.log('💾 Updating article with data:', {
        title: updateData.title,
        status: updateData.view_status,
        live: updateData.live,
        publication: updateData.publication,
        featured_image: updateData.featured_image
      });

      // Update the article
      const updatedArticle = await strapi.entityService.update('api::post.post', articleId, {
        data: updateData,
        populate: {
          authors: true,
          categories: true,
          tags: true,
          featured_image: true,
          album: true,
          publication: true
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
      const latestArticle = await strapi.entityService.findMany('api::post.post', {
        sort: { wp_id: 'desc' },
        limit: 1,
        fields: ['wp_id']
      });

      if (latestArticle && latestArticle.length > 0 && latestArticle[0].wp_id) {
        return latestArticle[0].wp_id + 1;
      }

      return 1;
    } catch (error) {
      console.error('Error getting next wp_id:', error);
      return Math.floor(Date.now() / 1000);
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
        const cleanTagName = tagName.trim();
        
        if (!cleanTagName) continue;

        const existingTags = await strapi.entityService.findMany('api::tag.tag', {
          filters: { name: cleanTagName },
          limit: 1
        });

        if (existingTags && existingTags.length > 0) {
          tagIds.push(existingTags[0].id);
          console.log('🏷️ Found existing tag:', cleanTagName);
        } else {
          console.log('🏷️ Creating new tag:', cleanTagName);
          
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
   * Process authors
   */
  async processAuthors(authors) {
    try {
      if (!authors || authors.length === 0) {
        return [];
      }

      return authors.map(author => {
        if (typeof author === 'number') {
          return author;
        }
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
   */
  async processCategories(primaryCategory, secondaryCategory) {
    try {
      const categoryIds = [];

      if (primaryCategory) {
        const catId = typeof primaryCategory === 'number' ? primaryCategory : primaryCategory.id;
        if (catId) categoryIds.push(catId);
      }

      if (secondaryCategory) {
        const catId = typeof secondaryCategory === 'number' ? secondaryCategory : secondaryCategory.id;
        if (catId && !categoryIds.includes(catId)) categoryIds.push(catId);
      }

      return categoryIds;
    } catch (error) {
      console.error('Error processing categories:', error);
      return [];
    }
  },

  /**
   * Process album images for article
   */
  async processAlbumForArticle(albumImages) {
    try {
      if (!albumImages || albumImages.length === 0) {
        return [];
      }

      const imageIds = [];

      for (const image of albumImages) {
        if (typeof image === 'number') {
          imageIds.push(image);
          continue;
        }

        if (image.id && !image.file) {
          imageIds.push(image.id);
          continue;
        }

        if (image.url) {
          const existingFiles = await strapi.plugins['upload'].services.upload.find({
            filters: { url: image.originalUrl || image.url }
          });
          
          if (existingFiles && existingFiles.length > 0) {
            imageIds.push(existingFiles[0].id);
          }
        }
      }

      return imageIds;
    } catch (error) {
      console.error('Error processing album images:', error);
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

      while (true) {
        const existing = await strapi.entityService.findMany('api::post.post', {
          filters: { slug: slug },
          limit: 1
        });

        if (!existing || existing.length === 0) {
          break;
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
        
        if (counter > 100) {
          slug = `${baseSlug}-${Date.now()}`;
          break;
        }
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
    if (!text) return '';
    
    return text
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  },

  /**
   * Extract excerpt from content
   */
  extractExcerpt(content, maxLength = 160) {
    if (!content) return '';
    
    const stripped = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    
    if (stripped.length <= maxLength) {
      return stripped;
    }
    
    const truncated = stripped.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.7) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  },

  /**
   * Format article response to match frontend expectations
   * FIX: Include publication data
   */
  formatArticleResponse(article, originalData) {
    try {
      const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
      
      // Format featured image
      let featuredImage = null;
      if (article.featured_image) {
        const img = article.featured_image;
        let imageUrl = img.url;
        
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = imageUrl.startsWith('/') 
            ? `${cmsBaseUrl}${imageUrl}` 
            : `${cmsBaseUrl}/${imageUrl}`;
        }
        
        featuredImage = {
          id: img.id,
          url: imageUrl,
          originalUrl: img.url,
          alternativeText: img.alternativeText || '',
          caption: img.caption || '',
          name: img.name,
          mime: img.mime,
          size: img.size,
          width: img.width,
          height: img.height
        };
      }

      // Format album images
      const album = [];
      if (article.album && Array.isArray(article.album)) {
        article.album.forEach(img => {
          if (img && img.url) {
            let imageUrl = img.url;
            
            if (!imageUrl.startsWith('http')) {
              imageUrl = imageUrl.startsWith('/') 
                ? `${cmsBaseUrl}${imageUrl}` 
                : `${cmsBaseUrl}/${imageUrl}`;
            }
            
            album.push({
              id: img.id,
              url: imageUrl,
              originalUrl: img.url,
              alternativeText: img.alternativeText || '',
              caption: img.caption || '',
              name: img.name,
              mime: img.mime,
              size: img.size,
              width: img.width,
              height: img.height
            });
          }
        });
      }

      // Format authors
      const authors = [];
      const authorIds = [];
      
      if (article.authors && Array.isArray(article.authors)) {
        article.authors.forEach(author => {
          authors.push({
            id: author.id,
            username: author.username,
            displayName: author.display_name || `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.username,
            firstName: author.first_name,
            lastName: author.last_name,
            email: author.email,
            wpId: author.wp_id
          });
          authorIds.push(author.id);
        });
      }

      // Format categories
      const category = article.categories?.[0]?.id || null;
      const secondaryCategory = article.categories?.[1]?.id || null;

      // Format tags
      const tags = article.tags?.map(tag => tag.name) || [];

      // FIX: Extract publicationId from publication relationship
      let publicationId = null;
      if (article.publication && Array.isArray(article.publication) && article.publication.length > 0) {
        publicationId = article.publication[0].id;
      } else if (originalData?.publicationId) {
        publicationId = originalData.publicationId;
      }

      return {
        id: article.id,
        wp_id: article.wp_id,
        title: article.title,
        slug: article.slug,
        
        // Status
        view_status: article.view_status,
        status: article.view_status || 'draft',
        live: article.live || false,
        
        // Categories
        category: category,
        secondaryCategory: secondaryCategory,
        
        // Authors
        authors: authors,
        authorIds: authorIds,
        
        // Publishing
        publishedAt: article.wp_published_at,
        
        // Feature flags
        featured: article.featured || false,
        breakingNews: article.breakingNews || false,
        breakingDuration: article.breakingDuration || null,
        premium: article.isPremium || false,
        
        // Content
        tags: tags,
        summary: article.excerpt || '',
        content: article.content || '',
        
        // Media
        featuredImage: featuredImage,
        album: album,
        
        // FIX: Publication
        publicationId: publicationId,
        
        // Timestamps
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        
        // SEO
        seo_title: article.seo_title,
        seo_description: article.seo_description,
        
        // Stats
        views: article.views || 0
      };

    } catch (error) {
      console.error('Error formatting article response:', error);
      
      return {
        id: article.id,
        title: article.title,
        status: article.view_status || 'draft',
        live: article.live || false,
        authors: [],
        authorIds: [],
        content: article.content || '',
        createdAt: article.createdAt,
        updatedAt: article.updatedAt
      };
    }
  }
  
};


/*
Full Multipart Form Data Handling: Properly processes file uploads with FormData

Featured Image Upload: Uploads featured images to Strapi media library

Content Image Processing: Extracts base64 images from content and uploads them

Album Image Support: Handles multiple album images

Tag Creation: Creates new tags if they don't exist

Unique Slug Generation: Creates SEO-friendly slugs

Proper Error Handling: Comprehensive error handling throughout

Image URL Processing: Converts Strapi media URLs to absolute URLs

Response Formatting: Returns data in the exact format expected by your Vue frontend

Logging: Detailed console logging for debugging
*/
