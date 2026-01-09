'use strict';

/**
 * advert service
 */

const { createCoreService } = require('@strapi/strapi').factories;

//module.exports = createCoreService('api::advert.advert');

module.exports = createCoreService('api::advert.advert', ({ strapi }) => ({
  /**
   * Get transactions within a date range with specific conditions
   * @param {string} startDate - Start date (optional, defaults to today)
   * @param {string} endDate - End date (optional, defaults to today)
   * @param {string} dateField - Field to filter by: 'created', 'start', 'end', 'updated' (optional, defaults to 'created')
   * @param {boolean} debug - Enable debug mode to see query details
   * @returns {Promise<Object>} Transactions with summary and debug info
   */
  async getTransactions(startDate, endDate, dateField = 'created', debug = false) {
    try {
      // Determine which date field to use
      const fieldMapping = {
        created: 'createdAt',
        start: 'start_date',
        end: 'end_date',
        updated: 'updatedAt',
      };

      const dateFieldName = fieldMapping[dateField] || 'createdAt';

      // Set up date range
      let dateFilter = {};
      let filterStartDate, filterEndDate;
      
      if (startDate || endDate) {
        // Use provided dates
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date();
        
        // Set to start of day (00:00:00)
        start.setHours(0, 0, 0, 0);
        
        // Set to end of day (23:59:59)
        end.setHours(23, 59, 59, 999);
        
        filterStartDate = start.toISOString().split('T')[0];
        filterEndDate = end.toISOString().split('T')[0];
        
        dateFilter = {
          [dateFieldName]: {
            $gte: start.toISOString(),
            $lte: end.toISOString(),
          },
        };
      } else {
        // Default to today
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        
        filterStartDate = today.toISOString().split('T')[0];
        filterEndDate = today.toISOString().split('T')[0];
        
        dateFilter = {
          [dateFieldName]: {
            $gte: startOfDay.toISOString(),
            $lte: endOfDay.toISOString(),
          },
        };
      }

      // Build filters object
      const filters = {
        ...dateFilter,
        isCanceled: false,
        isPaid: false,
        isActive: false,
      };

      if (debug) {
        console.log('🔍 Debug Info:');
        console.log('Date Field:', dateFieldName);
        console.log('Filters:', JSON.stringify(filters, null, 2));
      }

      // Query adverts with all conditions
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        populate: {
          client: true,
          product: true,
          rate_card: true,
          vgams_user: {
            fields: ['id', 'name', 'email', 'role', 'isActive'],
          },
          invoice: {
            populate: {
              payments: {
                populate: {
                  vgams_user: {
                    fields: ['id', 'name', 'email', 'role'],
                  },
                },
              },
              client: {
                fields: ['id', 'company_name', 'email', 'phone'],
              },
            },
          },
          workflow_history: {
            populate: {
              vgams_users: {
                fields: ['id', 'name', 'email', 'role'],
              },
            },
            sort: 'timestamp:desc',
          },
          comments: {
            sort: 'createdAt:desc',
          },
          created_by_clerk: {
            fields: ['id', 'username', 'email'],
          },
          reviewed_by_editor: {
            fields: ['id', 'username', 'email'],
          },
          approved_by_manager: {
            fields: ['id', 'username', 'email'],
          },
        },
        sort: 'createdAt:desc',
      });

      if (debug) {
        console.log('📊 Results Count:', adverts?.length || 0);
        if (adverts?.length > 0) {
          console.log('First result:', {
            id: adverts[0].id,
            reference: adverts[0].reference_number,
            title: adverts[0].advert_title,
            createdAt: adverts[0].createdAt,
            start_date: adverts[0].start_date,
            isCanceled: adverts[0].isCanceled,
            isPaid: adverts[0].isPaid,
            isActive: adverts[0].isActive,
          });
        }
      }

      // Calculate summary statistics
      const summary = {
        totalTransactions: adverts?.length || 0,
        totalAmount: 0,
        averageAmount: 0,
        byPaymentMethod: {},
        byStatus: {},
        byClient: {},
      };

      if (adverts && adverts.length > 0) {
        // Calculate total amount
        summary.totalAmount = adverts.reduce((sum, advert) => {
          const amount = parseFloat(advert.total_amount || 0);
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);

        // Calculate average
        summary.averageAmount = summary.totalAmount / adverts.length;

        // Group by payment method
        adverts.forEach(advert => {
          if (advert.payment_method) {
            const method = advert.payment_method;
            if (!summary.byPaymentMethod[method]) {
              summary.byPaymentMethod[method] = { count: 0, total: 0 };
            }
            summary.byPaymentMethod[method].count++;
            const amount = parseFloat(advert.total_amount || 0);
            summary.byPaymentMethod[method].total += isNaN(amount) ? 0 : amount;
          }
        });

        // Group by status
        adverts.forEach(advert => {
          if (advert.status) {
            const status = advert.status;
            if (!summary.byStatus[status]) {
              summary.byStatus[status] = { count: 0, total: 0 };
            }
            summary.byStatus[status].count++;
            const amount = parseFloat(advert.total_amount || 0);
            summary.byStatus[status].total += isNaN(amount) ? 0 : amount;
          }
        });

        // Group by client
        adverts.forEach(advert => {
          if (advert.client && advert.client.company_name) {
            const clientName = advert.client.company_name;
            if (!summary.byClient[clientName]) {
              summary.byClient[clientName] = { 
                count: 0, 
                total: 0, 
                clientId: advert.client.id 
              };
            }
            summary.byClient[clientName].count++;
            const amount = parseFloat(advert.total_amount || 0);
            summary.byClient[clientName].total += isNaN(amount) ? 0 : amount;
          }
        });
      }

      const result = {
        transactions: adverts || [],
        summary,
        filters: {
          dateField: dateFieldName,
          startDate: filterStartDate,
          endDate: filterEndDate,
          conditions: {
            isCanceled: false,
            isPaid: false,
            isActive: false,
          },
        },
      };

      if (debug) {
        result.debug = {
          queryFilters: filters,
          resultCount: adverts?.length || 0,
          totalAmount: summary.totalAmount,
        };
      }

      return result;

    } catch (error) {
      console.error('❌ Error in getTransactions:', error);
      throw error;
    }
  },

  /**
   * Get all adverts matching conditions without date filter (for debugging)
   * @returns {Promise<Array>} All matching adverts
   */
  async getAllMatchingTransactions() {
    try {
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isCanceled: false,
          isPaid: false,
          isActive: false,
        },
        populate: {
          client: true,
        },
        fields: ['id', 'reference_number', 'advert_title', 'createdAt', 'start_date', 'end_date', 'total_amount', 'isCanceled', 'isPaid', 'isActive'],
        sort: 'createdAt:desc',
      });

      return adverts || [];
    } catch (error) {
      console.error('❌ Error in getAllMatchingTransactions:', error);
      throw error;
    }
  },
