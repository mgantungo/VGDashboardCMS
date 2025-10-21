'use strict';

module.exports = async ({ strapi }) => {
  console.log('🖼️  Updating featured images...\n');
  
  try {
    // Get all media with wp- prefix
    const allMedia = await strapi.entityService.findMany('plugin::upload.file', {
      filters: { name: { $startsWith: 'wp-' } },
      fields: ['name', 'id'],
      pagination: { limit: -1 }
    });
    
    console.log(`Found ${allMedia.length} media files\n`);
    
    // Create mapping
    const mediaMapping = {};
    for (const media of allMedia) {
      const match = media.name.match(/^wp-(\d+)-/);
      if (match) {
        mediaMapping[parseInt(match[1])] = media.id;
      }
    }
    
    console.log(`Mapped ${Object.keys(mediaMapping).length} images\n`);
    
    // Get all posts
    const posts = await strapi.entityService.findMany('api::post.post', {
      fields: ['wp_id', 'title'],
      pagination: { limit: -1 }
    });
    
    console.log(`Found ${posts.length} posts\n`);
    
    let success = 0, noMatch = 0;
    
    for (const post of posts) {
      if (!post.wp_id || !mediaMapping[post.wp_id]) {
        noMatch++;
        continue;
      }
      
      await strapi.entityService.update('api::post.post', post.id, {
        data: { featured_image: mediaMapping[post.wp_id] }
      });
      
      console.log(`✔ ${post.title}`);
      success++;
      
      if (success % 100 === 0) console.log(`\n   ${success} updated...\n`);
    }
    
    console.log(`\n✅ Success: ${success}, No match: ${noMatch}`);
    
  } catch (error) {
    console.error('❌ Failed:', error);
  }
};
