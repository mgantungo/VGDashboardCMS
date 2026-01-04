// scripts/import-vision-v5.js
//#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function importData() {
  console.log('🚀 Vision Group Data Import - Strapi v5.17.0\n');
  
  try {
    // 1. Load data
    console.log('📂 Loading billing data...');
    const dataPath = path.join(__dirname, '../data/vision_group_comprehensive_billing.json');
    const billingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`✅ Data loaded: ${Object.keys(billingData.products).length} product categories\n`);
    
    // 2. Initialize Strapi v5.17.0
    console.log('📦 Initializing Strapi v5.17.0...');
    
    // For Strapi v5.17.0, use createStrapi
    const { createStrapi } = require('@strapi/strapi');
    
    const strapi = createStrapi({
      appDir: process.cwd(),
      distDir: process.cwd(),
      autoReload: false,
      serveAdminPanel: false,
    });
    
    // Load Strapi
    await strapi.load();
    
    console.log('✅ Strapi initialized successfully\n');
    
    // 3. Import data
    const stats = {
      categories: 0,
      products: 0,
      rateCards: 0,
      errors: []
    };
    
    console.log('========================================');
    console.log('Starting Data Import');
    console.log('========================================\n');
    
    // First, delete existing data to avoid duplicates
    console.log('🧹 Clearing existing data...');
    await clearExistingData(strapi);
    
    // Process each product category
    for (const [categoryKey, categoryData] of Object.entries(billingData.products)) {
      if (typeof categoryData === 'object' && categoryData.category) {
        try {
          await processCategory(strapi, categoryKey, categoryData, stats);
        } catch (error) {
          stats.errors.push(`Category ${categoryKey}: ${error.message}`);
          console.error(`❌ Error with category ${categoryKey}:`, error.message);
        }
      }
    }
    
    // 4. Show summary
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
    
    console.log('\n🎉 Import completed successfully!');
    console.log('\n📊 View your data at: http://localhost:1337/admin');
    console.log('   - Categories: /admin/content-manager/collectionType/api::product-category.product-category');
    console.log('   - Products: /admin/content-manager/collectionType/api::product.product');
    console.log('   - Rate Cards: /admin/content-manager/collectionType/api::rate-card.rate-card\n');
    
    // 5. Cleanup
    await strapi.destroy();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Import failed with error:');
    console.error(error.message);
    
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack.split('\n').slice(0, 5).join('\n'));
    }
    
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure Strapi is not already running');
    console.error('   2. Check database connection');
    console.error('   3. Ensure content types exist: product-category, product, rate-card');
    console.error('   4. Verify data file: /data/vision_group_comprehensive_billing.json\n');
    
    process.exit(1);
  }
}

async function clearExistingData(strapi) {
  try {
    // Clear rate cards first (due to foreign key constraints)
    const rateCards = await strapi.entityService.findMany('api::rate-card.rate-card');
    for (const rateCard of rateCards) {
      await strapi.entityService.delete('api::rate-card.rate-card', rateCard.id);
    }
    
    // Clear products
    const products = await strapi.entityService.findMany('api::product.product');
    for (const product of products) {
      await strapi.entityService.delete('api::product.product', product.id);
    }
    
    // Clear categories
    const categories = await strapi.entityService.findMany('api::product-category.product-category');
    for (const category of categories) {
      await strapi.entityService.delete('api::product-category.product-category', category.id);
    }
    
    console.log('   ✅ Cleared existing data\n');
  } catch (error) {
    console.log('   ⚠️  Could not clear existing data (might be empty):', error.message);
  }
}

async function processCategory(strapi, categoryKey, categoryData, stats) {
  console.log(`📁 Processing: ${categoryData.category}`);
  
  try {
    // Create category
    const category = await strapi.entityService.create('api::product-category.product-category', {
      data: {
        category_name: categoryData.category,
        description: categoryData.description || '',
        product_id: categoryData.product_id || `CAT-${categoryKey.toUpperCase()}`,
        category_type: getCategoryType(categoryKey),
        is_active: true
      }
    });
    
    stats.categories++;
    console.log(`   ✓ Category created (ID: ${category.id})`);
    
    // Process products in this category
    await processProducts(strapi, categoryData, category.id, stats);
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

function getCategoryType(key) {
  const typeMap = {
    'newspapers': 'print',
    'digital_media': 'digital',
    'television': 'tv',
    'radio': 'radio',
    'publishing': 'publishing',
    'courier_services': 'commercial',
    'digital_outdoor': 'outdoor',
    'commercial_printing': 'commercial',
    'translation_services': 'commercial',
    'experiential_marketing': 'commercial'
  };
  
  return typeMap[key] || 'commercial';
}

async function processProducts(strapi, categoryData, categoryId, stats) {
  // Handle different category structures
  const items = categoryData.items || {};
  
  for (const [productKey, productData] of Object.entries(items)) {
    if (productData && productData.name) {
      try {
        await createProduct(strapi, productData, categoryId, stats);
      } catch (error) {
        stats.errors.push(`Product ${productData.name}: ${error.message}`);
        console.error(`   ❌ Error with product ${productData.name}:`, error.message);
      }
    }
  }
  
  // Handle newspaper supplements if they exist
  if (categoryData.newspaper_supplements) {
    for (const [supplementKey, supplementData] of Object.entries(categoryData.newspaper_supplements)) {
      if (supplementData && supplementData.name) {
        try {
          await createProduct(strapi, supplementData, categoryId, stats);
        } catch (error) {
          stats.errors.push(`Supplement ${supplementData.name}: ${error.message}`);
          console.error(`   ❌ Error with supplement ${supplementData.name}:`, error.message);
        }
      }
    }
  }
}

async function createProduct(strapi, productData, categoryId, stats) {
  console.log(`   📦 Creating: ${productData.name}`);
  
  try {
    // Prepare metadata
    const metadata = {};
    const metaFields = [
      'publishing_days', 'publication_day', 'frequency', 'language', 
      'coverage', 'reach', 'target_audience', 'format', 'location',
      'accessibility', 'special_features', 'content', 'focus',
      'target_age', 'features', 'use_cases', 'services',
      'offerings', 'organization', 'flagship_brand', 'pricing_model'
    ];
    
    metaFields.forEach(field => {
      if (productData[field]) {
        metadata[field] = productData[field];
      }
    });
    
    // Parse circulation and readership numbers
    const circulation = productData.circulation ? 
      parseInt(productData.circulation.replace(/\D/g, '')) || 0 : 0;
    
    const readership = productData.readership ? 
      parseInt(productData.readership.replace(/\D/g, '')) || 0 : 0;
    
    // Create product
    const product = await strapi.entityService.create('api::product.product', {
      data: {
        product_name: productData.name,
        product_id: productData.product_id,
        description: productData.description || '',
        category: categoryId,
        circulation: circulation,
        readership: readership,
        metadata: metadata,
        is_active: true
      }
    });
    
    stats.products++;
    console.log(`      ✓ Product created (ID: ${product.id})`);
    
    // Import rate cards if they exist
    if (productData.rate_card) {
      await importRateCards(strapi, productData.rate_card, product.id, stats);
    }
    
  } catch (error) {
    console.error(`      ❌ Error: ${error.message}`);
    throw error;
  }
}

async function importRateCards(strapi, rateCardData, productId, stats) {
  const effectiveDate = new Date('2024-07-01');
  const expiryDate = new Date('2025-12-31');
  let rateCount = 0;
  
  try {
    // Process different rate card structures
    await processRateCards(strapi, rateCardData, 'special_positions', productId, effectiveDate, expiryDate, stats);
    await processRateCards(strapi, rateCardData, 'main_body_display', productId, effectiveDate, expiryDate, stats);
    await processRateCards(strapi, rateCardData, 'classifieds', productId, effectiveDate, expiryDate, stats);
    await processRateCards(strapi, rateCardData, 'supplements_special_sections', productId, effectiveDate, expiryDate, stats);
    await processRateCards(strapi, rateCardData, 'loose_leaf_inserts', productId, effectiveDate, expiryDate, stats);
    
    // TV-specific rate cards
    await processRateCards(strapi, rateCardData, 'spot_adverts', productId, effectiveDate, expiryDate, stats);
    await processRateCards(strapi, rateCardData, 'studio_appearances', productId, effectiveDate, expiryDate, stats);
    await processRateCards(strapi, rateCardData, 'news_interviews', productId, effectiveDate, expiryDate, stats);
    await processRateCards(strapi, rateCardData, 'talkshows', productId, effectiveDate, expiryDate, stats);
    
    // Radio-specific rate cards
    await processRateCards(strapi, rateCardData, 'spot_messages', productId, effectiveDate, expiryDate, stats);
    
    if (rateCount > 0) {
      console.log(`      ✓ Created ${rateCount} rate cards`);
    }
    
  } catch (error) {
    console.error(`      ❌ Error creating rate cards:`, error.message);
    stats.errors.push(`Rate cards for product ${productId}: ${error.message}`);
  }
}

async function processRateCards(strapi, rateCardData, rateType, productId, effectiveDate, expiryDate, stats) {
  if (!rateCardData[rateType]) return;
  
  const rates = rateCardData[rateType].rates || rateCardData[rateType].time_slots || [];
  
  for (const rate of rates) {
    if (!rate) continue;
    
    // Determine ad type based on rate structure
    let adType = '';
    if (rate.position) adType = rate.position;
    else if (rate.size) adType = rate.size;
    else if (rate.type) adType = rate.type;
    else if (rate.time_slot) adType = `Time Slot: ${rate.time_slot}`;
    else adType = rateType.replace('_', ' ').toUpperCase();
    
    // Determine price
    let priceFc = 0;
    let priceBw = 0;
    
    if (rate.price_fc !== null && rate.price_fc !== undefined) priceFc = rate.price_fc;
    if (rate.price_bw !== null && rate.price_bw !== undefined) priceBw = rate.price_bw;
    if (rate.price !== null && rate.price !== undefined) priceFc = rate.price;
    if (rate['30sec'] !== null && rate['30sec'] !== undefined) priceFc = rate['30sec'];
    if (rate.monthly_rate !== null && rate.monthly_rate !== undefined) priceFc = rate.monthly_rate;
    
    // Only create rate card if there's a price
    if (priceFc > 0 || priceBw > 0) {
      try {
        await strapi.entityService.create('api::rate-card.rate-card', {
          data: {
            product: productId,
            ad_type: adType,
            size_dimension: rate.dimensions || rate.size || rate.unit || '',
            duration: rate.duration || '',
            time_slot: rate.time_slot || '',
            price_fc: priceFc,
            price_bw: priceBw,
            currency: 'UGX',
            effective_date: effectiveDate,
            expiry_date: expiryDate,
            surcharge_percentage: rate.surcharge_percentage || 0,
            metadata: {
              section: rate.section,
              location: rate.location,
              program: rate.program,
              placement: rate.placement
            }
          }
        });
        
        stats.rateCards++;
        
      } catch (error) {
        // Skip individual rate card errors
        console.error(`         ⚠️  Skipped rate card: ${error.message}`);
      }
    }
  }
}

// Run the import
importData();
