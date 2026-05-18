'use strict';
// src/api/sfa-quotation/controllers/sfa-quotation.js

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveSfaProfile }    = require('../../_sfa-helpers/sfa-profile');

const Q_POPULATE = [
  'opportunity', 'opportunity.company', 'opportunity.existing_client',
  'items', 'items.buy_in',
  'submitted_by', 'submitted_by.vgams_sales_person',
  'reviewed_by',  'reviewed_by.vgams_sales_person',
  'parent_quotation', 'pdf_document',
];

// Auto-generate quotation number: QT-YYYYMM-XXXX
async function generateQuotationNumber(strapi) {
  const now    = new Date();
  const ym     = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `QT-${ym}-`;

  const [latest] = await strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
    filters: { quotation_number: { $startsWith: prefix } },
    sort:    'quotation_number:desc',
    limit:   1,
  });

  let seq = 1;
  if (latest) {
    const lastSeq = parseInt(latest.quotation_number.split('-').pop(), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

async function createItems(strapi, quotationDocumentId, items) {
  for (const item of items) {
    await strapi.documents('api::sfa-quotation-item.sfa-quotation-item').create({
      data: {
        quotation:   quotationDocumentId,
        buy_in:      item.buy_in      || null,
        description: item.description || '',
        quantity:    item.quantity    || 1,
        unit_price:  item.unit_price  || 0,
        subtotal:    (item.quantity || 0) * (item.unit_price || 0),
        notes:       item.notes || '',
      },
    });
  }
}

async function deleteItems(strapi, quotationDocumentId) {
  const existing = await strapi.documents('api::sfa-quotation-item.sfa-quotation-item').findMany({
    filters: { quotation: { documentId: { $eq: quotationDocumentId } } },
  });
  for (const item of existing) {
    await strapi.documents('api::sfa-quotation-item.sfa-quotation-item').delete({ documentId: item.documentId });
  }
}

module.exports = createCoreController(
  'api::sfa-quotation.sfa-quotation',
  ({ strapi }) => ({

    // POST /api/sfa-quotations/create
    async createQuotation(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { opportunity, items = [], total_amount, notes } = ctx.request.body;
      if (!opportunity) return ctx.badRequest('opportunity is required.');

      const quotation_number = await generateQuotationNumber(strapi);

      const quotation = await strapi.documents('api::sfa-quotation.sfa-quotation').create({
        data: {
          quotation_number,
          opportunity,
          version:      1,
          status:       'draft',
          total_amount: total_amount || 0,
          notes:        notes        || '',
          submitted_by: caller.profile.documentId,
        },
      });

      await createItems(strapi, quotation.documentId, items);

      const result = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: quotation.documentId, populate: Q_POPULATE,
      });

      return ctx.send({ data: result });
    },

    // POST /api/sfa-quotations/update
    async updateQuotation(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { id, items, total_amount, notes } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const updateData = {};
      if (notes        !== undefined) updateData.notes        = notes;
      if (total_amount !== undefined) updateData.total_amount = total_amount;

      await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: id, data: updateData,
      });

      if (items) {
        await deleteItems(strapi, id);
        await createItems(strapi, id, items);
      }

      const result = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: id, populate: Q_POPULATE,
      });

      return ctx.send({ data: result });
    },

    // POST /api/sfa-quotations/by-opportunity
    async byOpportunity(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { opportunityId, populate } = ctx.request.body;
      if (!opportunityId) return ctx.badRequest('opportunityId is required.');

      const quotations = await strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
        filters:  { opportunity: { documentId: { $eq: opportunityId } } },
        populate: populate || Q_POPULATE,
        sort:     'version:desc',
      });

      return ctx.send(quotations);
    },

    // POST /api/sfa-quotations/pending-approval
    async pendingApproval(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const quotations = await strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
        filters:  { status: { $eq: 'pending_approval' } },
        populate: ['opportunity', 'opportunity.company', 'opportunity.existing_client',
                   'submitted_by', 'submitted_by.vgams_sales_person'],
        sort: 'createdAt:asc',
      });

      return ctx.send(quotations);
    },

    // POST /api/sfa-quotations/submit-for-approval
    async submitForApproval(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { quotationId } = ctx.request.body;
      if (!quotationId) return ctx.badRequest('quotationId is required.');

      const q = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({ documentId: quotationId });
      if (!q) return ctx.notFound('Quotation not found.');
      if (!['draft', 'rejected'].includes(q.status)) {
        return ctx.badRequest(`Cannot submit a quotation with status "${q.status}".`);
      }

      const updated = await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId, data: { status: 'pending_approval' }, populate: Q_POPULATE,
      });

      return ctx.send({ data: updated });
    },

    // POST /api/sfa-quotations/approve  — supervisor/manager only
    async approve(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      if (!['supervisor', 'manager', 'admin'].includes(caller.role)) {
        return ctx.forbidden('Only supervisors and managers can approve quotations.');
      }

      const { quotationId, comment = '' } = ctx.request.body;
      if (!quotationId) return ctx.badRequest('quotationId is required.');

      const updated = await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId,
        data: {
          status:         'approved',
          reviewed_by:    caller.profile.documentId,
          reviewed_at:    new Date().toISOString(),
          review_comment: comment,
        },
        populate: Q_POPULATE,
      });

      return ctx.send({ data: updated });
    },

    // POST /api/sfa-quotations/reject  — supervisor/manager only
    async reject(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      if (!['supervisor', 'manager', 'admin'].includes(caller.role)) {
        return ctx.forbidden('Only supervisors and managers can reject quotations.');
      }

      const { quotationId, comment } = ctx.request.body;
      if (!quotationId || !comment) {
        return ctx.badRequest('quotationId and comment are required.');
      }

      const updated = await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId,
        data: {
          status:         'rejected',
          reviewed_by:    caller.profile.documentId,
          reviewed_at:    new Date().toISOString(),
          review_comment: comment,
        },
        populate: Q_POPULATE,
      });

      return ctx.send({ data: updated });
    },

    // POST /api/sfa-quotations/revise  — creates a new version
    async revise(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { quotationId, items = [], total_amount, notes } = ctx.request.body;
      if (!quotationId) return ctx.badRequest('quotationId is required.');

      const source = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: quotationId, populate: ['opportunity'],
      });
      if (!source) return ctx.notFound('Source quotation not found.');

      // Mark original as revised
      await strapi.documents('api::sfa-quotation.sfa-quotation').update({
        documentId: quotationId, data: { status: 'revised' },
      });

      const quotation_number = await generateQuotationNumber(strapi);

      const newQ = await strapi.documents('api::sfa-quotation.sfa-quotation').create({
        data: {
          quotation_number,
          opportunity:      source.opportunity?.documentId,
          version:          (source.version || 1) + 1,
          status:           'draft',
          total_amount:     total_amount ?? source.total_amount ?? 0,
          notes:            notes        ?? source.notes        ?? '',
          submitted_by:     caller.profile.documentId,
          parent_quotation: quotationId,
        },
      });

      await createItems(strapi, newQ.documentId, items);

      const result = await strapi.documents('api::sfa-quotation.sfa-quotation').findOne({
        documentId: newQ.documentId, populate: Q_POPULATE,
      });

      return ctx.send({ data: result });
    },

    // POST /api/sfa-quotations/upload-pdf
    async uploadPdf(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const quotationId = ctx.request.body?.quotationId;
      const file        = ctx.request.files?.['files.pdf_document'];

      if (!quotationId) return ctx.badRequest('quotationId is required.');
      if (!file)        return ctx.badRequest('No PDF file provided.');

      const uploaded = await strapi.plugins.upload.services.upload.upload({
        data: { refId: quotationId, ref: 'api::sfa-quotation.sfa-quotation', field: 'pdf_document' },
        files: file,
      });

      return ctx.send({ data: uploaded });
    },
  })
);
