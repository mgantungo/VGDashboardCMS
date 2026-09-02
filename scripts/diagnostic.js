// scripts/diagnostic.js


console.log('🔍 Strapi Diagnostic Tool\n');

try {
  console.log('1. Checking Strapi module...');
  const strapiModule = require('@strapi/strapi');
  
  console.log('✅ Strapi module loaded successfully');
  console.log('   Type of module:', typeof strapiModule);
  console.log('   Keys:', Object.keys(strapiModule).slice(0, 10));
  
  if (strapiModule.default) {
    console.log('   Has default export:', typeof strapiModule.default);
  }
  
  console.log('\n2. Checking Strapi initialization methods...');
  
  // Try different initialization patterns
  if (typeof strapiModule === 'function') {
    console.log('   ✅ Module is a function (Strapi v5 pattern)');
    try {
      const app = strapiModule({ appDir: process.cwd() });
      console.log('   ✅ Function call successful');
    } catch (err) {
      console.log('   ❌ Function call failed:', err.message);
    }
  }
  
  if (typeof strapiModule === 'object') {
    console.log('   ✅ Module is an object');
    
    if (strapiModule.factory) {
      console.log('   ✅ Has factory method');
    }
    
    if (strapiModule.Strapi) {
      console.log('   ✅ Has Strapi class');
    }
  }
  
  console.log('\n3. Checking package.json...');
  try {
    const packageJson = require('../package.json');
    const strapiVersion = packageJson.dependencies['@strapi/strapi'] || 
                         packageJson.devDependencies['@strapi/strapi'];
    console.log(`   Strapi version: ${strapiVersion}`);
  } catch (err) {
    console.log('   ❌ Could not read package.json');
  }
  
  console.log('\n4. Checking content types...');
  try {
    const fs = require('fs');
    const path = require('path');
    
    const apiPath = path.join(__dirname, '../src/api');
    if (fs.existsSync(apiPath)) {
      const apis = fs.readdirSync(apiPath);
      console.log(`   Found ${apis.length} APIs:`, apis);
    } else {
      console.log('   ❌ src/api directory not found');
    }
  } catch (err) {
    console.log('   ❌ Error checking content types:', err.message);
  }
  
} catch (error) {
  console.error('❌ Failed to load Strapi module:', error.message);
  console.error('Stack:', error.stack);
}
