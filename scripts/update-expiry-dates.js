// scripts/update-expiry-dates.js
'use strict';

module.exports = async () => {
  try {
    const expiryDate = '2026-07-30'; // Set your expiry date here
    
    console.log('Starting bulk update of expiry dates...');
    
    // Get all rate cards
    const rateCards = await strapi.entityService.findMany(
      'api::rate-card.rate-card',
      {
        fields: ['id', 'expiry_date']
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
        console.log(`Updated rate card ${rateCard.id}`);
      } catch (error) {
        errorCount++;
        console.error(`Error updating rate card ${rateCard.id}:`, error.message);
      }
    }
    
    console.log(`\nUpdate completed:`);
    console.log(`  - Successfully updated: ${updatedCount}`);
    console.log(`  - Failed: ${errorCount}`);
    console.log(`  - Total: ${rateCards.length}`);
    
  } catch (error) {
    console.error('Script failed:', error);
  }
};
