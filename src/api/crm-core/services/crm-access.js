'use strict';

/**
 * Who is calling, what they may see (record-level scope) and which
 * sensitive fields they may receive (field-level filtering).
 */
const { UID, ROLE_CAN, clean, stripCost, forbid, uniq } = require('../utils/crm-helpers');

const VGU = 'api::vgams-user.vgams-user';

/**
 * VGAMS staff roles that may sign in to the CRM, and the CRM role they start with.
 * 'mdsoffice' must also exist in the vgams-user role enumeration before anyone can hold it.
 */
const STAFF_ROLES = {
  administrator: 'admin',
  finance_team: 'finance',
  mdsoffice: 'executive',
};

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');

  const PROFILE_POPULATE = {
    sales_person: true,
    vgams_user: { fields: ['name', 'email', 'role', 'isActive'] },
    team: { populate: ['business_unit', 'supervisor'] },
    business_unit: true,
  };

  return {
    PROFILE_POPULATE,

    /** Builds the CRM context object for a profile. `user` is the caller as shown in /me and the audit log. */
    build(profile, user) {
      const role = profile?.crm_role || null;
      return {
        user,
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

    /** CRM context from a Strapi Users & Permissions login (JWT). */
    async context(user) {
      let profile = await store().first(UID.profile, {
        filters: { user: { id: user.id } },
        populate: PROFILE_POPULATE,
      });
      if (!profile) profile = await this.autoProvision(user);
      return this.build(profile, { id: user.id, documentId: user.documentId, email: user.email, username: user.username });
    },

    /**
     * Who may use the CRM through the VGAMS login (module 'crm'). Read-only on both existing collections.
     * Eligible when the email is @newvision.co.ug AND either
     *   - an active vgams-user whose role is in STAFF_ROLES, or
     *   - an active vgams-sales-person.
     * Returns { email, vgamsUser, salesPerson } or null.
     */
    STAFF_ROLES,

    async eligibleByEmail(rawEmail) {
      const email = String(rawEmail || '').toLowerCase().trim();
      if (!email || email.split('@')[1] !== 'newvision.co.ug') return null;
      const vgamsUser = strapi.contentTypes[VGU] ? await strapi.db.query(VGU).findOne({
        where: { email: { $eqi: email }, isActive: true, role: { $in: Object.keys(STAFF_ROLES) } },
        select: ['id', 'documentId', 'name', 'email', 'role', 'isActive'],
      }) : null;
      const salesPerson = await strapi.db.query(UID.salesPerson).findOne({
        where: { email: { $eqi: email }, isActive: true },
        select: ['id', 'documentId', 'name', 'email', 'bc_code', 'isActive'],
      });
      if (!vgamsUser && !salesPerson) return null;
      return { email, vgamsUser, salesPerson };
    },

    /** CRM role a new profile starts with. Staff role wins over sales person; CRM_ADMIN_EMAILS can force admin. */
    startingRole({ email, vgamsUser }) {
      if (this.adminEmails().includes(email)) return 'admin';
      if (vgamsUser) return STAFF_ROLES[vgamsUser.role] || 'salesperson';
      return 'salesperson';
    },

    /**
     * Finds (or, on first sign-in, creates) the CRM profile for an eligible person and keeps its
     * links to the sales person / VGAMS user current. Rights (role, team, BU) are then managed
     * in CRM Admin → People and are not overwritten on later sign-ins.
     */
    async profileForLogin(who) {
      const s = store();
      let profile = null;
      if (who.salesPerson) profile = await s.first(UID.profile, { filters: { sales_person: { documentId: who.salesPerson.documentId } }, populate: PROFILE_POPULATE });
      if (!profile && who.vgamsUser) profile = await s.first(UID.profile, { filters: { vgams_user: { documentId: who.vgamsUser.documentId } }, populate: PROFILE_POPULATE });
      if (!profile) {
        return s.create(UID.profile, {
          sales_person: who.salesPerson?.documentId || null,
          vgams_user: who.vgamsUser?.documentId || null,
          display_name: who.salesPerson?.name || who.vgamsUser?.name || who.email,
          crm_role: this.startingRole(who),
        }, PROFILE_POPULATE);
      }
      // Fill in a missing link (e.g. a sales person who is later also given a VGAMS staff account).
      const patch = {};
      if (who.salesPerson && !profile.sales_person) {
        const taken = await s.first(UID.profile, { filters: { sales_person: { documentId: who.salesPerson.documentId } } });
        if (!taken) patch.sales_person = who.salesPerson.documentId;
      }
      if (who.vgamsUser && !profile.vgams_user) {
        const taken = await s.first(UID.profile, { filters: { vgams_user: { documentId: who.vgamsUser.documentId } } });
        if (!taken) patch.vgams_user = who.vgamsUser.documentId;
      }
      if (Object.keys(patch).length) {
        await s.update(UID.profile, profile.documentId, patch);
        profile = await s.first(UID.profile, { filters: { documentId: profile.documentId }, populate: PROFILE_POPULATE });
      }
      return profile;
    },

    /** Login payload for the vgams-user controller's 'crm' branch. Throws nothing; returns null when not eligible. */
    async crmLogin(email) {
      const who = await this.eligibleByEmail(email);
      if (!who) return null;
      const profile = await this.profileForLogin(who);
      return { who, profile };
    },

    /** CRM context for a request from the CRM app (gateway). Re-checks eligibility every time. */
    async contextForLogin(email) {
      const who = await this.eligibleByEmail(email);
      if (!who) return null;
      const profile = await this.profileForLogin(who);
      const name = who.salesPerson?.name || who.vgamsUser?.name || who.email;
      return this.build(profile, {
        id: null, documentId: null, email: who.email, username: name,
        salesPerson: who.salesPerson?.documentId || null,
        vgamsUser: who.vgamsUser ? { documentId: who.vgamsUser.documentId, role: who.vgamsUser.role } : null,
      });
    },

    /** Emails in CRM_ADMIN_EMAILS (comma separated) start as CRM admin. */
    adminEmails() {
      return String(process.env.CRM_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    },

    /**
     * Users & Permissions logins (integrations): anyone in CRM_ADMIN_EMAILS becomes CRM admin; anyone whose
     * login email matches a VGAMS sales person is linked to that sales person. Nobody else is provisioned.
     * (CRM staff normally sign in through the VGAMS login instead — see eligibleByEmail.)
     */
    async autoProvision(user) {
      const s = store();
      const isListedAdmin = Boolean(user.email && this.adminEmails().includes(String(user.email).toLowerCase()));
      if (isListedAdmin) {
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
