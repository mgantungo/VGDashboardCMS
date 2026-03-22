const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const logger = require('./logger');
const BCClient = require('./bc-client');
const StrapiClient = require('./strapi-client');

class BCInvoiceMonitor {
  constructor() {
    this.bcClient = new BCClient();
    this.strapiClient = new StrapiClient();
    
    // Configuration from env with defaults
    this.daysBack = parseInt(process.env.MONITOR_DAYS_BACK) || 2;
    this.batchSize = parseInt(process.env.MONITOR_BATCH_SIZE) || 50;
    this.logLevel = process.env.LOG_LEVEL || 'info';
    this.dryRun = process.env.DRY_RUN === 'true';
    
    // Statistics
    this.stats = {
      processed: 0,
      successful: 0,
      failed: 0,
      paid: 0,
      pending: 0,
      errors: []
    };
    
    this.validateConfig();
  }
  
  validateConfig() {
    const required = [
      'EXTERNAL_API_BC_BASE_URL',
      'EXTERNAL_API_USERNAME',
      'EXTERNAL_API_PASSWORD',
      'BC_API_SECRET_KEY'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    logger.info('Configuration validated successfully');
    if (this.dryRun) {
      logger.warn('⚠️ DRY RUN MODE - No changes will be saved');
    }
  }
  
  /**
   * Process a single advert
   */
  async processAdvert(advert) {
    const advertId = advert.id;
    const bcReferenceNumber = advert.attributes.bc_reference_number;
    const advertTitle = advert.attributes.advert_title || 'Untitled';
    
    if (!bcReferenceNumber) {
      logger.warn(`Advert ${advertId} has no BC reference number, skipping`);
      this.stats.failed++;
      return { success: false, reason: 'no_bc_reference' };
    }
    
    logger.info(`Processing advert ${advertId}: "${advertTitle}" (BC: ${bcReferenceNumber})`);
    
    try {
      // Check invoice status in Business Central
      const invoiceStatus = await this.bcClient.checkInvoiceStatus(bcReferenceNumber);
      
      if (invoiceStatus.exists) {
        logger.info(`Invoice found for ${bcReferenceNumber}: ${invoiceStatus.invoiceNo} - Paid: ${invoiceStatus.isClosed}`);
        
        if (!this.dryRun) {
          // Update payment status
          const updateData = {
            last_bc_check_at: new Date().toISOString(),
            isPaid: invoiceStatus.isClosed,
            isClosed: invoiceStatus.isClosed,
          };
          
          if (invoiceStatus.isClosed && !advert.attributes.isPaid) {
            updateData.paid_at = new Date().toISOString();
            logger.info(`💰 Payment detected for advert ${advertId}`);
          }
          
          // Update advert
          await this.strapiClient.updateAdvert(advertId, updateData);
          
          // Create/update invoice record
          await this.strapiClient.upsertInvoice(advertId, {
            ...invoiceStatus,
            orderNumber: bcReferenceNumber
          });
          
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
                checked_at: new Date().toISOString()
              }
            );
          }
        } else {
          logger.info(`[DRY RUN] Would update advert ${advertId} - Paid: ${invoiceStatus.isClosed}`);
        }
        
        this.stats.successful++;
        if (invoiceStatus.isClosed) {
          this.stats.paid++;
        } else {
          this.stats.pending++;
        }
        
        return {
          success: true,
          advertId,
          bcReferenceNumber,
          isPaid: invoiceStatus.isClosed,
          hasInvoice: true,
          invoiceNo: invoiceStatus.invoiceNo
        };
      } else {
        // No invoice yet, just update check timestamp
        if (!this.dryRun) {
          await this.strapiClient.updateAdvert(advertId, {
            last_bc_check_at: new Date().toISOString(),
          });
        } else {
          logger.info(`[DRY RUN] Would update check timestamp for advert ${advertId}`);
        }
        
        logger.info(`⏳ No invoice yet for advert ${advertId}`);
        this.stats.successful++;
        this.stats.pending++;
        
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
      this.stats.failed++;
      this.stats.errors.push({
        advertId,
        bcReferenceNumber,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      // Log failure in workflow
      if (!this.dryRun) {
        await this.strapiClient.addWorkflowLog(
          advertId,
          'bc_check_failed',
          'failed',
          { 
            error: error.message, 
            bc_reference: bcReferenceNumber
          }
        ).catch(e => logger.warn('Could not add failure log:', e.message));
      }
      
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
    if (this.dryRun) logger.warn('🔧 DRY RUN MODE ENABLED');
    
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
          stats: this.stats
        };
      }
      
      logger.info(`Found ${adverts.length} adverts to process`);
      
      // Process adverts sequentially to avoid rate limiting
      for (let i = 0; i < adverts.length; i++) {
        await this.processAdvert(adverts[i]);
        this.stats.processed++;
        
        // Small delay between requests to be kind to BC API
        if (i < adverts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Generate summary
      logger.info('=' .repeat(60));
      logger.info(`📊 MONITORING SUMMARY (${duration}s):`);
      logger.info(`   Total processed: ${this.stats.processed}`);
      logger.info(`   ✅ Successful: ${this.stats.successful}`);
      logger.info(`   ❌ Failed: ${this.stats.failed}`);
      logger.info(`   💰 Paid invoices found: ${this.stats.paid}`);
      logger.info(`   ⏳ Pending invoices: ${this.stats.pending}`);
      
      if (this.stats.errors.length > 0) {
        logger.warn(`   ⚠️ Errors: ${this.stats.errors.length}`);
        this.stats.errors.slice(0, 5).forEach(err => {
          logger.warn(`      - Advert ${err.advertId}: ${err.error}`);
        });
      }
      
      logger.info('=' .repeat(60));
      
      return {
        success: true,
        processed: this.stats.processed,
        successful: this.stats.successful,
        failed: this.stats.failed,
        paid: this.stats.paid,
        pending: this.stats.pending,
        duration,
        errors: this.stats.errors
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
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Monitoring failed:', error);
      process.exit(1);
    });
}

module.exports = BCInvoiceMonitor;
