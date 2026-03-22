const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const axios = require('axios');
const logger = require('./logger');

class StrapiClient {
  constructor() {
    // Build STRAPI_URL from existing HOST and PORT
    const host = process.env.HOST || 'localhost';
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
   * Fetch pending adverts that need invoice checking
   */
  async fetchPendingAdverts(daysBack = 2, limit = 100) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      startDate.setHours(0, 0, 0, 0);
      
      // Use camelCase field names (Strapi API format)
      const params = {
        'filters[bc_reference_number][$notNull]': true,
        'filters[bc_reference_number][$ne]': '',
        'filters[isPaid][$eq]': false,  // Changed from is_paid to isPaid
        'filters[createdAt][$gte]': startDate.toISOString(),
        'populate[invoice]': {
          fields: ['id', 'invoice_number', 'is_paid']
        },
        'populate[client]': {
          fields: ['name', 'client_code']
        },
        'sort[0]': 'createdAt:asc',
        'pagination[pageSize]': limit,
        'pagination[page]': 1
      };
      
      const response = await this.client.get('/api/adverts', { params });
      logger.info(`Fetched ${response.data.data.length} pending adverts`);
      
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching pending adverts:', {
        message: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }
  
  /**
   * Update advert with invoice and payment status
   */
  async updateAdvert(advertId, updateData) {
    try {
      // Ensure field names are in camelCase for Strapi API
      const formattedData = {};
      
      // Map snake_case to camelCase if needed
      Object.keys(updateData).forEach(key => {
        if (key === 'last_bc_check_at') {
          formattedData.lastBcCheckAt = updateData[key];
        } else if (key === 'paid_at') {
          formattedData.paidAt = updateData[key];
        } else {
          formattedData[key] = updateData[key];
        }
      });
      
      const response = await this.client.put(`/api/adverts/${advertId}`, {
        data: formattedData,
      });
      
      logger.debug(`Updated advert ${advertId}`, formattedData);
      return response.data;
    } catch (error) {
      logger.error(`Error updating advert ${advertId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Create or update invoice record
   */
  async upsertInvoice(advertId, invoiceData) {
    try {
      // Check if invoice already exists
      const existingResponse = await this.client.get('/api/invoices', {
        params: {
          'filters[advert][id][$eq]': advertId,
          'pagination[pageSize]': 1,
        },
      });
      
      const existingInvoice = existingResponse.data.data[0];
      
      const payload = {
        data: {
          advert: advertId,
          invoice_number: invoiceData.invoiceNo,
          amount: invoiceData.amount,
          amount_including_vat: invoiceData.amountIncludingVAT,
          remaining_amount: invoiceData.remainingAmount,
          due_date: invoiceData.dueDate,
          posting_date: invoiceData.postingDate,
          is_paid: invoiceData.isClosed,
          last_sync_at: new Date().toISOString(),
          bc_reference: invoiceData.orderNumber
        },
      };
      
      if (existingInvoice) {
        // Update existing invoice
        const response = await this.client.put(
          `/api/invoices/${existingInvoice.id}`,
          payload
        );
        logger.debug(`Updated invoice for advert ${advertId}`);
        return response.data;
      } else {
        // Create new invoice
        const response = await this.client.post('/api/invoices', payload);
        logger.debug(`Created invoice for advert ${advertId}`);
        return response.data;
      }
    } catch (error) {
      logger.error(`Error upserting invoice for advert ${advertId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Add workflow log entry
   */
  async addWorkflowLog(advertId, action, status, metadata = {}) {
    try {
      const response = await this.client.post('/api/workflow-logs', {
        data: {
          advert: advertId,
          action,
          status,
          metadata,
          performed_at: new Date().toISOString(),
        },
      });
      return response.data;
    } catch (error) {
      logger.warn(`Error adding workflow log for advert ${advertId}:`, error.message);
      // Don't throw - workflow logs are non-critical
    }
  }
  
  /**
   * Test connection to Strapi
   */
  async testConnection() {
    try {
      // Simple query to test connection
      const response = await this.client.get('/api/adverts', {
        params: { 'pagination[pageSize]': 1 }
      });
      logger.info('Strapi connection successful');
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
