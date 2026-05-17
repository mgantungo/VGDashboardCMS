'use strict';
// src/api/sfa-quotation-communication/controllers/sfa-quotation-communication.js

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveSfaProfile }    = require('../../../_sfa-helpers/sfa-profile');

module.exports = createCoreController(
  'api::sfa-quotation-communication.sfa-quotation-communication',
  ({ strapi }) => ({

    // POST /api/sfa-quotation-communications/record-send
    // Records that a quotation was sent and updates status to sent_to_client
    async recordSend(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { quotationId, channel, sentAt, notes = '' } = ctx.request.body;
      if (!quotationId || !channel) return ctx.badRequest('quotationId and channel are required.');

      await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId, data: { status: 'sent_to_client' },
      });

      const record = await strapi.documents(
        'api::sfa-quotation-communication.sfa-quotation-communication'
      ).create({
        data: {
          quotation:         quotationId,
          channel,
          sent_at:           sentAt || new Date().toISOString(),
          sent_by:           caller.profile.documentId,
          negotiation_notes: notes,
        },
        populate: ['sent_by', 'sent_by.vgams_sales_person'],
      });

      return ctx.send({ data: record });
    },

    // POST /api/sfa-quotation-communications/record-response
    async recordClientResponse(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { quotationId, clientResponse, negotiationNotes, responseDate } = ctx.request.body;
      if (!quotationId) return ctx.badRequest('quotationId is required.');

      // Update the most recent communication record for this quotation
      const [latest] = await strapi.documents(
        'api::sfa-quotation-communication.sfa-quotation-communication'
      ).findMany({
        filters: { quotation: { documentId: { $eq: quotationId } } },
        sort:    'sent_at:desc',
        limit:   1,
      });

      if (latest) {
        await strapi.documents('api::sfa-quotation-communication.sfa-quotation-communication').update({
          documentId: latest.documentId,
          data: {
            client_response:   clientResponse   || '',
            negotiation_notes: negotiationNotes || '',
            response_date:     responseDate     || new Date().toISOString(),
          },
        });
      } else {
        await strapi.documents('api::sfa-quotation-communication.sfa-quotation-communication').create({
          data: {
            quotation:         quotationId,
            channel:           'other',
            sent_at:           new Date().toISOString(),
            sent_by:           caller.profile.documentId,
            client_response:   clientResponse   || '',
            negotiation_notes: negotiationNotes || '',
            response_date:     responseDate     || new Date().toISOString(),
          },
        });
      }

      return ctx.send({ ok: true });
    },

    // POST /api/sfa-quotation-communications/by-quotation
    async byQuotation(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { quotationId, populate = ['sent_by', 'sent_by.vgams_sales_person', 'attachments'] } = ctx.request.body;
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
