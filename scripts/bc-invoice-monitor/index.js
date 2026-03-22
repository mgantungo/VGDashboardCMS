const logger = require('./logger');
const BCClient = require('./bc-client');
const StrapiClient = require('./strapi-client');

class BCInvoiceMonitor {
  constructor() {
    this.bcClient = new BCClient();
    this.strapiClient = new StrapiClient();
    
    // Use existing env variables with fallbacks
    this.daysBack = parseInt(process.env.MONITOR_DAYS_BACK) || 2;
    this.batchSize = parseInt(process.env.MONITOR_BATCH_SIZE) || 50;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    
    // Validate configuration
    this.validateConfig();
  }
  
  validateConfig() {
    const required = ['EXTERNAL_API_BC_BASE_URL', 'EXTERNAL_API_USERNAME', 'EXTERNAL_API_PASSWORD', 'API_SECRET_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    logger.info('Configuration validated successfully');
  }
  
  /**
   * Process a single advert
   */
  async processAdvert(advert) {
    const advertId = advert.id;
    const bcReferenceNumber = advert.attributes.bc_reference_number;
    const advertTitle = advert.attributes.advert_title;
    
    if (!bcReferenceNumber) {
      logger.warn(`Advert ${advertId} has no BC reference number, skipping`);
      return { success: false, reason: 'no_bc_reference' };
    }
    
    logger.info(`Processing advert ${advertId}: ${advertTitle} (BC: ${bcReferenceNumber})`);
    
    try {
      // Check invoice status in Business Central
      const invoiceStatus = await this.bcClient.checkInvoiceStatus(bcReferenceNumber);
      
      const updateData = {
        last_bc_check_at: new Date().toISOString(),
      };
      
      if (invoiceStatus.exists) {
        // Update payment status
        updateData.isPaid = invoiceStatus.isClosed;
        updateData.isClosed = invoiceStatus.isClosed;
        
        if (invoiceStatus.isClosed) {
          updateData.paid_at = new Date().toISOString();
        }
        
        // Update advert
        await this.strapiClient.updateAdvert(advertId, updateData);
        
        // Create/update invoice record
        await this.strapiClient.upsertInvoice(advertId, invoiceStatus);
        
        // Add workflow log if payment is completed
        if (invoiceStatus.isClosed) {
          await this.strapiClient.addWorkflowLog(
            advertId,
            'payment_received',
            'completed',
            {
              invoice_no: invoiceStatus.invoiceNo,
              amount: invoiceStatus.amountIncludingVAT,
              bc_reference: bcReferenceNumber,
            }
          );
        }
        
        logger.info(`✓ Advert ${advertId} updated - Paid: ${invoiceStatus.isClosed}`);
        
        return {
          success: true,
          advertId,
          bcReferenceNumber,
          isPaid: invoiceStatus.isClosed,
          hasInvoice: true,
        };
      } else {
        // No invoice yet, just update check timestamp
        await this.strapiClient.updateAdvert(advertId, updateData);
        logger.info(`⏳ No invoice yet for advert ${advertId}`);
        
        return {
          success: true,
          advertId,
          bcReferenceNumber,
          isPaid: false,
          hasInvoice: false,
        };
      }
    } catch (error) {
      logger.error(`✗ Failed to process advert ${advertId}:`, error.message);
      
      // Log failure in workflow
      await this.strapiClient.addWorkflowLog(
        advertId,
        'bc_check_failed',
        'failed',
        { error: error.message, bc_reference: bcReferenceNumber }
      ).catch(e => logger.warn('Could not add failure log:', e.message));
      
      return {
        success: false,
        advertId,
        bcReferenceNumber,
        error: error.message,
      };
    }
  }
  
  /**
   * Run the monitoring process
   */
  async run() {
    const startTime = Date.now();
    logger.info('🚀 Starting Business Central invoice monitoring...');
    logger.info(`Configuration: ${this.daysBack} days back, batch size: ${this.batchSize}`);
    
    try {
      // Test Strapi connection first
      const isConnected = await this.strapiClient.testConnection();
      if (!isConnected) {
        throw new Error('Cannot connect to Strapi API');
      }
      
      // Fetch pending adverts
      const adverts = await this.strapiClient.fetchPendingAdverts(
        this.daysBack,
        this.batchSize
      );
      
      if (adverts.length === 0) {
        logger.info('✓ No pending adverts to process');
        return {
          success: true,
          processed: 0,
          message: 'No pending adverts',
        };
      }
      
      logger.info(`Found ${adverts.length} adverts to process`);
      
      // Process adverts sequentially to avoid rate limiting
      const results = [];
      for (let i = 0; i < adverts.length; i++) {
        const result = await this.processAdvert(adverts[i]);
        results.push(result);
        
        // Small delay between requests to be kind to BC API
        if (i < adverts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Generate summary
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      const paid = results.filter(r => r.isPaid === true).length;
      const pending = results.filter(r => r.success && !r.isPaid).length;
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      logger.info('=' .repeat(50));
      logger.info(`📊 Monitoring Summary (${duration}s):`);
      logger.info(`   Total processed: ${results.length}`);
      logger.info(`   Successful: ${successful}`);
      logger.info(`   Failed: ${failed}`);
      logger.info(`   Paid invoices found: ${paid}`);
      logger.info(`   Pending invoices: ${pending}`);
      logger.info('=' .repeat(50));
      
      return {
        success: true,
        processed: results.length,
        successful,
        failed,
        paid,
        pending,
        duration,
      };
    } catch (error) {
      logger.error('💥 Fatal error in monitoring process:', error);
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  const monitor = new BCInvoiceMonitor();
  monitor.run()
    .then(result => {
      logger.info('Monitoring completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Monitoring failed:', error);
      process.exit(1);
    });
}

module.exports = BCInvoiceMonitor;
