// scripts/update-expiry-dates-db.js
const { createStrapi } = require('@strapi/strapi');

async function updateExpiryDates() {
  try {
    console.log('Starting Strapi...');
    const strapi = await createStrapi();
    
    const expiryDate = '2026-06-30'; // Change this to your desired date
    console.log(`Setting expiry date to: ${expiryDate}`);
    
    // Get all rate cards
    const rateCards = await strapi.entityService.findMany(
      'api::rate-card.rate-card',
      {
        fields: ['id', 'expiry_date'],
        populate: ['product']
      }
    );
    
    console.log(`Found ${rateCards.length} rate cards`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const rateCard of rateCards) {
      try {
        await strapi.entityService.update(
          'api::rate-card.rate-card',
          rateCard.id,
          {
            data: {
              expiry_date: expiryDate
            }
          }
        );
        updatedCount++;
        
        // Show progress
        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount} rate cards...`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error updating rate card ${rateCard.id}:`, error.message);
      }
    }
    
    console.log('\n=== Update Completed ===');
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Failed: ${errorCount}`);
    console.log(`Total: ${rateCards.length}`);
    
    await strapi.destroy();
    
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

// Run the function
updateExpiryDates();
