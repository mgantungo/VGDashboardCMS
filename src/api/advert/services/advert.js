'use strict';

/**
 * advert service
 */

const { createCoreService } = require('@strapi/strapi').factories;

//module.exports = createCoreService('api::advert.advert');

module.exports = createCoreService('api::advert.advert', ({ strapi }) => ({
  /**
   * Get transactions within a date range with specific conditions
   * @param {string} startDate - Start date (optional)
   * @param {string} endDate - End date (optional)
   * @returns {Promise<Array>} Array of adverts with relations
   */
  async getTransactions(startDate, endDate) {
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
        createdAt: {
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
        createdAt: {
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
          fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'payment_terms', 'credit_approved'],
        },
        product: {
          fields: '*',
        },
        rate_card: {
          fields: '*',
        },
        vgams_user: {
          fields: ['id', 'name', 'email', 'role'],
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
              fields: ['id', 'company_name', 'email'],
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

    return adverts;
  },
}));
