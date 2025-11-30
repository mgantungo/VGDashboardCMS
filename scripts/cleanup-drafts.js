'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Database } = require('@strapi/database');
const { createStrapi } = require('@strapi/strapi');

async function cleanupDrafts() {
  let strapi;
  
  try {
    // Load Strapi application
    strapi = await createStrapi();
    await strapi.load();
    
    console.log('Connected to database. Searching for draft publications...');
    
    // Find all draft publications
    const draftPublications = await strapi.db.query('api::publication.publication').findMany({
      where: {
        published_at: null
      },
      select: ['id', 'name', 'slug', 'published_at']
    });

    console.log(`Found ${draftPublications.length} draft publications to delete:`);
    
    // Delete each draft publication
    for (const draft of draftPublications) {
      await strapi.db.query('api::publication.publication').delete({
        where: { id: draft.id }
      });
      console.log(`✓ Deleted: ${draft.name} (ID: ${draft.id}, Slug: ${draft.slug})`);
    }

    console.log(`\n✅ Successfully deleted ${draftPublications.length} draft publications`);
    
  } catch (error) {
    console.error('❌ Error cleaning up draft publications:', error.message);
    process.exit(1);
  } finally {
    if (strapi) {
      await strapi.destroy();
    }
  }
}

// Run the cleanup
cleanupDrafts();
