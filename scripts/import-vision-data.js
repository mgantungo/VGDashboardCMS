#!/usr/bin/env node
/**
 * Vision Group Billing Data Import - Strapi 5 Compatible
 * 
 * Usage: node scripts/import-vision-data.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 Vision Group Data Import - Starting...\n');
  
  try {
    // Load Strapi
    console.log('📦 Loading Strapi...');
    const strapi = require('@strapi/strapi');
    
    // Create Strapi instance
    const app = strapi({
      appDir: process.cwd(),
      distDir: process.cwd(),
    });
    
    // Load the app
    await app.load();
    
    console.log('✅ Strapi loaded successfully\n');
    
    // Load billing data
    console.log('📂 Loading billing data...');
    const billingData = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../data/vision_group_comprehensive_billing.json'), 
        'utf8'
      )
    );
    console.log('✅ Billing data loaded\n');
    
    // Import the data
    console.log('========================================');
    console.log('Starting Vision Group Billing Data Import');
    console.log('========================================\n');
    
    const stats = await importAllData(app, billingData);
    
    // Show summary
    console.log('\n========================================');
    console.log('Import Summary:');
    console.log('========================================');
    console.log(`✅ Categories Created: ${stats.categories}`);
    console.log(`✅ Products Created: ${stats.products}`);
    console.log(`✅ Rate Cards Created: ${stats.rateCards}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
      if (stats.errors.length > 5) {
        console.log(`   ... and ${stats.errors.length - 5} more errors`);
      }
    }
    
    console.log('\n✅ Import completed successfully!');
    console.log('\n📊 View your data at: http://localhost:1337/admin\n');
    console.log('   - Categories: http://localhost:1337/admin/content-manager/collectionType/api::product-category.product-category');
    console.log('   - Products: http://localhost:1337/admin/content-manager/collectionType/api::product.product');
    console.log('   - Rate Cards: http://localhost:1337/admin/content-manager/collectionType/api::rate-card.rate-card\n');
    
    // Cleanup
    await app.destroy();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Import failed with error:');
    console.error(error.message);
    
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Ensure all content types are created in Strapi');
    console.error('   2. Check that vision_group_comprehensive_billing.json exists in /data/');
    console.error('   3. Verify database connection is working');
    console.error('   4. Make sure Strapi has been built: npm run build\n');
    
    process.exit(1);
  }
}

async function importAllData(app, billingData) {
  const stats = {
    categories: 0,
    products: 0,
    rateCards: 0,
    errors: []
  };
  
  // Import each product category
  for (const [key, categoryData] of Object.entries(billingData.products)) {
    if (typeof categoryData === 'object' && categoryData.category) {
      try {
        await importCategory(app, key, categoryData, stats);
      } catch (error) {
        stats.errors.push(`Category ${key}: ${error.message}`);
        console.error(`❌ Error with category ${key}:`, error.message);
      }
    }
  }
  
  return stats;
}

async function importCategory(app, key, categoryData, stats) {
  console.log(`\n📁 Processing: ${categoryData.category}`);
  
  const category = await app.entityService.create('api::product-category.product-category', {
    data: {
      category_name: categoryData.category,
      description: categoryData.description || '',
      product_id: categoryData.product_id || `CAT-${key.toUpperCase()}`,
      category_type: getCategoryType(key),
      is_active: true
    }
  });
  
  stats.categories++;
  console.log(`   ✓ Category created (ID: ${category.id})`);
  
  // Import products for this category
  const importers = {
    'newspapers': importNewspapers,
    'tv_stations': importTVStations,
    'radio_stations': importRadioStations,
    'digital_media': importDigitalMedia,
    'outdoor': importOutdoor,
    'publishing': importPublishing,
    'commercial_services': importCommercial
  };
  
  const importer = importers[key];
  if (importer) {
    await importer(app, categoryData, category.id, stats);
  }
}

function getCategoryType(key) {
  const types = {
    'newspapers': 'print',
    'tv_stations': 'tv',
    'radio_stations': 'radio',
    'digital_media': 'digital',
    'outdoor': 'outdoor',
    'publishing': 'publishing',
    'commercial_services': 'commercial'
  };
  return types[key] || 'commercial';
}

// Simplified importers
async function importNewspapers(app, data, categoryId, stats) {
  const papers = ['new_vision', 'weekend_vision', 'bukedde', 'bukedde_ku_wiikendi'];
  for (const key of papers) {
    if (data[key]) {
      await createProduct(app, data[key], categoryId, stats);
    }
  }
}

async function importTVStations(app, data, categoryId, stats) {
  const stations = ['ubc_tv', 'bukedde_tv'];
  for (const key of stations) {
    if (data[key]) {
      await createProduct(app, data[key], categoryId, stats);
    }
  }
}

async function importRadioStations(app, data, categoryId, stats) {
  const stations = ['central_broadcasting', 'delta_fm', 'akaboozi_fm'];
  for (const key of stations) {
    if (data[key]) {
      await createProduct(app, data[key], categoryId, stats);
    }
  }
}

async function importDigitalMedia(app, data, categoryId, stats) {
  const products = ['website_advertising', 'mobile_app_advertising', 'social_media'];
  for (const key of products) {
    if (data[key]) {
      await createProduct(app, data[key], categoryId, stats);
    }
  }
}

async function importOutdoor(app, data, categoryId, stats) {
  const products = ['billboards', 'transit_advertising', 'experiential_marketing'];
  for (const key of products) {
    if (data[key]) {
      await createProduct(app, data[key], categoryId, stats);
    }
  }
}

async function importPublishing(app, data, categoryId, stats) {
  await createProduct(app, {
    name: 'Vision Publishing',
    product_id: data.product_id,
    description: data.description
  }, categoryId, stats);
}

async function importCommercial(app, data, categoryId, stats) {
  const services = ['printing', 'design', 'translation'];
  for (const key of services) {
    if (data[key]) {
      await createProduct(app, data[key], categoryId, stats);
    }
  }
}

async function createProduct(app, productData, categoryId, stats) {
  try {
    console.log(`   📦 Creating: ${productData.name}`);
    
    const product = await app.entityService.create('api::product.product', {
      data: {
        product_name: productData.name,
        product_id: productData.product_id,
        description: productData.description || '',
        category: categoryId,
        circulation: productData.circulation,
        readership: productData.readership,
        metadata: extractMetadata(productData),
        is_active: true
      }
    });
    
    stats.products++;
    console.log(`      ✓ Product created (ID: ${product.id})`);
    
    // Import rate cards if they exist
    if (productData.rate_card) {
      await importRateCards(app, productData.rate_card, product.id, stats);
    }
    
  } catch (error) {
    stats.errors.push(`Product ${productData.name}: ${error.message}`);
    console.error(`      ❌ Error: ${error.message}`);
  }
}

function extractMetadata(productData) {
  const metadata = {};
  
  // Add any relevant metadata fields
  const metaFields = [
    'publishing_days', 'reach', 'column_spec', 'coverage', 
    'signal_type', 'frequency', 'language', 'platforms', 
    'pricing_model', 'organization', 'offerings'
  ];
  
  metaFields.forEach(field => {
    if (productData[field]) {
      metadata[field] = productData[field];
    }
  });
  
  return metadata;
}

async function importRateCards(app, rateCard, productId, stats) {
  const effectiveDate = new Date('2024-07-01');
  let rateCount = 0;
  
  try {
    // Handle different rate card structures
    if (rateCard.special_position?.rates) {
      for (const rate of rateCard.special_position.rates) {
        await createRateCard(app, productId, rate.position, rate, effectiveDate, stats);
        rateCount++;
      }
    }
    
    if (rateCard.main_body_display?.rates) {
      for (const rate of rateCard.main_body_display.rates) {
        await createRateCard(app, productId, rate.size, rate, effectiveDate, stats);
        rateCount++;
      }
    }
    
    if (rateCard.classifieds?.rates) {
      for (const rate of rateCard.classifieds.rates) {
        await createRateCard(app, productId, rate.type, rate, effectiveDate, stats);
        rateCount++;
      }
    }
    
    if (rateCard.spot_rates?.time_slots) {
      for (const slot of rateCard.spot_rates.time_slots) {
        if (slot['30sec']) {
          await createRateCard(app, productId, '30 Second Spot', {
            time_slot: slot.time_slot,
            price_fc: slot['30sec']
          }, effectiveDate, stats);
          rateCount++;
        }
      }
    }
    
    if (rateCard.rates && Array.isArray(rateCard.rates)) {
      for (const rate of rateCard.rates) {
        await createRateCard(app, productId, rate.format || rate.type || 'Standard', rate, effectiveDate, stats);
        rateCount++;
      }
    }
    
    if (rateCount > 0) {
      console.log(`      ✓ Created ${rateCount} rate cards`);
    }
    
  } catch (error) {
    stats.errors.push(`Rate cards for product ${productId}: ${error.message}`);
  }
}

async function createRateCard(app, productId, adType, rateData, effectiveDate, stats) {
  try {
    await app.entityService.create('api::rate-card.rate-card', {
      data: {
        product: productId,
        ad_type: adType,
        size_dimension: rateData.dimensions || rateData.size || rateData.unit,
        duration: rateData.duration,
        time_slot: rateData.time_slot,
        price_fc: rateData.price_fc || rateData.price || rateData.monthly_rate,
        price_bw: rateData.price_bw,
        effective_date: effectiveDate,
        currency: rateData.currency || 'UGX',
        surcharge_percentage: rateData.surcharge_percentage,
        metadata: {
          section: rateData.section,
          location: rateData.location
        }
      }
    });
    
    stats.rateCards++;
  } catch (error) {
    // Silently continue on individual rate card errors
    stats.errors.push(`Rate card ${adType}: ${error.message}`);
  }
}

// Run the import
main();
