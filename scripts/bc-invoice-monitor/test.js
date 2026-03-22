const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BCInvoiceMonitor = require('./index');
const logger = require('./logger');
const StrapiClient = require('./strapi-client');

async function testSingleAdvert(advertId) {
  const monitor = new BCInvoiceMonitor();
  const strapiClient = new StrapiClient();
  
  try {
    logger.info(`Testing with advert ID: ${advertId}`);
    
    // Get advert details
    const response = await strapiClient.client.get(`/api/adverts/${advertId}`);
    const advert = response.data.data;
    
    if (!advert) {
      throw new Error(`Advert ${advertId} not found`);
    }
    
    logger.info(`Advert found: ${advert.id} - ${advert.advert_title}`);
    logger.info(`BC Reference: ${advert.bc_reference_number}`);
    logger.info(`Current isPaid: ${advert.isPaid}`);
    
    const result = await monitor.processAdvert(advert);
    
    logger.info('=' .repeat(50));
    logger.info('Test Result:');
    logger.info(JSON.stringify(result, null, 2));
    logger.info('=' .repeat(50));
    
  } catch (error) {
    logger.error('Test failed:', error);
    process.exit(1);
  }
}

async function testBCConnection() {
  const monitor = new BCInvoiceMonitor();
  
  try {
    logger.info('Testing Business Central connection...');
    const result = await monitor.bcClient.checkInvoiceStatus('B-SO-216544N');
    logger.info('BC Connection successful!');
    logger.info(JSON.stringify(result, null, 2));
  } catch (error) {
    logger.error('BC Connection failed:', error.message);
    process.exit(1);
  }
}

async function testStrapiConnection() {
  const strapiClient = new StrapiClient();
  
  try {
    logger.info('Testing Strapi connection...');
    const connected = await strapiClient.testConnection();
    if (connected) {
      logger.info('Strapi Connection successful!');
      
      // Fetch adverts needing payment check
      const adverts = await strapiClient.fetchAdvertsForPaymentCheck(30, 5);
      if (adverts.length > 0) {
        logger.info(`Found ${adverts.length} adverts needing payment check`);
        logger.info('Sample advert:', {
          id: adverts[0].id,
          title: adverts[0].advert_title,
          bc_ref: adverts[0].bc_reference_number,
          isPaid: adverts[0].isPaid,
          createdAt: adverts[0].createdAt
        });
      } else {
        logger.info('No adverts need payment check');
      }
      
      // Test single update
      if (adverts.length > 0 && process.env.TEST_UPDATE === 'true') {
        const testAdvert = adverts[0];
        logger.info(`\nTesting update for advert ${testAdvert.id}...`);
        const updateResult = await strapiClient.updateAdvertPayment(testAdvert.id, false);
        logger.info('Update test result:', updateResult);
      }
      
    } else {
      throw new Error('Connection failed');
    }
  } catch (error) {
    logger.error('Strapi Connection failed:', error.message);
    process.exit(1);
  }
}

async function testBulkUpdate() {
  const strapiClient = new StrapiClient();
  
  try {
    logger.info('Testing bulk update...');
    
    // Get some adverts to test
    const adverts = await strapiClient.fetchAdvertsForPaymentCheck(30, 3);
    
    if (adverts.length === 0) {
      logger.info('No adverts to test bulk update');
      return;
    }
    
    const updates = adverts.map(advert => ({
      id: advert.id,
      isPaid: false  // Just testing, not actually changing status
    }));
    
    logger.info(`Testing bulk update for ${updates.length} adverts`);
    const result = await strapiClient.bulkUpdatePayment(updates);
    
    logger.info('Bulk update result:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    logger.error('Bulk update test failed:', error.message);
  }
}

async function testCheckByBcReference() {
  const strapiClient = new StrapiClient();
  
  try {
    logger.info('Testing check by BC reference...');
    
    // Get a sample advert
    const adverts = await strapiClient.fetchAdvertsForPaymentCheck(30, 1);
    
    if (adverts.length === 0) {
      logger.info('No adverts to test BC reference lookup');
      return;
    }
    
    const bcReference = adverts[0].bc_reference_number;
    logger.info(`Looking up BC reference: ${bcReference}`);
    
    const result = await strapiClient.checkPaymentByBcReference(bcReference);
    logger.info('BC reference lookup result:', result);
    
  } catch (error) {
    logger.error('BC reference lookup test failed:', error.message);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'advert':
    const advertId = args[1];
    if (!advertId) {
      console.error('Usage: node test.js advert <advert-id>');
      process.exit(1);
    }
    testSingleAdvert(advertId);
    break;
    
  case 'bc':
    testBCConnection();
    break;
    
  case 'strapi':
    testStrapiConnection();
    break;
    
  case 'bulk':
    testBulkUpdate();
    break;
    
  case 'lookup':
    testCheckByBcReference();
    break;
    
  case 'all':
    Promise.all([
      testBCConnection(),
      testStrapiConnection(),
      testBulkUpdate(),
      testCheckByBcReference()
    ]).catch(console.error);
    break;
    
  default:
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║         BC Invoice Monitor - Test Script                     ║
╚══════════════════════════════════════════════════════════════╝

Usage:
  npm run monitor:bc:test -- bc          - Test Business Central connection
  npm run monitor:bc:test -- strapi      - Test Strapi connection
  npm run monitor:bc:test -- advert <id> - Test with specific advert ID
  npm run monitor:bc:test -- bulk        - Test bulk update
  npm run monitor:bc:test -- lookup      - Test BC reference lookup
  npm run monitor:bc:test -- all         - Run all tests

Examples:
  npm run monitor:bc:test -- bc
  npm run monitor:bc:test -- strapi
  npm run monitor:bc:test -- advert 123
  npm run monitor:bc:test -- bulk
  npm run monitor:bc:test -- all

Environment Variables Required:
  BC_API_SECRET_KEY          - Strapi API token
  EXTERNAL_API_BC_BASE_URL   - Business Central API URL
  EXTERNAL_API_USERNAME      - BC username
  EXTERNAL_API_PASSWORD      - BC password
  MONITOR_DAYS_BACK          - Days to look back (default: 2)
  MONITOR_BATCH_SIZE         - Batch size (default: 50)

Optional:
  DRY_RUN=true               - Run without making changes
  TEST_UPDATE=true           - Test actual updates (use with caution)
    `);
    process.exit(0);
}
