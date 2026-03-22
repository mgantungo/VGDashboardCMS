const BCInvoiceMonitor = require('./index');
const logger = require('./logger');
const StrapiClient = require('./strapi-client'); // Fixed: removed destructuring

async function testSingleAdvert(advertId) {
  const monitor = new BCInvoiceMonitor();
  const strapiClient = new StrapiClient(); // Fixed: removed destructuring
  
  try {
    logger.info(`Testing with advert ID: ${advertId}`);
    
    const response = await strapiClient.client.get(`/api/adverts/${advertId}`, {
      params: {
        populate: 'deep,3'
      }
    });
    
    const advert = response.data.data;
    if (!advert) {
      throw new Error(`Advert ${advertId} not found`);
    }
    
    logger.info(`Advert found: ${advert.id} - ${advert.attributes.advert_title}`);
    logger.info(`BC Reference: ${advert.attributes.bc_reference_number}`);
    logger.info(`Current isPaid: ${advert.attributes.isPaid}`);
    
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
  const StrapiClient = require('./strapi-client'); // Fixed: removed destructuring
  const strapiClient = new StrapiClient();
  
  try {
    logger.info('Testing Strapi connection...');
    const connected = await strapiClient.testConnection();
    if (connected) {
      logger.info('Strapi Connection successful!');
      
      // Fetch one advert to test
      const adverts = await strapiClient.fetchPendingAdverts(30, 1);
      if (adverts.length > 0) {
        logger.info(`Sample advert found: ${adverts[0].id}`);
      } else {
        logger.info('No pending adverts found for testing');
      }
    } else {
      throw new Error('Connection failed');
    }
  } catch (error) {
    logger.error('Strapi Connection failed:', error.message);
    process.exit(1);
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
    
  default:
    console.log(`
BC Invoice Monitor Test Script

Usage:
  node test.js bc          - Test Business Central connection
  node test.js strapi      - Test Strapi connection
  node test.js advert <id> - Test with specific advert ID

Examples:
  node test.js bc
  node test.js strapi
  node test.js advert 123
    `);
    process.exit(0);
}
