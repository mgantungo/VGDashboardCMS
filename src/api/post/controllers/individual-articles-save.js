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
      
      let articleData;
      let featuredImageFile = null;
      let inlineImageFiles = [];
      let inlineImagesMeta = [];
      
      // Check if it's multipart/form-data
      if (ctx.is('multipart')) {
        console.log('✅ Is multipart/form-data');
        
        // STRAPI V4 FIX: Get data and files directly from ctx.request
        const body = ctx.request.body;
        const files = ctx.request.files;
        
        console.log('📊 Request body keys:', body ? Object.keys(body) : 'No body');
        console.log('🗂️ Request files keys:', files ? Object.keys(files) : 'No files');
        
        // Parse JSON data from FormData
        if (body && body.data) {
          try {
            articleData = JSON.parse(body.data);
            console.log('✅ Parsed JSON from body.data:', articleData.title);
          } catch (parseError) {
            console.error('❌ Error parsing body.data JSON:', parseError);
            return ctx.badRequest('Invalid JSON in data field');
          }
        } else {
          console.error('❌ No data found in request body');
          return ctx.badRequest('No data provided');
        }
        
        // Get featured image file
        if (files && files['files.featuredImage']) {
          featuredImageFile = files['files.featuredImage'];
          console.log('🖼️ Featured image file found:', featuredImageFile.name);
        }
        
        // NEW: Get inline images files
        if (files && files['files.inlineImages']) {
          // Handle both single file and array of files
          inlineImageFiles = Array.isArray(files['files.inlineImages']) 
            ? files['files.inlineImages'] 
            : [files['files.inlineImages']];
          
          console.log('📷 Found inline images to process:', inlineImageFiles.length);
        }
        
        // NEW: Get inline images metadata
        if (body && body.inlineImagesMeta) {
          // Handle both single metadata and array
          const metaArray = Array.isArray(body.inlineImagesMeta)
            ? body.inlineImagesMeta
            : [body.inlineImagesMeta];
          
          inlineImagesMeta = metaArray.map(meta => {
            try {
              return typeof meta === 'string' ? JSON.parse(meta) : meta;
            } catch (e) {
              console.error('Error parsing inline image meta:', e);
              return null;
            }
          }).filter(Boolean);
          
          console.log('📋 Inline images metadata:', inlineImagesMeta.length);
        }
        
      } else {
        // Handle regular JSON request
        console.log('📄 Handling JSON request');
        articleData = ctx.request.body;
      }
      
      // Validate required fields
      if (!articleData.title || articleData.title.trim() === '') {
        console.error('❌ Title validation failed');
        return ctx.badRequest('Article title is required');
      }

      if (!articleData.content || articleData.content.trim() === '') {
        return ctx.badRequest('Article content is required');
      }
      
      if (!articleData.publicationId) {
        console.error('❌ PublicationId validation failed');
        return ctx.badRequest('Publication is required');
      }
      
      console.log('✅ All validations passed');
      console.log('📰 Publication ID:', articleData.publicationId);
      console.log('📄 Title:', articleData.title);
      console.log('📏 Content length:', articleData.content?.length || 0);
      console.log('📷 Inline images to process:', inlineImageFiles.length);
      
      // NEW: Debug - check what's in the content
      if (inlineImageFiles.length > 0) {
        console.log('🔍 DEBUG: Checking content for data-inline-id patterns...');
        // Look for all data-inline-id patterns in the content
        const inlineIdPattern = /data-inline-id=["']([^"']+)["']/gi;
        const foundIds = [];
        let match;
        while ((match = inlineIdPattern.exec(articleData.content)) !== null) {
          foundIds.push(match[1]);
        }
        console.log('🔍 DEBUG: Found data-inline-id values in content:', foundIds);
        console.log('🔍 DEBUG: Inline image IDs from metadata:', inlineImagesMeta.map(m => m?.id));
      }
      
      // NEW: Process inline images FIRST (before processing content)
      if (inlineImageFiles.length > 0) {
        console.log('🔄 Processing inline images...');
        const uploadedInlineImages = await this.processInlineImages(
          inlineImageFiles,
          inlineImagesMeta,
          articleData.id || 'new',
          articleData.publicationId
        );
        
        // Replace inline image data URLs with server URLs in content
        if (uploadedInlineImages.length > 0) {
          console.log('🔄 Replacing inline image URLs in content...');
          articleData.content = this.replaceInlineImageUrls(
            articleData.content,
            uploadedInlineImages
          );
          console.log('✅ Replaced URLs for', uploadedInlineImages.length, 'inline images');
        }
      }
      
      // Process featured image if provided
      if (featuredImageFile) {
        console.log('🖼️ Processing featured image upload');
        const featuredImageResult = await this.processFeaturedImageUpload(featuredImageFile);
        if (featuredImageResult) {
          articleData.featuredImageId = featuredImageResult.id;
          console.log('✅ Featured image uploaded with ID:', featuredImageResult.id);
        }
      } else if (articleData.featuredImage?.id) {
        articleData.featuredImageId = articleData.featuredImage.id;
        console.log('🆔 Using existing featured image ID:', articleData.featuredImageId);
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
      console.error('❌ Error stack:', error.stack);
      strapi.log.error('Error in saveArticle:', error);
      return ctx.internalServerError('An error occurred while saving the article');
    }
  },

  /**
   * NEW: Process inline images from content
   * Uploads inline images to media library and returns URL mappings
   */
  async processInlineImages(inlineImageFiles, inlineImagesMeta, articleId, publicationId) {
    try {
      if (!inlineImageFiles || inlineImageFiles.length === 0) {
        console.log('ℹ️ No inline images to process');
        return [];
      }

      const uploadedImages = [];
      const uploadService = strapi.plugin('upload').service('upload');
      const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
      
      console.log(`📤 Processing ${inlineImageFiles.length} inline images...`);
      
      for (let i = 0; i < inlineImageFiles.length; i++) {
        const imageFile = inlineImageFiles[i];
        const meta = inlineImagesMeta[i] || {};
        
        try {
          // CRITICAL FIX: Ensure 'path' property exists (Strapi 5 requirement)
          if (!imageFile.path && imageFile.filepath) {
            console.log('🔧 Fixing file object: adding path property from filepath');
            imageFile.path = imageFile.filepath;
          }
          
          console.log('📋 Processing inline image', i + 1, ':', {
            hasPath: !!imageFile.path,
            hasFilepath: !!imageFile.filepath,
            name: imageFile.name || imageFile.originalFilename,
            type: imageFile.type || imageFile.mimetype,
            size: imageFile.size,
            trackingId: meta.id
          });
          
          // Generate descriptive filename
          const timestamp = Date.now();
          const pubPrefix = publicationId ? `pub${publicationId}` : 'nopub';
          const sanitizedAlt = this.sanitizeFilename(meta.alt || 'inline-image');
          const extension = meta.format === 'svg+xml' ? 'svg' : (meta.format || 'jpg');
          const filename = `${pubPrefix}-${sanitizedAlt}-inline-${timestamp}-${i}.${extension}`;
          
          console.log(`📤 Uploading inline image ${i + 1}/${inlineImageFiles.length}: ${filename}`);
          
          // Upload to Strapi media library
          const uploadedFiles = await uploadService.upload({
            data: {
              fileInfo: {
                name: filename,
                alternativeText: meta.alt || `Inline content image ${i + 1}`,
                caption: ''
              }
            },
            files: imageFile
          });

          if (uploadedFiles && uploadedFiles.length > 0) {
            const uploadedFile = uploadedFiles[0];
            
            // Build full image URL
            let imageUrl = uploadedFile.url;
            if (!imageUrl.startsWith('http')) {
              imageUrl = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
              imageUrl = `${cmsBaseUrl}${imageUrl}`;
            }
            
            uploadedImages.push({
              id: meta.id,  // Original tracking ID from editor
              url: imageUrl,  // New server URL
              originalUrl: uploadedFile.url,
              mediaId: uploadedFile.id,  // Strapi media library ID
              alternativeText: uploadedFile.alternativeText,
              name: uploadedFile.name,
              mime: uploadedFile.mime,
              size: uploadedFile.size
            });
            
            console.log(`✅ Uploaded inline image ${i + 1}: ${imageUrl}`);
            console.log(`   Media library ID: ${uploadedFile.id}`);
          }
        } catch (imgError) {
          console.error(`❌ Error uploading inline image ${i + 1}:`, imgError);
          console.error('   Error details:', imgError.message);
          // Continue with other images even if one fails
        }
      }
      
      console.log(`✅ Successfully uploaded ${uploadedImages.length}/${inlineImageFiles.length} inline images`);
      return uploadedImages;
      
    } catch (error) {
      console.error('❌ Error in processInlineImages:', error);
      console.error('❌ Error stack:', error.stack);
      return [];
    }
  },

  /**
   * NEW: Replace inline image data URLs with server URLs in content
   * Fixed regex method that handles multiple images properly
   */
  replaceInlineImageUrls(content, uploadedImages) {
    try {
      if (!content || !uploadedImages || uploadedImages.length === 0) {
        return content;
      }

      console.log('🔄 Starting URL replacement for', uploadedImages.length, 'images');
      
      // Create a map for quick lookup
      const imageMap = {};
      uploadedImages.forEach(img => {
        imageMap[img.id] = img.url;
        console.log(`  Mapping: ${img.id} -> ${img.url}`);
      });
      
      let processedContent = content;
      let totalReplacements = 0;
      
      // Process each uploaded image
      uploadedImages.forEach((uploaded, index) => {
        console.log(`\n🔄 Processing image ${index + 1} (ID: ${uploaded.id})`);
        
        // Find and count all occurrences of this ID in the content
        const idPattern = new RegExp(`data-inline-id=["']${this.escapeRegex(uploaded.id)}["']`, 'gi');
        const matches = (processedContent.match(idPattern) || []);
        console.log(`  Found ${matches.length} occurrences of ID "${uploaded.id}" in content`);
        
        if (matches.length === 0) {
          console.log(`  ❌ No matches found for ID "${uploaded.id}"`);
          console.log(`  Searching for similar patterns...`);
          // Try to find if the ID exists in a slightly different format
          const partialMatch = processedContent.includes(uploaded.id.substring(0, 10));
          if (partialMatch) {
            console.log(`  ⚠️ Found partial match for ID "${uploaded.id}"`);
          }
          return; // Skip to next image
        }
        
        // Create a comprehensive regex pattern to match the entire img tag
        // This pattern handles:
        // 1. Attributes in any order
        // 2. Both single and double quotes
        // 3. The data-inline-id attribute anywhere in the tag
        const pattern = `(<img[^>]*?data-inline-id=["']${this.escapeRegex(uploaded.id)}["'][^>]*?>)`;
        const regex = new RegExp(pattern, 'gi');
        
        // Replace all occurrences
        let replacementsForThisImage = 0;
        processedContent = processedContent.replace(regex, (match) => {
          replacementsForThisImage++;
          
          // Remove the data-inline-id attribute
          let newTag = match.replace(
            new RegExp(`\\s*data-inline-id=["']${this.escapeRegex(uploaded.id)}["']`, 'i'),
            ''
          );
          
          // Replace the src attribute (handles both single and double quotes)
          newTag = newTag.replace(
            /src=["']data:image\/[^"']+["']/gi,
            `src="${uploaded.url}"`
          );
          
          console.log(`  ✅ Replaced occurrence ${replacementsForThisImage}`);
          return newTag;
        });
        
        totalReplacements += replacementsForThisImage;
        console.log(`  ➤ Total replacements for this image: ${replacementsForThisImage}`);
      });
      
      console.log(`\n✅ Total replacements made: ${totalReplacements}`);
      
      // Final verification
      const remainingDataUrls = (processedContent.match(/src=["']data:image\/[^"']+["']/gi) || []).length;
      const remainingInlineIds = (processedContent.match(/data-inline-id=["'][^"']+["']/gi) || []).length;
      
      console.log(`🔍 Final check:`);
      console.log(`  - Images still with data URLs: ${remainingDataUrls}`);
      console.log(`  - Images still with data-inline-id: ${remainingInlineIds}`);
      
      if (remainingDataUrls > 0) {
        console.log('⚠️ WARNING: Some images still have data URLs!');
        // Log the remaining data URLs for debugging
        const dataUrlMatches = processedContent.match(/src=["'](data:image\/[^"']+)["']/gi);
        if (dataUrlMatches) {
          console.log('  Remaining data URLs:');
          dataUrlMatches.forEach((match, i) => {
            console.log(`    ${i + 1}: ${match.substring(0, 100)}...`);
          });
        }
      }
      
      return processedContent;
      
    } catch (error) {
      console.error('❌ Error in replaceInlineImageUrls:', error);
      console.error('❌ Error stack:', error.stack);
      
      // Try a simpler fallback approach
      console.log('🔄 Trying fallback replacement...');
      return this.replaceInlineImageUrlsFallback(content, uploadedImages);
    }
  },

  /**
   * Fallback method for URL replacement (simpler but less robust)
   */
  replaceInlineImageUrlsFallback(content, uploadedImages) {
    try {
      console.log('🔄 Using fallback replacement method');
      
      let processedContent = content;
      
      uploadedImages.forEach((uploaded, index) => {
        console.log(`  Processing image ${index + 1} (ID: ${uploaded.id})`);
        
        // Simple string replacement approach
        // Look for the pattern and replace it
        const searchPattern = `data-inline-id="${uploaded.id}"`;
        
        if (processedContent.includes(searchPattern)) {
          console.log(`    Found pattern "${searchPattern}"`);
          
          // Find the position of this pattern
          let startPos = processedContent.indexOf(searchPattern);
          let attempts = 0;
          const maxAttempts = 10; // Prevent infinite loops
          
          while (startPos !== -1 && attempts < maxAttempts) {
            attempts++;
            
            // Find the start of the img tag (go backwards)
            let tagStart = processedContent.lastIndexOf('<img', startPos);
            if (tagStart === -1) {
              console.log(`    ❌ Could not find <img tag for pattern at position ${startPos}`);
              break;
            }
            
            // Find the end of the img tag (go forwards)
            let tagEnd = processedContent.indexOf('>', startPos);
            if (tagEnd === -1) {
              console.log(`    ❌ Could not find > for img tag at position ${startPos}`);
              break;
            }
            
            // Extract the img tag
            const imgTag = processedContent.substring(tagStart, tagEnd + 1);
            
            // Create new tag
            let newTag = imgTag;
            
            // Remove data-inline-id
            newTag = newTag.replace(searchPattern, '');
            
            // Replace src
            const srcMatch = newTag.match(/src="([^"]*)"/);
            if (srcMatch && srcMatch[1] && srcMatch[1].startsWith('data:image/')) {
              newTag = newTag.replace(srcMatch[0], `src="${uploaded.url}"`);
              console.log(`    ✅ Replaced data URL with server URL`);
            }
            
            // Replace in content
            processedContent = processedContent.substring(0, tagStart) + 
                              newTag + 
                              processedContent.substring(tagEnd + 1);
            
            // Look for next occurrence
            startPos = processedContent.indexOf(searchPattern, tagStart + newTag.length);
          }
          
          console.log(`    Made ${attempts} replacement(s) for this pattern`);
        } else {
          console.log(`    ❌ Pattern "${searchPattern}" not found`);
        }
      });
      
      return processedContent;
      
    } catch (error) {
      console.error('❌ Error in fallback replacement:', error);
      return content; // Return original content if all fails
    }
  },

  /**
   * Helper: Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },

  /**
   * Helper: Sanitize filename for storage
   */
  sanitizeFilename(filename) {
    if (!filename) return 'image';
    
    return filename
      .toString()
      .toLowerCase()
      // Remove file extension if present
      .replace(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i, '')
      // Normalize unicode characters
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace spaces and underscores with hyphens
      .replace(/[\s_]+/g, '-')
      // Remove any character that's not alphanumeric or hyphen
      .replace(/[^a-z0-9\-]+/g, '')
      // Replace multiple hyphens with single hyphen
      .replace(/\-\-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+/, '')
      .replace(/-+$/, '')
      // Limit length
      .substring(0, 50)
      // Ensure we have something left
      || 'image';
  },

  /**
   * Process featured image upload to Strapi media library
   * STRAPI 5 CORRECTED VERSION - Fix filepath vs path issue
   */
  async processFeaturedImageUpload(featuredImageFile) {
    try {
      if (!featuredImageFile) {
        console.log('ℹ️ No file provided for upload');
        return null;
      }

      console.log('📤 Uploading featured image to media library');
      console.log('📋 Original file object keys:', Object.keys(featuredImageFile));
      
      // CRITICAL FIX: Strapi 5's upload service calls getStream() which does:
      // fs.createReadStream(file.path) 
      // But the file from multipart has 'filepath' not 'path'
      // We need to ensure 'path' property exists
      
      if (!featuredImageFile.path && featuredImageFile.filepath) {
        console.log('🔧 Fixing file object: adding path property from filepath');
        featuredImageFile.path = featuredImageFile.filepath;
      }
      
      console.log('📋 File details for upload:', {
        hasPath: !!featuredImageFile.path,
        hasFilepath: !!featuredImageFile.filepath,
        path: featuredImageFile.path,
        name: featuredImageFile.name || featuredImageFile.originalFilename,
        type: featuredImageFile.type || featuredImageFile.mimetype,
        size: featuredImageFile.size
      });
      
      // STRAPI 5: Get upload service
      const uploadService = strapi.plugin('upload').service('upload');
      
      // Upload to Strapi media library
      const uploadedFiles = await uploadService.upload({
        data: {
          fileInfo: {
            name: featuredImageFile.name || featuredImageFile.originalFilename || 'featured-image.jpg',
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
      console.error('❌ Error uploading featured image:', error);
      console.error('❌ Error stack:', error.stack);
      return null;
    }
  },

  /**
   * Create New Article
   */
  async createNewArticle(ctx, articleData) {
    try {
      const nextWpId = await this.getNextWpId();
      console.log('🆔 Next wp_id:', nextWpId);

      const tagIds = await this.processTagsForArticle(articleData.tags || []);
      console.log('🏷️ Processed tag IDs:', tagIds);

      const authorIds = await this.processAuthors(articleData.authors || []);
      console.log('👤 Author IDs:', authorIds);

      const categoryIds = await this.processCategories(articleData.category, articleData.secondaryCategory);
      console.log('📁 Category IDs:', categoryIds);

      const albumImageIds = await this.processAlbumForArticle(articleData.album || []);
      console.log('📸 Album image IDs:', albumImageIds);

      const slug = await this.generateUniqueSlug(articleData.title);
      console.log('🔗 Generated slug:', slug);

      // NOTE: Content already has inline images processed with server URLs
      const processedContent = articleData.content;
      console.log('📝 Using processed content (inline images already replaced)');

      const createData = {
        title: articleData.title,
        slug: slug,
        content: processedContent,
        excerpt: articleData.summary || this.extractExcerpt(processedContent, 200),
        wp_id: nextWpId,
        view_status: articleData.status || 'draft',
        wp_published_at: articleData.status === 'published' ? 
          (articleData.publishedAt || new Date().toISOString()) : null,
        live: articleData.live || false,
        isPremium: articleData.premium || false,
        featured: articleData.featured || false,
        breakingNews: articleData.breakingNews || false,
        breakingDuration: articleData.breakingDuration || null,
        seo_title: articleData.title,
        seo_description: articleData.summary || this.extractExcerpt(processedContent, 160),
        views: 0,
        authors: authorIds,
        categories: categoryIds,
        tags: tagIds,
      };

      if (articleData.featuredImageId) {
        createData.featured_image = articleData.featuredImageId;
        console.log('🖼️ Adding featured image ID:', articleData.featuredImageId);
      }

      if (albumImageIds.length > 0) {
        createData.album = albumImageIds;
      }

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
        featured_image: createData.featured_image,
        contentLength: createData.content.length
      });

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
      
      if (createdArticle.publication) {
        console.log('✅ Publication relationship saved:', createdArticle.publication);
      } else {
        console.warn('⚠️ Publication relationship NOT saved!');
      }

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

      const tagIds = await this.processTagsForArticle(articleData.tags || []);
      const authorIds = await this.processAuthors(articleData.authors || []);
      const categoryIds = await this.processCategories(articleData.category, articleData.secondaryCategory);
      const albumImageIds = await this.processAlbumForArticle(articleData.album || []);

      // NOTE: Content already has inline images processed with server URLs
      const processedContent = articleData.content;
      console.log('📝 Using processed content (inline images already replaced)');

      const updateData = {
        title: articleData.title,
        content: processedContent,
        excerpt: articleData.summary || this.extractExcerpt(processedContent, 200),
        view_status: articleData.status || 'draft',
        wp_published_at: articleData.status === 'published' ? 
          (articleData.publishedAt || new Date().toISOString()) : null,
        live: articleData.live || false,
        isPremium: articleData.premium || false,
        featured: articleData.featured || false,
        breakingNews: articleData.breakingNews || false,
        breakingDuration: articleData.breakingDuration || null,
        seo_title: articleData.title,
        seo_description: articleData.summary || this.extractExcerpt(processedContent, 160),
        authors: authorIds,
        categories: categoryIds,
        tags: tagIds,
      };

      if (articleData.featuredImageId) {
        updateData.featured_image = articleData.featuredImageId;
        console.log('🖼️ Updating featured image ID:', articleData.featuredImageId);
      }

      if (albumImageIds.length > 0) {
        updateData.album = albumImageIds;
      }

      if (articleData.publicationId) {
        updateData.publication = [articleData.publicationId];
        console.log('📰 Updating publication relationship:', articleData.publicationId);
      }

      console.log('💾 Updating article with data:', {
        title: updateData.title,
        status: updateData.view_status,
        live: updateData.live,
        publication: updateData.publication,
        featured_image: updateData.featured_image,
        contentLength: updateData.content.length
      });

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

      return this.formatArticleResponse(updatedArticle, articleData);

    } catch (error) {
      console.error('❌ Error updating article:', error);
      throw error;
    }
  }
  
  ,

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
          const existingFiles = await strapi.plugin('upload').service('upload').findMany({
            filters: { url: image.originalUrl || image.url }
          });
          
          if (existingFiles && existingFiles.results && existingFiles.results.length > 0) {
            imageIds.push(existingFiles.results[0].id);
          }
        }
      }

      return imageIds;
    } catch (error) {
      console.error('Error processing album images:', error);
      return [];
    }
  },

  async generateUniqueSlug(title) {
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
   * Extract original filename from img tag attributes
   * Checks alt, title, data-filename attributes
   */
  extractOriginalFilename(imgTag, index) {
    // Try to extract from alt attribute
    const altMatch = imgTag.match(/alt="([^"]+)"/i);
    if (altMatch && altMatch[1]) {
      return altMatch[1];
    }
    
    // Try to extract from title attribute
    const titleMatch = imgTag.match(/title="([^"]+)"/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1];
    }
    
    // Try to extract from data-filename attribute
    const dataFilenameMatch = imgTag.match(/data-filename="([^"]+)"/i);
    if (dataFilenameMatch && dataFilenameMatch[1]) {
      return dataFilenameMatch[1];
    }
    
    // Default: use generic name with index
    return `inline-image-${index + 1}`;
  },

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

  formatArticleResponse(article, originalData) {
    try {
      const cmsBaseUrl = strapi.config.get('server.url', 'https://cms-vgad.visiongroup.co.ug');
      
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

      const category = article.categories?.[0]?.id || null;
      const secondaryCategory = article.categories?.[1]?.id || null;
      const tags = article.tags?.map(tag => tag.name) || [];

      let publicationId = null;
      if (article.publication && Array.isArray(article.publication) && article.publication.length > 0) {
        publicationId = article.publication[0].id;
        console.log('✅ Publication in response:', publicationId);
      } else if (originalData?.publicationId) {
        publicationId = originalData.publicationId;
        console.warn('⚠️ Using original publicationId, not from saved article');
      }

      return {
        id: article.id,
        wp_id: article.wp_id,
        title: article.title,
        slug: article.slug,
        view_status: article.view_status,
        status: article.view_status || 'draft',
        live: article.live || false,
        category: category,
        secondaryCategory: secondaryCategory,
        authors: authors,
        authorIds: authorIds,
        publishedAt: article.wp_published_at,
        featured: article.featured || false,
        breakingNews: article.breakingNews || false,
        breakingDuration: article.breakingDuration || null,
        premium: article.isPremium || false,
        tags: tags,
        summary: article.excerpt || '',
        content: article.content || '',
        featuredImage: featuredImage,
        album: album,
        publicationId: publicationId,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        seo_title: article.seo_title,
        seo_description: article.seo_description,
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
