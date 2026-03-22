const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const axios = require('axios');
const logger = require('./logger');

class StrapiClient {
  constructor() {
    // Build STRAPI_URL from existing HOST and PORT
    const host = process.env.LOCALHOST || 'localhost';
    const port = process.env.PORT || 1337;
    this.url = `http://${host}:${port}`;
    
    // Use BC_API_SECRET_KEY for authentication
    this.apiSecret = process.env.BC_API_SECRET_KEY;
    
    if (!this.apiSecret) {
      throw new Error('Missing BC_API_SECRET_KEY in .env');
    }
    
    this.client = axios.create({
      baseURL: this.url,
      headers: {
        'Authorization': `Bearer ${this.apiSecret}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
    
    logger.info(`Strapi client initialized: ${this.url}`);
  }
  
  /**
   * Fetch adverts that need payment check
   * Returns adverts with bc_reference_number where isPaid = false
   */
  async fetchAdvertsForPaymentCheck(daysBack = 2, limit = 100) {
    try {
      const response = await this.client.get('/api/bc/check-payment', {
        params: { daysBack, limit }
      });
      
      logger.info(`Fetched ${response.data.data.length} adverts needing payment check`);
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching adverts for payment check:', {
        message: error.message,
        status: error.response?.status,
        response: error.response?.data
      });
      throw error;
    }
  }
  
  /**
   * Update single advert payment status
   * Only updates isPaid flag
   */
  async updateAdvertPayment(advertId, isPaid) {
    try {
      const response = await this.client.put(`/api/bc/${advertId}/payment`, { isPaid });
      
      logger.debug(`Updated advert ${advertId}: isPaid=${isPaid}`);
      return response.data;
    } catch (error) {
      logger.error(`Error updating advert ${advertId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Bulk update multiple adverts payment status
   */
  async bulkUpdatePayment(updates) {
    try {
      const response = await this.client.post('/api/bc/bulk-payment', { updates });
      return response.data;
    } catch (error) {
      logger.error('Error in bulk update:', error.message);
      throw error;
    }
  }
  
  /**
   * Check payment status by BC reference number
   */
  async checkPaymentByBcReference(bcReference) {
    try {
      const response = await this.client.get(`/api/bc/payment/${encodeURIComponent(bcReference)}`);
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error(`Error checking payment for ${bcReference}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Test connection to Strapi
   */
  async testConnection() {
    try {
      const response = await this.client.get('/api/bc/check-payment', {
        params: { daysBack: 30, limit: 1 }
      });
      
      logger.info('Strapi connection successful');
      logger.info(`Total adverts needing check: ${response.data.meta?.count || 0}`);
      return true;
    } catch (error) {
      logger.error('Strapi connection failed:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      return false;
    }
  }
}

module.exports = StrapiClient;
