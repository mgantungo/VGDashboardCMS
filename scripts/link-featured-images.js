/**
 * Script to link uploaded media to posts based on filename pattern
 * Place this in your Strapi project root and run: node link-featured-images.js
 */

const fetch = require('node-fetch');

// Use localhost since we're running on the same server as Strapi
const STRAPI_URL = 'http://localhost:1337'; // Change port if different
const STRAPI_TOKEN = '930ab8d0b752e4fa146b20d2afcd32a5614b7d65a034481857453e3145c8a6c46ca63c16895abb59d86b97ec4012d95eee8079fc56b8a349e80001ec487b7134172aba55855736c2e4eb2e7bee10508f789bf90f909c81f953e4caf4d6c99fc4be91202a1049f4f2228f49e8ea4cf7fd8858431f7cc7d6bb0b007b3fd29d029a';

async function linkFeaturedImages() {
  console.log('🚀 Starting featured image linking for ALL posts...');

  try {
    // Fetch ALL posts with pagination
    console.log('📥 Fetching all posts...');
    const allPosts = [];
    let page = 1;
    let hasMorePosts = true;
    const pageSize = 100;

    while (hasMorePosts) {
      const postsResponse = await fetch(
        `${STRAPI_URL}/api/posts?populate=featured_image&pagination[page]=${page}&pagination[pageSize]=${pageSize}`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_TOKEN}`,
          },
        }
      );

      if (!postsResponse.ok) {
        throw new Error(`Failed to fetch posts page ${page}: ${postsResponse.statusText}`);
      }

      const postsData = await postsResponse.json();
      const posts = postsData.data;
      allPosts.push(...posts);

      console.log(`   Fetched page ${page}: ${posts.length} posts (total: ${allPosts.length})`);

      hasMorePosts = posts.length === pageSize;
      page++;
      
      // Small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`✅ Fetched ${allPosts.length} total posts\n`);

    // Fetch ALL media files with pagination
    console.log('📥 Fetching all media files...');
    const allMedia = [];
    page = 1;
    let hasMoreMedia = true;

    while (hasMoreMedia) {
      const mediaResponse = await fetch(
        `${STRAPI_URL}/api/upload/files?pagination[page]=${page}&pagination[pageSize]=${pageSize}`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_TOKEN}`,
          },
        }
      );

      if (!mediaResponse.ok) {
        throw new Error(`Failed to fetch media page ${page}: ${mediaResponse.statusText}`);
      }

      const mediaData = await mediaResponse.json();
      const mediaFiles = Array.isArray(mediaData) ? mediaData : mediaData.data || [];
      allMedia.push(...mediaFiles);

      console.log(`   Fetched page ${page}: ${mediaFiles.length} files (total: ${allMedia.length})`);

      hasMoreMedia = mediaFiles.length === pageSize;
      page++;
      
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`✅ Fetched ${allMedia.length} total media files\n`);

    // Filter for files in "API Uploads" folder and with wp- pattern
    const apiUploadFiles = allMedia.filter((file) => {
      const folderName = file.folder?.name || file.folderPath;
      const hasWpPattern = /^wp-\d+-/.test(file.name);
      return hasWpPattern && (folderName === 'API Uploads' || file.folderPath === '/API Uploads');
    });

    console.log(`📁 Found ${apiUploadFiles.length} files in "API Uploads" folder with wp- pattern`);

    // If no files found with folder filter, try without folder filter
    if (apiUploadFiles.length === 0) {
      console.log(`⚠️  No files found with folder filter, searching all files with wp- pattern...`);
      apiUploadFiles.push(...allMedia.filter((file) => /^wp-\d+-/.test(file.name)));
      console.log(`📁 Found ${apiUploadFiles.length} files with wp- pattern (any folder)`);
    }

    // Show some sample files for debugging
    if (apiUploadFiles.length > 0) {
      console.log(`\n📋 Sample files found:`);
      apiUploadFiles.slice(0, 3).forEach((file) => {
        console.log(`   - ${file.name} (id: ${file.id}, documentId: ${file.documentId})`);
      });
      console.log('');
    }

    // Create a map of wp_id to media IDs (both id and documentId)
    const mediaMap = new Map();
    apiUploadFiles.forEach((file) => {
      // Match pattern: wp-{wp_id}-{rest of filename}
      const match = file.name.match(/^wp-(\d+)-/);
      if (match) {
        const wpId = parseInt(match[1]);
        
        // If there's already an entry, keep the first one found
        if (!mediaMap.has(wpId)) {
          mediaMap.set(wpId, {
            id: file.id,
            documentId: file.documentId,
            name: file.name,
            url: file.url
          });
        }
      }
    });

    console.log(`🔗 Created mapping for ${mediaMap.size} unique wp_id values`);

    // Process posts
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let noMedia = 0;
    const totalPosts = allPosts.length;

    console.log(`\n🔄 Starting to process ${totalPosts} posts...\n`);

    for (let i = 0; i < allPosts.length; i++) {
      const post = allPosts[i];
      const wpId = post.wp_id;
      const postId = post.documentId || post.id;
      const hasFeaturedImage = post.featured_image && post.featured_image.length > 0;

      // Progress indicator every 100 posts
      if ((i + 1) % 100 === 0) {
        console.log(`📊 Progress: ${i + 1}/${totalPosts} posts processed (${Math.round((i + 1) / totalPosts * 100)}%)`);
        console.log(`   ✅ Updated: ${updated} | ⏭️  Skipped: ${skipped} | ❌ Failed: ${failed} | 🔍 No media: ${noMedia}\n`);
      }

      if (hasFeaturedImage) {
        skipped++;
        continue;
      }

      if (!wpId) {
        failed++;
        continue;
      }

      const mediaInfo = mediaMap.get(wpId);
      if (!mediaInfo) {
        noMedia++;
        continue;
      }

      // Update the post with featured image - try both id and documentId
      // Only log every 50th successful update to reduce noise
      const shouldLog = (updated % 50 === 0);
      
      if (shouldLog) {
        console.log(`🔄 Processing: "${post.title.substring(0, 40)}..." (wp_id: ${wpId})`);
        console.log(`   → Media: ${mediaInfo.name}`);
      }

      // Try with regular id first
      let success = false;
      
      try {
        const updateResponse = await fetch(`${STRAPI_URL}/api/posts/${postId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${STRAPI_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              featured_image: [mediaInfo.id], // Try with id first
            },
          }),
        });

        if (updateResponse.ok) {
          if (shouldLog) console.log(`✅ Linked successfully using id\n`);
          updated++;
          success = true;
        } else {
          const errorData = await updateResponse.json();
          
          // Try with documentId
          const updateResponse2 = await fetch(`${STRAPI_URL}/api/posts/${postId}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${STRAPI_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: {
                featured_image: [mediaInfo.documentId],
              },
            }),
          });

          if (updateResponse2.ok) {
            if (shouldLog) console.log(`✅ Linked successfully using documentId\n`);
            updated++;
            success = true;
          } else {
            const errorData2 = await updateResponse2.json();
            if (shouldLog) {
              console.log(`❌ Both attempts failed for wp_id ${wpId}`);
              console.log(`   Error: ${JSON.stringify(errorData2).substring(0, 150)}\n`);
            }
            failed++;
          }
        }
      } catch (error) {
        if (shouldLog) console.log(`❌ Error updating post ${wpId}: ${error.message}\n`);
        failed++;
      }

      // Reduce delay since we're processing many posts
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 BULK LINKING COMPLETED!');
    console.log('='.repeat(60));
    console.log(`📊 Total posts processed: ${totalPosts}`);
    console.log(`✅ Successfully updated: ${updated}`);
    console.log(`⏭️  Already had images (skipped): ${skipped}`);
    console.log(`🔍 No matching media found: ${noMedia}`);
    console.log(`❌ Failed to update: ${failed}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

// Run the script
linkFeaturedImages();
