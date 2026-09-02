#!/usr/bin/env node
/**
 * Simple Vision Group Data Import
 */

const fs = require('fs');
const path = require('path');

async function run() {
  console.log('🚀 Starting Vision Group Data Import...');
  
  try {
    // First, check if data file exists
    const dataPath = path.join(__dirname, '../data/vision_group_comprehensive_billing.json');
    if (!fs.existsSync(dataPath)) {
      console.error(`❌ Data file not found: ${dataPath}`);
      process.exit(1);
    }
    
    console.log('📂 Loading data file...');
    const billingData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`✅ Data loaded: ${Object.keys(billingData.products).length} categories found`);
    
    // Now load Strapi
    console.log('📦 Loading Strapi...');
    const strapi = require('@strapi/strapi');
    
    const app = strapi({
      appDir: process.cwd(),
      distDir: process.cwd(),
    });
    
    await app.load();
    console.log('✅ Strapi loaded successfully');
    
    // Test connection by getting existing categories
    console.log('\n🧪 Testing database connection...');
    const existingCategories = await app.entityService.findMany('api::product-category.product-category');
    console.log(`📊 Found ${existingCategories.length} existing categories`);
    
    // Now you can proceed with your import logic
    console.log('\n🎯 Ready to import data...');
    
    // Your import code here...
    
    await app.destroy();
    console.log('\n✅ Import process completed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\n💡 Make sure:');
    console.error('   1. Strapi content types exist (product-category, product, rate-card)');
    console.error('   2. Database is running and accessible');
    console.error('   3. You are in the correct directory: /var/www/VGDashboardCMS');
    process.exit(1);
  }
}

run();
