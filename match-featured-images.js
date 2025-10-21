// match-featured-images.js
// Matches posts to their featured images based on wp_id

'use strict';

module.exports = async ({ strapi }) => {
  console.log('🖼️  Starting Featured Image Matching...\n');
  
  try {
    // Step 1: Fetch all media files from uploads
    console.log('📁 Fetching media files from uploads...');
    
    const allMedia = await strapi.entityService.findMany('plugin::upload.file', {
      filters: {
        name: {
          $startsWith: 'wp-'
        }
      },
      fields: ['name', 'url', 'id'],
      pagination: { limit: -1 }
    });
    
    console.log(`✔ Found ${allMedia.length} media files with 'wp-' prefix\n`);
    
    // Step 2: Create a mapping: wp_id -> media_id
    console.log('🔗 Creating wp_id to media mapping...');
    
    const mediaMapping = {};
    let mappedCount = 0;
    
    for (const media of allMedia) {
      // Extract number from filename like "wp-14504-onions.jpg" -> 14504
      const match = media.name.match(/^wp-(\d+)-/);
      
      if (match) {
        const wpId = parseInt(match[1]);
        mediaMapping[wpId] = {
          id: media.id,
          name: media.name,
          url: media.url
        };
        mappedCount++;
      }
    }
    
    console.log(`✔ Created mapping for ${mappedCount} images\n`);
    
    // Step 3: Fetch all posts
    console.log('📄 Fetching posts...');
    
    const posts = await strapi.entityService.findMany('api::post.post', {
      fields: ['wp_id', 'title'],
      pagination: { limit: -1 }
    });
    
    console.log(`✔ Found ${posts.length} posts\n`);
    
    // Step 4: Update posts with matching featured images
    console.log('🔄 Matching and updating posts...\n');
    
    let successCount = 0;
    let noMatchCount = 0;
    let failedCount = 0;
    
    for (const post of posts) {
      try {
        const wpId = post.wp_id;
        
        if (!wpId) {
          noMatchCount++;
          continue;
        }
        
        // Check if we have a matching image
        const matchedMedia = mediaMapping[wpId];
        
        if (!matchedMedia) {
          noMatchCount++;
          continue;
        }
        
        // Update post with featured image
        await strapi.entityService.update('api::post.post', post.id, {
          data: {
            featured_image: matchedMedia.id
          }
        });
        
        console.log(`✔ ${post.title}`);
        console.log(`   wp_id: ${wpId} -> ${matchedMedia.name}`);
        
        successCount++;
        
        // Progress indicator
        if (successCount % 100 === 0) {
          console.log(`\n   Progress: ${successCount} posts updated...\n`);
        }
        
      } catch (error) {
        console.error(`✗ Failed: ${post.title} - ${error.message}`);
        failedCount++;
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(70));
    console.log(`✔ Successfully matched: ${successCount}`);
    console.log(`⊘ No matching image: ${noMatchCount}`);
    console.log(`✗ Failed: ${failedCount}`);
    console.log('\n✅ Featured image matching complete!');
    
  } catch (error) {
    console.error('❌ Matching failed:', error);
    throw error;
  }
};
