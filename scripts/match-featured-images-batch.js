// scripts/match-featured-images-batch.js
const axios = require('axios');
const fs = require('fs');

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
});

async function generateBatchScript() {
  console.log('🖼️  Generating Featured Image Batch Script...\n');
  
  try {
    // Fetch media
    console.log('📁 Fetching media files...');
    const mediaResponse = await strapiAPI.get('/api/upload/files', {
      params: {
        pagination: { limit: -1 },
        filters: { name: { $startsWith: 'wp-' } }
      }
    });
    
    const allMedia = mediaResponse.data;
    console.log(`✔ Found ${allMedia.length} media files\n`);
    
    // Create mapping
    const mediaMapping = {};
    for (const media of allMedia) {
      const match = media.name.match(/^wp-(\d+)-/);
      if (match) {
        mediaMapping[parseInt(match[1])] = media.id;
      }
    }
    console.log(`✔ Mapped ${Object.keys(mediaMapping).length} images\n`);
    
    // Generate internal script
    const scriptContent = `'use strict';
const mediaMapping = ${JSON.stringify(mediaMapping, null, 2)};

module.exports = async ({ strapi }) => {
  console.log('🖼️  Updating featured images...\\n');
  
  const posts = await strapi.entityService.findMany('api::post.post', {
    fields: ['wp_id', 'title'],
    pagination: { limit: -1 }
  });
  
  console.log(\`Found \${posts.length} posts\\n\`);
  
  let success = 0, noMatch = 0;
  
  for (const post of posts) {
    if (!post.wp_id || !mediaMapping[post.wp_id]) {
      noMatch++;
      continue;
    }
    
    await strapi.entityService.update('api::post.post', post.id, {
      data: { featured_image: mediaMapping[post.wp_id] }
    });
    
    console.log(\`✔ \${post.title}\`);
    success++;
    if (success % 100 === 0) console.log(\`\\n   \${success} updated...\\n\`);
  }
  
  console.log(\`\\n✅ Updated \${success} posts (no match: \${noMatch})\`);
};`;
    
    fs.writeFileSync('match-images-final.js', scriptContent);
    console.log('✅ Created match-images-final.js\n');
    console.log('Now run: npm run strapi match-images-final.js\n');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
}

generateBatchScript();
