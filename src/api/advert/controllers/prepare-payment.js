'use strict';

module.exports = {

  async getFilteredTransactions(ctx) {
    try {
      // Get dates from request body (not query params)
      const { startDate, endDate } = ctx.request.body;
      
      console.log('📊 getFilteredTransactions called with:', { startDate, endDate });
      
      // Validate required fields
      if (!startDate || !endDate) {
        return ctx.badRequest('Both startDate and endDate are required in the request body');
      }
      
      // Parse dates
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // Validate dates
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return ctx.badRequest('Invalid date format. Use YYYY-MM-DD');
      }
      
      // Set time to start and end of day
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj.setHours(23, 59, 59, 999);
      
      // Build filter - EXACTLY as requested
      const filters = {
        createdAt: {
          $gte: startDateObj.toISOString(),
          $lte: endDateObj.toISOString()
        },
        isActive: false,
        isPaid: false,
        isCanceled: false
      };
      
      console.log('🔍 Filters:', filters);
      
      // Query with specific relations populated
      const transactions = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        fields: [
          'id',
          'reference_number',
          'advert_title',
          'ad_size',
          'ad_type',
          'frequency',
          'start_date',
          'end_date',
          'base_price',
          'surcharge',
          'discount',
          'total_amount',
          'payment_method',
          'special_instructions',
          'status',
          'createdAt',
          'updatedAt'
        ],
        populate: {
          client: {
            fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'clientTin']
          },
          product: {
            fields: ['id', 'product_name', 'description'],
            populate: {
              product_category: {
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
        limit: -1 // Get all
      });
      
      console.log(`✅ Found ${transactions.length} transactions`);
      
      // Transform data to include nested relations
      const formattedTransactions = transactions.map(transaction => {
        // Extract product category from product
        let productCategory = null;
        if (transaction.product && transaction.product.product_category) {
          productCategory = {
            id: transaction.product.product_category.id,
            category_name: transaction.product.product_category.category_name,
            description: transaction.product.product_category.description
          };
        }
        
        return {
          id: transaction.id,
          reference_number: transaction.reference_number,
          advert_title: transaction.advert_title,
          // Advert details
          ad_size: transaction.ad_size,
          ad_type: transaction.ad_type,
          frequency: transaction.frequency,
          start_date: transaction.start_date,
          end_date: transaction.end_date,
          // Monetary fields
          base_price: transaction.base_price,
          surcharge: transaction.surcharge,
          discount: transaction.discount,
          total_amount: transaction.total_amount,
          // Payment info
          payment_method: transaction.payment_method,
          special_instructions: transaction.special_instructions,
          // Status
          status: transaction.status,
          // Timestamps
          createdAt: transaction.createdAt,
          updatedAt: transaction.updatedAt,
          // Relations
          client: transaction.client ? {
            id: transaction.client.id,
            company_name: transaction.client.company_name,
            contact_person: transaction.client.contact_person,
            email: transaction.client.email,
            phone: transaction.client.phone,
            clientTin: transaction.client.clientTin
          } : null,
          product: transaction.product ? {
            id: transaction.product.id,
            product_name: transaction.product.product_name,
            description: transaction.product.description,
            category: productCategory // Nested product category
          } : null,
          rate_card: transaction.rate_card ? {
            id: transaction.rate_card.id,
            name: transaction.rate_card.name,
            ad_type: transaction.rate_card.ad_type,
            price_fc: transaction.rate_card.price_fc,
            price_bw: transaction.rate_card.price_bw,
            description: transaction.rate_card.description
          } : null,
          vgams_user: transaction.vgams_user ? {
            id: transaction.vgams_user.id,
            name: transaction.vgams_user.name,
            email: transaction.vgams_user.email,
            role: transaction.vgams_user.role
          } : null
        };
      });
      
      // Calculate monetary totals
      const totals = {
        base_price: 0,
        surcharge: 0,
        discount: 0,
        total_amount: 0,
        transaction_count: formattedTransactions.length
      };
      
      // Additional statistics
      const stats = {
        unique_clients: new Set(),
        unique_products: new Set(),
        unique_categories: new Set(),
        payment_methods: {},
        status_counts: {}
      };
      
      formattedTransactions.forEach(t => {
        // Monetary totals
        totals.base_price += parseFloat(t.base_price) || 0;
        totals.surcharge += parseFloat(t.surcharge) || 0;
        totals.discount += parseFloat(t.discount) || 0;
        totals.total_amount += parseFloat(t.total_amount) || 0;
        
        // Client stats
        if (t.client) stats.unique_clients.add(t.client.id);
        
        // Product stats
        if (t.product) {
          stats.unique_products.add(t.product.id);
          if (t.product.category) stats.unique_categories.add(t.product.category.id);
        }
        
        // Payment method stats
        if (t.payment_method) {
          stats.payment_methods[t.payment_method] = (stats.payment_methods[t.payment_method] || 0) + 1;
        }
        
        // Status stats
        if (t.status) {
          stats.status_counts[t.status] = (stats.status_counts[t.status] || 0) + 1;
        }
      });
      
      // Return response with all relations
      return {
        success: true,
        count: formattedTransactions.length,
        data: formattedTransactions,
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
          base_price: formattedTransactions.length > 0 ? (totals.base_price / formattedTransactions.length).toFixed(2) : 0,
          total_amount: formattedTransactions.length > 0 ? (totals.total_amount / formattedTransactions.length).toFixed(2) : 0
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
      return ctx.internalServerError('Failed to fetch transactions');
    }
  }

}
