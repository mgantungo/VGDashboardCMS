'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

// ── Auto-generate quotation number ───────────────────────────────────────────
async function generateQuotationNumber(strapi) {
  const now  = new Date();
  const ym   = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `QT-${ym}-`;

  // Find the highest existing number for this month
  const existing = await strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
    filters: { quotation_number: { $startsWith: prefix } },
    sort: 'quotation_number:desc',
    limit: 1,
  });

  let seq = 1;
  if (existing.length) {
    const last = existing[0].quotation_number;
    const lastSeq = parseInt(last.split('-').pop(), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

const Q_POPULATE = [
  'opportunity',
  'opportunity.company',
  'items',
  'items.buy_in',
  'submitted_by',
  'reviewed_by',
  'parent_quotation',
  'pdf_document',
];

// ── Controller ────────────────────────────────────────────────────────────────
module.exports = createCoreController(
  'api::sfa-quotation.sfa-quotation',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-quotations/create
     */
    async createQuotation(ctx) {
      const user = ctx.state.user;
      const { opportunity, items = [], total_amount, notes } = ctx.request.body;
      if (!opportunity) return ctx.badRequest('opportunity is required.');

      const quotation_number = await generateQuotationNumber(strapi);

      const quotation = await strapi.documents('api::sfa-quotation.sfa-quotation').create({
        data: {
          quotation_number,
          opportunity,
          version:       1,
          status:        'draft',
          total_amount:  total_amount || 0,
          notes:         notes || '',
          submitted_by:  user.id,
        },
      });

      // Create line items
      for (const item of items) {
        const subtotal = (item.quantity || 0) * (item.unit_price || 0);
        await strapi.documents('api::sfa-quotation-item.sfa-quotation-item').create({
          data: {
            quotation:   quotation.documentId,
            buy_in:      item.buy_in || null,
            description: item.description || '',
            quantity:    item.quantity   || 1,
            unit_price:  item.unit_price || 0,
            subtotal,
            notes:       item.notes || '',
          },
        });
      }

      const result = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: quotation.documentId,
        populate: Q_POPULATE,
      });

      return ctx.send({ data: result });
    },

    /**
     * POST /api/sfa-quotations/update
     * Update a draft quotation's items and totals.
     */
    async updateQuotation(ctx) {
      const { id, items, total_amount, notes } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const data = {};
      if (notes        !== undefined) data.notes        = notes;
      if (total_amount !== undefined) data.total_amount = total_amount;

      await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: id,
        data,
      });

      // Replace items if provided
      if (items) {
        const existingItems = await strapi.documents('api::sfa-quotation-item.sfa-quotation-item').findMany({
          filters: { quotation: { documentId: { $eq: id } } },
        });
        for (const ei of existingItems) {
          await strapi.documents('api::sfa-quotation-item.sfa-quotation-item').delete({
            documentId: ei.documentId,
          });
        }
        for (const item of items) {
          await strapi.documents('api::sfa-quotation-item.sfa-quotation-item').create({
            data: {
              quotation:   id,
              buy_in:      item.buy_in || null,
              description: item.description || '',
              quantity:    item.quantity   || 1,
              unit_price:  item.unit_price || 0,
              subtotal:    (item.quantity || 0) * (item.unit_price || 0),
              notes:       item.notes || '',
            },
          });
        }
      }

      const result = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: id,
        populate: Q_POPULATE,
      });

      return ctx.send({ data: result });
    },

    /**
     * POST /api/sfa-quotations/by-opportunity
     * All quotation versions for an opportunity, sorted desc by version.
     */
    async byOpportunity(ctx) {
      const { opportunityId, populate } = ctx.request.body;
      if (!opportunityId) return ctx.badRequest('opportunityId is required.');

      const quotations = await strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
        filters: { opportunity: { documentId: { $eq: opportunityId } } },
        populate: populate || Q_POPULATE,
        sort: 'version:desc',
      });

      return ctx.send(quotations);
    },

    /**
     * POST /api/sfa-quotations/pending-approval
     * Quotations in pending_approval state, role-scoped.
     */
    async pendingApproval(ctx) {
      const { populate } = ctx.request.body;

      const quotations = await strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
        filters: { status: { $eq: 'pending_approval' } },
        populate: populate || [
          'opportunity', 'opportunity.company', 'submitted_by',
        ],
        sort: 'createdAt:asc',
      });

      return ctx.send(quotations);
    },

    /**
     * POST /api/sfa-quotations/submit-for-approval
     * Agent submits a draft or rejected quotation.
     */
    async submitForApproval(ctx) {
      const { quotationId } = ctx.request.body;
      if (!quotationId) return ctx.badRequest('quotationId is required.');

      const q = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: quotationId,
      });
      if (!q) return ctx.notFound('Quotation not found.');
      if (!['draft', 'rejected'].includes(q.status)) {
        return ctx.badRequest(`Cannot submit a quotation with status "${q.status}".`);
      }

      const updated = await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId,
        data: { status: 'pending_approval' },
        populate: Q_POPULATE,
      });

      return ctx.send({ data: updated });
    },

    /**
     * POST /api/sfa-quotations/approve
     * Supervisor / manager approves.
     */
    async approve(ctx) {
      const user = ctx.state.user;
      const { quotationId, comment = '' } = ctx.request.body;
      if (!quotationId) return ctx.badRequest('quotationId is required.');

      const updated = await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId,
        data: {
          status:         'approved',
          reviewed_by:    user.id,
          reviewed_at:    new Date().toISOString(),
          review_comment: comment,
        },
        populate: Q_POPULATE,
      });

      return ctx.send({ data: updated });
    },

    /**
     * POST /api/sfa-quotations/reject
     */
    async reject(ctx) {
      const user = ctx.state.user;
      const { quotationId, comment } = ctx.request.body;
      if (!quotationId || !comment) {
        return ctx.badRequest('quotationId and comment are required.');
      }

      const updated = await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId,
        data: {
          status:         'rejected',
          reviewed_by:    user.id,
          reviewed_at:    new Date().toISOString(),
          review_comment: comment,
        },
        populate: Q_POPULATE,
      });

      return ctx.send({ data: updated });
    },

    /**
     * POST /api/sfa-quotations/revise
     * Creates a new quotation version (version + 1) based on an existing one.
     */
    async revise(ctx) {
      const user = ctx.state.user;
      const { quotationId, items = [], total_amount, notes } = ctx.request.body;
      if (!quotationId) return ctx.badRequest('quotationId is required.');

      const source = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: quotationId,
        populate: ['opportunity'],
      });
      if (!source) return ctx.notFound('Source quotation not found.');

      // Mark original as revised
      await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId,
        data: { status: 'revised' },
      });

      const quotation_number = await generateQuotationNumber(strapi);

      const newQ = await strapi.documents('api::sfa-quotation.sfa-quotation').create({
        data: {
          quotation_number,
          opportunity:       source.opportunity?.documentId,
          version:           (source.version || 1) + 1,
          status:            'draft',
          total_amount:      total_amount || source.total_amount || 0,
          notes:             notes || source.notes || '',
          submitted_by:      user.id,
          parent_quotation:  quotationId,
        },
      });

      for (const item of items) {
        await strapi.documents('api::sfa-quotation-item.sfa-quotation-item').create({
          data: {
            quotation:   newQ.documentId,
            buy_in:      item.buy_in || null,
            description: item.description || '',
            quantity:    item.quantity   || 1,
            unit_price:  item.unit_price || 0,
            subtotal:    (item.quantity || 0) * (item.unit_price || 0),
            notes:       item.notes || '',
          },
        });
      }

      const result = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: newQ.documentId,
        populate: Q_POPULATE,
      });

      return ctx.send({ data: result });
    },

    /**
     * POST /api/sfa-quotations/upload-pdf
     * Upload a PDF file and attach it to a quotation.
     */
    async uploadPdf(ctx) {
      const { quotationId } = ctx.request.body;
      const file = ctx.request.files?.['files.pdf_document'];

      if (!quotationId) return ctx.badRequest('quotationId is required.');
      if (!file)        return ctx.badRequest('No PDF file provided.');

      const uploaded = await strapi.plugins.upload.services.upload.upload({
        data: {
          refId: quotationId,
          ref:   'api::sfa-quotation.sfa-quotation',
          field: 'pdf_document',
        },
        files: file,
      });

      return ctx.send({ data: uploaded });
    },
  })
);
