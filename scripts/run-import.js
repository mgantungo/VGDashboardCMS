// scripts/run-import.js
/**
 * Vision Group Billing Data Import Runner
 * 
 * This script loads the Strapi instance and runs the import-billing-data script
 * within the proper Strapi context so that entityService is available.
 */

const importBillingData = require('./import-data');

async function runImport() {
  console.log('🚀 Loading Strapi instance...\n');
  
  let strapiInstance;
  
  try {
    // Strapi 5 method - compile and load
    const strapi = require('@strapi/strapi');
    
    // Compile the app (required in Strapi 5)
    await strapi.compile();
    
    // Load Strapi without starting the HTTP server
    strapiInstance = await strapi.load();
    
    // Make Strapi globally available for the import script
    global.strapi = strapiInstance;
    
    console.log('✅ Strapi loaded successfully\n');
    
    // Run the import
    await importBillingData();
    
    console.log('\n🎉 All done! Your Vision Group billing data has been imported.');
    console.log('📊 You can now view the data in Strapi Admin Panel:\n');
    console.log('   - Categories: http://localhost:1337/admin/content-manager/collectionType/api::product-category.product-category');
    console.log('   - Products: http://localhost:1337/admin/content-manager/collectionType/api::product.product');
    console.log('   - Rate Cards: http://localhost:1337/admin/content-manager/collectionType/api::rate-card.rate-card\n');
    
  } catch (error) {
    console.error('\n❌ Import failed with error:');
    console.error(error);
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Ensure all content types are created in Strapi');
    console.error('   2. Check that vision_group_comprehensive_billing.json exists in /data/');
    console.error('   3. Verify database connection is working');
    console.error('   4. Make sure Strapi has been built: npm run build\n');
    process.exit(1);
    
  } finally {
    // Clean up
    if (strapiInstance) {
      console.log('🧹 Cleaning up...');
      await strapiInstance.destroy();
    }
    process.exit(0);
  }
}

// Run the import
runImport().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
