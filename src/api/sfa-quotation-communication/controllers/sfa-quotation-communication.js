'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::sfa-quotation-communication.sfa-quotation-communication',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-quotation-communications/record-send
     * Record that a quotation was sent to a client via a specific channel.
     * Also updates the quotation status to sent_to_client.
     */
    async recordSend(ctx) {
      const user = ctx.state.user;
      const { quotationId, channel, sentAt, notes = '' } = ctx.request.body;

      if (!quotationId || !channel) {
        return ctx.badRequest('quotationId and channel are required.');
      }

      // Update quotation status
      await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId,
        data: { status: 'sent_to_client' },
      });

      // Log the communication record
      const record = await strapi.documents(
        'api::sfa-quotation-communication.sfa-quotation-communication'
      ).create({
        data: {
          quotation: quotationId,
          channel,
          sent_at:  sentAt || new Date().toISOString(),
          sent_by:  user.id,
          negotiation_notes: notes,
        },
        populate: ['sent_by'],
      });

      return ctx.send({ data: record });
    },

    /**
     * POST /api/sfa-quotation-communications/record-response
     * Record a client response to a sent quotation.
     */
    async recordClientResponse(ctx) {
      const { quotationId, clientResponse, negotiationNotes, responseDate } = ctx.request.body;

      if (!quotationId) return ctx.badRequest('quotationId is required.');

      // Find the most recent communication for this quotation
      const [latestComm] = await strapi.documents(
        'api::sfa-quotation-communication.sfa-quotation-communication'
      ).findMany({
        filters: { quotation: { documentId: { $eq: quotationId } } },
        sort: 'sent_at:desc',
        limit: 1,
      });

      if (latestComm) {
        await strapi.documents(
          'api::sfa-quotation-communication.sfa-quotation-communication'
        ).update({
          documentId: latestComm.documentId,
          data: {
            client_response:   clientResponse || '',
            negotiation_notes: negotiationNotes || '',
            response_date:     responseDate || new Date().toISOString(),
          },
        });
      } else {
        // Create standalone response record
        await strapi.documents(
          'api::sfa-quotation-communication.sfa-quotation-communication'
        ).create({
          data: {
            quotation:         quotationId,
            channel:           'other',
            sent_at:           new Date().toISOString(),
            client_response:   clientResponse || '',
            negotiation_notes: negotiationNotes || '',
            response_date:     responseDate || new Date().toISOString(),
          },
        });
      }

      return ctx.send({ ok: true });
    },

    /**
     * POST /api/sfa-quotation-communications/by-quotation
     */
    async byQuotation(ctx) {
      const { quotationId, populate = ['sent_by', 'attachments'] } = ctx.request.body;
      if (!quotationId) return ctx.badRequest('quotationId is required.');

      const records = await strapi.documents(
        'api::sfa-quotation-communication.sfa-quotation-communication'
      ).findMany({
        filters: { quotation: { documentId: { $eq: quotationId } } },
        populate,
        sort: 'sent_at:desc',
      });

      return ctx.send(records);
    },
  })
);
