'use strict';

module.exports = {

  async getFilteredTransactions(ctx) {
    try {
      // Get dates from request body
      const { startDate, endDate } = ctx.request.body;
      
      console.log('📊 getFilteredTransactions called with:', { startDate, endDate });
      
      // Validate
      if (!startDate || !endDate) {
        return ctx.badRequest('Both startDate and endDate are required');
      }
      
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return ctx.badRequest('Invalid date format. Use YYYY-MM-DD');
      }
      
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj.setHours(23, 59, 59, 999);
      
      // Build filter
      const filters = {
        createdAt: {
          $gte: startDateObj.toISOString(),
          $lte: endDateObj.toISOString()
        },
        isActive: false,
        isPaid: false,
        isCanceled: false
      };
      
      console.log('🔍 Filters:', JSON.stringify(filters, null, 2));
      
      // Single query with all relations - CORRECT category field name
      const transactions = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        fields: [
          'id', 'reference_number', 'advert_title', 'ad_size', 'ad_type', 'frequency',
          'start_date', 'end_date', 'base_price', 'surcharge', 'discount', 'total_amount',
          'payment_method', 'special_instructions', 'status', 'createdAt', 'updatedAt'
        ],
        populate: {
          client: {
            fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'clientTin']
          },
          product: {
            fields: ['id', 'product_name', 'description'],
            populate: {
              category: {
                fields: ['id', 'category_name', 'description']
              }
            }
          },
          rate_card: {
            fields: ['id', 'ad_type', 'price_fc', 'price_bw', 'description']
          },
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          }
        },
        sort: 'createdAt:asc',
        limit: -1
      });
      
      console.log(`✅ Found ${transactions.length} transactions`);
      
      // Calculate totals
      const totals = {
        base_price: 0,
        surcharge: 0,
        discount: 0,
        total_amount: 0,
        transaction_count: transactions.length
      };
      
      // Additional statistics
      const stats = {
        unique_clients: new Set(),
        unique_products: new Set(),
        unique_categories: new Set(),
        payment_methods: {},
        status_counts: {}
      };
      
      transactions.forEach(transaction => {
        // Monetary totals
        totals.base_price += parseFloat(transaction.base_price) || 0;
        totals.surcharge += parseFloat(transaction.surcharge) || 0;
        totals.discount += parseFloat(transaction.discount) || 0;
        totals.total_amount += parseFloat(transaction.total_amount) || 0;
        
        // Client stats
        if (transaction.client) stats.unique_clients.add(transaction.client.id);
        
        // Product stats
        if (transaction.product) {
          stats.unique_products.add(transaction.product.id);
          if (transaction.product.category) {
            stats.unique_categories.add(transaction.product.category.id);
          }
        }
        
        // Payment method stats
        if (transaction.payment_method) {
          stats.payment_methods[transaction.payment_method] = 
            (stats.payment_methods[transaction.payment_method] || 0) + 1;
        }
        
        // Status stats
        if (transaction.status) {
          stats.status_counts[transaction.status] = 
            (stats.status_counts[transaction.status] || 0) + 1;
        }
      });
      
      // Return response
      return {
        success: true,
        count: transactions.length,
        data: transactions,
        totals: {
          monetary: {
            base_price: totals.base_price,
            surcharge: totals.surcharge,
            discount: totals.discount,
            total_amount: totals.total_amount
          },
          transaction_count: totals.transaction_count
        },
        averages: {
          base_price: transactions.length > 0 ? 
            (totals.base_price / transactions.length).toFixed(2) : 0,
          total_amount: transactions.length > 0 ? 
            (totals.total_amount / transactions.length).toFixed(2) : 0
        },
        statistics: {
          unique_clients: stats.unique_clients.size,
          unique_products: stats.unique_products.size,
          unique_categories: stats.unique_categories.size,
          payment_method_distribution: stats.payment_methods,
          status_distribution: stats.status_counts
        },
        dateRange: {
          start: startDateObj.toISOString(),
          end: endDateObj.toISOString(),
          human_readable: `${startDate} to ${endDate}`
        }
      };
      
    } catch (err) {
      console.error('❌ Error in getFilteredTransactions:', err);
      return ctx.internalServerError(`Failed to fetch transactions: ${err.message}`);
    }
  }

}
