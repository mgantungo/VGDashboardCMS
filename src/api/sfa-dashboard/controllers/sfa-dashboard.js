'use strict';
// src/api/sfa-dashboard/controllers/sfa-dashboard.js
// No content-type — pure aggregation controller.

const { resolveSfaProfile } = require('../../_sfa-helpers/sfa-profile');

module.exports = {

  // POST /api/sfa-dashboard/my-stats
  async myStats(ctx) {
    const caller = await resolveSfaProfile(ctx, strapi);
    if (!caller) return;

    const today        = new Date().toISOString().slice(0, 10);
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const profileDocId = caller.profile.documentId;

    const [myOpps, wonThisMonth, lostThisMonth, overdueFollowups, quotationsOut, pendingApproval] =
      await Promise.all([
        // Active opportunities owned by this agent
        strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
          filters: {
            created_by_agent: { documentId: { $eq: profileDocId } },
            is_converted:     { $eq: false },
            funnel_stage:     { $notIn: ['closed_lost'] },
          },
          limit: 500,
        }),
        // Won this month
        strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
          filters: {
            created_by_agent: { documentId: { $eq: profileDocId } },
            is_converted:     { $eq: true },
            converted_at:     { $gte: firstOfMonth },
          },
          limit: 200,
        }),
        // Lost this month
        strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
          filters: {
            created_by_agent: { documentId: { $eq: profileDocId } },
            funnel_stage:     { $eq: 'closed_lost' },
            updatedAt:        { $gte: firstOfMonth },
          },
          limit: 200,
        }),
        // Overdue / due today follow-ups
        strapi.documents('api::sfa-activity.sfa-activity').findMany({
          filters: {
            logged_by:          { documentId: { $eq: profileDocId } },
            next_followup_date: { $lte: today },
            opportunity:        { is_converted: { $eq: false } },
          },
          limit: 100,
        }),
        // Quotations sent to client or approved (awaiting send)
        strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
          filters: {
            submitted_by: { documentId: { $eq: profileDocId } },
            status:       { $in: ['sent_to_client', 'approved'] },
          },
          limit: 100,
        }),
        // Quotations pending approval
        strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
          filters: {
            submitted_by: { documentId: { $eq: profileDocId } },
            status:       { $eq: 'pending_approval' },
          },
          limit: 100,
        }),
      ]);

    const pipeline_value = myOpps.reduce((s, o) => s + (parseFloat(o.expected_value) || 0), 0);
    const won_value      = wonThisMonth.reduce((s, o) => s + (parseFloat(o.expected_value) || 0), 0);

    const funnel_counts = {};
    for (const opp of myOpps) {
      const stage = opp.funnel_stage;
      funnel_counts[stage] = (funnel_counts[stage] || 0) + 1;
    }

    const totalClosed    = wonThisMonth.length + lostThisMonth.length;
    const conversion_rate = totalClosed > 0
      ? Math.round((wonThisMonth.length / totalClosed) * 100)
      : 0;

    return ctx.send({
      pipeline_value,
      active_count:       myOpps.length,
      follow_ups_today:   overdueFollowups.filter(a => a.next_followup_date === today).length,
      overdue_follow_ups: overdueFollowups.length,
      quotations_out:     quotationsOut.length,
      pending_approval:   pendingApproval.length,
      won_this_month:     { count: wonThisMonth.length, value: won_value },
      lost_this_month:    { count: lostThisMonth.length },
      conversion_rate,
      funnel_counts,
    });
  },

  // POST /api/sfa-dashboard/management-stats
  async managementStats(ctx) {
    const caller = await resolveSfaProfile(ctx, strapi);
    if (!caller) return;

    if (!['supervisor', 'manager', 'admin'].includes(caller.role)) {
      return ctx.forbidden('Only supervisors and managers can view management stats.');
    }

    const { filters: userFilters = {} } = ctx.request.body;
    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const fromDate     = userFilters.date_from || firstOfMonth;
    const toDate       = userFilters.date_to   || new Date().toISOString();

    // Scope filter for supervisor (own unit only)
    const scopeFilter = caller.role === 'supervisor' && caller.unitDocumentId
      ? { created_by_agent: { unit: { documentId: { $eq: caller.unitDocumentId } } } }
      : {};

    const [allOpps, wonOpps, lostOpps] = await Promise.all([
      strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
        filters: { ...scopeFilter, is_converted: { $eq: false }, funnel_stage: { $notIn: ['closed_lost'] } },
        populate: ['created_by_agent', 'created_by_agent.vgams_sales_person', 'created_by_agent.unit'],
        limit: 1000,
      }),
      strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
        filters: { ...scopeFilter, is_converted: { $eq: true }, converted_at: { $gte: fromDate, $lte: toDate } },
        populate: ['created_by_agent', 'created_by_agent.vgams_sales_person'],
        limit: 500,
      }),
      strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
        filters: { ...scopeFilter, funnel_stage: { $eq: 'closed_lost' }, updatedAt: { $gte: fromDate, $lte: toDate } },
        limit: 500,
      }),
    ]);

    const funnel_counts  = {};
    const total_pipeline = allOpps.reduce((s, o) => {
      funnel_counts[o.funnel_stage] = (funnel_counts[o.funnel_stage] || 0) + 1;
      return s + (parseFloat(o.expected_value) || 0);
    }, 0);

    const won_value = wonOpps.reduce((s, o) => s + (parseFloat(o.expected_value) || 0), 0);

    // Team ranking
    const agentMap = {};
    for (const opp of [...wonOpps, ...allOpps]) {
      const agent = opp.created_by_agent;
      if (!agent) continue;
      if (!agentMap[agent.documentId]) {
        agentMap[agent.documentId] = {
          agent:          { documentId: agent.documentId, name: agent.vgams_sales_person?.name || '', unit: agent.unit },
          won_count:      0,
          pipeline_value: 0,
        };
      }
      if (opp.is_converted) agentMap[agent.documentId].won_count++;
      agentMap[agent.documentId].pipeline_value += parseFloat(opp.expected_value) || 0;
    }

    const team_ranking = Object.values(agentMap)
      .sort((a, b) => b.won_count - a.won_count || b.pipeline_value - a.pipeline_value)
      .slice(0, 20);

    const totalClosed     = wonOpps.length + lostOpps.length;
    const conversion_rate = totalClosed > 0 ? Math.round((wonOpps.length / totalClosed) * 100) : 0;
    const revenue_forecast = allOpps.filter(o => o.funnel_stage === 'approved')
      .reduce((s, o) => s + (parseFloat(o.expected_value) || 0), 0);

    return ctx.send({
      total_opportunities:  allOpps.length,
      total_pipeline_value: total_pipeline,
      won_this_month:       { count: wonOpps.length, value: won_value },
      lost_this_month:      { count: lostOpps.length },
      conversion_rate,
      revenue_forecast,
      funnel_counts,
      team_ranking,
    });
  },

  // POST /api/sfa-dashboard/followup-summary
  async followupSummary(ctx) {
    const caller = await resolveSfaProfile(ctx, strapi);
    if (!caller) return;

    const today    = new Date().toISOString().slice(0, 10);
    const followups = await strapi.documents('api::sfa-activity.sfa-activity').findMany({
      filters: {
        logged_by:          { documentId: { $eq: caller.profile.documentId } },
        next_followup_date: { $lte: today },
        opportunity:        { is_converted: { $eq: false } },
      },
      populate: ['opportunity', 'opportunity.company', 'opportunity.existing_client'],
      sort:     'next_followup_date:asc',
      limit:    50,
    });

    return ctx.send({
      today:   followups.filter(f => f.next_followup_date === today),
      overdue: followups.filter(f => f.next_followup_date  <  today),
      total:   followups.length,
    });
  },
};
