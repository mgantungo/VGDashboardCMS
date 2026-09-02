// src/scripts/run-upload.js
const path = require('path');
const fs = require('fs');

/**
 * Standalone script to upload Uganda administrative data to Strapi
 * Usage: node src/scripts/run-upload.js
 */

async function main() {
  console.log('🚀 Initializing Strapi for data upload...\n');
  
  try {
    // Get the Strapi project root (two levels up from this script)
    const projectRoot = path.resolve(__dirname, '../..');
    process.chdir(projectRoot);
    
    console.log(`📁 Project root: ${projectRoot}`);
    
    // Check if csvjson.json exists
    const jsonFilePath = path.join(__dirname, 'csvjson.json');
    if (!fs.existsSync(jsonFilePath)) {
      console.error(`❌ JSON file not found at: ${jsonFilePath}`);
      console.log('💡 Please place your csvjson.json file in src/scripts/ directory');
      process.exit(1);
    }
    
    // Initialize Strapi instance - try different import methods
    let strapi;
    try {
      // Method 1: Try default import
      const Strapi = require('@strapi/strapi');
      console.log('🔍 Trying default Strapi import...');
      
      if (typeof Strapi === 'function') {
        strapi = Strapi({ 
          dir: projectRoot,
          autoReload: false,
          serveAdminPanel: false
        });
      } else if (Strapi.default && typeof Strapi.default === 'function') {
        strapi = Strapi.default({ 
          dir: projectRoot,
          autoReload: false,
          serveAdminPanel: false
        });
      } else {
        throw new Error('Cannot initialize Strapi with default import');
      }
    } catch (error) {
      console.log('⚠️  Default import failed, trying alternative methods...');
      
      try {
        // Method 2: Try using strapi factory
        const strapiFactory = require('@strapi/strapi');
        console.log('🔍 Trying Strapi factory...');
        strapi = await strapiFactory().load();
      } catch (factoryError) {
        try {
          // Method 3: Try using createStrapi
          const { createStrapi } = require('@strapi/core');
          console.log('🔍 Trying createStrapi from core...');
          strapi = createStrapi({ 
            dir: projectRoot,
            autoReload: false,
            serveAdminPanel: false 
          });
        } catch (coreError) {
          // Method 4: Direct core usage
          console.log('🔍 Trying direct core usage...');
          const core = require('@strapi/core');
          strapi = await core.createStrapi({
            dir: projectRoot,
            autoReload: false,
            serveAdminPanel: false
          }).load();
        }
      }
    }
    
    // Load Strapi if not already loaded
    if (strapi && !strapi.isLoaded) {
      console.log('⏳ Loading Strapi...');
      await strapi.load();
    }
    
    console.log('✅ Strapi loaded successfully\n');
    
    // Import and run the upload function
    const { uploadAdminData } = require('./upload-admin-data');
    
    // Check if collections exist
    console.log('🔍 Checking if required collections exist...');
    const collections = [
      'api::region.region',
      'api::district.district', 
      'api::enumeration-area.enumeration-area',
      'api::sub-county.sub-county',
      'api::parish.parish',
      'api::polling-station.polling-station'
    ];
    
    for (const collection of collections) {
      try {
        await strapi.entityService.findMany(collection, { limit: 1 });
        console.log(`✅ ${collection.split('.')[1]} collection found`);
      } catch (error) {
        console.error(`❌ ${collection.split('.')[1]} collection not found or not accessible`);
        console.log('💡 Please create all required collections in Strapi Admin first');
        await strapi.destroy();
        process.exit(1);
      }
    }
    
    console.log('\n🎯 Starting data upload...');
    const result = await uploadAdminData(strapi);
    
    console.log('\n🎉 Upload completed successfully!');
    console.log('📊 Final Summary:');
    console.log(`   ✓ Regions: ${result.summary.regions}`);
    console.log(`   ✓ Districts: ${result.summary.districts}`);
    console.log(`   ✓ Enumeration Areas: ${result.summary.enumerationAreas}`);
    console.log(`   ✓ Sub Counties: ${result.summary.subCounties}`);
    console.log(`   ✓ Parishes: ${result.summary.parishes}`);
    console.log(`   ✓ Polling Stations: ${result.summary.pollingStations}`);
    console.log(`\n📈 Total records processed: ${result.processed}/${result.total}`);
    
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Make sure you\'re running this from your Strapi project root');
      console.log('2. Ensure all Strapi dependencies are installed: npm install');
      console.log('3. Verify the upload-admin-data.js file exists in src/scripts/');
    }
    
    if (error.stack) {
      console.error('\n🔍 Stack trace:', error.stack);
    }
    
    process.exit(1);
  } finally {
    // Clean up Strapi instance
    if (global.strapi) {
      console.log('\n🧹 Cleaning up Strapi instance...');
      await global.strapi.destroy();
    }
  }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, cleaning up...');
  if (global.strapi) {
    await global.strapi.destroy();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, cleaning up...');
  if (global.strapi) {
    await global.strapi.destroy();
  }
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
