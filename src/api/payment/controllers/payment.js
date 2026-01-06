'use strict';

/**
 * payment controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::payment.payment', ({ strapi }) => ({
  async find(ctx) {
    try {
      // Get the current user
      const user = ctx.state.user;

      // Build filters
      const filters = { ...ctx.query.filters };
      const populate = ['invoice', 'recorded_by'];
      const sort = ctx.query.sort || 'payment_date:desc';

      // Apply additional filters based on user role if needed
      // For example, if you want to restrict access:
      // if (user.role.name !== 'administrator') {
      //   filters.recorded_by = user.id;
      // }

      const payments = await strapi.entityService.findMany('api::payment.payment', {
        filters,
        populate,
        sort,
        ...ctx.query
      });

      return payments;
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async findOne(ctx) {
    try {
      const { id } = ctx.params;
      const payment = await strapi.entityService.findOne('api::payment.payment', id, {
        populate: ['invoice', 'recorded_by']
      });

      if (!payment) {
        return ctx.notFound('Payment not found');
      }

      return payment;
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async create(ctx) {
    try {
      const data = ctx.request.body;
      const user = ctx.state.user;

      // Add recorded_by if not provided
      if (!data.recorded_by) {
        data.recorded_by = user.id;
      }

      // Set payment_date if not provided
      if (!data.payment_date) {
        data.payment_date = new Date();
      }

      const payment = await strapi.entityService.create('api::payment.payment', {
        data,
        populate: ['invoice', 'recorded_by']
      });

      // If invoice is provided, update invoice status
      if (data.invoice) {
        await this.updateInvoiceStatus(data.invoice);
      }

      return payment;
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async update(ctx) {
    try {
      const { id } = ctx.params;
      const data = ctx.request.body;
      const user = ctx.state.user;

      // Check if payment exists
      const existingPayment = await strapi.entityService.findOne('api::payment.payment', id);
      if (!existingPayment) {
        return ctx.notFound('Payment not found');
      }

      // Update payment
      const payment = await strapi.entityService.update('api::invoice.invoice', id, {
        data,
        populate: ['invoice', 'recorded_by']
      });

      // If invoice is being updated, update invoice status
      if (data.invoice) {
        await this.updateInvoiceStatus(data.invoice);
      }

      return payment;
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async delete(ctx) {
    try {
      const { id } = ctx.params;

      // Get payment first to get invoice info
      const payment = await strapi.entityService.findOne('api::payment.payment', id, {
        populate: ['invoice']
      });

      if (!payment) {
        return ctx.notFound('Payment not found');
      }

      // Delete payment
      await strapi.entityService.delete('api::payment.payment', id);

      // Update invoice status if payment had an invoice
      if (payment.invoice) {
        await this.updateInvoiceStatus(payment.invoice.id);
      }

      return { message: 'Payment deleted successfully' };
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  // Your existing custom methods
  async recordPayment(ctx) {
    try {
      const { invoiceId, amount, paymentMethod, referenceNumber, notes } = ctx.request.body;
      const user = ctx.state.user;

      // Get invoice
      const invoice = await strapi.entityService.findOne(
        'api::invoice.invoice',
        invoiceId,
        { populate: ['payments'] }
      );

      if (!invoice) {
        return ctx.notFound('Invoice not found');
      }

      // Create payment record
      const payment = await strapi.entityService.create('api::payment.payment', {
        data: {
          invoice: invoiceId,
          payment_date: new Date(),
          amount,
          payment_method: paymentMethod,
          reference_number: referenceNumber,
          notes,
          recorded_by: user.id
        }
      });

      // Update invoice
      const newAmountPaid = parseFloat(invoice.amount_paid) + parseFloat(amount);
      const newBalance = parseFloat(invoice.total_amount) - newAmountPaid;

      let paymentStatus = 'unpaid';
      if (newBalance <= 0) {
        paymentStatus = 'paid';
      } else if (newAmountPaid > 0) {
        paymentStatus = 'partial';
      }

      await strapi.entityService.update('api::invoice.invoice', invoiceId, {
        data: {
          amount_paid: newAmountPaid,
          balance: newBalance,
          payment_status: paymentStatus
        }
      });

      return ctx.send(payment);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  async getPaymentHistory(ctx) {
    try {
      const { invoiceId } = ctx.params;

      const payments = await strapi.entityService.findMany(
        'api::payment.payment',
        {
          filters: { invoice: invoiceId },
          populate: ['recorded_by'],
          sort: 'payment_date:desc'
        }
      );

      return ctx.send(payments);
    } catch (err) {
      ctx.throw(500, err);
    }
  },

  // Helper method to update invoice status
  async updateInvoiceStatus(invoiceId) {
    try {
      const invoice = await strapi.entityService.findOne('api::invoice.invoice', invoiceId, {
        populate: ['payments']
      });

      if (!invoice) return;

      const totalPaid = invoice.payments?.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount || 0);
      }, 0) || 0;

      const balance = parseFloat(invoice.total_amount) - totalPaid;

      let paymentStatus = 'unpaid';
      if (balance <= 0) {
        paymentStatus = 'paid';
      } else if (totalPaid > 0) {
        paymentStatus = 'partial';
      }

      await strapi.entityService.update('api::invoice.invoice', invoiceId, {
        data: {
          amount_paid: totalPaid,
          balance: balance,
          payment_status: paymentStatus
        }
      });
    } catch (err) {
      console.error('Error updating invoice status:', err);
    }
  }
}));
