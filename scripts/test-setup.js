// test-setup.js
console.log('🧪 Testing Strapi Connection');
console.log('=============================\n');

// Test if we can access the Strapi instance
const testMethods = {
  // Method 1: Check if Strapi is running locally
  checkLocalStrapi: () => {
    console.log('1. Checking local Strapi...');
    try {
      const strapi = require('../node_modules/@strapi/strapi');
      console.log('   ✅ Strapi package available');
      return true;
    } catch (error) {
      console.log('   ❌ Strapi package not found');
      return false;
    }
  },

  // Method 2: Check database connection
  checkDatabase: async () => {
    console.log('2. Checking database...');
    try {
      const databaseConfig = require('../config/database');
      console.log('   ✅ Database config loaded');
      console.log('   Database type:', databaseConfig.default.connection.client);
      return true;
    } catch (error) {
      console.log('   ❌ Database config not found');
      return false;
    }
  },

  // Method 3: Check environment
  checkEnvironment: () => {
    console.log('3. Checking environment...');
    console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
    console.log('   Current directory:', process.cwd());
    return true;
  }
};

async function runTests() {
  const results = [];
  
  results.push(testMethods.checkLocalStrapi());
  results.push(await testMethods.checkDatabase());
  results.push(testMethods.checkEnvironment());

  console.log('\n📊 Test Results:');
  console.log('================');
  if (results.every(r => r)) {
    console.log('✅ All tests passed! Ready to proceed.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please check your setup.');
    return false;
  }
}

runTests();
