'use strict';

/**
 * bc-sync-monitor controller
 * Simple endpoints for checking and updating payment status from Business Central
 * Only updates isPaid flag
 */

module.exports = {
  
  /**
   * Get adverts that need payment status check
   * Returns adverts with bc_reference_number where isPaid = false
   * Optionally filtered by date range
   */
  async getAdvertsForPaymentCheck(ctx) {
    try {
      const { daysBack = 2, limit = 100 } = ctx.query;
      
      // Calculate date range if daysBack provided
      let startDate = null;
      if (daysBack) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(daysBack));
        startDate.setHours(0, 0, 0, 0);
      }
      
      // Build where clause
      const whereClause = {
        bc_reference_number: {
          $notNull: true,
          $ne: ''
        },
        isPaid: false
      };
      
      // Add date filter if specified
      if (startDate) {
        whereClause.createdAt = {
          $gte: startDate
        };
      }
      
      // Fetch adverts
      const adverts = await strapi.db.query('api::advert.advert').findMany({
        where: whereClause,
        select: ['id', 'bc_reference_number', 'advert_title', 'isPaid', 'createdAt'],
        orderBy: { createdAt: 'asc' },
        limit: parseInt(limit)
      });
      
      return {
        data: adverts,
        meta: {
          count: adverts.length,
          daysBack: daysBack ? parseInt(daysBack) : null,
          startDate: startDate ? startDate.toISOString() : null
        }
      };
    } catch (error) {
      strapi.log.error('Error fetching adverts for payment check:', error);
      return ctx.badRequest('Failed to fetch adverts', { error: error.message });
    }
  },
  
  /**
   * Update advert payment status after checking BC
   * Only updates isPaid flag
   */
  async updatePaymentStatus(ctx) {
    try {
      const { id } = ctx.params;
      const { isPaid } = ctx.request.body;
      
      // Validate required fields
      if (isPaid === undefined) {
        return ctx.badRequest('isPaid is required');
      }
      
      // Check if advert exists
      const existingAdvert = await strapi.db.query('api::advert.advert').findOne({
        where: { id: parseInt(id) },
        select: ['id', 'bc_reference_number', 'isPaid']
      });
      
      if (!existingAdvert) {
        return ctx.notFound(`Advert with id ${id} not found`);
      }
      
      // Only update if status is changing
      if (existingAdvert.isPaid === isPaid) {
        return {
          data: {
            id: existingAdvert.id,
            bc_reference_number: existingAdvert.bc_reference_number,
            isPaid: existingAdvert.isPaid
          },
          message: 'Payment status unchanged'
        };
      }
      
      // Update isPaid only
      const updatedAdvert = await strapi.db.query('api::advert.advert').update({
        where: { id: parseInt(id) },
        data: {
          isPaid: isPaid,
          lastPaymentCheckAt: new Date(),
          // If marking as paid, also set paidAt timestamp
          ...(isPaid === true ? { paidAt: new Date() } : {})
        }
      });
      
      return {
        data: {
          id: updatedAdvert.id,
          bc_reference_number: updatedAdvert.bc_reference_number,
          isPaid: updatedAdvert.isPaid
        },
        message: isPaid ? 'Payment confirmed' : 'Payment status updated'
      };
    } catch (error) {
      strapi.log.error('Error updating payment status:', error);
      return ctx.badRequest('Failed to update payment status', { error: error.message });
    }
  },
  
  /**
   * Bulk update multiple adverts payment status
   * Only updates isPaid flag for multiple adverts at once
   */
  async bulkUpdatePaymentStatus(ctx) {
    try {
      const { updates } = ctx.request.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return ctx.badRequest('updates must be a non-empty array');
      }
      
      const results = [];
      const errors = [];
      
      for (const update of updates) {
        try {
          const { id, isPaid } = update;
          
          if (!id || isPaid === undefined) {
            throw new Error('Missing required fields: id and isPaid');
          }
          
          // Check if advert exists
          const existingAdvert = await strapi.db.query('api::advert.advert').findOne({
            where: { id: parseInt(id) },
            select: ['id', 'bc_reference_number', 'isPaid']
          });
          
          if (!existingAdvert) {
            throw new Error(`Advert ${id} not found`);
          }
          
          // Only update if status is changing
          if (existingAdvert.isPaid === isPaid) {
            results.push({
              id,
              success: true,
              isPaid: existingAdvert.isPaid,
              changed: false,
              bc_reference: existingAdvert.bc_reference_number
            });
            continue;
          }
          
          // Update isPaid
          const updated = await strapi.db.query('api::advert.advert').update({
            where: { id: parseInt(id) },
            data: {
              isPaid: isPaid,
              lastPaymentCheckAt: new Date(),
              ...(isPaid === true ? { paidAt: new Date() } : {})
            }
          });
          
          results.push({
            id,
            success: true,
            changed: true,
            isPaid: updated.isPaid,
            bc_reference: existingAdvert.bc_reference_number
          });
          
        } catch (error) {
          errors.push({
            id: update.id,
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        data: {
          successful: results,
          failed: errors
        },
        meta: {
          total: updates.length,
          successCount: results.length,
          errorCount: errors.length,
          changedCount: results.filter(r => r.changed).length
        }
      };
    } catch (error) {
      strapi.log.error('Error in bulk update:', error);
      return ctx.badRequest('Failed to bulk update payment status', { error: error.message });
    }
  },
  
  /**
   * Check payment status by BC reference number
   * Simple endpoint to verify if an advert is paid by its BC reference
   */
  async checkPaymentByBcReference(ctx) {
    try {
      const { reference } = ctx.params;
      
      const advert = await strapi.db.query('api::advert.advert').findOne({
        where: { bc_reference_number: reference },
        select: ['id', 'bc_reference_number', 'isPaid', 'paidAt']
      });
      
      if (!advert) {
        return ctx.notFound(`Advert with BC reference ${reference} not found`);
      }
      
      return {
        data: {
          bc_reference_number: advert.bc_reference_number,
          isPaid: advert.isPaid,
          paidAt: advert.paidAt
        }
      };
    } catch (error) {
      strapi.log.error('Error checking payment by BC reference:', error);
      return ctx.badRequest('Failed to check payment status', { error: error.message });
    }
  }
};
