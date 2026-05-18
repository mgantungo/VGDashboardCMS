'use strict';
// src/api/sfa-opportunity/controllers/sfa-opportunity.js

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveSfaProfile }    = require('../../../_sfa-helpers/sfa-profile');

const STAGE_ORDER = [
  'opportunity_created', 'contact_engaged', 'requirement_defined',
  'quotation_created', 'quotation_sent', 'negotiation', 'approved', 'closed_lost',
];

const OPP_POPULATE = [
  'company',
  'existing_client',
  'contacts',
  'created_by_agent',
  'created_by_agent.vgams_sales_person',
  'created_by_agent.unit',
  'buy_in_lines',
  'buy_in_lines.buy_in',
];

/**
 * Returns a Strapi filter based on the caller's SFA role.
 *   sales_agent  → own opportunities only (matched via profile documentId)
 *   supervisor   → all opportunities within the caller's unit
 *   manager/admin → all opportunities (no filter)
 */
function buildRoleFilter(role, profileDocumentId, unitDocumentId) {
  if (role === 'sales_agent') {
    return { created_by_agent: { documentId: { $eq: profileDocumentId } } };
  }
  if (role === 'supervisor' && unitDocumentId) {
    return { created_by_agent: { unit: { documentId: { $eq: unitDocumentId } } } };
  }
  return {}; // manager / admin
}

module.exports = createCoreController(
  'api::sfa-opportunity.sfa-opportunity',
  ({ strapi }) => ({

    // POST /api/sfa-opportunities/my-board
    async myBoard(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const roleFilter = buildRoleFilter(caller.role, caller.profile.documentId, caller.unitDocumentId);

      const all = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
        filters:  { ...roleFilter, is_converted: { $eq: false } },
        populate: OPP_POPULATE,
        sort:     'createdAt:desc',
        limit:    500,
      });

      const board = {}, counts = {};
      for (const stage of STAGE_ORDER) { board[stage] = []; counts[stage] = 0; }
      for (const opp of all) {
        const stage = opp.funnel_stage || 'opportunity_created';
        if (!board[stage]) board[stage] = [];
        board[stage].push(opp);
        counts[stage] = (counts[stage] || 0) + 1;
      }

      return ctx.send({ board, counts });
    },

    // POST /api/sfa-opportunities/list
    async list(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { filters = {}, pagination = { page: 1, pageSize: 50 }, populate } = ctx.request.body;
      const roleFilter = buildRoleFilter(caller.role, caller.profile.documentId, caller.unitDocumentId);

      const items = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
        filters:  { ...roleFilter, ...filters },
        populate: populate || OPP_POPULATE,
        limit:    pagination.pageSize || 50,
        start:    ((pagination.page || 1) - 1) * (pagination.pageSize || 50),
        sort:     'createdAt:desc',
      });

      return ctx.send(items);
    },

    // POST /api/sfa-opportunities/detail
    async detail(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { id, populate } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const opp = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findOne({
        documentId: id,
        populate:   populate || OPP_POPULATE,
      });

      if (!opp) return ctx.notFound('Opportunity not found.');
      return ctx.send({ data: opp });
    },

    // POST /api/sfa-opportunities/create
    async createOpportunity(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const {
        title, description, source,
        expected_value, expected_close_date,
        existing_client,  // documentId from clients (return order)
        company,          // documentId from sfa-company (new prospect)
        contacts = [],    // array of { full_name, phone, email, position } OR documentIds
        buy_in_lines = [],
      } = ctx.request.body;

      if (!title) return ctx.badRequest('title is required.');
      if (!existing_client && !company) {
        return ctx.badRequest('Either existing_client (return client) or company (new prospect) is required.');
      }
      if (existing_client && company) {
        return ctx.badRequest('Provide either existing_client or company — not both.');
      }

      // ── Resolve contacts ──────────────────────────────────────────────────
      // The frontend may send either:
      //   a) documentId strings (existing contacts already in Strapi)
      //   b) raw objects { full_name, phone, email, position } (new contacts to create)
      // We create new ones and collect all documentIds for the relation.
      const contactDocumentIds = [];

      for (const contact of contacts) {
        if (typeof contact === 'string') {
          // Already a documentId
          contactDocumentIds.push(contact);
        } else if (contact?.documentId) {
          // Object with documentId
          contactDocumentIds.push(contact.documentId);
        } else if (contact?.full_name) {
          // Raw object — create the sfa-contact record first
          const companyId = company || null;
          const newContact = await strapi.documents('api::sfa-contact.sfa-contact').create({
            data: {
              full_name: contact.full_name,
              phone:     contact.phone    || null,
              email:     contact.email    || null,
              position:  contact.position || null,
              company:   companyId,
            },
          });
          contactDocumentIds.push(newContact.documentId);
        }
        // Skip empty / malformed contact entries
      }

      // ── Create the opportunity ────────────────────────────────────────────
      const opp = await strapi.documents('api::sfa-opportunity.sfa-opportunity').create({
        data: {
          title, description, source,
          expected_value, expected_close_date,
          existing_client:  existing_client || null,
          company:          company         || null,
          contacts:         contactDocumentIds,    // array of documentIds
          funnel_stage:     'opportunity_created',
          status:           'new',
          created_by_agent: caller.profile.documentId,
          is_converted:     false,
        },
        populate: OPP_POPULATE,
      });

      // ── Create buy-in lines ───────────────────────────────────────────────
      for (const line of buy_in_lines) {
        await strapi.documents('api::sfa-opportunity-buy-in.sfa-opportunity-buy-in').create({
          data: {
            opportunity:  opp.documentId,
            buy_in:       line.buy_in,
            quantity:     line.quantity,
            unit_price:   line.unit_price,
            subtotal:     (line.quantity || 0) * (line.unit_price || 0),
            notes:        line.notes        || '',
            custom_offer: line.custom_offer || '',
          },
        });
      }

      return ctx.send({ data: opp });
    },

    // POST /api/sfa-opportunities/update
    async updateOpportunity(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { id, sfaProfileDocumentId, ...data } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const updated = await strapi.documents('api::sfa-opportunity.sfa-opportunity').update({
        documentId: id, data, populate: OPP_POPULATE,
      });

      return ctx.send({ data: updated });
    },

    // POST /api/sfa-opportunities/change-stage
    async changeStage(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { id, funnel_stage } = ctx.request.body;
      if (!id || !funnel_stage)                return ctx.badRequest('id and funnel_stage are required.');
      if (!STAGE_ORDER.includes(funnel_stage)) return ctx.badRequest('Invalid funnel_stage value.');

      const updated = await strapi.documents('api::sfa-opportunity.sfa-opportunity').update({
        documentId: id, data: { funnel_stage },
      });

      return ctx.send({ data: updated });
    },

    // POST /api/sfa-opportunities/mark-lost
    async markLost(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { id, reason = '' } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const updated = await strapi.documents('api::sfa-opportunity.sfa-opportunity').update({
        documentId: id,
        data: {
          funnel_stage: 'closed_lost',
          status:       'lost',
          ...(reason ? { description: `[LOST REASON] ${reason}` } : {}),
        },
      });

      return ctx.send({ data: updated });
    },
  })
);
