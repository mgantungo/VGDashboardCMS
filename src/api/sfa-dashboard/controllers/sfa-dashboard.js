'use strict';

/**
 * sfa-dashboard controller
 * No content-type — pure custom controller for aggregated stats.
 */

module.exports = {

  /**
   * POST /api/sfa-dashboard/my-stats
   * Per-agent pipeline statistics.
   */
  async myStats(ctx) {
    const user  = ctx.state.user;
    const today = new Date().toISOString().slice(0, 10);
    const firstOfMonth = new Date(
      new Date().getFullYear(), new Date().getMonth(), 1
    ).toISOString();

    // All active opportunities for this agent
    const myOpps = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
      filters: {
        created_by_agent: { id: { $eq: user.id } },
        is_converted: { $eq: false },
        funnel_stage: { $notIn: ['closed_lost'] },
      },
      populate: ['buy_in_lines'],
      limit: 500,
    });

    // Won this month
    const wonThisMonth = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
      filters: {
        created_by_agent: { id: { $eq: user.id } },
        is_converted:    { $eq: true },
        converted_at:    { $gte: firstOfMonth },
      },
      populate: ['buy_in_lines'],
      limit: 200,
    });

    // Lost this month
    const lostThisMonth = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
      filters: {
        created_by_agent: { id: { $eq: user.id } },
        funnel_stage:     { $eq: 'closed_lost' },
        updatedAt:        { $gte: firstOfMonth },
      },
      limit: 200,
    });

    // Overdue follow-ups
    const overdueFollowups = await strapi.documents('api::sfa-activity.sfa-activity').findMany({
      filters: {
        logged_by:          { id: { $eq: user.id } },
        next_followup_date: { $lte: today },
        opportunity:        { is_converted: { $eq: false } },
      },
      limit: 100,
    });

    // Quotations out (sent_to_client or pending_approval)
    const quotationsOut = await strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
      filters: {
        submitted_by: { id: { $eq: user.id } },
        status:       { $in: ['sent_to_client', 'approved'] },
      },
      limit: 100,
    });

    const pendingApproval = await strapi.documents('api::sfa-quotation.sfa-quotation').findMany({
      filters: {
        submitted_by: { id: { $eq: user.id } },
        status:       { $eq: 'pending_approval' },
      },
      limit: 100,
    });

    // Pipeline value = sum of expected_value across active opportunities
    const pipeline_value = myOpps.reduce((s, o) => s + (parseFloat(o.expected_value) || 0), 0);

    // Won value this month
    const won_value = wonThisMonth.reduce((s, o) => s + (parseFloat(o.expected_value) || 0), 0);

    // Funnel counts
    const funnel_counts = {};
    for (const opp of myOpps) {
      const stage = opp.funnel_stage;
      funnel_counts[stage] = (funnel_counts[stage] || 0) + 1;
    }

    // Conversion rate = won / (won + lost) %
    const totalClosed = wonThisMonth.length + lostThisMonth.length;
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

  /**
   * POST /api/sfa-dashboard/management-stats
   * Aggregated stats for supervisor/manager view.
   * Accepts optional filters: { unit_id, date_from, date_to }
   */
  async managementStats(ctx) {
    const { filters: userFilters = {} } = ctx.request.body;
    const { date_from, date_to } = userFilters;

    const firstOfMonth = new Date(
      new Date().getFullYear(), new Date().getMonth(), 1
    ).toISOString();
    const fromDate = date_from || firstOfMonth;
    const toDate   = date_to   || new Date().toISOString();

    // All active opportunities (role filter would be applied in production via policy)
    const allOpps = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
      filters: {
        is_converted: { $eq: false },
        funnel_stage: { $notIn: ['closed_lost'] },
      },
      populate: ['created_by_agent', 'created_by_agent.sfa_agent_profile',
                 'created_by_agent.sfa_agent_profile.unit'],
      limit: 1000,
    });

    const wonOpps = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
      filters: {
        is_converted: { $eq: true },
        converted_at: { $gte: fromDate, $lte: toDate },
      },
      populate: ['created_by_agent'],
      limit: 500,
    });

    const lostOpps = await strapi.documents('api::sfa-opportunity.sfa-opportunity').findMany({
      filters: {
        funnel_stage: { $eq: 'closed_lost' },
        updatedAt:    { $gte: fromDate, $lte: toDate },
      },
      populate: ['created_by_agent'],
      limit: 500,
    });

    // Funnel counts
    const funnel_counts = {};
    const pipeline_value = allOpps.reduce((s, o) => {
      const stage = o.funnel_stage;
      funnel_counts[stage] = (funnel_counts[stage] || 0) + 1;
      return s + (parseFloat(o.expected_value) || 0);
    }, 0);

    const won_value = wonOpps.reduce((s, o) => s + (parseFloat(o.expected_value) || 0), 0);

    // Team ranking: group won opportunities by agent
    const agentMap = {};
    for (const opp of wonOpps) {
      const agentId = opp.created_by_agent?.id;
      if (!agentId) continue;
      if (!agentMap[agentId]) {
        agentMap[agentId] = { agent: opp.created_by_agent, won_count: 0, pipeline_value: 0 };
      }
      agentMap[agentId].won_count++;
      agentMap[agentId].pipeline_value += parseFloat(opp.expected_value) || 0;
    }
    // Also include active pipeline per agent
    for (const opp of allOpps) {
      const agentId = opp.created_by_agent?.id;
      if (!agentId) continue;
      if (!agentMap[agentId]) {
        agentMap[agentId] = { agent: opp.created_by_agent, won_count: 0, pipeline_value: 0 };
      }
      agentMap[agentId].pipeline_value += parseFloat(opp.expected_value) || 0;
    }

    const team_ranking = Object.values(agentMap)
      .sort((a, b) => b.won_count - a.won_count || b.pipeline_value - a.pipeline_value)
      .slice(0, 20);

    const totalClosed = wonOpps.length + lostOpps.length;
    const conversion_rate = totalClosed > 0
      ? Math.round((wonOpps.length / totalClosed) * 100)
      : 0;

    // Revenue forecast: sum of expected_value for approved stage
    const revenue_forecast = allOpps
      .filter(o => o.funnel_stage === 'approved')
      .reduce((s, o) => s + (parseFloat(o.expected_value) || 0), 0);

    return ctx.send({
      total_opportunities:  allOpps.length,
      total_pipeline_value: pipeline_value,
      won_this_month:       { count: wonOpps.length, value: won_value },
      lost_this_month:      { count: lostOpps.length },
      conversion_rate,
      revenue_forecast,
      funnel_counts,
      team_ranking,
    });
  },

  /**
   * POST /api/sfa-dashboard/followup-summary
   * Follow-ups due today or overdue for the current user.
   */
  async followupSummary(ctx) {
    const user  = ctx.state.user;
    const today = new Date().toISOString().slice(0, 10);

    const followups = await strapi.documents('api::sfa-activity.sfa-activity').findMany({
      filters: {
        logged_by:          { id: { $eq: user.id } },
        next_followup_date: { $lte: today },
        opportunity:        { is_converted: { $eq: false } },
      },
      populate: ['opportunity', 'opportunity.company'],
      sort: 'next_followup_date:asc',
      limit: 50,
    });

    const todayItems   = followups.filter(f => f.next_followup_date === today);
    const overdueItems = followups.filter(f => f.next_followup_date  <  today);

    return ctx.send({
      today:   todayItems,
      overdue: overdueItems,
      total:   followups.length,
    });
  },
};
