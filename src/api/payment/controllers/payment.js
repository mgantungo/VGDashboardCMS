'use strict';

/**
 * payment controller
 */

//const { createCoreController } = require('@strapi/strapi').factories;

//module.exports = createCoreController('api::payment.payment');

//'use strict';

module.exports = {
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
  }
};
