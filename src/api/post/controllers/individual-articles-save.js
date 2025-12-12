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
    console.log('🔍 Content-Type:', ctx.request.headers['content-type']);
    
    // Check if it's multipart/form-data
    if (ctx.is('multipart/form-data')) {
      console.log('✅ Is multipart/form-data');
      
      // Parse multipart data - FIXED VERSION
      let data, files;
      try {
        // FIX: Use correct service path
        const uploadService = strapi.plugin('upload').service('upload');
        const parsed = await uploadService.parseMultipartData(ctx);
        data = parsed.data;
        files = parsed.files;
        console.log('✅ Successfully parsed multipart data');
      } catch (parseError) {
        console.error('❌ Error parsing multipart data:', parseError);
        // Try manual parsing as fallback
        data = ctx.request.body;
        files = ctx.request.files;
      }
      
      console.log('📊 Parsed data:', data);
      console.log('📁 Parsed files:', files ? Object.keys(files) : 'No files');
      
      // Check if data.data exists (JSON string in FormData)
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
        // Try to use data directly
        articleData = data;
        console.log('✅ Using data directly:', articleData);
      } else {
        console.error('❌ No data found in request');
        return ctx.badRequest('No data provided');
      }
      
      // Process featured image from files
      if (files && files.featuredImage) {
        console.log('🖼️ Processing featured image upload');
        const featuredImageResult = await this.processFeaturedImageUpload(files.featuredImage);
        if (featuredImageResult) {
          articleData.featuredImage = featuredImageResult;
        }
      }
      
      // Validate required fields
      if (!articleData.title || articleData.title.trim() === '') {
        console.error('❌ Title validation failed. Title:', articleData.title);
        return ctx.badRequest('Article title is required');
      }

      if (!articleData.content || articleData.content.trim() === '') {
        return ctx.badRequest('Article content is required');
      }
      
      console.log('✅ All validations passed');
      console.log('📝 Title:', articleData.title);
      console.log('📄 Content length:', articleData.content?.length || 0);
      
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
      console.log('📝 Handling JSON request');
      const articleData = ctx.request.body;
      
      // Validate required fields
      if (!articleData.title) {
        return ctx.badRequest('Article title is required');
      }

      if (!articleData.content) {
        return ctx.badRequest('Article content is required');
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
}
  ,

  /**
   * Parse multipart form data
   */
  async parseMultipartData(ctx) {
    return new Promise((resolve, reject) => {
      strapi.plugins['upload'].services.upload.parseMultipartData(ctx)
        .then(resolve)
        .catch(error => {
          console.error('Error parsing multipart data:', error);
          
          // If multipart parsing fails, try to get data from request body
          if (ctx.request.body && ctx.request.files) {
            resolve({
              data: ctx.request.body,
              files: ctx.request.files
            });
          } else {
            reject(error);
          }
        });
    });
  },

  /**
   * Process featured image upload
   */
async processFeaturedImageUpload(featuredImageFile) {
  try {
    if (!featuredImageFile) {
      return null;
    }

    console.log('📤 Processing featured image upload:', featuredImageFile.name || 'Unnamed file');
    
    // FIX: Use the correct service path for Strapi v4
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
      
      // Get CMS base URL for full URL
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
   * Process album images upload
   */
  async processAlbumImages(albumFiles) {
    try {
      if (!albumFiles) {
        return [];
      }

      const filesArray = Array.isArray(albumFiles) ? albumFiles : [albumFiles];
      console.log(`📤 Processing ${filesArray.length} album images`);
      
      const uploadPromises = filesArray.map(async (file, index) => {
        try {
          const uploadedFiles = await strapi.plugins['upload'].services.upload.upload({
            data: {
              fileInfo: {
                name: file.name || `album-image-${index + 1}`,
                alternativeText: `Album image ${index + 1}`,
                caption: ''
              }
            },
            files: file
          });

          if (uploadedFiles && uploadedFiles.length > 0) {
            const uploadedFile = uploadedFiles[0];
            
            // Get CMS base URL for full URL
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
          console.error(`Error uploading album image ${index + 1}:`, error);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const validResults = results.filter(result => result !== null);
      
      console.log(`✅ Uploaded ${validResults.length} album images`);
      return validResults;

    } catch (error) {
      console.error('Error processing album images:', error);
      return [];
    }
  },

  /**
   * Extract and upload images from content
   */
  async processContentImages(content, articleId) {
    try {
      // Extract base64 images from content
      const base64Regex = /data:image\/(png|jpeg|jpg|gif|webp|bmp|svg\+xml);base64,([^"'\s<>]+)/gi;
      const matches = [...content.matchAll(base64Regex)];
      
      if (matches.length === 0) {
        return content; // No images to process
      }

      console.log(`📷 Found ${matches.length} base64 images in content`);
      
      let processedContent = content;
      const uploadPromises = [];
      
      for (const [fullMatch, format, base64Data] of matches) {
        try {
          // Convert base64 to buffer
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Create filename
          const filename = `content-image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${format}`;
          
          uploadPromises.push({
            fullMatch,
            buffer,
            filename,
            format,
            index: uploadPromises.length
          });
        } catch (imgError) {
          console.error('Error processing base64 image:', imgError);
        }
      }
      
      // Upload all images in parallel
      const uploadResults = await Promise.allSettled(
        uploadPromises.map(async ({ fullMatch, buffer, filename, format, index }) => {
          try {
            const uploadedFiles = await strapi.plugins['upload'].services.upload.upload({
              data: {
                fileInfo: {
                  name: filename,
                  alternativeText: `Content image ${index + 1}`,
                  caption: ''
                }
              },
              files: {
                path: buffer,
                name: filename,
                type: `image/${format}`,
                size: buffer.length
              }
            });

            if (uploadedFiles && uploadedFiles.length > 0) {
              const uploadedFile = uploadedFiles[0];
              const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
              const imageUrl = uploadedFile.url.startsWith('http') 
                ? uploadedFile.url 
                : `${cmsBaseUrl}${uploadedFile.url}`;
              
              console.log(`✅ Uploaded content image ${index + 1}: ${filename}`);
              return { fullMatch, imageUrl };
            }
            return null;
          } catch (uploadError) {
            console.error(`Error uploading content image ${index + 1}:`, uploadError);
            return null;
          }
        })
      );
      
      // Replace base64 images with URLs in content
      for (const result of uploadResults) {
        if (result.status === 'fulfilled' && result.value) {
          const { fullMatch, imageUrl } = result.value;
          processedContent = processedContent.replace(fullMatch, imageUrl);
        }
      }
      
      console.log(`✅ Processed ${uploadResults.filter(r => r.status === 'fulfilled').length} content images`);
      return processedContent;
      
    } catch (error) {
      console.error('Error processing content images:', error);
      return content;
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

      // Prepare article data for creation
      const createData = {
        title: articleData.title,
        slug: slug,
        content: articleData.content, // Will be updated after image processing
        excerpt: articleData.summary || this.extractExcerpt(articleData.content, 200),
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
        seo_description: articleData.summary || this.extractExcerpt(articleData.content, 160),
        
        // Views counter
        views: 0,
        
        // Relations
        authors: authorIds,
        categories: categoryIds,
        tags: tagIds,
      };

      // Add featured image if exists
      if (featuredImageId) {
        createData.featured_image = featuredImageId;
      }

      // Add album if exists
      if (albumImageIds.length > 0) {
        createData.album = albumImageIds;
      }

      console.log('💾 Creating article with initial data:', {
        title: createData.title,
        status: createData.view_status,
        authors: createData.authors,
        categories: createData.categories
      });

      // Create the article
      const createdArticle = await strapi.entityService.create('api::post.post', {
        data: createData,
        populate: {
          authors: true,
          categories: true,
          tags: true,
          featured_image: true,
          album: true
        }
      });

      console.log('✅ Article created successfully with ID:', createdArticle.id);

      // Process content images after article is created (need the article ID)
      if (articleData.content) {
        const processedContent = await this.processContentImages(
          articleData.content, 
          createdArticle.id
        );
        
        // Update article with processed content if images were uploaded
        if (processedContent !== articleData.content) {
          await strapi.entityService.update('api::post.post', createdArticle.id, {
            data: { content: processedContent }
          });
          createdArticle.content = processedContent;
          console.log('✅ Updated article content with uploaded images');
        }
      }

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
      const existingArticle = await strapi.entityService.findOne('api::post.post', articleId, {
        populate: {
          authors: true,
          categories: true,
          tags: true,
          featured_image: true,
          album: true
        }
      });
      
      if (!existingArticle) {
        return ctx.notFound('Article not found');
      }

      console.log('📝 Updating article:', existingArticle.title, '(ID:', articleId, ')');

      // Process tags
      const tagIds = await this.processTagsForArticle(articleData.tags || []);

      // Process featured image
      const featuredImageId = await this.processFeaturedImage(articleData.featuredImage);

      // Process authors
      const authorIds = await this.processAuthors(articleData.authors || []);

      // Process categories
      const categoryIds = await this.processCategories(articleData.category, articleData.secondaryCategory);

      // Process album images
      const albumImageIds = await this.processAlbumForArticle(articleData.album || []);

      // Process content images
      let processedContent = articleData.content;
      if (articleData.content) {
        processedContent = await this.processContentImages(articleData.content, articleId);
      }

      // Prepare update data
      const updateData = {
        title: articleData.title,
        content: processedContent,
        excerpt: articleData.summary || this.extractExcerpt(articleData.content, 200),
        
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
        seo_description: articleData.summary || this.extractExcerpt(articleData.content, 160),
        
        // Relations
        authors: authorIds,
        categories: categoryIds,
        tags: tagIds,
      };

      // Only update featured image if it exists
      if (featuredImageId !== null) {
        updateData.featured_image = featuredImageId;
      }

      // Update album if provided
      if (albumImageIds.length > 0) {
        updateData.album = albumImageIds;
      }

      console.log('💾 Updating article with data:', {
        title: updateData.title,
        status: updateData.view_status,
        live: updateData.live
      });

      // Update the article
      const updatedArticle = await strapi.entityService.update('api::post.post', articleId, {
        data: updateData,
        populate: {
          authors: true,
          categories: true,
          tags: true,
          featured_image: true,
          album: true
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
      return Math.floor(Date.now() / 1000); // Use timestamp as fallback
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
      if (featuredImageData.id && !featuredImageData.file) {
        return featuredImageData.id;
      }

      // If it's a file object with url (already uploaded via multipart), find or create
      if (featuredImageData.url) {
        // Check if file exists in media library
        const existingFiles = await strapi.plugins['upload'].services.upload.find({
          filters: { url: featuredImageData.originalUrl || featuredImageData.url }
        });
        
        if (existingFiles && existingFiles.length > 0) {
          return existingFiles[0].id;
        }
      }

      return null;

    } catch (error) {
      console.error('Error processing featured image:', error);
      return null;
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
        // If it's already an ID, add it
        if (typeof image === 'number') {
          imageIds.push(image);
          continue;
        }

        // If it has an id property, add that
        if (image.id && !image.file) {
          imageIds.push(image.id);
          continue;
        }

        // If it's a recently uploaded image, find it by URL
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
        if (catId && !categoryIds.includes(catId)) categoryIds.push(catId);
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

        // If no existing article with this slug, use it
        if (!existing || existing.length === 0) {
          break;
        }

        // Generate new slug with counter
        slug = `${baseSlug}-${counter}`;
        counter++;
        
        // Safety check to prevent infinite loop
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
      .normalize('NFD') // Normalize unicode
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
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
    const stripped = content
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .replace(/&nbsp;/g, ' ')  // Replace &nbsp;
      .replace(/&amp;/g, '&')   // Replace &amp;
      .replace(/&lt;/g, '<')    // Replace &lt;
      .replace(/&gt;/g, '>')    // Replace &gt;
      .replace(/&quot;/g, '"')  // Replace &quot;
      .replace(/&#39;/g, "'")   // Replace &#39;
      .trim();
    
    // Truncate to maxLength
    if (stripped.length <= maxLength) {
      return stripped;
    }
    
    // Find the last space before maxLength
    const truncated = stripped.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.7) { // If space is reasonably close
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  },

  /**
   * Format article response to match frontend expectations
   */
  formatArticleResponse(article, originalData) {
    try {
      // Get CMS base URL
      const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
      
      // Format featured image with full URL
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
        
        // Publication
        publicationId: originalData?.publicationId || null,
        
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
      
      // Return minimal response if formatting fails
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
