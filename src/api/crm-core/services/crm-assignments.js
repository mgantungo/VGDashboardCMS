'use strict';

/**
 * Client ↔ sales person ownership (Client Assignment) and the two manager views:
 * the team map (group manager) and the company coverage map (overall manager).
 */
const {
  UID, num, today, daysBetween, forbid, fail, uniq, fmtM,
} = require('../utils/crm-helpers');

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const notify = () => strapi.service('api::crm-core.crm-notify');
  const config = () => strapi.service('api::crm-core.crm-config');
  const clients = () => strapi.service('api::crm-core.crm-clients');

  /** Facts per client used by both maps. */
  async function clientFacts(clientIds) {
    if (!clientIds.length) return {};
    const s = store();
    const [profiles, assigns, opps, contribs, revenue] = await Promise.all([
      s.rows(UID.clientProfile, { where: { client: { documentId: { $in: clientIds } } }, populate: { client: { select: ['id', 'documentId'] } } }),
      s.rows(UID.assignment, {
        where: { client: { documentId: { $in: clientIds } }, state: 'active' },
        populate: { client: { select: ['id', 'documentId'] }, business_unit: { select: ['id', 'documentId', 'name'] } },
      }),
      s.rows(UID.opportunity, {
        where: { client: { documentId: { $in: clientIds } }, state: 'open' },
        select: ['id', 'documentId', 'expected_revenue'], populate: { client: { select: ['id', 'documentId'] } },
      }),
      s.rows(UID.oppContributor, {
        where: { opportunity: { client: { documentId: { $in: clientIds } }, state: 'open' } },
        populate: { business_unit: { select: ['id', 'name'] }, opportunity: { populate: { client: { select: ['id', 'documentId'] } } } },
      }),
      s.rows(UID.proposal, {
        where: { client: { documentId: { $in: clientIds } }, state: 'accepted' },
        populate: { client: { select: ['id', 'documentId'] }, accepted_version: { select: ['id', 'net_total', 'accepted_at'] } },
      }),
    ]);
    const facts = {};
    const f = (id) => { facts[id] = facts[id] || { units: new Set(), pipe: 0, revenue: 0, last: null }; return facts[id]; };
    profiles.forEach((p) => { const x = f(p.client?.documentId); x.last = p.last_contact_at; x.profile = p; });
    assigns.forEach((a) => { if (a.business_unit?.name) f(a.client?.documentId).units.add(a.business_unit.name); });
    contribs.forEach((c) => { if (c.business_unit?.name) f(c.opportunity?.client?.documentId).units.add(c.business_unit.name); });
    opps.forEach((o) => { f(o.client?.documentId).pipe += num(o.expected_revenue); });
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    revenue.forEach((p) => {
      if (p.accepted_version && (!p.accepted_version.accepted_at || p.accepted_version.accepted_at >= yearAgo)) {
        f(p.client?.documentId).revenue += num(p.accepted_version.net_total);
      }
    });
    return facts;
  }

  async function teamMembers(teamId) {
    return store().find(UID.profile, {
      filters: { team: { documentId: teamId }, is_active: true },
      populate: ['sales_person'],
      sort: ['display_name:asc'],
    });
  }

  async function assertCanAssign(crm, clientId) {
    if (!crm.can.assign) forbid('Only managers can reassign clients.');
    if (crm.can.scope === 'team') {
      const sps = await access().visibleSalesPersonIds(crm);
      const leads = await store().rows(UID.assignment, {
        where: { client: { documentId: clientId } },
        populate: { sales_person: { select: ['id', 'documentId'] } },
        orderBy: { id: 'desc' }, limit: 5,
      });
      const inTeam = leads.some((l) => sps.includes(l.sales_person?.documentId)) || !leads.length;
      if (!inTeam) forbid('This client belongs to another team.');
    }
  }

  return {
    clientFacts,

    async leadFor(clientId) {
      return store().first(UID.assignment, {
        filters: { client: { documentId: clientId }, role: 'account_lead', state: 'active' },
        populate: ['sales_person'],
      });
    },

    /** Moves (or sets) the account lead. Ends the previous lead's assignment, keeps history. */
    async assign(crm, { client, sales_person: spId, role = 'account_lead', reason }) {
      if (!client || !spId) fail('Choose a client and a person.');
      await assertCanAssign(crm, client);
      const sp = await store().must(UID.salesPerson, spId, { fields: ['name'] }, 'Sales person');
      const clientDoc = await store().must(UID.client, client, { fields: ['company_name'] }, 'Client');
      const prof = await store().first(UID.profile, { filters: { sales_person: { documentId: spId } }, populate: ['business_unit'] });

      let from = null;
      if (role === 'account_lead') {
        const current = await store().find(UID.assignment, {
          filters: { client: { documentId: client }, role: 'account_lead', state: 'active' }, populate: ['sales_person'],
        });
        for (const a of current) {
          if (a.sales_person?.documentId === spId) return { unchanged: true };
          from = a.sales_person;
          await store().update(UID.assignment, a.documentId, { state: 'ended', end_date: today(), reason: reason || 'Reassigned' });
        }
        // open deals follow the new lead
        const opps = await store().find(UID.opportunity, {
          filters: { client: { documentId: client }, state: 'open' }, populate: ['lead_sales_person'],
        });
        for (const o of opps) {
          if (!o.lead_sales_person || o.lead_sales_person.documentId === from?.documentId) {
            await store().update(UID.opportunity, o.documentId, { lead_sales_person: spId });
          }
        }
      }
      const created = await store().create(UID.assignment, {
        client, sales_person: spId, role, business_unit: prof?.business_unit?.documentId || null,
        start_date: today(), state: 'active', assigned_by: crm.profileId, reason: reason || null,
      });
      await audit().log(crm, 'assignment.move', UID.assignment, created.documentId, { lead: from?.documentId || null }, { lead: spId, client, role });
      const msg = {
        event: 'assignment.changed',
        title: `${clientDoc.company_name} is now with ${sp.name}`,
        body: from ? `Previously looked after by ${from.name}. Client history moves with it.` : 'You are the account lead.',
        link: `/crm/clients/${client}`,
      };
      await notify().toSalesPersons([spId, from?.documentId], msg, crm.profileId);
      return { moved: true, from: from ? { id: from.documentId, name: from.name } : null, to: { id: spId, name: sp.name } };
    },

    async bulkAssign(crm, { moves = [] }) {
      const results = [];
      for (const m of moves) results.push(await this.assign(crm, m));
      return { results };
    },

    async endAssignment(crm, assignmentId, reason) {
      const a = await store().must(UID.assignment, assignmentId, { populate: ['client'] }, 'Assignment');
      await assertCanAssign(crm, a.client?.documentId);
      await store().update(UID.assignment, assignmentId, { state: 'ended', end_date: today(), reason: reason || 'Ended' });
      await audit().log(crm, 'assignment.end', UID.assignment, assignmentId, a, { state: 'ended' });
      return { ended: true };
    },

    async teamsForMe(crm) {
      if (['executive', 'senior_manager', 'admin', 'finance'].includes(crm.role)) {
        return store().find(UID.team, { filters: { is_active: true }, populate: ['supervisor', 'business_unit'], sort: ['name:asc'] });
      }
      const filters = { $or: [{ supervisor: { documentId: crm.profileId } }] };
      if (crm.teamId) filters.$or.push({ documentId: crm.teamId });
      return store().find(UID.team, { filters, populate: ['supervisor', 'business_unit'], sort: ['name:asc'] });
    },

    /** Group manager view: one column per person, their clients, plus clients with no owner. */
    async teamMap(crm, { team: teamId } = {}) {
      if (!crm.can.manager && !crm.can.admin) forbid('The team map is for managers.');
      const teams = await this.teamsForMe(crm);
      const team = teams.find((t) => t.documentId === teamId) || teams[0];
      if (!team) return { teams: [], team: null, reps: [], unassigned: [], kpis: {} };
      const settings = await config().settings();
      const members = (await teamMembers(team.documentId)).filter((m) => m.sales_person);
      const spIds = members.map((m) => m.sales_person.documentId);

      const leads = spIds.length ? await store().rows(UID.assignment, {
        where: { sales_person: { documentId: { $in: spIds } }, role: 'account_lead', state: 'active' },
        populate: { client: { select: ['id', 'documentId', 'company_name'] }, sales_person: { select: ['id', 'documentId'] } },
      }) : [];

      // clients last led by someone in this team but with no active lead now
      const past = spIds.length ? await store().rows(UID.assignment, {
        where: { sales_person: { documentId: { $in: spIds } }, role: 'account_lead', state: 'ended' },
        populate: { client: { select: ['id', 'documentId', 'company_name'] }, sales_person: { select: ['id', 'documentId', 'isActive'] } },
        orderBy: { id: 'desc' },
      }) : [];
      const ledNow = new Set(leads.map((l) => l.client?.documentId));
      const pastIds = uniq(past.map((p) => p.client?.documentId)).filter((id) => !ledNow.has(id));
      const stillLed = pastIds.length ? await store().rows(UID.assignment, {
        where: { client: { documentId: { $in: pastIds } }, role: 'account_lead', state: 'active' },
        populate: { client: { select: ['id', 'documentId'] } },
      }) : [];
      const ledElsewhere = new Set(stillLed.map((r) => r.client?.documentId));
      const unassignedIds = pastIds.filter((id) => !ledElsewhere.has(id));

      const allIds = uniq([...leads.map((l) => l.client?.documentId), ...unassignedIds]);
      const facts = await clientFacts(allIds);
      const card = (clientId, name, extra = {}) => {
        const fx = facts[clientId] || { units: new Set(), pipe: 0 };
        const days = fx.last ? daysBetween(fx.last, today()) : null;
        return {
          id: clientId, name, last_contact_days: days, health: clients().health(days, settings.cold_after_days),
          pipeline: fx.pipe, shared_units: [...fx.units].filter((u) => u !== team.business_unit?.name), ...extra,
        };
      };
      const reps = members.map((m) => {
        const mine = leads.filter((l) => l.sales_person?.documentId === m.sales_person.documentId)
          .map((l) => card(l.client.documentId, l.client.company_name));
        const n = mine.length;
        return {
          profile_id: m.documentId,
          sales_person_id: m.sales_person.documentId,
          name: m.sales_person.name || m.display_name,
          clients: mine.sort((a, b) => a.name.localeCompare(b.name)),
          count: n,
          pipeline: mine.reduce((a, c) => a + c.pipeline, 0),
          cold: mine.filter((c) => c.health === 'cold').length,
          load: n >= settings.heavy_load_clients ? 'heavy' : (n <= 2 ? 'light' : 'balanced'),
        };
      });
      const unassigned = unassignedIds.map((id) => {
        const last = past.find((p) => p.client?.documentId === id);
        const left = last && last.sales_person && last.sales_person.isActive === false;
        return card(id, last?.client?.company_name || 'Client', { reason: left ? 'Owner left the company' : 'No account lead' });
      });

      // one-click balancing suggestion
      let suggestion = null;
      const sorted = [...reps].sort((a, b) => b.count - a.count);
      const heavy = sorted[0]; const light = sorted[sorted.length - 1];
      if (heavy && light && heavy !== light && heavy.load === 'heavy' && heavy.cold >= 2 && light.count * 2 <= heavy.count) {
        const move = heavy.clients.filter((c) => c.health === 'cold').slice(0, 3);
        suggestion = {
          from: { id: heavy.sales_person_id, name: heavy.name },
          to: { id: light.sales_person_id, name: light.name },
          clients: move.map((c) => ({ id: c.id, name: c.name })),
          text: `${heavy.name} has ${heavy.count} clients and ${heavy.cold} haven't been contacted in over ${settings.cold_after_days} days. ${light.name} has ${light.count}.`,
        };
      }
      const all = [...reps.flatMap((r) => r.clients), ...unassigned];
      return {
        teams: teams.map((t) => ({ id: t.documentId, name: t.name })),
        team: { id: team.documentId, name: team.name, business_unit: team.business_unit?.name || null, supervisor: team.supervisor?.display_name || null },
        reps,
        unassigned,
        suggestion,
        kpis: {
          clients: all.length,
          unassigned: unassigned.length,
          cold: reps.reduce((a, r) => a + r.cold, 0),
          shared: all.filter((c) => c.shared_units.length).length,
          pipeline: all.reduce((a, c) => a + c.pipeline, 0),
          people: reps.length,
        },
        cold_after_days: settings.cold_after_days,
      };
    },

    /** Overall manager view: coverage by team, owner lookup, overlaps needing a decision. */
    async companyMap(crm, { q } = {}) {
      if (!['executive', 'senior_manager', 'admin', 'finance'].includes(crm.role)) forbid('The company view is for senior managers.');
      const settings = await config().settings();
      const s = store();
      const teams = await s.find(UID.team, { filters: { is_active: true }, populate: ['supervisor', 'business_unit'], sort: ['name:asc'] });
      const profiles = await s.rows(UID.profile, {
        where: { is_active: true },
        populate: { sales_person: { select: ['id', 'documentId', 'name'] }, team: { select: ['id', 'documentId', 'name'] } },
      });
      const spTeam = {};
      profiles.forEach((p) => { if (p.sales_person) spTeam[p.sales_person.documentId] = p.team?.documentId || null; });
      const leads = await s.rows(UID.assignment, {
        where: { role: 'account_lead', state: 'active' },
        populate: { client: { select: ['id', 'documentId', 'company_name'] }, sales_person: { select: ['id', 'documentId', 'name'] } },
      });
      const clientProfiles = await s.rows(UID.clientProfile, {
        where: { lifecycle: { $ne: 'closed' } }, populate: { client: { select: ['id', 'documentId', 'company_name'] } },
      });
      const ledIds = new Set(leads.map((l) => l.client?.documentId));
      const noOwner = clientProfiles.filter((p) => p.client && !ledIds.has(p.client.documentId));
      const allIds = uniq([...ledIds, ...noOwner.map((p) => p.client.documentId)]);
      const facts = await clientFacts(allIds);
      const daysOf = (id) => (facts[id]?.last ? daysBetween(facts[id].last, today()) : null);
      const isCold = (id) => { const d = daysOf(id); return d === null || d > settings.cold_after_days; };

      const teamRows = teams.map((t) => {
        const people = profiles.filter((p) => p.team?.documentId === t.documentId && p.sales_person);
        const teamLeads = leads.filter((l) => spTeam[l.sales_person?.documentId] === t.documentId);
        const ids = teamLeads.map((l) => l.client?.documentId);
        return {
          id: t.documentId, name: t.name, manager: t.supervisor?.display_name || null,
          people: people.length, clients: ids.length,
          per_person: people.length ? Math.round((ids.length / people.length) * 10) / 10 : 0,
          cold: ids.filter(isCold).length,
          pipeline: ids.reduce((a, id) => a + (facts[id]?.pipe || 0), 0),
        };
      });
      const totalPeople = profiles.filter((p) => p.sales_person).length;

      const rowFor = (id, name, lead) => {
        const fx = facts[id] || { units: new Set(), revenue: 0 };
        const teamId = lead ? spTeam[lead.documentId] : null;
        return {
          id, name,
          lead: lead ? { id: lead.documentId, name: lead.name } : null,
          team: teams.find((t) => t.documentId === teamId)?.name || null,
          units: [...fx.units],
          last_contact_days: daysOf(id),
          revenue_12m: fx.revenue,
        };
      };
      let lookup = [
        ...leads.map((l) => rowFor(l.client.documentId, l.client.company_name, l.sales_person)),
        ...noOwner.map((p) => rowFor(p.client.documentId, p.client.company_name, null)),
      ];
      const term = String(q || '').trim().toLowerCase();
      if (term) lookup = lookup.filter((r) => r.name.toLowerCase().includes(term) || (r.lead?.name || '').toLowerCase().includes(term));
      else {
        const top = [...lookup].sort((a, b) => b.revenue_12m - a.revenue_12m).slice(0, 8);
        const quiet = lookup.filter((r) => !top.includes(r) && (r.last_contact_days === null || r.last_contact_days > settings.cold_after_days)).slice(0, 4);
        lookup = [...top, ...quiet];
      }

      // overlaps waiting for a decision
      const overlapOpps = await s.find(UID.opportunity, {
        filters: { overlap_flag: true, overlap_resolution: 'none', state: 'open' },
        populate: { client: { fields: ['company_name'] }, lead_sales_person: { fields: ['name'] }, contributors: { populate: { sales_person: { fields: ['name'] }, business_unit: { fields: ['name'] } } } },
        sort: ['createdAt:desc'], limit: 200,
      });
      const byClient = {};
      overlapOpps.forEach((o) => { const k = o.client?.documentId; (byClient[k] = byClient[k] || []).push(o); });
      const decisions = Object.values(byClient).filter((list) => list.length >= 2).map((list) => {
        const who = list.map((o) => {
          const orig = (o.contributors || []).find((c) => c.role === 'originator') || o.contributors?.[0];
          return { opportunity: o.documentId, title: o.title, value: num(o.expected_revenue), person: orig?.sales_person?.name || o.lead_sales_person?.name, unit: orig?.business_unit?.name || null, sales_person_id: orig?.sales_person?.documentId || null };
        });
        return {
          client: { id: list[0].client?.documentId, name: list[0].client?.company_name },
          opportunities: who,
          text: `${who.map((w) => `${w.person || 'Someone'}${w.unit ? ` (${w.unit})` : ''}`).join(' and ')} are pitching ${who.map((w) => `“${w.title}” ${fmtM(w.value)}`).join(' and ')}.`,
        };
      });

      return {
        kpis: {
          clients: allIds.length,
          people: totalPeople,
          per_person: totalPeople ? Math.round((ledIds.size / totalPeople) * 10) / 10 : 0,
          no_owner: noOwner.length,
          cold: allIds.filter(isCold).length,
          multi_unit: allIds.filter((id) => (facts[id]?.units?.size || 0) >= 2).length,
        },
        teams: teamRows,
        lookup,
        decisions,
        cold_after_days: settings.cold_after_days,
      };
    },
  };
};
