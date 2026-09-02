// scripts/import-wp-featured-images.js
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

class WordPressMediaImporter {
  constructor() {
    // Configuration - Update these values
    this.config = {
      wordpress: {
        baseUrl: 'http://44.197.75.205', // Your WordPress site URL
        username: 'vmujuzi',        // WP application password username
        password: 'Fybpuz-dekvaq-3vokdy',      // WP application password
      },
      strapi: {
        baseUrl: 'http://localhost:1337',           // Your Strapi URL
        apiToken: '930ab8d0b752e4fa146b20d2afcd32a5614b7d65a034481857453e3145c8a6c46ca63c16895abb59d86b97ec4012d95eee8079fc56b8a349e80001ec487b7134172aba55855736c2e4eb2e7bee10508f789bf90f909c81f953e4caf4d6c99fc4be91202a1049f4f2228f49e8ea4cf7fd8858431f7cc7d6bb0b007b3fd29d029a',          // Strapi API Token
      },
      mediaFolder: 'Harvestmoney'                   // Target folder in Strapi Media Library
    };

    // Axios instances with auth
    this.wpApi = axios.create({
      baseURL: `${this.config.wordpress.baseUrl}/wp-json/wp/v2`,
      auth: {
        username: this.config.wordpress.username,
        password: this.config.wordpress.password
      },
      timeout: 30000
    });

    this.strapiApi = axios.create({
      baseURL: `${this.config.strapi.baseUrl}/api`,
      headers: {
        'Authorization': `Bearer ${this.config.strapi.apiToken}`
      },
      timeout: 30000
    });
  }

  async run() {
    try {
      console.log('🚀 Starting WordPress media import for Strapi 5...');
      console.log('📋 Testing API connections...');

      // Test Strapi connection first
      await this.testStrapiConnection();
      
      // Step 1: Get or create Harvestmoney folder in Strapi
      const folderId = await this.getOrCreateFolder();
      console.log(`📁 Using folder: ${this.config.mediaFolder} (ID: ${folderId})`);

      // Step 2: Get all posts from Strapi that need featured images
      const strapiPosts = await this.getStrapiPostsWithoutFeaturedImages();
      console.log(`📝 Found ${strapiPosts.length} posts without featured images`);

      // Step 3: Process each post
      let successCount = 0;
      let errorCount = 0;

      for (const post of strapiPosts) {
        try {
          console.log(`\n🔍 Processing post: ${post.title} (WP_ID: ${post.wp_id})`);
          
          const result = await this.processPost(post, folderId);
          
          if (result.success) {
            successCount++;
            console.log(`✅ Successfully imported featured image for post ${post.wp_id}`);
          } else {
            errorCount++;
            console.log(`⚠️ ${result.message}`);
          }

          // Delay to avoid rate limiting
          await this.delay(1000);
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing post ${post.id}:`, error.message);
        }
      }

      console.log(`\n🎉 Import completed! Success: ${successCount}, Errors: ${errorCount}`);

    } catch (error) {
      console.error('💥 Fatal error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }

  async testStrapiConnection() {
    try {
      // Test with a simple endpoint - Strapi 5 uses different response structure
      const response = await this.strapiApi.get('/posts');
      console.log('✅ Strapi 5 connection successful');
    } catch (error) {
      console.error('❌ Strapi connection failed:');
      console.error('URL:', error.config?.url);
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
      throw error;
    }
  }

  async getOrCreateFolder() {
    try {
      console.log('🔍 Checking existing folders...');
      
      // Strapi 5 folder API
      const response = await this.strapiApi.get('/upload/folders');
      
      console.log('Available folders:', response.data.data.map(f => ({ id: f.id, name: f.attributes.name })));
      
      // Find Harvestmoney folder
      const harvestmoneyFolder = response.data.data.find(folder => 
        folder.attributes.name === this.config.mediaFolder
      );

      if (harvestmoneyFolder) {
        console.log(`✅ Found existing folder: ${harvestmoneyFolder.attributes.name} (ID: ${harvestmoneyFolder.id})`);
        return harvestmoneyFolder.id;
      }

      // Create new folder if it doesn't exist - Strapi 5 structure
      console.log(`📁 Creating new folder: ${this.config.mediaFolder}`);
      const createResponse = await this.strapiApi.post('/upload/folders', {
        data: {
          name: this.config.mediaFolder
        }
      });

      console.log(`✅ Created folder: ${createResponse.data.data.attributes.name} (ID: ${createResponse.data.data.id})`);
      return createResponse.data.data.id;

    } catch (error) {
      console.error('❌ Error getting/creating folder:', error.message);
      if (error.response) {
        console.error('Folder API Error Status:', error.response.status);
        console.error('Folder API Error Data:', JSON.stringify(error.response.data, null, 2));
      }
      console.log('⚠️ Continuing without folder assignment');
      return null;
    }
  }

  async getStrapiPostsWithoutFeaturedImages() {
    try {
      console.log('🔍 Fetching posts from Strapi 5...');
      
      // Strapi 5 API with populate and filters
      const response = await this.strapiApi.get('/posts', {
        params: {
          'populate[featured_image]': '*',
          'pagination[pageSize]': 1000
        }
      });

      console.log(`📊 Total posts in Strapi: ${response.data.data.length}`);

      // Filter posts that have wp_id but no featured image - Strapi 5 structure
      const postsWithoutImages = response.data.data.filter(post => {
        const hasWpId = post.attributes.wp_id !== null && post.attributes.wp_id !== undefined;
        const hasFeaturedImage = post.attributes.featured_image && post.attributes.featured_image.data;
        
        if (hasWpId && !hasFeaturedImage) {
          console.log(`📝 Post needs image: ${post.attributes.title} (WP_ID: ${post.attributes.wp_id})`);
          return true;
        }
        return false;
      });

      // Format for processing
      const formattedPosts = postsWithoutImages.map(post => ({
        id: post.id,
        ...post.attributes
      }));

      console.log(`📝 Posts needing featured images: ${formattedPosts.length}`);
      return formattedPosts;

    } catch (error) {
      console.error('❌ Error fetching Strapi posts:');
      console.error('URL:', error.config?.url);
      console.error('Status:', error.response?.status);
      console.error('Data:', JSON.stringify(error.response?.data, null, 2));
      
      // Alternative approach if the above fails
      console.log('🔄 Trying alternative approach...');
      return await this.getStrapiPostsAlternative();
    }
  }

  async getStrapiPostsAlternative() {
    try {
      // Alternative approach for Strapi 5
      const response = await this.strapiApi.get('/posts?populate=*');
      
      const postsWithoutImages = response.data.data.filter(post => {
        const hasWpId = post.attributes.wp_id;
        const hasFeaturedImage = post.attributes.featured_image;
        
        return hasWpId && !hasFeaturedImage;
      });

      return postsWithoutImages.map(post => ({
        id: post.id,
        ...post.attributes
      }));
    } catch (error) {
      console.error('Alternative approach also failed:', error.message);
      return [];
    }
  }

  async processPost(post, folderId) {
    const wpId = post.wp_id;

    try {
      console.log(`🔗 Fetching WordPress post ${wpId}...`);

      // Step 1: Get post data from WordPress including featured media
      const wpPost = await this.wpApi.get(`/posts/${wpId}`, {
        params: {
          _embed: true
        }
      });

      // Step 2: Check if post has featured media
      const featuredMedia = wpPost.data._embedded?.['wp:featuredmedia']?.[0];
      
      if (!featuredMedia) {
        return { success: false, message: `No featured media found for WP post ${wpId}` };
      }

      console.log(`🖼️ Found featured media: ${featuredMedia.source_url}`);

      // Step 3: Get the actual image URL
      const imageUrl = featuredMedia.source_url || 
                      featuredMedia.media_details?.source_url ||
                      featuredMedia.guid?.rendered;

      if (!imageUrl) {
        return { success: false, message: `No image URL found for featured media of post ${wpId}` };
      }

      // Step 4: Download and upload to Strapi
      const strapiMedia = await this.uploadImageToStrapi(imageUrl, folderId, `wp-${wpId}-${featuredMedia.id}`);

      // Step 5: Update Strapi post with featured image - Strapi 5 format
      await this.updatePostFeaturedImage(post.id, strapiMedia.id);

      return { success: true, message: 'Featured image imported successfully' };

    } catch (error) {
      if (error.response?.status === 404) {
        return { success: false, message: `WordPress post ${wpId} not found` };
      }
      console.error(`❌ WordPress API error for post ${wpId}:`, error.message);
      throw error;
    }
  }

  async uploadImageToStrapi(imageUrl, folderId, filename) {
    try {
      console.log(`📥 Downloading image: ${imageUrl}`);

      // Download image from WordPress
      const imageResponse = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'WordPress-Media-Importer/1.0'
        }
      });

      // Prepare form data for Strapi 5
      const formData = new FormData();
      formData.append('files', imageResponse.data, {
        filename: `${filename}${path.extname(new URL(imageUrl).pathname) || '.jpg'}`,
        contentType: imageResponse.headers['content-type']
      });

      // Add folder info if available - Strapi 5 format
      if (folderId) {
        formData.append('fileInfo', JSON.stringify({
          folder: folderId
        }));
      }

      // Upload to Strapi - Strapi 5 endpoint
      console.log(`📤 Uploading to Strapi...`);
      const uploadResponse = await this.strapiApi.post('/upload', formData, {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 60000
      });

      if (!uploadResponse.data || uploadResponse.data.length === 0) {
        throw new Error('No data returned from Strapi upload');
      }

      console.log(`✅ Upload successful: ${uploadResponse.data[0].name}`);
      return uploadResponse.data[0];

    } catch (error) {
      console.error(`❌ Upload failed for ${imageUrl}:`, error.message);
      if (error.response) {
        console.error('Upload error details:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async updatePostFeaturedImage(postId, mediaId) {
    try {
      // Strapi 5 update format
      await this.strapiApi.put(`/posts/${postId}`, {
        data: {
          featured_image: {
            id: mediaId
          }
        }
      });
      console.log(`✅ Updated post ${postId} with featured image ${mediaId}`);
    } catch (error) {
      console.error(`❌ Failed to update post ${postId}:`, error.message);
      if (error.response) {
        console.error('Update error:', JSON.stringify(error.response.data, null, 2));
      }
      
      // Try alternative format
      console.log('🔄 Trying alternative update format...');
      await this.strapiApi.put(`/posts/${postId}`, {
        data: {
          featured_image: mediaId
        }
      });
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the script
const importer = new WordPressMediaImporter();
importer.run();
