// update-publish-onweb.js

const { createStrapi } = require('@strapi/strapi');

async function updatePublishOnweb() {
  let strapiInstance;
  
  try {
    console.log('Starting Strapi 5...');
    
    // Initialize Strapi
    strapiInstance = await createStrapi({ 
      distDir: './dist',
      autoReload: false,
      serveAdminPanel: false
    }).load();

    console.log('Strapi loaded successfully');
    
    console.log('Updating publish_onweb field for all adverts...');
    
    // Get all adverts using the document service
    // In Strapi 5, documents are the recommended way to query content
    const adverts = await strapiInstance.documents('api::advert.advert').findMany({
      fields: ['documentId', 'publish_onweb'],
      locale: '*', // Get all locales
      status: 'published', // Get published versions
      pagination: {
        limit: -1 // Get all records
      }
    });

    console.log(`Found ${adverts.length} published adverts to process`);

    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const advert of adverts) {
      if (advert.publish_onweb !== false) {
        try {
          // Update using document service
          await strapiInstance.documents('api::advert.advert').update({
            documentId: advert.documentId,
            data: {
              publish_onweb: false
            },
            status: 'published'
          });
          updatedCount++;
          console.log(`Updated advert ${advert.documentId}`);
        } catch (updateError) {
          console.error(`Failed to update advert ${advert.documentId}:`, updateError.message);
        }
      } else {
        skippedCount++;
      }
    }

    console.log('\n--- Summary ---');
    console.log(`Total published adverts processed: ${adverts.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (already false): ${skippedCount}`);
    
    // Also handle draft versions if needed
    console.log('\nChecking draft versions...');
    
    const draftAdverts = await strapiInstance.documents('api::advert.advert').findMany({
      fields: ['documentId', 'publish_onweb'],
      locale: '*',
      status: 'draft',
      pagination: {
        limit: -1
      }
    });

    if (draftAdverts.length > 0) {
      console.log(`Found ${draftAdverts.length} draft adverts to process`);
      
      let draftUpdatedCount = 0;
      
      for (const advert of draftAdverts) {
        if (advert.publish_onweb !== false) {
          await strapiInstance.documents('api::advert.advert').update({
            documentId: advert.documentId,
            data: {
              publish_onweb: false
            },
            status: 'draft'
          });
          draftUpdatedCount++;
        }
      }
      
      console.log(`Updated ${draftUpdatedCount} draft adverts`);
    }
    
  } catch (error) {
    console.error('Error updating adverts:', error);
    throw error;
  } finally {
    // Gracefully shutdown Strapi
    if (strapiInstance) {
      await strapiInstance.destroy();
      console.log('\nStrapi shutdown complete');
    }
  }
}

// Run the script
updatePublishOnweb().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
