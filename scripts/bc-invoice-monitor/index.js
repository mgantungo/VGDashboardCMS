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
   * Handles different payment methods:
   * - Cash: Only mark as paid if invoice is closed
   * - Credit/PDC/Bank Transfer/Mobile Money: Mark as paid as soon as invoice exists
   */
  async processAdvert(advert) {
    const advertId = advert.id;
    const bcReferenceNumber = advert.bc_reference_number;
    const advertTitle = advert.advert_title || 'Untitled';
    const paymentMethod = advert.payment_method || 'cash';
    
    if (!bcReferenceNumber) {
      logger.warn(`Advert ${advertId} has no BC reference number, skipping`);
      this.stats.failed++;
      return { success: false, reason: 'no_bc_reference', advertId };
    }
    
    logger.info(`Processing advert ${advertId}: "${advertTitle}" (BC: ${bcReferenceNumber}, Payment Method: ${paymentMethod})`);
    
    try {
      // Check if invoice exists in Business Central
      const invoiceStatus = await this.bcClient.checkInvoiceStatus(bcReferenceNumber);
      
      if (invoiceStatus.exists) {
        logger.info(`✅ Invoice found for ${bcReferenceNumber}: ${invoiceStatus.invoiceNo}`);
        
        // Determine if payment should be considered confirmed based on payment method
        let shouldMarkPaid = false;
        let reason = '';
        
        if (paymentMethod === 'cash') {
          // For cash payments, check if invoice is closed (paid in BC)
          if (invoiceStatus.isClosed === true) {
            shouldMarkPaid = true;
            reason = 'Cash payment - invoice closed';
          } else {
            logger.info(`⏳ Cash payment - Invoice exists but not closed yet for ${bcReferenceNumber}`);
            shouldMarkPaid = false;
          }
        } else {
          // For credit, pdc, bank_transfer, mobile_money - invoice existence is enough
          shouldMarkPaid = true;
          reason = `${paymentMethod} payment - invoice exists`;
        }
        
        if (shouldMarkPaid && !this.dryRun) {
          // Update advert as paid with full BC data
          await this.strapiClient.updateAdvertPayment(
            advertId,
            true,  // isPaid = true
            true,  // isClosed = true
            {
              invoiceNo: invoiceStatus.invoiceNo,
              amount: invoiceStatus.amount,
              amountIncludingVAT: invoiceStatus.amountIncludingVAT,
              remainingAmount: invoiceStatus.remainingAmount,
              dueDate: invoiceStatus.dueDate,
              postingDate: invoiceStatus.postingDate,
              orderNumber: bcReferenceNumber,
              paymentMethod: paymentMethod,
              isClosed: invoiceStatus.isClosed
            }
          );
          
          logger.info(`💰 Advert ${advertId} marked as paid - ${reason}`);
          this.stats.successful++;
          this.stats.paid++;
          
          return {
            success: true,
            advertId,
            bcReferenceNumber,
            isPaid: true,
            invoiceNo: invoiceStatus.invoiceNo,
            amount: invoiceStatus.amountIncludingVAT,
            reason: reason
          };
        } else if (shouldMarkPaid && this.dryRun) {
          logger.info(`[DRY RUN] Would mark advert ${advertId} as paid - ${reason}`);
          this.stats.successful++;
          this.stats.paid++;
          
          return {
            success: true,
            advertId,
            bcReferenceNumber,
            isPaid: true,
            dryRun: true,
            reason: reason
          };
        } else {
          // Invoice exists but not ready to mark as paid (e.g., cash payment not closed)
          logger.info(`⏳ Invoice exists but not ready to mark as paid: ${reason || 'Cash payment pending closure'}`);
          this.stats.successful++;
          this.stats.pending++;
          
          return {
            success: true,
            advertId,
            bcReferenceNumber,
            isPaid: false,
            hasInvoice: true,
            invoiceNo: invoiceStatus.invoiceNo,
            reason: 'Waiting for payment closure'
          };
        }
      } else {
        // No invoice yet
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
      
      // Fetch adverts that need payment check
      const adverts = await this.strapiClient.fetchAdvertsForPaymentCheck(
        this.daysBack,
        this.batchSize
      );
      
      if (adverts.length === 0) {
        logger.info('✓ No adverts need payment check');
        return {
          success: true,
          processed: 0,
          message: 'No adverts to process',
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
