#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function importData() {
  console.log('🚀 Vision Group Data Import - Starting...\n');
  
  try {
    // 1. Load the data
    console.log('📂 Loading billing data...');
    const dataPath = path.join(__dirname, '../data/vision_group_comprehensive_billing.json');
    const billingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`✅ Data loaded: ${Object.keys(billingData.products).length} product categories\n`);
    
    // 2. Initialize Strapi for v5
    console.log('📦 Initializing Strapi v5...');
    
    // For Strapi v5, we need to use the strapi factory properly
    const strapiFactory = require('@strapi/strapi');
    
    // Create a minimal Strapi instance
    const strapi = await strapiFactory({
      appDir: process.cwd(),
      distDir: process.cwd(),
      autoReload: false,
      serveAdminPanel: false,
    });
    
    // Load Strapi without starting the HTTP server
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
    console.log('Starting Vision Group Data Import');
    console.log('========================================\n');
    
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
    
    console.log('\n✅ Import completed successfully!');
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
    console.error('\nStack:', error.stack);
    
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Ensure Strapi content types exist in src/api/');
    console.error('   2. Check database connection in config/database.js');
    console.error('   3. Make sure Strapi is not already running on port 1337');
    console.error('   4. Verify the data file exists: /data/vision_group_comprehensive_billing.json\n');
    
    process.exit(1);
  }
}

async function processCategory(strapi, categoryKey, categoryData, stats) {
  console.log(`\n📁 Processing Category: ${categoryData.category}`);
  
  // Determine category type
  const categoryType = getCategoryType(categoryKey);
  
  // Create or find existing category
  let category;
  
  try {
    // Check if category already exists
    const existingCategories = await strapi.entityService.findMany('api::product-category.product-category', {
      filters: { product_id: categoryData.product_id || `CAT-${categoryKey.toUpperCase()}` },
      limit: 1
    });
    
    if (existingCategories.length > 0) {
      category = existingCategories[0];
      console.log(`   ⚠️  Category already exists (ID: ${category.id})`);
    } else {
      // Create new category
      category = await strapi.entityService.create('api::product-category.product-category', {
        data: {
          category_name: categoryData.category,
          description: categoryData.description || '',
          product_id: categoryData.product_id || `CAT-${categoryKey.toUpperCase()}`,
          category_type: categoryType,
          is_active: true
        }
      });
      
      stats.categories++;
      console.log(`   ✓ Category created (ID: ${category.id})`);
    }
    
    // Process products in this category
    await processCategoryProducts(strapi, categoryData, category.id, stats);
    
  } catch (error) {
    console.error(`   ❌ Error creating category ${categoryData.category}:`, error.message);
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

async function processCategoryProducts(strapi, categoryData, categoryId, stats) {
  // Handle different category structures
  const items = categoryData.items || {};
  
  for (const [productKey, productData] of Object.entries(items)) {
    if (productData && productData.name) {
      try {
        await createOrUpdateProduct(strapi, productData, categoryId, stats);
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
          await createOrUpdateProduct(strapi, supplementData, categoryId, stats);
        } catch (error) {
          stats.errors.push(`Supplement ${supplementData.name}: ${error.message}`);
          console.error(`   ❌ Error with supplement ${supplementData.name}:`, error.message);
        }
      }
    }
  }
}

async function createOrUpdateProduct(strapi, productData, categoryId, stats) {
  console.log(`   📦 Processing: ${productData.name}`);
  
  try {
    // Check if product already exists
    const existingProducts = await strapi.entityService.findMany('api::product.product', {
      filters: { product_id: productData.product_id },
      limit: 1
    });
    
    let product;
    
    if (existingProducts.length > 0) {
      product = existingProducts[0];
      console.log(`      ⚠️  Product already exists (ID: ${product.id})`);
    } else {
      // Create new product
      product = await strapi.entityService.create('api::product.product', {
        data: {
          product_name: productData.name,
          product_id: productData.product_id,
          description: productData.description || '',
          category: categoryId,
          circulation: productData.circulation ? parseInt(productData.circulation.replace(/\D/g, '')) || 0 : 0,
          readership: productData.readership ? parseInt(productData.readership.replace(/\D/g, '')) || 0 : 0,
          metadata: extractMetadata(productData),
          is_active: true
        }
      });
      
      stats.products++;
      console.log(`      ✓ Product created (ID: ${product.id})`);
    }
    
    // Import rate cards if they exist
    if (productData.rate_card) {
      await importRateCards(strapi, productData.rate_card, product.id, stats);
    }
    
  } catch (error) {
    console.error(`      ❌ Error creating product ${productData.name}:`, error.message);
    throw error;
  }
}

function extractMetadata(productData) {
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
  
  return metadata;
}

async function importRateCards(strapi, rateCardData, productId, stats) {
  const effectiveDate = new Date('2024-07-01');
  let rateCount = 0;
  
  try {
    // Handle different rate card structures
    const rateHandlers = [
      { key: 'special_positions', getRates: (data) => data.rates, getAdType: (rate) => rate.position },
      { key: 'main_body_display', getRates: (data) => data.rates, getAdType: (rate) => rate.size },
      { key: 'classifieds', getRates: (data) => data.rates, getAdType: (rate) => rate.type },
      { key: 'supplements_special_sections', getRates: (data) => data.rates, getAdType: (rate) => rate.size },
      { key: 'loose_leaf_inserts', getRates: (data) => data.rates, getAdType: (rate) => rate.type || rate.size },
      { key: 'spot_adverts', getRates: (data) => data.rates || data.time_slots, getAdType: (rate) => rate.time_slot || 'Spot Advert' },
      { key: 'studio_appearances', getRates: (data) => data.rates, getAdType: (rate) => 'Studio Appearance' },
      { key: 'news_interviews', getRates: (data) => data.rates, getAdType: (rate) => rate.program || 'News Interview' },
      { key: 'talkshows', getRates: (data) => data.rates, getAdType: (rate) => 'Talkshow' },
      { key: 'squeeze_backs', getRates: (data) => data.rates, getAdType: (rate) => 'Squeeze Back' },
      { key: 'pop_ups', getRates: (data) => data.rates, getAdType: (rate) => 'Pop Up' },
      { key: 'scrolls', getRates: (data) => data.rates, getAdType: (rate) => 'Scroll' },
      { key: 'documentaries', getRates: (data) => data.rates, getAdType: (rate) => rate.duration || 'Documentary' },
      { key: 'herbalists', getRates: (data) => data.rates, getAdType: (rate) => rate.type },
      { key: 'churches_pastors', getRates: (data) => data.rates, getAdType: (rate) => rate.type },
      { key: 'spot_messages', getRates: (data) => data.rates, getAdType: (rate) => 'Spot Message' },
      { key: 'presenter_mentions', getRates: (data) => ({duration: data.duration, price: data.price}), getAdType: () => 'Presenter Mention' },
      { key: 'leaderboard_728x90', getRates: (data) => data, getAdType: (rate) => rate.placement },
      { key: 'packages', getRates: (data) => data, getAdType: (rate) => rate.type }
    ];
    
    for (const handler of rateHandlers) {
      if (rateCardData[handler.key]) {
        const rates = handler.getRates(rateCardData[handler.key]);
        
        if (Array.isArray(rates)) {
          for (const rate of rates) {
            if (rate && (rate.price_fc !== null || rate.price_bw !== null || rate.price !== null)) {
              await createRateCard(strapi, productId, handler.getAdType(rate), rate, effectiveDate, stats);
              rateCount++;
            }
          }
        }
      }
    }
    
    // Handle special rate structures
    if (rateCardData.surcharge) {
      await createRateCard(strapi, productId, 'Surcharge', {
        description: rateCardData.surcharge.description,
        surcharge_percentage: rateCardData.surcharge.percentage
      }, effectiveDate, stats);
      rateCount++;
    }
    
    if (rateCount > 0) {
      console.log(`      ✓ Created ${rateCount} rate cards`);
    }
    
  } catch (error) {
    console.error(`      ❌ Error creating rate cards:`, error.message);
    stats.errors.push(`Rate cards for product ${productId}: ${error.message}`);
  }
}

async function createRateCard(strapi, productId, adType, rateData, effectiveDate, stats) {
  try {
    // Skip if no price data
    const hasPrice = rateData.price_fc !== null || rateData.price_bw !== null || rateData.price !== null;
    const hasAmount = rateData['30sec'] !== null || rateData['45sec'] !== null || rateData['60sec'] !== null;
    
    if (!hasPrice && !hasAmount && !rateData.surcharge_percentage) {
      return;
    }
    
    await strapi.entityService.create('api::rate-card.rate-card', {
      data: {
        product: productId,
        ad_type: adType || 'Standard',
        size_dimension: rateData.dimensions || rateData.size || rateData.unit || '',
        duration: rateData.duration || '',
        time_slot: rateData.time_slot || '',
        price_fc: rateData.price_fc || rateData.price || rateData.monthly_rate || rateData['30sec'] || 0,
        price_bw: rateData.price_bw || 0,
        currency: rateData.currency || 'UGX',
        effective_date: effectiveDate,
        expiry_date: new Date('2025-12-31'),
        surcharge_percentage: rateData.surcharge_percentage || 0,
        metadata: {
          description: rateData.description,
          program: rateData.program,
          placement: rateData.placement,
          device: rateData.device
        }
      }
    });
    
    stats.rateCards++;
    
  } catch (error) {
    // Log error but continue with other rate cards
    console.error(`         ⚠️  Rate card error (${adType}):`, error.message);
    stats.errors.push(`Rate card ${adType}: ${error.message}`);
  }
}

// Run the import
importData();
