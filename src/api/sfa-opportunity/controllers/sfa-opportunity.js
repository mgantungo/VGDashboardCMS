'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

async function buildRoleFilter(user, strapi) {
  const [profile] = await strapi.documents('api::sfa-agent-profile.sfa-agent-profile').findMany({
    filters: { user: { id: { $eq: user.id } } },
    populate: ['unit'],
    limit: 1,
  });

  if (!profile) return null;

  if (profile.sfa_role === 'sales_agent') {
    return { created_by_agent: { id: { $eq: user.id } } };
  }

  if (profile.sfa_role === 'supervisor') {
    const unitId = profile.unit?.documentId;
    if (!unitId) return { created_by_agent: { id: { $eq: user.id } } };
    return {
      created_by_agent: {
        sfa_agent_profile: { unit: { documentId: { $eq: unitId } } },
      },
    };
  }

  return {}; // manager / admin
}

const STAGE_ORDER = [
  'opportunity_created', 'contact_engaged', 'requirement_defined',
  'quotation_created', 'quotation_sent', 'negotiation', 'approved', 'closed_lost',
];

const OPP_POPULATE = [
  'company',
  'existing_client',
  'contacts',
  'created_by_agent',
  'created_by_agent.sfa_agent_profile',
  'created_by_agent.sfa_agent_profile.unit',
  'buy_in_lines',
  'buy_in_lines.buy_in',
];

module.exports = createCoreController(
  'api::sfa-opportunity.sfa-opportunity',
  ({ strapi }) => ({

    // ── Kanban board (role-filtered) ─────────────────────────────────────────
    async myBoard(ctx) {
      const user       = ctx.state.user;
      const roleFilter = await buildRoleFilter(user, strapi);
      if (roleFilter === null) return ctx.forbidden('No SFA profile found.');

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

    // ── Filterable list view ─────────────────────────────────────────────────
    async list(ctx) {
      const user       = ctx.state.user;
      const roleFilter = await buildRoleFilter(user, strapi);
      if (roleFilter === null) return ctx.forbidden('No SFA profile found.');

      const { filters = {}, pagination = { page: 1, pageSize: 50 }, populate } = ctx.request.body;

      const items = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
        filters:  { ...roleFilter, ...filters },
        populate: populate || OPP_POPULATE,
        limit:    pagination.pageSize || 50,
        start:    ((pagination.page || 1) - 1) * (pagination.pageSize || 50),
        sort:     'createdAt:desc',
      });

      return ctx.send(items);
    },

    // ── Single detail ────────────────────────────────────────────────────────
    async detail(ctx) {
      const { id, populate } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const opp = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findOne({
        documentId: id,
        populate:   populate || OPP_POPULATE,
      });

      if (!opp) return ctx.notFound('Opportunity not found.');
      return ctx.send({ data: opp });
    },

    /**
     * POST /api/sfa-opportunities/create
     *
     * The payload must include EITHER:
     *   - existing_client: <documentId>
     *       When the agent is pursuing a new piece of business from a client
     *       who is already confirmed in the clients collection (return order).
     *
     *   - company: <documentId>
     *       When the agent is pursuing a brand-new prospect registered in
     *       sfa-company. The prospect has no confirmed orders yet.
     *
     * Both paths go through the full SFA pipeline identically.
     * The distinction only matters at order conversion time.
     */
    async createOpportunity(ctx) {
      const user = ctx.state.user;
      const {
        title,
        description,
        source,
        expected_value,
        expected_close_date,
        existing_client,   // documentId from clients collection (return order)
        company,           // documentId from sfa-company (new prospect)
        contacts    = [],
        buy_in_lines = [],
      } = ctx.request.body;

      if (!title) {
        return ctx.badRequest('title is required.');
      }

      if (!existing_client && !company) {
        return ctx.badRequest(
          'Either existing_client (for return clients) or company (for new prospects) is required.'
        );
      }

      if (existing_client && company) {
        return ctx.badRequest(
          'Provide either existing_client or company — not both.'
        );
      }

      const opp = await strapi.documents('api::sfa-opportunity.sfa-opportunity').create({
        data: {
          title,
          description,
          source,
          expected_value,
          expected_close_date,
          existing_client:  existing_client || null,
          company:          company         || null,
          contacts,
          funnel_stage:     'opportunity_created',
          status:           'new',
          created_by_agent: user.id,
          is_converted:     false,
        },
        populate: OPP_POPULATE,
      });

      // Create buy-in lines
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

    // ── Update ───────────────────────────────────────────────────────────────
    async updateOpportunity(ctx) {
      const { id, ...data } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const updated = await strapi.documents('api::sfa-opportunity.sfa-opportunity').update({
        documentId: id,
        data,
        populate:   OPP_POPULATE,
      });

      return ctx.send({ data: updated });
    },

    // ── Stage transition ─────────────────────────────────────────────────────
    async changeStage(ctx) {
      const { id, funnel_stage } = ctx.request.body;
      if (!id || !funnel_stage)           return ctx.badRequest('id and funnel_stage are required.');
      if (!STAGE_ORDER.includes(funnel_stage)) return ctx.badRequest('Invalid funnel_stage.');

      const updated = await strapi.documents('api::sfa-opportunity.sfa-opportunity').update({
        documentId: id,
        data:       { funnel_stage },
      });

      return ctx.send({ data: updated });
    },

    // ── Mark lost ────────────────────────────────────────────────────────────
    async markLost(ctx) {
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
