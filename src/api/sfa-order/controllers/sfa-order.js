'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

// ── Auto-generate order number ────────────────────────────────────────────────
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

// ── Client resolution ─────────────────────────────────────────────────────────
/**
 * Determines and returns the client record for a confirmed order.
 *
 * Three cases:
 *
 * 1. RETURN CLIENT — opportunity.existing_client is set
 *    The sales agent chose an existing client when creating the opportunity.
 *    → Use that client directly. No creation needed.
 *
 * 2. NEW PROSPECT — opportunity.company is set and a matching client already exists
 *    The prospect company name matches a record already in the clients collection.
 *    → Link to the existing client. No creation needed.
 *
 * 3. NEW PROSPECT — opportunity.company is set and NO matching client found
 *    First order from this prospect.
 *    → Create a new client record from the sfa-company data.
 *      (Independent creation within VGAMS — not dependent on Business Central)
 *
 * Returns: { client, isNew }
 */
async function resolveClient(strapi, opportunity) {

  // ── Case 1: return / existing client ──────────────────────────────────────
  if (opportunity.existing_client?.documentId) {
    const client = await strapi.documents('api::client.client').findOne({
      documentId: opportunity.existing_client.documentId,
    });
    if (client) return { client, isNew: false };
  }

  // ── Cases 2 & 3: new prospect via sfa-company ─────────────────────────────
  const company = opportunity.company;
  if (!company?.company_name) {
    // Neither existing_client nor company provided — cannot resolve
    return { client: null, isNew: false };
  }

  // Case 2: check whether this company already has a client record
  const [existing] = await strapi.documents('api::client.client').findMany({
    filters: {
      company_name: { $eqi: company.company_name },
      is_active:    { $eq: true },
    },
    limit: 1,
  });

  if (existing) {
    // Company is already a confirmed client — link directly
    return { client: existing, isNew: false };
  }

  // Case 3: first order — create client record from prospect data
  const newClient = await strapi.documents('api::client.client').create({
    data: {
      company_name:    company.company_name,
      contact_person:  company.contact_person || null,
      email:           company.email          || null,
      phone:           company.phone          || '0700000000',
      address:         company.address        || null,
      // BC fields left at defaults — BC will update bc_no and credit terms separately
      bc_no:           null,
      credit_approved: false,
      credit_limit:    0,
      payment_terms:   'cash',
      is_active:       true,
    },
  });

  return { client: newClient, isNew: true };
}

// ── Populate for order responses ──────────────────────────────────────────────
const ORDER_POPULATE = [
  'opportunity',
  'opportunity.company',
  'opportunity.existing_client',
  'opportunity.contacts',
  'accepted_quotation',
  'accepted_quotation.items',
  'accepted_quotation.items.buy_in',
  'client',
  'converted_by',
  'confirmation_document',
];

// ── Controller ────────────────────────────────────────────────────────────────
module.exports = createCoreController(
  'api::sfa-order.sfa-order',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-orders/convert
     *
     * Converts a confirmed (approved) opportunity to an order.
     * Accepts multipart/form-data when confirmation documents are attached.
     *
     * Steps:
     *  1. Validate opportunity exists and has not already been converted
     *  2. Resolve the client (return client | existing match | new creation)
     *  3. Create the sfa-order linked to that client
     *  4. Mark opportunity as converted + won
     *  5. Mark accepted quotation as accepted
     *  6. Attach uploaded confirmation documents
     *
     * Response: { order, client, clientIsNew }
     *   clientIsNew = true  → a new record was created in the clients collection
     *   clientIsNew = false → linked to an existing client record
     */
    async convert(ctx) {
      const user        = ctx.state.user;
      const isMultipart = ctx.is('multipart');
      const body        = ctx.request.body;
      const files       = isMultipart ? ctx.request.files : null;

      const { opportunityId, quotationId, confirmationType, notes = '' } = body;

      if (!opportunityId || !quotationId || !confirmationType) {
        return ctx.badRequest('opportunityId, quotationId, and confirmationType are required.');
      }

      // Fetch opportunity with both possible company sources populated
      const opp = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findOne({
        documentId: opportunityId,
        populate:   ['company', 'existing_client'],
      });

      if (!opp)             return ctx.notFound('Opportunity not found.');
      if (opp.is_converted) return ctx.badRequest('This opportunity has already been converted.');

      // Resolve the client for this order
      const { client, isNew: clientIsNew } = await resolveClient(strapi, opp);

      const order_number = await generateOrderNumber(strapi);

      // Create the order
      const order = await strapi.documents('api::sfa-order.sfa-order').create({
        data: {
          order_number,
          opportunity:        opportunityId,
          accepted_quotation: quotationId,
          confirmation_type:  confirmationType,
          notes,
          converted_date:     new Date().toISOString(),
          converted_by:       user.id,
          status:             'active',
          client:             client?.documentId || null,
          client_is_new:      clientIsNew,
        },
        populate: ORDER_POPULATE,
      });

      // Mark opportunity as converted
      await strapi.documents('api::sfa-opportunity.sfa-opportunity').update({
        documentId: opportunityId,
        data: {
          is_converted: true,
          converted_at: new Date().toISOString(),
          status:       'won',
        },
      });

      // Mark quotation as accepted
      await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId,
        data: { status: 'accepted' },
      });

      // Attach confirmation documents if provided
      if (files && files['files.confirmation_document']) {
        const uploads = Array.isArray(files['files.confirmation_document'])
          ? files['files.confirmation_document']
          : [files['files.confirmation_document']];

        for (const file of uploads) {
          await strapi.plugins.upload.services.upload.upload({
            data: {
              refId: order.id,
              ref:   'api::sfa-order.sfa-order',
              field: 'confirmation_document',
            },
            files: file,
          });
        }
      }

      return ctx.send({ order, client, clientIsNew });
    },

    // ── List (all roles) ─────────────────────────────────────────────────────
    async list(ctx) {
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

    // ── Single order detail ──────────────────────────────────────────────────
    async detail(ctx) {
      const { id, populate } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const order = await strapi.documents('api::sfa-order.sfa-order').findOne({
        documentId: id,
        populate:   populate || ORDER_POPULATE,
      });

      if (!order) return ctx.notFound('Order not found.');
      return ctx.send({ data: order });
    },

    // ── Update status ────────────────────────────────────────────────────────
    async updateStatus(ctx) {
      const { orderId, status } = ctx.request.body;
      const VALID = ['active', 'in_production', 'completed', 'cancelled'];

      if (!orderId || !status)     return ctx.badRequest('orderId and status are required.');
      if (!VALID.includes(status)) return ctx.badRequest(`status must be one of: ${VALID.join(', ')}`);

      const updated = await strapi.documents('api::sfa-order.sfa-order').update({
        documentId: orderId,
        data:       { status },
        populate:   ORDER_POPULATE,
      });

      return ctx.send({ data: updated });
    },
  })
);
