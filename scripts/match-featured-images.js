const axios = require('axios');

const CONFIG = {
  STRAPI_URL: 'http://localhost:1337',
  STRAPI_API_TOKEN: '930ab8d0b752e4fa146b20d2afcd32a5614b7d65a034481857453e3145c8a6c46ca63c16895abb59d86b97ec4012d95eee8079fc56b8a349e80001ec487b7134172aba55855736c2e4eb2e7bee10508f789bf90f909c81f953e4caf4d6c99fc4be91202a1049f4f2228f49e8ea4cf7fd8858431f7cc7d6bb0b007b3fd29d029a',
};

const strapiAPI = axios.create({
  baseURL: CONFIG.STRAPI_URL,
  headers: {
    'Authorization': `Bearer ${CONFIG.STRAPI_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000,
});

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function matchFeaturedImages() {
  console.log('🖼️  Starting Featured Image Matching...\n');
  
  try {
    // Fetch all media files
    console.log('📁 Fetching media files from uploads...');
    
    let allMedia = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await strapiAPI.get('/api/upload/files', {
        params: {
          pagination: { page, pageSize: 100 },
          filters: {
            name: { $startsWith: 'wp-' }
          }
        }
      });
      
      allMedia = allMedia.concat(response.data);
      hasMore = response.data.length === 100;
      page++;
      await delay(100);
    }
    
    console.log(`✔ Found ${allMedia.length} media files with 'wp-' prefix\n`);
    
    // Create mapping
    console.log('🔗 Creating wp_id to media mapping...');
    const mediaMapping = {};
    
    for (const media of allMedia) {
      const match = media.name.match(/^wp-(\d+)-/);
      if (match) {
        const wpId = parseInt(match[1]);
        mediaMapping[wpId] = {
          id: media.id,
          name: media.name,
          url: media.url
        };
      }
    }
    
    console.log(`✔ Mapped ${Object.keys(mediaMapping).length} images\n`);
    
    // Fetch all posts
    console.log('📄 Fetching posts...');
    
    let allPosts = [];
    page = 1;
    hasMore = true;
    
    while (hasMore) {
      const response = await strapiAPI.get('/api/posts', {
        params: {
          pagination: { page, pageSize: 100 },
          fields: ['wp_id', 'title']
        }
      });
      
      allPosts = allPosts.concat(response.data.data);
      
      const pagination = response.data.meta?.pagination;
      hasMore = pagination && pagination.page < pagination.pageCount;
      page++;
      
      if (page % 10 === 0) {
        console.log(`   Fetched ${allPosts.length} posts...`);
      }
      
      await delay(100);
    }
    
    console.log(`✔ Found ${allPosts.length} posts\n`);
    
    // Update posts
    console.log('🔄 Matching and updating posts...\n');
    
    let success = 0, noMatch = 0, failed = 0;
    
    for (const post of allPosts) {
      try {
        const wpId = post.attributes?.wp_id || post.wp_id;
        const title = post.attributes?.title || post.title || 'Unknown';
        
        if (!wpId) {
          noMatch++;
          continue;
        }
        
        const media = mediaMapping[wpId];
        if (!media) {
          noMatch++;
          continue;
        }
        
        // Update post via API
        await strapiAPI.put(`/api/posts/${post.id}`, {
          data: {
            featured_image: media.id
          }
        });
        
        console.log(`✔ ${title}`);
        console.log(`   wp_id: ${wpId} -> ${media.name}`);
        
        success++;
        
        if (success % 50 === 0) {
          console.log(`\n   Progress: ${success} posts updated...\n`);
        }
        
        await delay(200);
        
      } catch (error) {
        const title = post.attributes?.title || post.title || 'Unknown';
        console.error(`✗ ${title}: ${error.message}`);
        failed++;
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log(`✔ Successfully matched: ${success}`);
    console.log(`⊘ No matching image: ${noMatch}`);
    console.log(`✗ Failed: ${failed}`);
    console.log('\n✅ Featured image matching complete!');
    
  } catch (error) {
    console.error('\n❌ Matching failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

matchFeaturedImages();

