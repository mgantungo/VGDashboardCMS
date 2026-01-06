// src/api/rate-card/controllers/rate-card.js
'use strict';

module.exports = {

  async bulkUpdateExpiryDates(ctx) {
    try {
      const { expiryDate, filters = {} } = ctx.request.body;
      
      // Validate required fields
      if (!expiryDate) {
        return ctx.badRequest('expiryDate is required in request body');
      }
      
      // Validate date format
      const newExpiryDate = new Date(expiryDate);
      if (isNaN(newExpiryDate.getTime())) {
        return ctx.badRequest('Invalid expiryDate format. Use YYYY-MM-DD');
      }
      
      // Build query filters
      const queryFilters = {};
      
      // Optionally filter by product
      if (filters.productId) {
        queryFilters.product = { id: filters.productId };
      }
      
      // Optionally only update NULL expiry dates
      if (filters.onlyNullExpiry) {
        queryFilters.$or = [
          { expiry_date: null },
          { expiry_date: { $null: true } }
        ];
      }
      
      // Optionally only update expired rate cards
      if (filters.onlyExpired) {
        const today = new Date();
        queryFilters.$or = [
          { expiry_date: { $lt: today } },
          { expiry_date: null },
          { expiry_date: { $null: true } }
        ];
      }
      
      console.log('Updating rate cards with filters:', JSON.stringify(queryFilters));
      
      // Get rate cards to update
      const rateCards = await strapi.entityService.findMany(
        'api::rate-card.rate-card',
        {
          filters: queryFilters,
          limit: -1 // Get all records
        }
      );
      
      console.log(`Found ${rateCards.length} rate cards to update`);
      
      if (rateCards.length === 0) {
        return ctx.send({
          message: 'No rate cards found matching the criteria',
          expiryDate: newExpiryDate.toISOString().split('T')[0],
          updatedCount: 0
        });
      }
      
      // Update each rate card
      let successCount = 0;
      let failedCount = 0;
      const failedIds = [];
      
      for (const rateCard of rateCards) {
        try {
          await strapi.entityService.update(
            'api::rate-card.rate-card',
            rateCard.id,
            {
              data: {
                expiry_date: newExpiryDate
              }
            }
          );
          successCount++;
          
          // Log progress every 100 updates
          if (successCount % 100 === 0) {
            console.log(`Updated ${successCount} rate cards...`);
          }
        } catch (error) {
          failedCount++;
          failedIds.push({ id: rateCard.id, error: error.message });
          console.error(`Failed to update rate card ${rateCard.id}:`, error.message);
        }
      }
      
      return ctx.send({
        message: `Successfully updated ${successCount} rate cards`,
        expiryDate: newExpiryDate.toISOString().split('T')[0],
        totalFound: rateCards.length,
        successCount,
        failedCount,
        failedIds: failedCount > 0 ? failedIds : undefined
      });
      
    } catch (err) {
      console.error('Error in bulkUpdateExpiryDates:', err);
      return ctx.throw(500, err);
    }
  },

  // Simple method to update all NULL expiry dates
  async updateNullExpiryDates(ctx) {
    try {
      const { expiryDate } = ctx.request.body;
      
      if (!expiryDate) {
        return ctx.badRequest('expiryDate is required in request body');
      }
      
      const newExpiryDate = new Date(expiryDate);
      if (isNaN(newExpiryDate.getTime())) {
        return ctx.badRequest('Invalid expiryDate format. Use YYYY-MM-DD');
      }
      
      // Find rate cards with NULL expiry_date
      const rateCards = await strapi.entityService.findMany(
        'api::rate-card.rate-card',
        {
          filters: {
            $or: [
              { expiry_date: null },
              { expiry_date: { $null: true } }
            ]
          },
          limit: -1
        }
      );
      
      console.log(`Found ${rateCards.length} rate cards with NULL expiry date`);
      
      if (rateCards.length === 0) {
        return ctx.send({
          message: 'No rate cards found with NULL expiry date',
          expiryDate: newExpiryDate.toISOString().split('T')[0]
        });
      }
      
      // Update all NULL expiry dates
      for (const rateCard of rateCards) {
        await strapi.entityService.update(
          'api::rate-card.rate-card',
          rateCard.id,
          {
            data: {
              expiry_date: newExpiryDate
            }
          }
        );
      }
      
      return ctx.send({
        message: `Updated ${rateCards.length} rate cards with NULL expiry date`,
        expiryDate: newExpiryDate.toISOString().split('T')[0],
        updatedCount: rateCards.length
      });
      
    } catch (err) {
      console.error('Error in updateNullExpiryDates:', err);
      return ctx.throw(500, err);
    }
  }
};
