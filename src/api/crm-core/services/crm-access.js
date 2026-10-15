'use strict';

/**
 * Who is calling, what they may see (record-level scope) and which
 * sensitive fields they may receive (field-level filtering).
 */
const { UID, ROLE_CAN, clean, stripCost, forbid, uniq } = require('../utils/crm-helpers');

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');

  const PROFILE_POPULATE = {
    sales_person: true,
    team: { populate: ['business_unit', 'supervisor'] },
    business_unit: true,
  };

  return {
    PROFILE_POPULATE,

    /** Builds the request's CRM context from the signed-in Strapi user. */
    async context(user) {
      let profile = await store().first(UID.profile, {
        filters: { user: { id: user.id } },
        populate: PROFILE_POPULATE,
      });
      if (!profile) profile = await this.autoProvision(user);
      const role = profile?.crm_role || null;
      return {
        user: { id: user.id, documentId: user.documentId, email: user.email, username: user.username },
        profile,
        profileId: profile?.documentId || null,
        role,
        can: ROLE_CAN[role] || {},
        spId: profile?.sales_person?.documentId || null,
        spName: profile?.sales_person?.name || profile?.display_name || user.username,
        teamId: profile?.team?.documentId || null,
        buId: profile?.business_unit?.documentId || profile?.team?.business_unit?.documentId || null,
        active: Boolean(profile && profile.is_active !== false),
        cache: {},
      };
    },

    /**
     * First CRM user becomes CRM admin. Anyone whose login email matches an
     * existing VGAMS sales person is linked to that sales person automatically.
     */
    async autoProvision(user) {
      const s = store();
      const anyProfile = await s.count(UID.profile, {});
      if (!anyProfile) {
        return s.create(UID.profile, {
          user: user.documentId, display_name: user.username, crm_role: 'admin',
        }, PROFILE_POPULATE);
      }
      if (!user.email) return null;
      const sp = await s.first(UID.salesPerson, { filters: { email: { $eqi: user.email } } });
      if (!sp) return null;
      const taken = await s.first(UID.profile, { filters: { sales_person: { documentId: sp.documentId } } });
      if (taken) return null;
      return s.create(UID.profile, {
        user: user.documentId, sales_person: sp.documentId, display_name: sp.name, crm_role: 'salesperson',
      }, PROFILE_POPULATE);
    },

    requireRole(crm, roles, message) {
      if (!roles.includes(crm.role)) forbid(message || 'Your role cannot do this.');
    },

    /** Sales person ids whose records this user may see; null means everyone. */
    async visibleSalesPersonIds(crm) {
      if (crm.cache.sps !== undefined) return crm.cache.sps;
      const s = store();
      let ids;
      const scope = crm.can.scope;
      if (scope === 'all') ids = null;
      else if (scope === 'team') {
        const teams = await s.rows(UID.team, {
          where: { $or: [{ supervisor: { documentId: crm.profileId } }, ...(crm.teamId ? [{ documentId: crm.teamId }] : [])] },
          select: ['id', 'documentId'],
        });
        const teamIds = teams.map((t) => t.documentId);
        const members = teamIds.length ? await s.rows(UID.profile, {
          where: { team: { documentId: { $in: teamIds } } },
          populate: { sales_person: { select: ['id', 'documentId'] } },
        }) : [];
        ids = uniq([crm.spId, ...members.map((m) => m.sales_person?.documentId)]);
      } else if (scope === 'bu' && crm.buId) {
        const members = await s.rows(UID.profile, {
          where: { business_unit: { documentId: crm.buId } },
          populate: { sales_person: { select: ['id', 'documentId'] } },
        });
        ids = uniq([crm.spId, ...members.map((m) => m.sales_person?.documentId)]);
      } else ids = uniq([crm.spId]);
      crm.cache.sps = ids;
      return ids;
    },

    /** Client documentIds this user may see; null means all clients. */
    async visibleClientIds(crm) {
      if (crm.cache.clients !== undefined) return crm.cache.clients;
      const s = store();
      if (crm.can.scope === 'all') { crm.cache.clients = null; return null; }
      const ids = [];
      if (crm.can.scope === 'projects') {
        const projects = await s.rows(UID.project, {
          where: { project_manager: { documentId: crm.profileId } },
          populate: { client: { select: ['id', 'documentId'] } },
        });
        const ws = await s.rows(UID.workstream, {
          where: { owner: { documentId: crm.profileId } },
          populate: { project: { populate: { client: { select: ['id', 'documentId'] } } } },
        });
        projects.forEach((p) => ids.push(p.client?.documentId));
        ws.forEach((w) => ids.push(w.project?.client?.documentId));
      }
      const sps = await this.visibleSalesPersonIds(crm);
      if (sps && sps.length) {
        const assigns = await s.rows(UID.assignment, {
          where: { sales_person: { documentId: { $in: sps } }, state: 'active' },
          populate: { client: { select: ['id', 'documentId'] } },
        });
        assigns.forEach((a) => ids.push(a.client?.documentId));
        const contribs = await s.rows(UID.oppContributor, {
          where: { sales_person: { documentId: { $in: sps } } },
          populate: { opportunity: { populate: { client: { select: ['id', 'documentId'] } } } },
        });
        contribs.forEach((c) => ids.push(c.opportunity?.client?.documentId));
      }
      crm.cache.clients = uniq(ids);
      return crm.cache.clients;
    },

    async canSeeClient(crm, clientId) {
      const ids = await this.visibleClientIds(crm);
      return ids === null || ids.includes(clientId);
    },

    async assertClient(crm, clientId) {
      if (!clientId || !(await this.canSeeClient(crm, clientId))) forbid('This client is not in your list.');
    },

    /** Filter fragment limiting a query on a collection with a `client` relation. */
    async clientFilter(crm) {
      const ids = await this.visibleClientIds(crm);
      return ids === null ? {} : { client: { documentId: { $in: ids.length ? ids : ['__none__'] } } };
    },

    /** Output shaping: documentId -> id, money -> numbers, costs hidden when not allowed. */
    shape(crm, data) {
      const out = clean(data);
      return crm && crm.can && crm.can.cost ? out : stripCost(out);
    },
  };
};
