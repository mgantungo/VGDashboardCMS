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
      timeout: 30000, // 30 seconds timeout
    });
  }
  
  /**
   * Check invoice status for a specific order
   */
  async checkInvoiceStatus(orderNumber) {
    try {
      const endpoint = `/postedSalesInvoices('${orderNumber}')`;
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
      };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        logger.debug(`Invoice not found for order: ${orderNumber}`);
        return { exists: false, isClosed: false };
      }
      
      logger.error(`Error checking invoice for ${orderNumber}:`, {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }
  
  /**
   * Get multiple invoice statuses in batch (if BC API supports batch)
   */
  async checkMultipleInvoices(orderNumbers) {
    // BC API might not support batch requests, so we'll do individual requests
    // with concurrency control
    const results = {};
    const concurrency = 5;
    
    for (let i = 0; i < orderNumbers.length; i += concurrency) {
      const batch = orderNumbers.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(orderNo => this.checkInvoiceStatus(orderNo))
      );
      
      batch.forEach((orderNo, index) => {
        const result = batchResults[index];
        results[orderNo] = result.status === 'fulfilled' 
          ? result.value 
          : { exists: false, error: result.reason?.message };
      });
    }
    
    return results;
  }
}

module.exports = BCClient;
