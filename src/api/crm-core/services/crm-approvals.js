'use strict';

/**
 * Approvals inbox and decisions. Proposal approvals carry the version diff and
 * margin impact; other approvals (change requests, LPO exceptions, early
 * closure) are routed to their own services when decided.
 */
const { UID, num, nowIso, daysBetween, fail, forbid } = require('../utils/crm-helpers');
const { compareVersions } = require('../utils/crm-pricing');

const RANK = { supervisor: 1, senior_manager: 2, executive: 3 };

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const notify = () => strapi.service('api::crm-core.crm-notify');
  const proposals = () => strapi.service('api::crm-core.crm-proposals');

  const mayDecide = (crm, a) => {
    if (a.approver?.documentId) return a.approver.documentId === crm.profileId || crm.role === 'executive';
    if (a.approver_role === crm.role) return true;
    // a higher sales authority may decide a lower one
    return RANK[crm.role] !== undefined && RANK[a.approver_role] !== undefined && RANK[crm.role] >= RANK[a.approver_role];
  };

  return {
    mayDecide,

    async inbox(crm, { state = 'pending' } = {}) {
      if (!crm.can.approve && !crm.can.manager) return { items: [], count: 0 };
      const filters = { decision: state === 'all' ? { $ne: 'cancelled' } : state };
      const rows = await store().find(UID.approval, {
        filters,
        populate: {
          approver: { fields: ['display_name'] }, requested_by: { fields: ['display_name'] },
          version: {
            populate: {
              proposal: { populate: { client: { fields: ['company_name'] } } },
              previous_version: { populate: { lines: { populate: { product: { fields: ['name'] } } } } },
              lines: { populate: { product: { fields: ['name'] } } },
            },
          },
        },
        sort: ['createdAt:asc'], limit: 200,
      });
      const items = rows.filter((a) => state !== 'pending' || mayDecide(crm, a)).map((a) => {
        const v = a.version;
        const prev = v?.previous_version;
        const hoursWaiting = Math.round((Date.now() - new Date(a.createdAt).getTime()) / 3600000);
        return {
          id: a.documentId, trigger_type: a.trigger_type, detail: a.detail, decision: a.decision, reason: a.reason,
          approver_role: a.approver_role, approver: a.approver?.display_name || null, requested_by: a.requested_by?.display_name || null,
          created_at: a.createdAt, due_at: a.due_at, sla_hours: a.sla_hours, hours_waiting: hoursWaiting,
          past_sla: a.due_at ? new Date(a.due_at) < new Date() && a.decision === 'pending' : false,
          subject_type: a.subject_type || (v ? 'proposal_version' : null), subject_id: a.subject_id || v?.documentId || null,
          proposal: v ? {
            id: v.proposal?.documentId, reference: v.proposal?.reference, client: v.proposal?.client?.company_name,
            client_id: v.proposal?.client?.documentId, version_id: v.documentId, version_number: v.version_number,
            change_reason: v.change_reason,
            before: prev ? { list_total: num(prev.list_total), net_total: num(prev.net_total), contribution_total: num(prev.contribution_total), margin_pct: num(prev.margin_pct), discount_pct: num(prev.discount_pct), payment_terms_days: prev.payment_terms_days, version_number: prev.version_number } : null,
            after: { list_total: num(v.list_total), net_total: num(v.net_total), contribution_total: num(v.contribution_total), margin_pct: num(v.margin_pct), discount_pct: num(v.discount_pct), payment_terms_days: v.payment_terms_days },
            below_cost_lines: (v.lines || []).filter((l) => num(l.net_price) < num(l.internal_cost) + num(l.third_party_cost) + num(l.other_cost)).length,
            line_count: (v.lines || []).length,
            diff: prev ? compareVersions(prev, v) : null,
          } : null,
        };
      });
      return { items, count: items.length };
    },

    async pendingCount(crm) {
      if (!crm.can.approve && !crm.can.manager) return 0;
      const rows = await store().find(UID.approval, { filters: { decision: 'pending' }, populate: ['approver'], limit: 500 });
      return rows.filter((a) => mayDecide(crm, a)).length;
    },

    /** Generic approval for non-proposal subjects. */
    async request(crm, { trigger_type, detail, subject_type, subject_id }) {
      const policy = (await strapi.service('api::crm-core.crm-config').policies(trigger_type))[0];
      const role = policy?.approver_role || 'executive';
      const a = await store().create(UID.approval, {
        trigger_type, detail, subject_type, subject_id, requested_by: crm.profileId, approver_role: role, decision: 'pending',
        policy: policy?.documentId || null, sla_hours: policy?.sla_hours || 24,
        due_at: new Date(Date.now() + (policy?.sla_hours || 24) * 3600000).toISOString(),
      });
      await notify().toRole(role, { event: 'approval.requested', title: `Approval needed: ${detail}`, body: `Requested by ${crm.spName}`, link: '/crm/approvals' }, crm.profileId);
      return a;
    },

    async decide(crm, id, { decision, reason }) {
      if (!['approved', 'rejected', 'returned'].includes(decision)) fail('Choose approve, return or reject.');
      const a = await store().must(UID.approval, id, { populate: { approver: true, version: { populate: { proposal: { populate: ['owner', 'client'] } } }, requested_by: true } }, 'Approval');
      if (a.decision !== 'pending') fail('This approval has already been decided.');
      if (!mayDecide(crm, a)) forbid('This approval is not yours to decide.');
      if (decision !== 'approved' && !String(reason || '').trim()) fail('Add a short reason so the requester knows what to change.');
      await store().update(UID.approval, id, { decision, reason: reason || null, decided_at: nowIso(), approver: crm.profileId });
      await audit().log(crm, `approval.${decision}`, UID.approval, id, { decision: 'pending' }, { decision, reason });

      let result = null;
      if (a.version) result = await proposals().onApprovalsChanged(crm, a.version.documentId);
      else if (a.subject_type === 'change_request') result = await strapi.service('api::crm-core.crm-projects').onChangeDecision(crm, a.subject_id, decision, reason);
      else if (a.subject_type === 'lpo') result = await strapi.service('api::crm-core.crm-contracts').onLpoExceptionDecision(crm, a.subject_id, decision);
      else if (a.subject_type === 'billing_item') result = await strapi.service('api::crm-core.crm-finance').onBillingExceptionDecision(crm, a.subject_id, decision);
      else if (a.subject_type === 'project_closure') result = await strapi.service('api::crm-core.crm-projects').onClosureDecision(crm, a.subject_id, decision, reason);
      else if (a.subject_type === 'contract_amendment') {
        await store().update(UID.amendment, a.subject_id, { state: decision === 'approved' ? 'approved' : 'rejected', approver: crm.profileId, decided_at: nowIso() });
        result = { amendment: a.subject_id, decision };
      }

      if (a.requested_by) {
        const what = a.version ? `${a.version.proposal?.reference} v${a.version.version_number}` : a.detail;
        await notify().toProfiles([a.requested_by.documentId], {
          event: `approval.${decision}`,
          title: `${decision === 'approved' ? 'Approved' : decision === 'returned' ? 'Sent back' : 'Rejected'}: ${what}`,
          body: reason || (result?.submitted ? 'The quote has been sent to the client.' : null),
          link: a.version ? `/crm/proposals/${a.version.proposal?.documentId}` : '/crm/approvals',
        }, crm.profileId);
      }
      return { decided: decision, result };
    },

    async overdue() {
      const rows = await store().find(UID.approval, { filters: { decision: 'pending', due_at: { $lt: nowIso() } }, limit: 500 });
      return rows.map((r) => ({ id: r.documentId, hours_late: Math.round(daysBetween(r.due_at, nowIso()) * 24) }));
    },
  };
};
