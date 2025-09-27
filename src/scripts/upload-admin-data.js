// src/scripts/upload-admin-data.js
// Complete script with proper string casting and null handling for Strapi 5

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Initializing Strapi for data upload (Index-Based with String Casting)...\n');
  
  try {
    // Get the Strapi project root
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
    
    // Initialize Strapi
    let strapi;
    try {
      const { createStrapi } = require('@strapi/core');
      strapi = await createStrapi({
        dir: projectRoot,
        autoReload: false,
        serveAdminPanel: false
      }).load();
    } catch (error) {
      try {
        const strapiFactory = require('@strapi/strapi');
        strapi = await strapiFactory().load();
      } catch (factoryError) {
        console.error('❌ Failed to initialize Strapi:', error.message);
        process.exit(1);
      }
    }
    
    console.log('✅ Strapi loaded successfully\n');
    
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
    
    // Read and parse JSON file
    const rawData = fs.readFileSync(jsonFilePath, 'utf8');
    const data = JSON.parse(rawData);
    
    console.log(`📊 Total records to process: ${data.length}\n`);

    // Initialize caches
    const regionsCache = new Map();
    const districtsCache = new Map();
    const enumerationAreasCache = new Map();
    const subCountiesCache = new Map();
    const parishesCache = new Map();
    
    // Helper functions with proper string casting and null handling
    async function createOrGetRegion(regionName) {
      if (!regionName) {
        throw new Error('Region name is required but was undefined or empty');
      }
      
      const regionNameStr = String(regionName).trim();
      
      if (regionsCache.has(regionNameStr)) {
        return regionsCache.get(regionNameStr);
      }

      const existingRegions = await strapi.entityService.findMany('api::region.region', {
        filters: { name: regionNameStr }, 
        limit: 1
      });

      if (existingRegions.length > 0) {
        const region = existingRegions[0];
        regionsCache.set(regionNameStr, region);
        return region;
      }

      const region = await strapi.entityService.create('api::region.region', {
        data: { name: regionNameStr }
      });
      
      regionsCache.set(regionNameStr, region);
      console.log(`✓ Created region: ${regionNameStr}`);
      return region;
    }

    async function createOrGetDistrict(districtCode, districtName, regionId) {
      if (!districtName) {
        throw new Error(`District name is required but was: ${districtName}`);
      }
      
      // Cast to strings and handle null/undefined
      const codeStr = districtCode != null && districtCode !== '' ? String(districtCode).trim() : null;
      const nameStr = String(districtName).trim();
      const cacheKey = `${codeStr || 'null'}-${nameStr}`;
      
      if (districtsCache.has(cacheKey)) {
        return districtsCache.get(cacheKey);
      }

      // Create filters - only include code if it exists and is not empty
      const filters = { name: nameStr };
      if (codeStr) {
        filters.code = codeStr;
      }

      const existingDistricts = await strapi.entityService.findMany('api::district.district', {
        filters, 
        limit: 1
      });

      if (existingDistricts.length > 0) {
        const district = existingDistricts[0];
        districtsCache.set(cacheKey, district);
        return district;
      }

      // Create data object - only include code if it exists
      const data = { name: nameStr, region: regionId };
      if (codeStr) {
        data.code = codeStr;
      }

      const district = await strapi.entityService.create('api::district.district', { data });
      
      districtsCache.set(cacheKey, district);
      console.log(`✓ Created district: ${nameStr} ${codeStr ? `(${codeStr})` : ''}`);
      return district;
    }

    async function createOrGetEnumerationArea(eaCode, eaName, districtId) {
      const codeStr = eaCode != null && eaCode !== '' ? String(eaCode).trim() : null;
      const nameStr = eaName != null ? String(eaName).trim() : null;
      const cacheKey = `${codeStr || 'null'}-${nameStr || 'null'}-${districtId}`;
      
      if (enumerationAreasCache.has(cacheKey)) {
        return enumerationAreasCache.get(cacheKey);
      }

      const filters = { district: districtId };
      if (nameStr) filters.name = nameStr;
      if (codeStr) filters.code = codeStr;

      const existingEAs = await strapi.entityService.findMany('api::enumeration-area.enumeration-area', {
        filters, 
        limit: 1
      });

      if (existingEAs.length > 0) {
        const ea = existingEAs[0];
        enumerationAreasCache.set(cacheKey, ea);
        return ea;
      }

      const data = { district: districtId };
      if (nameStr) data.name = nameStr;
      if (codeStr) data.code = codeStr;

      const ea = await strapi.entityService.create('api::enumeration-area.enumeration-area', { data });
      
      enumerationAreasCache.set(cacheKey, ea);
      console.log(`✓ Created EA: ${nameStr || 'No Name'} ${codeStr ? `(${codeStr})` : ''}`);
      return ea;
    }

    async function createOrGetSubCounty(sctyCode, sctyName, eaId) {
      const codeStr = sctyCode != null && sctyCode !== '' ? String(sctyCode).trim() : null;
      const nameStr = sctyName != null ? String(sctyName).trim() : null;
      const cacheKey = `${codeStr || 'null'}-${nameStr || 'null'}-${eaId}`;
      
      if (subCountiesCache.has(cacheKey)) {
        return subCountiesCache.get(cacheKey);
      }

      const filters = { enumeration_area: eaId };
      if (nameStr) filters.name = nameStr;
      if (codeStr) filters.code = codeStr;

      const existingSubCounties = await strapi.entityService.findMany('api::sub-county.sub-county', {
        filters, 
        limit: 1
      });

      if (existingSubCounties.length > 0) {
        const subCounty = existingSubCounties[0];
        subCountiesCache.set(cacheKey, subCounty);
        return subCounty;
      }

      const data = { enumeration_area: eaId };
      if (nameStr) data.name = nameStr;
      if (codeStr) data.code = codeStr;

      const subCounty = await strapi.entityService.create('api::sub-county.sub-county', { data });
      
      subCountiesCache.set(cacheKey, subCounty);
      console.log(`✓ Created sub-county: ${nameStr || 'No Name'} ${codeStr ? `(${codeStr})` : ''}`);
      return subCounty;
    }

    async function createOrGetParish(parCode, parishName, subCountyId) {
      const codeStr = parCode != null && parCode !== '' ? String(parCode).trim() : null;
      const nameStr = parishName != null ? String(parishName).trim() : null;
      const cacheKey = `${codeStr || 'null'}-${nameStr || 'null'}-${subCountyId}`;
      
      if (parishesCache.has(cacheKey)) {
        return parishesCache.get(cacheKey);
      }

      const filters = { sub_county: subCountyId };
      if (nameStr) filters.name = nameStr;
      if (codeStr) filters.code = codeStr;

      const existingParishes = await strapi.entityService.findMany('api::parish.parish', {
        filters, 
        limit: 1
      });

      if (existingParishes.length > 0) {
        const parish = existingParishes[0];
        parishesCache.set(cacheKey, parish);
        return parish;
      }

      const data = { sub_county: subCountyId };
      if (nameStr) data.name = nameStr;
      if (codeStr) data.code = codeStr;

      const parish = await strapi.entityService.create('api::parish.parish', { data });
      
      parishesCache.set(cacheKey, parish);
      console.log(`✓ Created parish: ${nameStr || 'No Name'} ${codeStr ? `(${codeStr})` : ''}`);
      return parish;
    }

    async function createPollingStation(psCode, psName, parishId) {
      const codeStr = psCode != null && psCode !== '' ? String(psCode).trim() : null;
      const nameStr = psName != null ? String(psName).trim() : null;
      
      const filters = { parish: parishId };
      if (nameStr) filters.name = nameStr;
      if (codeStr) filters.code = codeStr;

      const existingPS = await strapi.entityService.findMany('api::polling-station.polling-station', {
        filters, 
        limit: 1
      });

      if (existingPS.length > 0) {
        return existingPS[0];
      }

      const data = { parish: parishId };
      if (nameStr) data.name = nameStr;
      if (codeStr) data.code = codeStr;

      const pollingStation = await strapi.entityService.create('api::polling-station.polling-station', { data });
      
      return pollingStation;
    }
    
    // Process data using INDICES instead of field names
    let processedCount = 0;
    let errorCount = 0;
    const batchSize = 50;

    // Log first record structure for verification
    if (data.length > 0) {
      const firstRecord = data[0];
      console.log('🔍 First record structure (for verification):');
      if (Array.isArray(firstRecord)) {
        console.log('   Data is in ARRAY format - using indices directly');
        firstRecord.forEach((value, index) => {
          console.log(`   Index ${index}: "${value}" (${typeof value})`);
        });
      } else {
        console.log('   Data is in OBJECT format - converting to array using Object.values()');
        const values = Object.values(firstRecord);
        values.forEach((value, index) => {
          console.log(`   Index ${index}: "${value}" (${typeof value})`);
        });
      }
      console.log('');
    }

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const record of batch) {
        try {
          // Convert record to array if it's an object
          let recordArray;
          if (Array.isArray(record)) {
            recordArray = record;
          } else {
            recordArray = Object.values(record);
          }
          
          // Extract values using indices and handle empty/null values
          // Based on the structure: [REGION NAME, DIST CODE, DISTRICT NAME, EA CODE, EA NAME, SCTY CODE, SCOUNTY NAME, PAR CODE, PARISH NAME, PS CODE, PS NAME]
          const regionName = recordArray[0] || null;       // Index 0: REGION NAME
          const districtCode = recordArray[1] || null;     // Index 1: DIST CODE
          const districtName = recordArray[2] || null;     // Index 2: DISTRICT NAME  
          const eaCode = recordArray[3] || null;           // Index 3: EA CODE
          const eaName = recordArray[4] || null;           // Index 4: EA NAME
          const sctyCode = recordArray[5] || null;         // Index 5: SCTY CODE
          const sctyName = recordArray[6] || null;         // Index 6: SCOUNTY NAME
          const parCode = recordArray[7] || null;          // Index 7: PAR CODE
          const parishName = recordArray[8] || null;       // Index 8: PARISH NAME
          const psCode = recordArray[9] || null;           // Index 9: PS CODE
          const psName = recordArray[10] || null;          // Index 10: PS NAME
          
          // Debug: Log field extraction for first few records
          if (processedCount < 3) {
            console.log(`🔍 Record ${processedCount + 1} field extraction:`);
            console.log(`   Region: "${regionName}" | District: "${districtName}" | EA: "${eaName}"`);
            console.log(`   Sub-County: "${sctyName}" | Parish: "${parishName}" | PS: "${psName}"`);
          }
          
          // Validate required fields
          if (!regionName || regionName.toString().trim() === '') {
            throw new Error(`Region name is missing or empty (index 0): "${regionName}"`);
          }
          if (!districtName || districtName.toString().trim() === '') {
            throw new Error(`District name is missing or empty (index 2): "${districtName}"`);
          }
          
          const region = await createOrGetRegion(regionName);
          const district = await createOrGetDistrict(districtCode, districtName, region.id);
          const ea = await createOrGetEnumerationArea(eaCode, eaName, district.id);
          const subCounty = await createOrGetSubCounty(sctyCode, sctyName, ea.id);
          const parish = await createOrGetParish(parCode, parishName, subCounty.id);
          await createPollingStation(psCode, psName, parish.id);
          
          processedCount++;
          
          if (processedCount % 100 === 0) {
            console.log(`📈 Processed ${processedCount}/${data.length} records (${Math.round(processedCount / data.length * 100)}%) - Errors: ${errorCount}`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ Error processing record ${processedCount + 1}:`, error.message);
          console.error('Raw record data:', JSON.stringify(record, null, 2));
          
          // Stop if too many errors
          if (errorCount > 50) {
            console.error('❌ Too many errors encountered. Stopping upload.');
            break;
          }
        }
      }
    }

    console.log('\n🎉 Upload completed successfully!');
    console.log('📊 Final Summary:');
    console.log(`   ✓ Regions: ${regionsCache.size}`);
    console.log(`   ✓ Districts: ${districtsCache.size}`);
    console.log(`   ✓ Enumeration Areas: ${enumerationAreasCache.size}`);
    console.log(`   ✓ Sub Counties: ${subCountiesCache.size}`);
    console.log(`   ✓ Parishes: ${parishesCache.size}`);
    console.log(`   ✓ Polling Stations: ${processedCount - errorCount}`);
    console.log(`\n📈 Total records processed: ${processedCount}/${data.length}`);
    console.log(`❌ Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('\n❌ Upload failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
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

module.exports = main;
