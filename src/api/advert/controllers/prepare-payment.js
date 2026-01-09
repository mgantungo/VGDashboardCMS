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
      
      // Simple query - no relations populated
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
        sort: 'createdAt:asc',
        limit: -1 // Get all
      });
      
      console.log(`✅ Found ${transactions.length} transactions`);
      
      // Calculate monetary totals
      const totals = {
        base_price: 0,
        surcharge: 0,
        discount: 0,
        total_amount: 0
      };
      
      transactions.forEach(t => {
        totals.base_price += parseFloat(t.base_price) || 0;
        totals.surcharge += parseFloat(t.surcharge) || 0;
        totals.discount += parseFloat(t.discount) || 0;
        totals.total_amount += parseFloat(t.total_amount) || 0;
      });
      
      // Return simple response
      return {
        success: true,
        count: transactions.length,
        data: transactions,
        totals: totals,
        averages: {
          base_price: transactions.length > 0 ? (totals.base_price / transactions.length).toFixed(2) : 0,
          total_amount: transactions.length > 0 ? (totals.total_amount / transactions.length).toFixed(2) : 0
        },
        dateRange: {
          start: startDateObj.toISOString(),
          end: endDateObj.toISOString()
        }
      };
      
    } catch (err) {
      console.error('❌ Error:', err);
      return ctx.internalServerError('Failed to fetch transactions');
    }
  }

}
