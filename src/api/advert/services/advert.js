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
   * @returns {Promise<Array>} Array of adverts with relations
   */
  async getTransactions(startDate, endDate, dateField = 'created') {
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
    
    if (startDate || endDate) {
      // Use provided dates
      const start = startDate ? new Date(startDate) : new Date();
      const end = endDate ? new Date(endDate) : new Date();
      
      // Set to start of day (00:00:00)
      start.setHours(0, 0, 0, 0);
      
      // Set to end of day (23:59:59)
      end.setHours(23, 59, 59, 999);
      
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
      
      dateFilter = {
        [dateFieldName]: {
          $gte: startOfDay.toISOString(),
          $lte: endOfDay.toISOString(),
        },
      };
    }

    // Query adverts with all conditions
    const adverts = await strapi.entityService.findMany('api::advert.advert', {
      filters: {
        ...dateFilter,
        isCanceled: false,
        isPaid: false,
        isActive: false,
      },
      populate: {
        client: {
          fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'address', 'payment_terms', 'credit_approved', 'credit_limit', 'is_active', 'clientTin'],
        },
        product: {
          fields: '*',
        },
        rate_card: {
          fields: '*',
        },
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

    // Calculate summary statistics
    const summary = {
      totalTransactions: adverts.length,
      totalAmount: adverts.reduce((sum, advert) => sum + parseFloat(advert.total_amount || 0), 0),
      averageAmount: 0,
      byPaymentMethod: {},
      byStatus: {},
      byClient: {},
    };

    if (adverts.length > 0) {
      summary.averageAmount = summary.totalAmount / adverts.length;

      // Group by payment method
      adverts.forEach(advert => {
        const method = advert.payment_method;
        if (!summary.byPaymentMethod[method]) {
          summary.byPaymentMethod[method] = { count: 0, total: 0 };
        }
        summary.byPaymentMethod[method].count++;
        summary.byPaymentMethod[method].total += parseFloat(advert.total_amount || 0);
      });

      // Group by status
      adverts.forEach(advert => {
        const status = advert.status;
        if (!summary.byStatus[status]) {
          summary.byStatus[status] = { count: 0, total: 0 };
        }
        summary.byStatus[status].count++;
        summary.byStatus[status].total += parseFloat(advert.total_amount || 0);
      });

      // Group by client
      adverts.forEach(advert => {
        if (advert.client) {
          const clientName = advert.client.company_name;
          if (!summary.byClient[clientName]) {
            summary.byClient[clientName] = { count: 0, total: 0, clientId: advert.client.id };
          }
          summary.byClient[clientName].count++;
          summary.byClient[clientName].total += parseFloat(advert.total_amount || 0);
        }
      });
    }

    return {
      transactions: adverts,
      summary,
      filters: {
        dateField: dateFieldName,
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate: endDate || new Date().toISOString().split('T')[0],
        conditions: {
          isCanceled: false,
          isPaid: false,
          isActive: false,
        },
      },
    };
  },
}));
