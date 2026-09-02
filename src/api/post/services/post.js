//'use strict';

/**
 * post service
 */

//const { createCoreService } = require('@strapi/strapi').factories;

//module.exports = createCoreService('api::post.post');

// scripts/fix-images-service.js
'use strict';

module.exports = ({ strapi }) => ({
  async fixFeaturedImages() {
    try {
      console.log('🚀 Starting featured image correction...');

      const postService = strapi.entityService;
      const uploadService = strapi.plugin('upload').service('upload');

      // Get all posts
      const posts = await postService.findMany('api::post.post', {
        populate: ['featured_image'],
        limit: -1
      });

      console.log(`📝 Found ${posts.length} posts`);

      let updated = 0;
      let skippedNoWpId = 0;
      let skippedNoMedia = 0;
      let errors = 0;

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        
        process.stdout.write(`[${i+1}/${posts.length}] Post ${post.id}... `);

        if (!post.wp_id) {
          console.log('⏭️  No wp_id');
          skippedNoWpId++;
          continue;
        }

        // Find media files that start with wp-{wp_id}-
        const mediaFiles = await uploadService.findMany({
          filters: {
            name: {
              $startsWith: `wp-${post.wp_id}-`
            }
          }
        });

        if (mediaFiles.length === 0) {
          console.log('❌ No media');
          skippedNoMedia++;
          continue;
        }

        const media = mediaFiles[0];
        console.log(`✅ Found: ${media.name}`);

        try {
          await postService.update('api::post.post', post.id, {
            data: {
              featured_image: media.id
            }
          });
          console.log('   ✅ Updated');
          updated++;
        } catch (error) {
          console.log('   💥 Failed');
          errors++;
        }

        // Progress update
        if (i % 100 === 0 && i > 0) {
          console.log(`\n📈 Progress: ${i}/${posts.length} (${((i/posts.length)*100).toFixed(1)}%)`);
        }
      }

      console.log('\n📊 COMPLETE!');
      console.log(`✅ Updated: ${updated}`);
      console.log(`⏭️  No wp_id: ${skippedNoWpId}`);
      console.log(`📭 No media: ${skippedNoMedia}`);
      console.log(`💥 Errors: ${errors}`);

      return { updated, skippedNoWpId, skippedNoMedia, errors };

    } catch (error) {
      console.error('💥 Service failed:', error);
      throw error;
    }
  }
});
