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
            fields: ['id', 'product_name'],
            populate: {
              category: {
                fields: ['id', 'category_name']
              }
            }
          },
          rate_card: {
            fields: ['id', 'ad_type', 'price_fc', 'price_bw']
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
  },

  /**
 * Mark advert as fully paid (primarily for cash payments)
 * Does NOT create invoice - just payment record
 */
  async markAsPaid(ctx) {
    try {
      const { 
        referenceNumber, 
        paymentMethod, 
        paymentDate, 
        paymentNotes, 
        recordedBy 
      } = ctx.request.body;
      
      console.log('💳 markAsPaid called with:', { referenceNumber, paymentMethod });
      
      // Validate
      if (!referenceNumber) {
        return ctx.badRequest('Reference number is required');
      }
      
      // Find the advert by reference_number
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: { reference_number: referenceNumber },
        populate: {
          client: { fields: ['id', 'company_name'] },
          product: { fields: ['id', 'product_name'] },
          vgams_user: { fields: ['id', 'name'] }
        }
      });
      
      if (!adverts || adverts.length === 0) {
        return ctx.notFound(`Advert with reference ${referenceNumber} not found`);
      }
      
      const advert = adverts[0];
      
      // Check if already paid
      if (advert.isPaid) {
        return ctx.badRequest('This advert is already marked as paid');
      }
      
      // Check if canceled
      if (advert.isCanceled) {
        return ctx.badRequest('Cannot mark a canceled advert as paid');
      }
      
      console.log(`📝 Processing payment for advert #${advert.id} - ${advert.advert_title}`);
      
      // Determine payment method (use provided or advert's payment method)
      const finalPaymentMethod = paymentMethod || advert.payment_method || 'cash';
      const finalPaymentDate = paymentDate || new Date().toISOString().split('T')[0];
      
      // Create payment record (NO INVOICE for cash payments)
      const payment = await strapi.entityService.create('api::payment.payment', {
        data: {
          amount: advert.total_amount,
          payment_method: finalPaymentMethod,
          payment_date: finalPaymentDate,
          reference_number: referenceNumber,
          notes: paymentNotes || `Full payment for ${advert.advert_title} - ${finalPaymentMethod}`,
          vgams_user: recordedBy || advert.vgams_user?.id || null,
          invoice: null // No invoice
        }
      });
      
      console.log(`✅ Payment record created: #${payment.id}`);
      
      // Update advert - mark as paid and active
      const updatedAdvert = await strapi.entityService.update('api::advert.advert', advert.id, {
        data: {
          isPaid: true,
          isActive: true,
          status: advert.status === 'draft' ? 'published' : advert.status
        }
      });
      
      console.log(`✅ Advert #${advert.id} marked as paid and active`);
      
      return {
        success: true,
        message: 'Advert marked as paid successfully',
        data: {
          advert_id: advert.id,
          reference_number: referenceNumber,
          advert_title: advert.advert_title,
          client: advert.client?.company_name,
          amount: parseFloat(advert.total_amount),
          payment_method: finalPaymentMethod,
          payment_date: finalPaymentDate,
          payment_id: payment.id,
          is_paid: true,
          is_active: true
        }
      };
      
    } catch (err) {
      console.error('❌ Error marking advert as paid:', err);
      return ctx.internalServerError(`Failed to mark advert as paid: ${err.message}`);
    }
  },

  /**
   * Record a partial payment for an advert
   * Creates payment record and updates paid status if fully paid
   */
  async recordPayment(ctx) {
    try {
      const { 
        referenceNumber,
        amount,
        paymentMethod, 
        paymentDate, 
        transactionRef,
        notes, 
        recordedBy 
      } = ctx.request.body;
      
      console.log('💵 recordPayment called with:', { referenceNumber, amount });
      
      // Validate
      if (!referenceNumber) {
        return ctx.badRequest('Reference number is required');
      }
      
      if (!amount || amount <= 0) {
        return ctx.badRequest('Valid payment amount is required');
      }
      
      // Find the advert
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: { reference_number: referenceNumber },
        populate: {
          client: { fields: ['id', 'company_name'] },
          product: { fields: ['id', 'product_name'] },
          vgams_user: { fields: ['id', 'name'] },
          invoice: { fields: ['id', 'amount_paid', 'balance', 'payment_status'] }
        }
      });
      
      if (!adverts || adverts.length === 0) {
        return ctx.notFound(`Advert with reference ${referenceNumber} not found`);
      }
      
      const advert = adverts[0];
      
      // Check if canceled
      if (advert.isCanceled) {
        return ctx.badRequest('Cannot record payment for a canceled advert');
      }
      
      // Check if already fully paid
      if (advert.isPaid) {
        return ctx.badRequest('This advert is already fully paid');
      }
      
      const totalAmount = parseFloat(advert.total_amount);
      const paymentAmount = parseFloat(amount);
      
      // Validate payment amount
      if (paymentAmount > totalAmount) {
        return ctx.badRequest(`Payment amount (${paymentAmount}) cannot exceed total amount (${totalAmount})`);
      }
      
      console.log(`📝 Recording payment of ${paymentAmount} for advert #${advert.id}`);
      
      // Create payment record
      const payment = await strapi.entityService.create('api::payment.payment', {
        data: {
          amount: paymentAmount,
          payment_method: paymentMethod || advert.payment_method || 'cash',
          payment_date: paymentDate || new Date().toISOString().split('T')[0],
          reference_number: transactionRef || `PMT-${referenceNumber}-${Date.now()}`,
          notes: notes || `Partial payment for ${advert.advert_title}`,
          vgams_user: recordedBy || advert.vgams_user?.id || null,
          invoice: advert.invoice?.id || null
        }
      });
      
      console.log(`✅ Payment record created: #${payment.id}`);
      
      // Calculate if now fully paid
      // Get all payments for this advert
      const allPayments = await strapi.entityService.findMany('api::payment.payment', {
        filters: { reference_number: { $contains: referenceNumber } }
      });
      
      const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const isFullyPaid = totalPaid >= totalAmount;
      
      console.log(`💰 Total paid: ${totalPaid} / ${totalAmount} - Fully paid: ${isFullyPaid}`);
      
      // Update advert if fully paid
      const updateData = {};
      
      if (isFullyPaid) {
        updateData.isPaid = true;
        updateData.isActive = true;
        if (advert.status === 'draft') {
          updateData.status = 'published';
        }
      }
      
      if (Object.keys(updateData).length > 0) {
        await strapi.entityService.update('api::advert.advert', advert.id, {
          data: updateData
        });
        console.log(`✅ Advert #${advert.id} updated - isPaid: ${isFullyPaid}`);
      }
      
      // Update invoice if exists
      if (advert.invoice) {
        const newBalance = totalAmount - totalPaid;
        const paymentStatus = isFullyPaid ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');
        
        await strapi.entityService.update('api::invoice.invoice', advert.invoice.id, {
          data: {
            amount_paid: totalPaid,
            balance: newBalance,
            payment_status: paymentStatus
          }
        });
        
        console.log(`✅ Invoice updated - Paid: ${totalPaid}, Balance: ${newBalance}`);
      }
      
      return {
        success: true,
        message: isFullyPaid ? 'Payment recorded - Advert now fully paid' : 'Partial payment recorded successfully',
        data: {
          advert_id: advert.id,
          reference_number: referenceNumber,
          advert_title: advert.advert_title,
          client: advert.client?.company_name,
          total_amount: totalAmount,
          payment_amount: paymentAmount,
          total_paid: totalPaid,
          balance: totalAmount - totalPaid,
          is_fully_paid: isFullyPaid,
          payment_id: payment.id,
          payment_method: payment.payment_method,
          payment_date: payment.payment_date
        }
      };
      
    } catch (err) {
      console.error('❌ Error recording payment:', err);
      return ctx.internalServerError(`Failed to record payment: ${err.message}`);
    }
  },

  /**
   * Get payment history for an advert
   */
  async getPaymentHistory(ctx) {
    try {
      const { referenceNumber } = ctx.params;
      
      if (!referenceNumber) {
        return ctx.badRequest('Reference number is required');
      }
      
      console.log(`📜 Getting payment history for: ${referenceNumber}`);
      
      // Find all payments related to this reference
      const payments = await strapi.entityService.findMany('api::payment.payment', {
        filters: {
          reference_number: { $contains: referenceNumber }
        },
        populate: {
          vgams_user: { fields: ['id', 'name', 'email'] },
          invoice: { fields: ['id', 'invoice_number'] }
        },
        sort: 'payment_date:desc'
      });
      
      const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      
      return {
        success: true,
        count: payments.length,
        total_paid: totalPaid,
        data: payments.map(p => ({
          id: p.id,
          amount: parseFloat(p.amount),
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          reference_number: p.reference_number,
          notes: p.notes,
          recorded_by: p.vgams_user?.name || 'System',
          invoice_number: p.invoice?.invoice_number || null
        }))
      };
      
    } catch (err) {
      console.error('❌ Error getting payment history:', err);
      return ctx.internalServerError(`Failed to get payment history: ${err.message}`);
    }
  }

}
