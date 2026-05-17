'use strict';
// src/api/sfa-order/controllers/sfa-order.js

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveSfaProfile }    = require('../../../_sfa-helpers/sfa-profile');

const ORDER_POPULATE = [
  'opportunity', 'opportunity.company', 'opportunity.existing_client', 'opportunity.contacts',
  'accepted_quotation', 'accepted_quotation.items', 'accepted_quotation.items.buy_in',
  'client',
  'converted_by', 'converted_by.vgams_sales_person',
  'confirmation_document',
];

// Auto-generate order number: SFA-ORD-YYYYMM-XXXX
async function generateOrderNumber(strapi) {
  const now    = new Date();
  const ym     = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `SFA-ORD-${ym}-`;

  const [latest] = await strapi.documents('api::sfa-order.sfa-order').findMany({
    filters: { order_number: { $startsWith: prefix } },
    sort:    'order_number:desc',
    limit:   1,
  });

  let seq = 1;
  if (latest) {
    const lastSeq = parseInt(latest.order_number.split('-').pop(), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

/**
 * Resolves the client record for a confirmed order.
 *
 * Case A — Return client: opportunity.existing_client is set → use it directly.
 * Case B — New prospect + matching client found by name → link to existing client.
 * Case C — New prospect + no matching client → create a new client record.
 *
 * Returns: { client, clientIsNew }
 */
async function resolveClient(strapi, opportunity) {
  // Case A
  if (opportunity.existing_client?.documentId) {
    const client = await strapi.documents('api::client.client').findOne({
      documentId: opportunity.existing_client.documentId,
    });
    if (client) return { client, clientIsNew: false };
  }

  // Cases B & C — prospect company
  const company = opportunity.company;
  if (!company?.company_name) return { client: null, clientIsNew: false };

  // Case B — look for matching client
  const [existing] = await strapi.documents('api::client.client').findMany({
    filters: { company_name: { $eqi: company.company_name }, is_active: { $eq: true } },
    limit: 1,
  });
  if (existing) return { client: existing, clientIsNew: false };

  // Case C — create new client from prospect data
  const newClient = await strapi.documents('api::client.client').create({
    data: {
      company_name:    company.company_name,
      contact_person:  company.contact_person || null,
      email:           company.email          || null,
      phone:           company.phone          || '0700000000',
      address:         company.address        || null,
      bc_no:           null,    // BC will populate this separately
      credit_approved: false,
      credit_limit:    0,
      payment_terms:   'cash',
      is_active:       true,
    },
  });
  return { client: newClient, clientIsNew: true };
}

module.exports = createCoreController(
  'api::sfa-order.sfa-order',
  ({ strapi }) => ({

    // POST /api/sfa-orders/convert
    async convert(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const isMultipart = ctx.is('multipart');
      const body        = ctx.request.body;
      const files       = isMultipart ? ctx.request.files : null;

      const { opportunityId, quotationId, confirmationType, notes = '' } = body;

      if (!opportunityId || !quotationId || !confirmationType) {
        return ctx.badRequest('opportunityId, quotationId, and confirmationType are required.');
      }

      const opp = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findOne({
        documentId: opportunityId,
        populate:   ['company', 'existing_client'],
      });

      if (!opp)             return ctx.notFound('Opportunity not found.');
      if (opp.is_converted) return ctx.badRequest('This opportunity has already been converted.');

      // Resolve client (existing or newly created)
      const { client, clientIsNew } = await resolveClient(strapi, opp);

      const order_number = await generateOrderNumber(strapi);

      const order = await strapi.documents('api::sfa-order.sfa-order').create({
        data: {
          order_number,
          opportunity:        opportunityId,
          accepted_quotation: quotationId,
          confirmation_type:  confirmationType,
          notes,
          converted_date:     new Date().toISOString(),
          converted_by:       caller.profile.documentId,
          status:             'active',
          client:             client?.documentId || null,
          client_is_new:      clientIsNew,
        },
        populate: ORDER_POPULATE,
      });

      // Mark opportunity as converted and won
      await strapi.documents('api::sfa-opportunity.sfa-opportunity').update({
        documentId: opportunityId,
        data: { is_converted: true, converted_at: new Date().toISOString(), status: 'won' },
      });

      // Mark accepted quotation as accepted
      await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId, data: { status: 'accepted' },
      });

      // Upload confirmation documents if present
      if (files?.['files.confirmation_document']) {
        const uploads = Array.isArray(files['files.confirmation_document'])
          ? files['files.confirmation_document']
          : [files['files.confirmation_document']];

        for (const file of uploads) {
          await strapi.plugins.upload.services.upload.upload({
            data: { refId: order.id, ref: 'api::sfa-order.sfa-order', field: 'confirmation_document' },
            files: file,
          });
        }
      }

      return ctx.send({ order, client, clientIsNew });
    },

    // POST /api/sfa-orders/list  — all orders visible to all SFA roles
    async list(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { filters = {}, pagination = { page: 1, pageSize: 50 }, populate } = ctx.request.body;

      const orders = await strapi.documents('api::sfa-order.sfa-order').findMany({
        filters,
        populate: populate || ORDER_POPULATE,
        limit:    pagination.pageSize || 50,
        start:    ((pagination.page || 1) - 1) * (pagination.pageSize || 50),
        sort:     'createdAt:desc',
      });

      return ctx.send(orders);
    },

    // POST /api/sfa-orders/detail
    async detail(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { id, populate } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const order = await strapi.documents('api::sfa-order.sfa-order').findOne({
        documentId: id,
        populate:   populate || ORDER_POPULATE,
      });

      if (!order) return ctx.notFound('Order not found.');
      return ctx.send({ data: order });
    },

    // POST /api/sfa-orders/update-status
    async updateStatus(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { orderId, status } = ctx.request.body;
      const VALID = ['active', 'in_production', 'completed', 'cancelled'];

      if (!orderId || !status)     return ctx.badRequest('orderId and status are required.');
      if (!VALID.includes(status)) return ctx.badRequest(`status must be one of: ${VALID.join(', ')}`);

      const updated = await strapi.documents('api::sfa-order.sfa-order').update({
        documentId: orderId, data: { status }, populate: ORDER_POPULATE,
      });

      return ctx.send({ data: updated });
    },
  })
);
