'use strict';

/**
 * Multi-duration delivery (blueprint 4.6): projects created from an accepted
 * version, independent workstreams, milestones, tasks with dependencies,
 * recurring work, costs per workstream, change requests with baselines,
 * and the closure rules.
 */
const {
  UID, num, money, today, nowIso, addDays, daysBetween, fail, forbid, uniq, fmtM,
} = require('../utils/crm-helpers');

const DURATION_RANK = { one_off: 0, fixed_term: 1, long_running: 2 };
const DEFAULT_DAYS = { one_off: 14, fixed_term: 90, long_running: 365 };
const OPEN_WS = ['pending', 'in_progress', 'blocked'];

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const notify = () => strapi.service('api::crm-core.crm-notify');
  const approvals = () => strapi.service('api::crm-core.crm-approvals');

  async function loadProject(crm, id) {
    const p = await store().must(UID.project, id, {
      populate: {
        client: { fields: ['company_name'] }, project_manager: { fields: ['display_name'] },
        version: { fields: ['version_number', 'net_total', 'payment_terms_days'], populate: { proposal: { fields: ['reference', 'title'] } } },
        contract: { fields: ['reference', 'state'] }, opportunity: { fields: ['title'] },
        workstreams: { populate: { owner: { fields: ['display_name'] }, product: { fields: ['name'] }, provider: { fields: ['name'] }, proposal_lines: { fields: ['description', 'net_price'] } } },
      },
    }, 'Project');
    const mine = p.project_manager?.documentId === crm.profileId || (p.workstreams || []).some((w) => w.owner?.documentId === crm.profileId);
    if (!mine) await access().assertClient(crm, p.client?.documentId);
    return p;
  }

  function canManage(crm, project, ws) {
    if (crm.can.manager || crm.role === 'admin') return true;
    if (project.project_manager?.documentId === crm.profileId) return true;
    if (ws && ws.owner?.documentId === crm.profileId) return true;
    return false;
  }

  async function snapshot(project, label, changeRequestId) {
    const ws = await store().find(UID.workstream, { filters: { project: { documentId: project.documentId } } });
    return store().create(UID.baseline, {
      project: project.documentId, change_request: changeRequestId || null, label,
      snapshot: {
        project: { start_date: project.start_date, end_date: project.end_date, contracted_value: num(project.contracted_value), budget: num(project.budget) },
        workstreams: ws.map((w) => ({ id: w.documentId, name: w.name, planned_start: w.planned_start, planned_end: w.planned_end, budget: num(w.budget), allocated_revenue: num(w.allocated_revenue), state: w.state })),
        taken_at: nowIso(),
      },
    });
  }

  async function refreshCosts(wsId) {
    const entries = await store().find(UID.costEntry, { filters: { workstream: { documentId: wsId } }, limit: 5000 });
    const actual = entries.filter((e) => e.kind === 'actual').reduce((a, e) => a + num(e.amount), 0);
    const committed = entries.filter((e) => e.kind === 'committed').reduce((a, e) => a + num(e.amount), 0);
    await store().update(UID.workstream, wsId, { actual_cost: money(actual), committed_cost: money(committed) });
    return { actual, committed };
  }

  async function refreshProject(projectId) {
    const p = await store().one(UID.project, projectId, { populate: ['workstreams'] });
    if (!p) return;
    const ws = p.workstreams || [];
    const over = ws.some((w) => num(w.actual_cost) > num(w.budget) && num(w.budget) > 0);
    const late = ws.some((w) => OPEN_WS.includes(w.state) && w.planned_end && w.planned_end < today());
    const blocked = ws.some((w) => w.state === 'blocked');
    const health = late && over ? 'off_track' : (over || late || blocked ? 'at_risk' : 'on_track');
    const patch = { health };
    if (!p.state_overridden && !['completed', 'cancelled'].includes(p.state)) {
      const starts = ws.map((w) => w.planned_start).filter(Boolean).sort();
      const ends = ws.map((w) => w.planned_end).filter(Boolean).sort();
      if (starts.length) patch.start_date = starts[0];
      if (ends.length) patch.end_date = ends[ends.length - 1];
    }
    await store().update(UID.project, projectId, patch);
  }

  return {
    refreshProject,

    async createFromVersion(crm, versionId, data = {}) {
      const v = await store().must(UID.version, versionId, {
        populate: { proposal: { populate: ['client', 'opportunity', 'owner'] }, lines: { populate: ['product', 'provider'], sort: ['sort:asc'] } },
      }, 'Proposal version');
      await access().assertClient(crm, v.proposal.client.documentId);
      if (v.state !== 'accepted') fail('Only an accepted proposal can start a project.');
      const existing = await store().first(UID.project, { filters: { version: { documentId: versionId } } });
      if (existing) return { project: { id: existing.documentId, name: existing.name }, existed: true };

      const lines = v.lines || [];
      const groups = (data.groups && data.groups.length ? data.groups : lines.map((l) => ({ line_ids: [l.documentId] })))
        .map((g) => ({ ...g, lines: lines.filter((l) => g.line_ids.includes(l.documentId)) }))
        .filter((g) => g.lines.length);
      const covered = new Set(groups.flatMap((g) => g.line_ids));
      lines.filter((l) => !covered.has(l.documentId)).forEach((l) => groups.push({ line_ids: [l.documentId], lines: [l] }));

      const pm = data.project_manager || (crm.role === 'project_manager' ? crm.profileId : null);
      const project = await store().create(UID.project, {
        name: data.name || v.proposal.title || v.proposal.reference,
        client: v.proposal.client.documentId, version: versionId, opportunity: v.proposal.opportunity?.documentId || null,
        contract: data.contract || null, project_manager: pm,
        contracted_value: money(v.net_total), budget: money(v.cost_total), state: 'active', health: 'on_track',
      });

      const owners = [];
      for (const g of groups) {
        const ls = g.lines;
        const duration = ls.map((l) => l.duration_type || 'fixed_term').sort((a, b) => DURATION_RANK[b] - DURATION_RANK[a])[0];
        const start = ls.map((l) => l.start_date).filter(Boolean).sort()[0] || data.start_date || today();
        const end = ls.map((l) => l.end_date).filter(Boolean).sort().pop() || addDays(start, DEFAULT_DAYS[duration]);
        const net = ls.reduce((a, l) => a + num(l.net_price), 0);
        const cost = ls.reduce((a, l) => a + num(l.internal_cost) + num(l.third_party_cost) + num(l.other_cost), 0);
        const owner = g.owner || pm || null;
        owners.push(owner);
        const ws = await store().create(UID.workstream, {
          project: project.documentId, name: g.name || ls[0].product?.name || ls[0].description,
          owner, product: ls[0].product?.documentId || null, provider: ls[0].provider?.documentId || null,
          proposal_lines: ls.map((l) => l.documentId), duration_type: duration,
          planned_start: start, planned_end: end, state: 'pending', is_required: true,
          budget: money(cost), forecast_cost: money(cost), allocated_revenue: money(net),
        });
        if (duration === 'long_running') {
          const months = Math.min(36, Math.max(1, Math.ceil(daysBetween(start, end) / 30.4)));
          let given = 0;
          for (let i = 0; i < months; i += 1) {
            const amount = i === months - 1 ? net - given : Math.round(net / months);
            given += amount;
            await store().create(UID.billingItem, {
              project: project.documentId, workstream: ws.documentId, label: `${ws.name} · month ${i + 1} of ${months}`,
              amount: money(amount), trigger_type: 'monthly', due_date: addDays(start, Math.round(30.4 * (i + 1))), state: 'not_billed',
            });
          }
        } else {
          await store().create(UID.billingItem, {
            project: project.documentId, workstream: ws.documentId, label: `${ws.name} · on completion`,
            amount: money(net), trigger_type: 'completion', due_date: end, state: 'not_billed',
          });
        }
      }
      const lpos = await store().find(UID.lpo, { filters: { version: { documentId: versionId } } });
      for (const l of lpos) await store().update(UID.lpo, l.documentId, { project: project.documentId });
      await refreshProject(project.documentId);
      const fresh = await store().one(UID.project, project.documentId);
      await snapshot(fresh, 'Original plan');
      await notify().toProfiles([pm, ...owners], {
        event: 'project.created', title: `New project: ${project.name}`,
        body: `${v.proposal.client.company_name} · ${groups.length} workstream${groups.length > 1 ? 's' : ''} · UGX ${fmtM(v.net_total)}`,
        link: `/crm/projects/${project.documentId}`,
      }, crm.profileId);
      await audit().log(crm, 'project.create', UID.project, project.documentId, null, { version: versionId, workstreams: groups.length });
      return { project: { id: project.documentId, name: project.name }, workstreams: groups.length };
    },

    async list(crm, { state, q } = {}) {
      const ids = await access().visibleClientIds(crm);
      const filters = {};
      if (ids !== null) {
        filters.$or = [
          { client: { documentId: { $in: ids.length ? ids : ['__none__'] } } },
          { project_manager: { documentId: crm.profileId } },
          { workstreams: { owner: { documentId: crm.profileId } } },
        ];
      }
      if (state && state !== 'all') filters.state = state;
      if (q) filters.name = { $containsi: q };
      const items = await store().find(UID.project, {
        filters, sort: ['updatedAt:desc'], limit: 200,
        populate: { client: { fields: ['company_name'] }, project_manager: { fields: ['display_name'] }, workstreams: { fields: ['name', 'state', 'is_required', 'budget', 'actual_cost'] } },
      });
      return {
        items: items.map((p) => {
          const ws = p.workstreams || [];
          const open = ws.filter((w) => w.is_required && OPEN_WS.includes(w.state)).length;
          return { ...p, open_workstreams: open, done_workstreams: ws.filter((w) => w.state === 'completed').length, total_workstreams: ws.length };
        }),
      };
    },

    async get(crm, id) {
      const p = await loadProject(crm, id);
      const wsIds = (p.workstreams || []).map((w) => w.documentId);
      const [milestones, tasks, billing, invoices, changes, baselines, contacts, rules] = await Promise.all([
        wsIds.length ? store().find(UID.milestone, { filters: { workstream: { documentId: { $in: wsIds } } }, populate: { workstream: { fields: ['name'] } }, sort: ['baseline_date:asc'] }) : [],
        store().find(UID.task, { filters: { project: { documentId: id } }, populate: { assignee: { fields: ['display_name'] }, workstream: { fields: ['name'] }, depends_on: { fields: ['title', 'state'] } }, sort: ['due_date:asc'], limit: 500 }),
        store().find(UID.billingItem, { filters: { project: { documentId: id } }, populate: { workstream: { fields: ['name'] }, invoice: true }, sort: ['due_date:asc'] }),
        store().find(UID.invoice, { filters: { project: { documentId: id } }, sort: ['due_date:asc'] }),
        store().find(UID.changeRequest, { filters: { project: { documentId: id } }, populate: { workstream: { fields: ['name'] }, requested_by: { fields: ['display_name'] } }, sort: ['createdAt:desc'] }),
        store().find(UID.baseline, { filters: { project: { documentId: id } }, sort: ['createdAt:desc'] }),
        store().find(UID.projectContact, { filters: { project: { documentId: id } }, populate: ['contact'] }),
        wsIds.length ? store().find(UID.recurringRule, { filters: { workstream: { documentId: { $in: wsIds } } }, populate: { workstream: { fields: ['name'] }, assignee: { fields: ['display_name'] } } }) : [],
      ]);
      const workstreams = (p.workstreams || []).map((w) => {
        const budget = num(w.budget);
        const actual = num(w.actual_cost);
        return {
          ...w,
          overrun: budget > 0 && actual > budget,
          overrun_pct: budget > 0 ? Math.round(((actual - budget) / budget) * 1000) / 10 : 0,
          late: OPEN_WS.includes(w.state) && w.planned_end && w.planned_end < today(),
          milestones: milestones.filter((m) => m.workstream?.documentId === w.documentId),
          open_tasks: tasks.filter((t) => t.workstream?.documentId === w.documentId && !['completed', 'cancelled'].includes(t.state)).length,
        };
      });
      const openRequired = workstreams.filter((w) => w.is_required && OPEN_WS.includes(w.state));
      const invoiced = invoices.filter((i) => !['requested', 'cancelled'].includes(i.state)).reduce((a, i) => a + num(i.amount), 0);
      const outstanding = invoices.filter((i) => !['requested', 'cancelled', 'written_off'].includes(i.state)).reduce((a, i) => a + num(i.balance), 0);
      const overdue = invoices.filter((i) => num(i.balance) > 0 && i.due_date && i.due_date < today() && !['requested', 'cancelled', 'written_off'].includes(i.state)).reduce((a, i) => a + num(i.balance), 0);
      return {
        project: p,
        workstreams,
        tasks, billing, invoices, changes, baselines, contacts, recurring: rules,
        finance: { contracted: num(p.contracted_value), invoiced, received: Math.max(0, invoiced - outstanding), outstanding, overdue },
        costs: { budget: workstreams.reduce((a, w) => a + num(w.budget), 0), actual: workstreams.reduce((a, w) => a + num(w.actual_cost), 0) },
        closure: {
          can_close: openRequired.length === 0 && !['completed', 'cancelled'].includes(p.state),
          blocking: openRequired.map((w) => ({ id: w.documentId, name: w.name, planned_end: w.planned_end })),
          text: openRequired.length
            ? `Close becomes available when ${openRequired.map((w) => w.name).join(', ')} ${openRequired.length > 1 ? 'are' : 'is'} completed, or by an approved early closure.`
            : 'All required workstreams are complete.',
        },
        can: { manage: canManage(crm, p) },
      };
    },

    async updateWorkstream(crm, wsId, data) {
      const ws = await store().must(UID.workstream, wsId, { populate: ['project', 'owner'] }, 'Workstream');
      const project = await loadProject(crm, ws.project.documentId);
      if (!canManage(crm, project, ws)) forbid('Only the project manager or the workstream owner can update it.');
      const patch = {};
      if (data.owner !== undefined) patch.owner = data.owner;
      if (data.completion_note !== undefined) patch.completion_note = data.completion_note;
      if (data.state && data.state !== ws.state) {
        if (data.state === 'cancelled') fail('Cancelling a workstream needs an approved change request.');
        if (data.state === 'completed') {
          const note = data.completion_note || ws.completion_note;
          if (!note || !String(note).trim()) fail('Add the completion evidence (what was delivered and who accepted it) before completing.');
          patch.actual_end = data.actual_end || today();
          if (!ws.actual_start) patch.actual_start = ws.planned_start || today();
        }
        if (data.state === 'in_progress' && !ws.actual_start) patch.actual_start = data.actual_start || today();
        if (data.state === 'blocked' && !data.reason) fail('Say what is blocking it.');
        patch.state = data.state;
      }
      if (ws.state === 'pending' && (data.planned_start || data.planned_end) && canManage(crm, project)) {
        if (data.planned_start) patch.planned_start = data.planned_start;
        if (data.planned_end) patch.planned_end = data.planned_end;
      }
      await store().update(UID.workstream, wsId, patch);
      if (patch.state === 'completed') {
        const items = await store().find(UID.billingItem, { filters: { workstream: { documentId: wsId }, trigger_type: 'completion', state: 'not_billed' } });
        for (const b of items) await store().update(UID.billingItem, b.documentId, { due_date: today() });
        if (items.length) {
          await notify().toRole('finance', {
            event: 'billing.ready', title: `Ready to bill: ${ws.name}`, body: `${project.name} · ${project.client?.company_name}`, link: `/crm/projects/${project.documentId}`,
          });
        }
      }
      if (patch.state === 'blocked') {
        await store().create(UID.task, { workstream: wsId, project: project.documentId, title: `Unblock: ${data.reason}`, assignee: project.project_manager?.documentId || null, state: 'pending', priority: 'high', due_date: addDays(null, 2) });
      }
      await refreshProject(project.documentId);
      await audit().log(crm, 'workstream.update', UID.workstream, wsId, { state: ws.state }, patch);
      return { ok: true, state: patch.state || ws.state };
    },

    async addMilestone(crm, wsId, data) {
      const ws = await store().must(UID.workstream, wsId, { populate: ['project', 'owner'] }, 'Workstream');
      const project = await loadProject(crm, ws.project.documentId);
      if (!canManage(crm, project, ws)) forbid();
      if (!data.name) fail('Name the milestone.');
      const m = await store().create(UID.milestone, {
        workstream: wsId, name: data.name, baseline_date: data.baseline_date || null, revised_date: null,
        is_billing_trigger: Boolean(data.is_billing_trigger), billing_amount: money(data.billing_amount || 0), state: 'pending',
      });
      if (data.is_billing_trigger && num(data.billing_amount) > 0) {
        await store().create(UID.billingItem, {
          project: project.documentId, workstream: wsId, milestone: m.documentId, label: `${ws.name} · ${data.name}`,
          amount: money(data.billing_amount), trigger_type: 'milestone', due_date: data.baseline_date || null, state: 'not_billed',
        });
      }
      return { milestone: { id: m.documentId } };
    },

    async updateMilestone(crm, id, data) {
      const m = await store().must(UID.milestone, id, { populate: { workstream: { populate: ['project', 'owner'] } } }, 'Milestone');
      const project = await loadProject(crm, m.workstream.project.documentId);
      if (!canManage(crm, project, m.workstream)) forbid();
      const patch = {};
      if (data.state === 'done') { patch.state = 'done'; patch.actual_date = data.actual_date || today(); patch.evidence_note = data.evidence_note || m.evidence_note; }
      if (data.revised_date) patch.revised_date = data.revised_date;
      await store().update(UID.milestone, id, patch);
      if (patch.state === 'done' && m.is_billing_trigger) {
        const items = await store().find(UID.billingItem, { filters: { milestone: { documentId: id }, state: 'not_billed' } });
        for (const b of items) await store().update(UID.billingItem, b.documentId, { due_date: today() });
      }
      await audit().log(crm, 'milestone.update', UID.milestone, id, { state: m.state }, patch);
      return { ok: true };
    },

    async addTask(crm, data) {
      const ws = await store().must(UID.workstream, data.workstream, { populate: ['project', 'owner'] }, 'Workstream');
      const project = await loadProject(crm, ws.project.documentId);
      if (!canManage(crm, project, ws)) forbid();
      if (!data.title) fail('Give the task a title.');
      const t = await store().create(UID.task, {
        workstream: ws.documentId, project: project.documentId, title: data.title, description: data.description || null,
        assignee: data.assignee || crm.profileId, supporters: data.supporters || [], start_date: data.start_date || null,
        due_date: data.due_date || null, priority: data.priority || 'normal', state: 'pending', depends_on: data.depends_on || null,
      });
      if (data.assignee && data.assignee !== crm.profileId) {
        await notify().toProfiles([data.assignee], { event: 'task.assigned', title: `New task: ${data.title}`, body: `${project.name}${data.due_date ? ` · due ${data.due_date}` : ''}`, link: `/crm/projects/${project.documentId}` });
      }
      return { task: { id: t.documentId } };
    },

    async updateTask(crm, id, data) {
      const t = await store().must(UID.task, id, { populate: { depends_on: true, assignee: true, project: true, workstream: { populate: ['owner'] } } }, 'Task');
      const project = await loadProject(crm, t.project.documentId);
      const mine = t.assignee?.documentId === crm.profileId;
      if (!mine && !canManage(crm, project, t.workstream)) forbid();
      const patch = {};
      if (data.state && data.state !== t.state) {
        if (['in_progress', 'completed'].includes(data.state) && t.depends_on && t.depends_on.state !== 'completed') {
          fail(`Blocked by “${t.depends_on.title}”, which isn't completed yet.`);
        }
        patch.state = data.state;
        if (data.state === 'completed') patch.completed_at = nowIso();
      }
      ['evidence_note', 'due_date', 'priority', 'assignee', 'title'].forEach((k) => { if (data[k] !== undefined) patch[k] = data[k]; });
      await store().update(UID.task, id, patch);
      return { ok: true };
    },

    async addCost(crm, wsId, data) {
      const ws = await store().must(UID.workstream, wsId, { populate: ['project', 'owner'] }, 'Workstream');
      const project = await loadProject(crm, ws.project.documentId);
      if (!canManage(crm, project, ws) && !['finance', 'procurement'].includes(crm.role)) forbid();
      if (!(num(data.amount) > 0)) fail('Enter the cost amount.');
      const e = await store().create(UID.costEntry, {
        workstream: wsId, amount: money(data.amount), cost_type: data.cost_type || 'internal', kind: data.kind || 'actual',
        incurred_on: data.incurred_on || today(), source_ref: data.source_ref || null, note: data.note || null,
        procurement_order: data.procurement_order || null, entered_by: crm.profileId,
      });
      const sums = await refreshCosts(wsId);
      await refreshProject(project.documentId);
      await audit().log(crm, 'cost.add', UID.costEntry, e.documentId, null, { amount: num(data.amount), workstream: wsId });
      return { cost: { id: e.documentId }, ...sums, over_budget: num(ws.budget) > 0 && sums.actual > num(ws.budget) };
    },

    async addRecurringRule(crm, wsId, data) {
      const ws = await store().must(UID.workstream, wsId, { populate: ['project', 'owner'] }, 'Workstream');
      const project = await loadProject(crm, ws.project.documentId);
      if (!canManage(crm, project, ws)) forbid();
      if (!data.title) fail('Describe the repeating work.');
      const r = await store().create(UID.recurringRule, {
        workstream: wsId, title: data.title, frequency: data.frequency || 'monthly', start_date: data.start_date || ws.planned_start || today(),
        end_date: data.end_date || ws.planned_end || null, day_of_month: Number(data.day_of_month) || 1,
        assignee: data.assignee || ws.owner?.documentId || crm.profileId, is_active: true,
      });
      await this.runRecurring(r.documentId);
      return { rule: { id: r.documentId } };
    },

    /** Generates the task for the current period of each active rule (idempotent). */
    async runRecurring(onlyRuleId) {
      const filters = { is_active: true };
      if (onlyRuleId) filters.documentId = onlyRuleId;
      const rules = await store().find(UID.recurringRule, { filters, populate: { workstream: { populate: ['project'] }, assignee: true }, limit: 2000 });
      const t = today();
      let created = 0;
      for (const r of rules) {
        if (r.start_date && r.start_date > addDays(t, 31)) continue;
        if (r.end_date && r.end_date < t) continue;
        const d = new Date();
        let periodStart;
        if (r.frequency === 'weekly') { const day = (d.getDay() + 6) % 7; periodStart = addDays(t, -day); }
        else if (r.frequency === 'quarterly') periodStart = `${t.slice(0, 4)}-${String(Math.floor(d.getMonth() / 3) * 3 + 1).padStart(2, '0')}-01`;
        else periodStart = `${t.slice(0, 7)}-01`;
        if (r.last_generated_for && r.last_generated_for >= periodStart) continue;
        const due = r.frequency === 'weekly' ? addDays(periodStart, 4) : `${periodStart.slice(0, 8)}${String(Math.min(28, r.day_of_month || 1)).padStart(2, '0')}`;
        await store().create(UID.task, {
          workstream: r.workstream?.documentId, project: r.workstream?.project?.documentId, title: `${r.title} (${periodStart.slice(0, 7)})`,
          assignee: r.assignee?.documentId || null, due_date: due, state: 'pending', priority: 'normal', recurring_rule: r.documentId,
        });
        await store().update(UID.recurringRule, r.documentId, { last_generated_for: periodStart });
        created += 1;
      }
      return { created };
    },

    async requestChange(crm, projectId, data) {
      const project = await loadProject(crm, projectId);
      if (!canManage(crm, project) && !crm.spId) forbid();
      if (!data.change_type) fail('Choose the type of change.');
      if (!data.reason) fail('Explain the reason for the change.');
      const cr = await store().create(UID.changeRequest, {
        project: projectId, workstream: data.workstream || null, change_type: data.change_type, reason: data.reason,
        price_impact: money(data.price_impact || 0), cost_impact: money(data.cost_impact || 0),
        new_end_date: data.new_end_date || null, state: 'pending', requested_by: crm.profileId, client_accepted: Boolean(data.client_accepted),
      });
      const trigger = ['early_closure', 'cancellation'].includes(data.change_type) ? 'early_closure' : 'change_request';
      await approvals().request(crm, {
        trigger_type: trigger, detail: `${project.name}: ${data.change_type.replace('_', ' ')}${num(data.price_impact) ? ` (${fmtM(data.price_impact)})` : ''}`,
        subject_type: 'change_request', subject_id: cr.documentId,
      });
      await audit().log(crm, 'change.request', UID.changeRequest, cr.documentId, null, data);
      return { change_request: { id: cr.documentId } };
    },

    /** Applies an approved change on a new baseline; the original plan is kept. */
    async onChangeDecision(crm, crId, decision) {
      const cr = await store().must(UID.changeRequest, crId, { populate: ['project', 'workstream', 'requested_by'] }, 'Change request');
      if (decision !== 'approved') {
        await store().update(UID.changeRequest, crId, { state: 'rejected', approver: crm.profileId, decided_at: nowIso() });
        return { applied: false };
      }
      const project = await store().one(UID.project, cr.project.documentId);
      await snapshot(project, `Before change: ${cr.change_type}`, crId);
      const ws = cr.workstream;
      if (cr.change_type === 'extension' && cr.new_end_date) {
        if (ws) await store().update(UID.workstream, ws.documentId, { planned_end: cr.new_end_date });
      } else if (['cancellation', 'early_closure'].includes(cr.change_type) && ws) {
        await store().update(UID.workstream, ws.documentId, { state: 'cancelled', is_required: false, completion_note: `Closed by approved change: ${cr.reason}` });
        const items = await store().find(UID.billingItem, { filters: { workstream: { documentId: ws.documentId }, state: 'not_billed' } });
        for (const b of items) await store().update(UID.billingItem, b.documentId, { state: 'cancelled' });
      }
      if (num(cr.price_impact) || num(cr.cost_impact)) {
        if (ws) {
          const w = await store().one(UID.workstream, ws.documentId);
          await store().update(UID.workstream, ws.documentId, { allocated_revenue: money(num(w.allocated_revenue) + num(cr.price_impact)), budget: money(num(w.budget) + num(cr.cost_impact)) });
        }
        await store().update(UID.project, project.documentId, { contracted_value: money(num(project.contracted_value) + num(cr.price_impact)), budget: money(num(project.budget) + num(cr.cost_impact)) });
      }
      await store().update(UID.changeRequest, crId, { state: 'applied', approver: crm.profileId, decided_at: nowIso() });
      await refreshProject(project.documentId);
      await audit().log(crm, 'change.apply', UID.changeRequest, crId, null, { type: cr.change_type });
      return { applied: true };
    },

    async close(crm, projectId, { reason, override } = {}) {
      const data = await this.get(crm, projectId);
      const p = data.project;
      if (!canManage(crm, p)) forbid('Only the project manager or a manager can close a project.');
      if (data.closure.can_close) {
        await store().update(UID.project, projectId, { state: 'completed', closed_at: nowIso(), closure_reason: reason || 'All required workstreams completed' });
        await audit().log(crm, 'project.close', UID.project, projectId, { state: p.state }, { state: 'completed' });
        return { closed: true };
      }
      if (!override) fail(data.closure.text, { blocking: data.closure.blocking });
      if (!reason) fail('Give the reason for closing early.');
      await approvals().request(crm, { trigger_type: 'early_closure', detail: `Close ${p.name} early: ${reason}`, subject_type: 'project_closure', subject_id: projectId });
      return { closed: false, approval_requested: true };
    },

    async onClosureDecision(crm, projectId, decision, reason) {
      if (decision !== 'approved') return { closed: false };
      await store().update(UID.project, projectId, { state: 'completed', state_overridden: true, closed_at: nowIso(), closure_reason: reason || 'Closed early by approved decision' });
      await audit().log(crm, 'project.close.override', UID.project, projectId, null, { reason });
      return { closed: true };
    },

    async addContact(crm, projectId, { contact, role }) {
      const p = await loadProject(crm, projectId);
      if (!canManage(crm, p)) forbid();
      return store().create(UID.projectContact, { project: projectId, contact, role: role || 'coordinator' });
    },

    uniq,
  };
};
