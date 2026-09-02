'use strict';

/**
 * bc-sync-monitor controller
 * Handles automatic payment updates from Business Central
 * Creates invoice and payment records when invoice exists and conditions are met
 * - Cash payments: Only when invoice is closed
 * - Other payments: As soon as invoice exists
 */

module.exports = {

  /**
   * Get adverts that need payment status check
   * Returns adverts with bc_reference_number where isPaid = false
   */
  async getAdvertsForPaymentCheck(ctx) {
    try {
      const { daysBack = 2, limit = 100 } = ctx.query;
      
      let startDate = null;
      if (daysBack) {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(daysBack));
        startDate.setHours(0, 0, 0, 0);
      }
      
      const whereClause = {
        bc_reference_number: {
          $notNull: true,
          $ne: ''
        },
        isPaid: false
      };
      
      if (startDate) {
        whereClause.createdAt = {
          $gte: startDate
        };
      }
      
      // Fetch adverts with direct fields only, populate relations separately
      const adverts = await strapi.db.query('api::advert.advert').findMany({
        where: whereClause,
        select: ['id', 'bc_reference_number', 'advert_title', 'isPaid', 'createdAt', 'total_amount', 'reference_number', 'payment_method'],
        populate: {
          client: {
            select: ['id', 'company_name']
          },
          vgams_user: {
            select: ['id', 'name', 'email']
          }
        },
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
   * Update advert payment status from Business Central
   * Creates invoice and payment records when conditions are met
   */
  async updatePaymentStatus(ctx) {
    try {
      const { id } = ctx.params;
      const { isPaid, invoiceData } = ctx.request.body;
      
      if (isPaid === undefined) {
        return ctx.badRequest('isPaid is required');
      }
      
      // Check if advert exists with relations
      const existingAdvert = await strapi.db.query('api::advert.advert').findOne({
        where: { id: parseInt(id) },
        populate: {
          client: true,
          invoice: true,
          vgams_user: true
        }
      });
      
      if (!existingAdvert) {
        return ctx.notFound(`Advert with id ${id} not found`);
      }
      
      // Only update if status is changing to paid
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
      
      // If marking as paid, create invoice and payment records
      let invoiceRecord = null;
      let paymentRecord = null;
      
      if (isPaid === true && existingAdvert.isPaid === false) {
        // Create or update invoice record from BC data
        invoiceRecord = await upsertInvoiceFromBC(existingAdvert, invoiceData);
        
        // Determine payment method and status from BC data
        const paymentMethod = invoiceData?.paymentMethod || existingAdvert.payment_method || 'bank_transfer';
        const isClosed = invoiceData?.isClosed || false;
        
        // Only create payment record for cash if closed, for others always create
        if (paymentMethod === 'cash' && !isClosed) {
          strapi.log.info(`Cash payment not closed yet for advert ${id}, skipping payment record`);
        } else {
          paymentRecord = await createPaymentFromBC(existingAdvert, invoiceData, invoiceRecord, paymentMethod, isClosed);
        }
        
        strapi.log.info(`✅ BC Invoice processed for advert ${id}: Invoice ${invoiceRecord?.invoice_number}, Payment ${paymentRecord?.id || 'pending'}, Method: ${paymentMethod}`);
      }
      
      // Update advert - mark as paid
      const updateData = {
        isPaid: isPaid,
        lastPaymentCheckAt: new Date()
      };
      
      if (isPaid === true) {
        updateData.paid_at = new Date();
        updateData.isActive = true;
        if (existingAdvert.status === 'draft') {
          updateData.status = 'published';
        }
      }
      
      const updatedAdvert = await strapi.db.query('api::advert.advert').update({
        where: { id: parseInt(id) },
        data: updateData
      });
      
      return {
        data: {
          id: updatedAdvert.id,
          bc_reference_number: updatedAdvert.bc_reference_number,
          isPaid: updatedAdvert.isPaid,
          invoice: invoiceRecord,
          payment: paymentRecord
        },
        message: isPaid ? 'Invoice confirmed - Advert marked as paid' : 'Payment status updated'
      };
    } catch (error) {
      strapi.log.error('Error updating payment status:', error);
      return ctx.badRequest('Failed to update payment status', { error: error.message });
    }
  },
  
  /**
   * Bulk update multiple adverts payment status
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
          const { id, isPaid, invoiceData } = update;
          
          if (!id || isPaid === undefined) {
            throw new Error('Missing required fields: id and isPaid');
          }
          
          // Process each advert
          const existingAdvert = await strapi.db.query('api::advert.advert').findOne({
            where: { id: parseInt(id) },
            populate: { client: true, vgams_user: true }
          });
          
          if (!existingAdvert) {
            throw new Error(`Advert ${id} not found`);
          }
          
          if (existingAdvert.isPaid === isPaid) {
            results.push({
              id,
              success: true,
              changed: false,
              isPaid: existingAdvert.isPaid,
              bc_reference: existingAdvert.bc_reference_number
            });
            continue;
          }
          
          let invoiceRecord = null;
          let paymentRecord = null;
          
          if (isPaid === true && existingAdvert.isPaid === false) {
            invoiceRecord = await upsertInvoiceFromBC(existingAdvert, invoiceData);
            
            const paymentMethod = invoiceData?.paymentMethod || existingAdvert.payment_method || 'bank_transfer';
            const isClosed = invoiceData?.isClosed || false;
            
            if (paymentMethod === 'cash' && !isClosed) {
              strapi.log.info(`Cash payment not closed yet for advert ${id}, skipping payment record`);
            } else {
              paymentRecord = await createPaymentFromBC(existingAdvert, invoiceData, invoiceRecord, paymentMethod, isClosed);
            }
          }
          
          const updateData = {
            isPaid: isPaid,
            lastPaymentCheckAt: new Date()
          };
          
          if (isPaid === true) {
            updateData.paid_at = new Date();
            updateData.isActive = true;
          }
          
          const updated = await strapi.db.query('api::advert.advert').update({
            where: { id: parseInt(id) },
            data: updateData
          });
          
          results.push({
            id,
            success: true,
            changed: true,
            isPaid: updated.isPaid,
            bc_reference: existingAdvert.bc_reference_number,
            invoice: invoiceRecord,
            payment: paymentRecord
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
   */
  async checkPaymentByBcReference(ctx) {
    try {
      const { reference } = ctx.params;
      
      const advert = await strapi.db.query('api::advert.advert').findOne({
        where: { bc_reference_number: reference },
        populate: {
          invoice: true,
          payments: true
        }
      });
      
      if (!advert) {
        return ctx.notFound(`Advert with BC reference ${reference} not found`);
      }
      
      return {
        data: {
          id: advert.id,
          bc_reference_number: advert.bc_reference_number,
          isPaid: advert.isPaid,
          paidAt: advert.paid_at,
          invoice: advert.invoice,
          payments: advert.payments
        }
      };
    } catch (error) {
      strapi.log.error('Error checking payment by BC reference:', error);
      return ctx.badRequest('Failed to check payment status', { error: error.message });
    }
  }
};

/**
 * Helper: Create or update invoice record from BC data
 */
async function upsertInvoiceFromBC(advert, invoiceData) {
  try {
    // Check if invoice already exists
    const existingInvoice = await strapi.db.query('api::invoice.invoice').findOne({
      where: { advert: advert.id }
    });
    
    const invoicePayload = {
      advert: advert.id,
      client: advert.client?.id || null,
      invoice_number: invoiceData?.invoiceNo || `BC-${advert.bc_reference_number}`,
      invoice_date: invoiceData?.postingDate || new Date().toISOString().split('T')[0],
      due_date: invoiceData?.dueDate || new Date().toISOString().split('T')[0],
      total_amount: parseFloat(invoiceData?.amountIncludingVAT || advert.total_amount),
      amount_paid: parseFloat(invoiceData?.amountIncludingVAT || advert.total_amount),
      balance: 0,
      payment_status: 'paid',
      currency: 'UGX'
    };
    
    if (existingInvoice) {
      return await strapi.db.query('api::invoice.invoice').update({
        where: { id: existingInvoice.id },
        data: invoicePayload
      });
    } else {
      return await strapi.db.query('api::invoice.invoice').create({
        data: invoicePayload
      });
    }
  } catch (error) {
    strapi.log.error('Error upserting invoice:', error);
    throw error;
  }
}

/**
 * Helper: Create payment record from BC data
 */
async function createPaymentFromBC(advert, invoiceData, invoiceRecord, paymentMethod, isClosed) {
  try {
    const paymentPayload = {
      invoice: invoiceRecord?.id || null,
      payment_date: invoiceData?.postingDate || new Date().toISOString().split('T')[0],
      amount: parseFloat(invoiceData?.amountIncludingVAT || advert.total_amount),
      payment_method: paymentMethod === 'cash' ? 'cash' : 'bank_transfer',
      reference_number: invoiceData?.invoiceNo || `BC-${advert.bc_reference_number}`,
      notes: `Payment from Business Central - Invoice ${invoiceData?.invoiceNo} - Method: ${paymentMethod}${isClosed ? '' : ' (Pending)'}`,
      vgams_user: advert.vgams_user?.id || null
    };
    
    return await strapi.db.query('api::payment.payment').create({
      data: paymentPayload
    });
  } catch (error) {
    strapi.log.error('Error creating payment record:', error);
    throw error;
  }
}
