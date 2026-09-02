const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const axios = require('axios');
const logger = require('./logger');

class BCClient {
  constructor() {
    this.baseURL = process.env.EXTERNAL_API_BC_BASE_URL;
    this.username = process.env.EXTERNAL_API_USERNAME;
    this.password = process.env.EXTERNAL_API_PASSWORD;
    
    if (!this.baseURL || !this.username || !this.password) {
      throw new Error('Missing Business Central configuration in .env');
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      auth: {
        username: this.username,
        password: this.password,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    
    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => response,
      error => {
        if (error.response) {
          logger.error('BC API Error:', {
            status: error.response.status,
            data: error.response.data,
            url: error.config.url
          });
        }
        return Promise.reject(error);
      }
    );
    
    logger.info('BC Client initialized', { baseURL: this.baseURL });
  }
  
  /**
   * Check invoice status for a specific order
   */
  async checkInvoiceStatus(orderNumber) {
    try {
      const endpoint = `/postedSalesInvoices('${encodeURIComponent(orderNumber)}')`;
      logger.debug(`Checking BC invoice for order: ${orderNumber}`);
      
      const response = await this.client.get(endpoint);
      
      return {
        exists: true,
        data: response.data,
        isClosed: response.data.Closed === true,
        invoiceNo: response.data.No,
        amount: response.data.Amount,
        amountIncludingVAT: response.data.Amount_Including_VAT,
        remainingAmount: response.data.Remaining_Amount,
        postingDate: response.data.Posting_Date,
        dueDate: response.data.Due_Date,
        customerNo: response.data.Sell_to_Customer_No,
        customerName: response.data.Sell_to_Customer_Name,
        documentDate: response.data.Document_Date,
        paymentTerms: response.data.Payment_Terms_Code
      };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        logger.debug(`Invoice not found for order: ${orderNumber}`);
        return { exists: false, isClosed: false };
      }
      
      logger.error(`Error checking invoice for ${orderNumber}:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }
  
  /**
   * Check multiple invoices with concurrency control
   */
  async checkMultipleInvoices(orderNumbers, concurrency = 3) {
    const results = {};
    const queue = [...orderNumbers];
    
    const processBatch = async () => {
      const promises = [];
      for (let i = 0; i < concurrency && queue.length > 0; i++) {
        const orderNo = queue.shift();
        promises.push(
          this.checkInvoiceStatus(orderNo)
            .then(result => ({ orderNo, result }))
            .catch(error => ({ orderNo, error: error.message }))
        );
      }
      
      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ orderNo, result, error }) => {
        if (error) {
          results[orderNo] = { exists: false, error };
        } else {
          results[orderNo] = result;
        }
      });
      
      if (queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await processBatch();
      }
    };
    
    await processBatch();
    return results;
  }
}

module.exports = BCClient;
