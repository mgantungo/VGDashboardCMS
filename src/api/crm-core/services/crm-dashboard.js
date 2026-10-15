'use strict';

/**
 * "Today" for salespeople (only what to do next), plus the manager dashboard.
 */
const {
  UID, num, today, addDays, daysBetween, startOfMonth, monthKey, uniq, fmtM,
} = require('../utils/crm-helpers');

const BUTTON = { send_quote: ['Quote', 'quote'], call_back: ['Log', 'log'], meet_again: ['Log', 'log'], follow_up: ['Log', 'log'] };

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const config = () => strapi.service('api::crm-core.crm-config');
  const pipeline = () => strapi.service('api::crm-core.crm-pipeline');
  const approvals = () => strapi.service('api::crm-core.crm-approvals');
  const commission = () => strapi.service('api::crm-core.crm-commission');

  return {
    async today(crm) {
      const settings = await config().settings();
      const t = today();
      const todos = [];
      const soon = addDays(t, 1);

      // 1. my open next actions (from logged visits and calls)
      const actions = await store().find(UID.interaction, {
        filters: { next_action_done: false, next_action_type: { $ne: 'none' }, next_action_due: { $lte: soon }, $or: [{ next_action_owner: { documentId: crm.profileId } }, { logged_by: { documentId: crm.profileId } }] },
        populate: { client: { fields: ['company_name'] }, opportunity: { fields: ['title'] } }, sort: ['next_action_due:asc'], limit: 30,
      });
      const seenClients = new Set();
      actions.forEach((a) => {
        const key = `${a.client?.documentId}:${a.next_action_type}`;
        if (seenClients.has(key)) return;
        seenClients.add(key);
        const [btn, kind] = BUTTON[a.next_action_type] || ['Log', 'log'];
        const overdue = a.next_action_due < t;
        todos.push({
          id: `ia:${a.documentId}`, kind, button: btn, client: { id: a.client?.documentId, name: a.client?.company_name },
          opportunity: a.opportunity ? { id: a.opportunity.documentId, title: a.opportunity.title } : null,
          title: a.next_action || 'Follow up', sub: `${a.client?.company_name}${overdue ? ` · ${daysBetween(a.next_action_due, t)}d overdue` : a.next_action_due === t ? ' · today' : ' · tomorrow'}`,
          overdue, interaction: a.documentId,
        });
      });

      // 2. quotes with the client that are about to expire
      if (crm.spId || crm.profileId) {
        const expiring = await store().find(UID.proposal, {
          filters: { state: { $in: ['submitted', 'negotiating'] }, $or: [{ owner: { documentId: crm.profileId } }, { sales_person: { documentId: crm.spId || '__none__' } }] },
          populate: { current_version: true, client: { fields: ['company_name'] } }, limit: 50,
        });
        expiring.filter((p) => p.current_version?.valid_until && daysBetween(t, p.current_version.valid_until) <= settings.reminder_days_before_expiry).forEach((p) => {
          const left = daysBetween(t, p.current_version.valid_until);
          todos.push({
            id: `ex:${p.current_version.documentId}`, kind: 'extend', button: 'Extend', client: { id: p.client?.documentId, name: p.client?.company_name },
            title: `Quote ${left < 0 ? 'expired' : `expires in ${left} day${left === 1 ? '' : 's'}`}`, sub: `${p.client?.company_name} · ${p.reference} · UGX ${fmtM(p.current_version.net_total)}`,
            version: p.current_version.documentId, proposal: p.documentId,
          });
        });

        // 3. won deals waiting for the LPO
        const won = await store().find(UID.proposal, {
          filters: { state: 'accepted', $or: [{ owner: { documentId: crm.profileId } }, { sales_person: { documentId: crm.spId || '__none__' } }] },
          populate: { accepted_version: true, client: { fields: ['company_name'] } }, sort: ['updatedAt:desc'], limit: 30,
        });
        for (const p of won) {
          const has = await store().count(UID.lpo, { version: { documentId: p.accepted_version?.documentId } });
          if (!has) {
            todos.push({
              id: `lpo:${p.accepted_version.documentId}`, kind: 'lpo', button: 'Add LPO', client: { id: p.client?.documentId, name: p.client?.company_name },
              title: 'Add the LPO so billing can start', sub: `${p.client?.company_name} · a photo is enough`, version: p.accepted_version.documentId, proposal: p.documentId,
            });
          }
        }
      }

      // 4. approvals waiting for me (managers)
      const pending = await approvals().pendingCount(crm);
      if (pending) todos.unshift({ id: 'approvals', kind: 'approvals', button: 'Review', title: `${pending} approval${pending > 1 ? 's' : ''} waiting for you`, sub: 'Quotes and changes need your OK' });

      // 5. my tasks on projects
      const tasks = await store().find(UID.task, {
        filters: { assignee: { documentId: crm.profileId }, state: { $in: ['pending', 'in_progress'] }, due_date: { $lte: soon } },
        populate: { project: { fields: ['name'] } }, sort: ['due_date:asc'], limit: 20,
      });
      tasks.forEach((tk) => todos.push({
        id: `task:${tk.documentId}`, kind: 'task', button: 'Done', title: tk.title, sub: `${tk.project?.name || 'Project'} · due ${tk.due_date}`, task: tk.documentId, project: tk.project?.documentId, overdue: tk.due_date < t,
      }));

      // my deals (4 simple steps)
      const mine = crm.spId ? await pipeline().list(crm, { scope: 'mine', state: 'open', limit: 50 }) : { items: [] };
      const deals = mine.items.slice(0, 12).map((o) => ({
        id: o.documentId, title: o.title, client: { id: o.client?.documentId, name: o.client?.company_name },
        value: num(o.expected_revenue), step: o.step, status_line: o.status_line, overlap: o.overlap_flag && o.overlap_resolution === 'none',
      }));
      const wonMonth = crm.spId ? await store().find(UID.opportunity, {
        filters: { state: 'won', won_at: { $gte: `${startOfMonth()}T00:00:00.000Z` }, $or: [{ contributors: { sales_person: { documentId: crm.spId } } }, { lead_sales_person: { documentId: crm.spId } }] },
        limit: 200,
      }) : [];
      const wonValue = wonMonth.reduce((a, o) => a + num(o.expected_revenue), 0);
      const target = num(crm.profile?.monthly_target);
      let earnings = null;
      if (crm.spId) {
        const st = await commission().statement(crm, { period: monthKey() }).catch(() => null);
        const all = await commission().statement(crm, {}).catch(() => null);
        earnings = st ? { month_accrued: st.totals.accrued, eligible: all?.totals.eligible || 0, paid: all?.totals.paid || 0, next_payout: all?.totals.next_payout || 0 } : null;
      }
      return {
        greeting: { name: (crm.spName || '').split(' ')[0] || 'there', date: t },
        todos,
        deals,
        month: { won: wonValue, won_count: wonMonth.length, target, to_go: Math.max(0, target - wonValue) },
        earnings,
      };
    },

    async manager(crm) {
      const pipe = await pipeline().list(crm, { state: 'open', limit: 500 });
      const ms = `${startOfMonth()}T00:00:00.000Z`;
      const scopeIds = await strapi.service('api::crm-core.crm-access').visibleClientIds(crm);
      const clientFilter = scopeIds === null ? {} : { client: { documentId: { $in: scopeIds.length ? scopeIds : ['__none__'] } } };
      const [won, lost, overdueTasks, approvalCount] = await Promise.all([
        store().find(UID.opportunity, { filters: { ...clientFilter, state: 'won', won_at: { $gte: ms } }, limit: 500 }),
        store().find(UID.opportunity, { filters: { ...clientFilter, state: 'lost', lost_at: { $gte: ms } }, limit: 500 }),
        store().count(UID.task, { state: { $in: ['pending', 'in_progress', 'blocked'] }, due_date: { $lt: today() } }),
        approvals().pendingCount(crm),
      ]);
      return {
        lanes: pipe.lanes,
        totals: pipe.totals,
        won: { count: won.length, value: won.reduce((a, o) => a + num(o.expected_revenue), 0) },
        lost: { count: lost.length, value: lost.reduce((a, o) => a + num(o.expected_revenue), 0), reasons: uniq(lost.map((l) => l.loss_reason)) },
        overdue_tasks: overdueTasks,
        approvals: approvalCount,
      };
    },
  };
};
