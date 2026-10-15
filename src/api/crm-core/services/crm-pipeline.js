'use strict';

/**
 * Opportunities, contributors, the 15-stage pipeline with evidence gates,
 * overlap detection, and the 4 simple steps salespeople see.
 */
const {
  UID, num, money, today, nowIso, addDays, endOfMonth, daysBetween, fail, forbid, uniq, fmtM,
} = require('../utils/crm-helpers');

const SIZE_VALUE = { under_10m: 5000000, between_10m_50m: 30000000, over_50m: 75000000 };
const STEPS = ['talking', 'quoting', 'waiting', 'won'];
const LANES = [
  { key: 'qualify', name: 'Qualify', from: 1, to: 3 },
  { key: 'shape', name: 'Shape', from: 4, to: 6 },
  { key: 'propose', name: 'Propose', from: 7, to: 9 },
  { key: 'negotiate', name: 'Negotiate', from: 10, to: 12 },
  { key: 'close', name: 'Close', from: 13, to: 15 },
];

const OPP_POPULATE = {
  client: { fields: ['company_name', 'contact_person', 'phone', 'email'] },
  stage: true,
  lead_sales_person: { fields: ['name'] },
  interest_products: { fields: ['name', 'short_label'], populate: { business_unit: { fields: ['name'] } } },
  contributors: { populate: { sales_person: { fields: ['name'] }, business_unit: { fields: ['name'] } } },
};

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const notify = () => strapi.service('api::crm-core.crm-notify');
  const config = () => strapi.service('api::crm-core.crm-config');
  const assignments = () => strapi.service('api::crm-core.crm-assignments');

  async function assertOpp(crm, opp) {
    const isContributor = (opp.contributors || []).some((c) => c.sales_person?.documentId === crm.spId);
    if (isContributor) return;
    await access().assertClient(crm, opp.client?.documentId);
  }

  /** Which required evidence is satisfied for this opportunity right now. */
  async function evidence(opp) {
    const proposals = await store().find(UID.proposal, {
      filters: { opportunity: { documentId: opp.documentId } }, populate: ['versions', 'accepted_version'],
    });
    const versions = proposals.flatMap((p) => p.versions || []);
    const versionIds = versions.map((v) => v.documentId);
    const [lpos, contracts] = versionIds.length ? await Promise.all([
      store().count(UID.lpo, { version: { documentId: { $in: versionIds } } }),
      store().count(UID.contract, { version: { documentId: { $in: versionIds } } }),
    ]) : [0, 0];
    return {
      approved_version: versions.some((v) => ['approved', 'submitted', 'accepted'].includes(v.state)),
      accepted_version: proposals.some((p) => p.accepted_version),
      lpo_or_contract: lpos + contracts > 0,
      loss_reason: Boolean(opp.loss_reason),
    };
  }

  const EVIDENCE_TEXT = {
    approved_version: 'needs an approved or submitted quote',
    accepted_version: 'needs the client to accept a quote',
    lpo_or_contract: 'needs an LPO or a contract',
    loss_reason: 'needs a reason',
  };

  return {
    STEPS, LANES, OPP_POPULATE, evidence,

    stepInfo(stage) {
      const step = stage?.simple_step || 'talking';
      return { step, index: step === 'lost' ? -1 : STEPS.indexOf(step), label: step === 'lost' ? 'Lost' : step[0].toUpperCase() + step.slice(1) };
    },

    laneOf(position) {
      return (LANES.find((l) => position >= l.from && position <= l.to) || LANES[0]).key;
    },

    /** One-line, human status that says what the deal is waiting for. */
    async statusLine(opp) {
      if (opp.state === 'lost') return `Lost${opp.loss_reason ? ` · ${opp.loss_reason}` : ''}`;
      const proposal = await store().first(UID.proposal, {
        filters: { opportunity: { documentId: opp.documentId } },
        populate: { current_version: { populate: { approvals: true } }, accepted_version: true },
        sort: ['updatedAt:desc'],
      });
      if (opp.state === 'won' || proposal?.accepted_version) {
        const lpo = proposal?.accepted_version ? await store().count(UID.lpo, { version: { documentId: proposal.accepted_version.documentId } }) : 1;
        return lpo ? 'Won · in delivery' : 'Won · add the LPO so billing can start';
      }
      const v = proposal?.current_version;
      if (!v) return opp.next_action ? `Next: ${opp.next_action}` : 'Send a quote when ready';
      const pending = (v.approvals || []).filter((a) => a.decision === 'pending');
      if (v.state === 'in_review' && pending.length) {
        const roles = uniq(pending.map((a) => a.approver_role.replace('_', ' ')));
        return `Waiting for ${roles.join(' and ')} OK on the price`;
      }
      if (v.state === 'draft') return 'Quote being prepared';
      if (v.state === 'submitted') {
        const left = v.valid_until ? daysBetween(today(), v.valid_until) : null;
        return `Waiting for their reply${left !== null ? ` · quote ${left < 0 ? 'expired' : `expires in ${left} day${left === 1 ? '' : 's'}`}` : ''}`;
      }
      return opp.next_action ? `Next: ${opp.next_action}` : 'In progress';
    },

    async list(crm, { scope = 'visible', state = 'open', q, lane, limit = 200 } = {}) {
      const filters = { is_archived: false };
      if (state && state !== 'all') filters.state = state;
      if (scope === 'mine') {
        filters.$or = [
          { contributors: { sales_person: { documentId: crm.spId || '__none__' } } },
          { lead_sales_person: { documentId: crm.spId || '__none__' } },
        ];
      } else {
        const ids = await access().visibleClientIds(crm);
        if (ids !== null) {
          filters.$or = [
            { client: { documentId: { $in: ids.length ? ids : ['__none__'] } } },
            { contributors: { sales_person: { documentId: crm.spId || '__none__' } } },
          ];
        }
      }
      if (q) filters.$and = [{ $or: [{ title: { $containsi: q } }, { client: { company_name: { $containsi: q } } }] }];
      const opps = await store().find(UID.opportunity, { filters, populate: OPP_POPULATE, sort: ['updatedAt:desc'], limit: Math.min(Number(limit) || 200, 500) });
      const items = [];
      for (const o of opps) {
        const pos = o.stage?.position || 1;
        const item = {
          ...o,
          step: this.stepInfo(o.stage),
          lane: this.laneOf(pos),
          weighted: Math.round(num(o.expected_revenue) * (num(o.probability ?? o.stage?.default_probability) / 100)),
          status_line: await this.statusLine(o),
        };
        if (!lane || item.lane === lane) items.push(item);
      }
      const total = items.reduce((a, o) => a + num(o.expected_revenue), 0);
      const weighted = items.reduce((a, o) => a + o.weighted, 0);
      return {
        items,
        lanes: LANES.map((l) => {
          const inLane = items.filter((i) => i.lane === l.key);
          return { ...l, count: inLane.length, value: inLane.reduce((a, o) => a + num(o.expected_revenue), 0) };
        }),
        totals: { count: items.length, value: total, weighted },
      };
    },

    async get(crm, id) {
      const opp = await store().must(UID.opportunity, id, { populate: OPP_POPULATE }, 'Opportunity');
      await assertOpp(crm, opp);
      const [history, interactions, proposals, stages, ev] = await Promise.all([
        store().find(UID.stageHistory, { filters: { opportunity: { documentId: id } }, populate: ['from_stage', 'to_stage', 'changed_by'], sort: ['changed_at:desc'], limit: 50 }),
        store().find(UID.interaction, { filters: { opportunity: { documentId: id } }, populate: { sales_person: { fields: ['name'] } }, sort: ['occurred_at:desc'], limit: 30 }),
        store().find(UID.proposal, { filters: { opportunity: { documentId: id } }, populate: ['current_version', 'accepted_version'], sort: ['updatedAt:desc'] }),
        config().stages(),
        evidence(opp),
      ]);
      const pos = opp.stage?.position || 1;
      const moves = stages.filter((s) => s.position !== pos).map((s) => {
        const missing = (s.required_evidence || []).filter((k) => !ev[k]);
        return { id: s.documentId, position: s.position, name: s.name, blocked: missing.length > 0, why: missing.map((k) => EVIDENCE_TEXT[k]).join(', ') };
      });
      return {
        opportunity: opp,
        step: this.stepInfo(opp.stage),
        steps: STEPS.map((s, i) => ({ key: s, label: s[0].toUpperCase() + s.slice(1), done: i <= this.stepInfo(opp.stage).index })),
        status_line: await this.statusLine(opp),
        history, interactions, proposals, stages, moves, evidence: ev,
      };
    },

    /** Register an opportunity in as few inputs as possible; everything else is derived. */
    async create(crm, data) {
      const clientId = data.client;
      if (!clientId) fail('Choose a client.');
      const client = await store().must(UID.client, clientId, { fields: ['company_name'] }, 'Client');
      const settings = await config().settings();
      const stage = await config().stageAt(1);
      if (!stage) fail('Pipeline stages are not set up yet. Ask an administrator to run CRM setup.');

      const productIds = uniq(data.products || []);
      const products = productIds.length ? await store().find(UID.product, { filters: { documentId: { $in: productIds } }, populate: ['business_unit'] }) : [];
      let expected = num(data.expected_revenue);
      if (!expected && data.size_band) expected = SIZE_VALUE[data.size_band] || 0;
      if (!expected && products.length) expected = products.reduce((a, p) => a + num(p.list_price) * num(p.default_quantity || 1), 0);

      let decision = data.decision_date || null;
      if (data.decision === 'this_month') decision = endOfMonth(0);
      else if (data.decision === 'next_month') decision = endOfMonth(1);
      else if (data.decision === 'later') decision = addDays(null, 90);

      const label = products.map((p) => p.short_label || p.name).slice(0, 3).join(' + ');
      const monthLabel = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
      const title = (data.title && String(data.title).trim()) || `${client.company_name}${label ? ` · ${label}` : ''} · ${monthLabel}`;

      const lead = await assignments().leadFor(clientId);
      const opp = await store().create(UID.opportunity, {
        title,
        client: clientId,
        stage: stage.documentId,
        state: 'open',
        requirements: data.requirements || null,
        expected_revenue: money(expected),
        size_band: data.size_band || null,
        probability: stage.default_probability,
        decision_date: decision,
        source: data.source || 'desktop',
        interest_products: productIds,
        lead_sales_person: lead?.sales_person?.documentId || crm.spId || null,
        created_by_profile: crm.profileId,
        last_activity_at: nowIso(),
        currency: settings.currency,
      });

      // roles are relationships: originator + the client's account lead
      if (crm.spId) {
        await store().create(UID.oppContributor, {
          opportunity: opp.documentId, sales_person: crm.spId, role: 'originator', business_unit: crm.buId, state: 'active',
          expected_products: products.filter((p) => !crm.buId || p.business_unit?.documentId === crm.buId).map((p) => p.documentId),
        });
        // the registering seller can now see this client
        const hasAssign = await store().count(UID.assignment, { client: { documentId: clientId }, sales_person: { documentId: crm.spId }, state: 'active' });
        if (!hasAssign) {
          await store().create(UID.assignment, {
            client: clientId, sales_person: crm.spId, role: lead ? 'associated_seller' : 'account_lead',
            business_unit: crm.buId, start_date: today(), state: 'active', assigned_by: crm.profileId, reason: 'Registered an opportunity',
          });
        }
      }
      if (lead?.sales_person && lead.sales_person.documentId !== crm.spId) {
        await store().create(UID.oppContributor, {
          opportunity: opp.documentId, sales_person: lead.sales_person.documentId, role: 'account_lead', state: 'active',
        });
      }
      await store().create(UID.stageHistory, { opportunity: opp.documentId, to_stage: stage.documentId, changed_by: crm.profileId, note: 'Registered', changed_at: nowIso() });
      crm.cache = {};

      // overlap check against the client's other open opportunities
      const others = await store().find(UID.opportunity, {
        filters: { client: { documentId: clientId }, state: 'open', documentId: { $ne: opp.documentId } },
        populate: { contributors: { populate: { sales_person: { fields: ['name'] }, business_unit: { fields: ['name'] } } } },
      });
      const overlaps = others.map((o) => {
        const orig = (o.contributors || []).find((c) => c.role === 'originator') || o.contributors?.[0];
        return { id: o.documentId, title: o.title, value: num(o.expected_revenue), person: orig?.sales_person?.name || null, unit: orig?.business_unit?.name || null, sales_person_id: orig?.sales_person?.documentId };
      });
      if (overlaps.length) {
        await store().update(UID.opportunity, opp.documentId, { overlap_flag: true });
        for (const o of others) await store().update(UID.opportunity, o.documentId, { overlap_flag: true });
        await notify().toSalesPersons(overlaps.map((o) => o.sales_person_id), {
          event: 'opportunity.overlap',
          title: `Another deal opened with ${client.company_name}`,
          body: `${crm.spName} registered “${title}” (${fmtM(expected)}). You both have open deals with this client.`,
          link: `/crm/deals/${opp.documentId}`,
        }, crm.profileId);
      }
      if (lead?.sales_person && lead.sales_person.documentId !== crm.spId) {
        await notify().toSalesPersons([lead.sales_person.documentId], {
          event: 'opportunity.created', title: `New deal for your client ${client.company_name}`,
          body: `${crm.spName} registered “${title}”.`, link: `/crm/deals/${opp.documentId}`,
        }, crm.profileId);
      }
      await audit().log(crm, 'opportunity.create', UID.opportunity, opp.documentId, null, { title, client: clientId, expected });
      return { opportunity: { id: opp.documentId, title, expected_revenue: expected }, overlaps };
    },

    /** Stage change through a workflow action: evidence gates + history + probability. */
    async move(crm, id, { stage: stageRef, position, note, loss_reason } = {}, { system = false } = {}) {
      const opp = await store().must(UID.opportunity, id, { populate: OPP_POPULATE }, 'Opportunity');
      if (!system) await assertOpp(crm, opp);
      const target = stageRef
        ? await store().one(UID.stage, stageRef)
        : await config().stageAt(Number(position));
      if (!target) fail('Unknown stage.');
      if (opp.stage?.documentId === target.documentId) return { unchanged: true };
      const patch = {};
      if (target.is_lost) {
        const reason = loss_reason || note || opp.loss_reason;
        if (!reason) fail('Tell us why the deal was lost.');
        patch.loss_reason = reason;
      }
      const ev = await evidence({ ...opp, loss_reason: patch.loss_reason || opp.loss_reason });
      const missing = (target.required_evidence || []).filter((k) => !ev[k]);
      if (missing.length) fail(`Can't move to “${target.name}” yet: it ${missing.map((k) => EVIDENCE_TEXT[k]).join(' and ')}.`, { missing });
      Object.assign(patch, {
        stage: target.documentId,
        state: target.is_won ? 'won' : (target.is_lost ? 'lost' : 'open'),
        last_activity_at: nowIso(),
      });
      if (!opp.probability_override) patch.probability = target.default_probability;
      if (target.is_won) patch.won_at = nowIso();
      if (target.is_lost) patch.lost_at = nowIso();
      await store().update(UID.opportunity, id, patch);
      await store().create(UID.stageHistory, {
        opportunity: id, from_stage: opp.stage?.documentId || null, to_stage: target.documentId,
        changed_by: crm?.profileId || null, note: note || (system ? 'Moved automatically' : null), changed_at: nowIso(),
      });
      await audit().log(crm, 'opportunity.stage', UID.opportunity, id, { stage: opp.stage?.position }, { stage: target.position });
      return { moved: true, stage: { id: target.documentId, name: target.name, position: target.position }, step: this.stepInfo(target) };
    },

    /** Moves forward only (never backwards), used by logging, quoting and acceptance. */
    async advance(crm, id, position, note) {
      const opp = await store().one(UID.opportunity, id, { populate: ['stage'] });
      if (!opp || opp.state !== 'open') return null;
      if ((opp.stage?.position || 0) >= position) return null;
      try {
        return await this.move(crm, id, { position, note }, { system: true });
      } catch (e) {
        strapi.log.info(`[crm] auto-advance of ${id} to ${position} skipped: ${e.message}`);
        return null;
      }
    },

    async markLost(crm, id, reason) {
      const lost = await store().first(UID.stage, { filters: { is_lost: true } });
      return this.move(crm, id, { stage: lost?.documentId, loss_reason: reason, note: reason });
    },

    async update(crm, id, data) {
      const opp = await store().must(UID.opportunity, id, { populate: OPP_POPULATE }, 'Opportunity');
      await assertOpp(crm, opp);
      const patch = {};
      ['title', 'requirements', 'decision_date', 'next_action', 'next_action_due', 'size_band'].forEach((k) => { if (data[k] !== undefined) patch[k] = data[k]; });
      if (data.expected_revenue !== undefined) patch.expected_revenue = money(data.expected_revenue);
      if (data.expected_cost !== undefined && crm.can.cost) patch.expected_cost = money(data.expected_cost);
      if (data.probability !== undefined && crm.can.manager) { patch.probability = Number(data.probability); patch.probability_override = true; }
      if (data.products) patch.interest_products = uniq(data.products);
      const out = await store().update(UID.opportunity, id, patch);
      await audit().log(crm, 'opportunity.update', UID.opportunity, id, null, patch);
      return out;
    },

    async addContributor(crm, id, { sales_person: spId, role = 'product_seller', business_unit, products = [] }) {
      const opp = await store().must(UID.opportunity, id, { populate: OPP_POPULATE }, 'Opportunity');
      await assertOpp(crm, opp);
      if (!spId) fail('Choose a person.');
      const exists = (opp.contributors || []).find((c) => c.sales_person?.documentId === spId && c.role === role);
      if (exists) return { unchanged: true };
      let bu = business_unit;
      if (!bu) {
        const p = await store().first(UID.profile, { filters: { sales_person: { documentId: spId } }, populate: ['business_unit'] });
        bu = p?.business_unit?.documentId || null;
      }
      const c = await store().create(UID.oppContributor, { opportunity: id, sales_person: spId, role, business_unit: bu, expected_products: products, state: 'invited' });
      await notify().toSalesPersons([spId], {
        event: 'opportunity.contributor', title: `You've been added to “${opp.title}”`,
        body: `${crm.spName} needs your product lines, price, cost and timeline for ${opp.client?.company_name}.`, link: `/crm/deals/${id}`,
      }, crm.profileId);
      await audit().log(crm, 'opportunity.contributor.add', UID.oppContributor, c.documentId, null, { opportunity: id, sales_person: spId, role });
      return c;
    },

    /** Overall manager decides on two teams pitching the same client. */
    async resolveOverlap(crm, id, { action, lead_sales_person: leadSp }) {
      if (!crm.can.manager) forbid('Only managers can decide overlaps.');
      const opp = await store().must(UID.opportunity, id, { populate: ['client'] }, 'Opportunity');
      const group = await store().find(UID.opportunity, { filters: { client: { documentId: opp.client.documentId }, state: 'open', overlap_flag: true } });
      if (action === 'separate') {
        for (const o of group) await store().update(UID.opportunity, o.documentId, { overlap_resolution: 'separate' });
      } else if (action === 'lead') {
        if (!leadSp) fail('Choose who leads.');
        for (const o of group) {
          await store().update(UID.opportunity, o.documentId, { overlap_resolution: 'lead_set', lead_sales_person: leadSp });
          const has = await store().count(UID.oppContributor, { opportunity: { documentId: o.documentId }, sales_person: { documentId: leadSp } });
          if (!has) await store().create(UID.oppContributor, { opportunity: o.documentId, sales_person: leadSp, role: 'negotiation_lead', state: 'active' });
        }
      } else if (action === 'merge') {
        const keep = group.find((o) => o.documentId !== id);
        if (!keep) fail('Nothing to merge into.');
        const contributors = await store().find(UID.oppContributor, { filters: { opportunity: { documentId: id } }, populate: ['sales_person'] });
        for (const c of contributors) {
          await store().create(UID.oppContributor, { opportunity: keep.documentId, sales_person: c.sales_person?.documentId, role: c.role === 'originator' ? 'supporting' : c.role, state: 'active' });
        }
        await this.markLost(crm, id, `Merged into “${keep.title}”`);
        await store().update(UID.opportunity, id, { overlap_resolution: 'merged' });
        await store().update(UID.opportunity, keep.documentId, { overlap_resolution: 'merged' });
      } else fail('Unknown decision.');
      const people = await store().rows(UID.oppContributor, {
        where: { opportunity: { documentId: { $in: group.map((g) => g.documentId) } } },
        populate: { sales_person: { select: ['id', 'documentId'] } },
      });
      await notify().toSalesPersons(people.map((p) => p.sales_person?.documentId), {
        event: 'opportunity.overlap.resolved', title: `Decision on ${opp.client?.company_name}`,
        body: action === 'separate' ? 'Both deals continue separately.' : (action === 'lead' ? 'One person now leads both deals.' : 'The deals were merged.'),
        link: `/crm/clients/${opp.client.documentId}`,
      }, crm.profileId);
      await audit().log(crm, 'opportunity.overlap.resolve', UID.opportunity, id, null, { action, leadSp });
      return { resolved: true };
    },
  };
};
