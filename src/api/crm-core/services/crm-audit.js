'use strict';

/** Append-only audit trail (actor, action, record, before/after). */
const { UID, nowIso } = require('../utils/crm-helpers');

const trim = (v) => {
  if (v === undefined) return null;
  try {
    const s = JSON.stringify(v);
    return s && s.length > 20000 ? { truncated: true } : JSON.parse(s || 'null');
  } catch (e) {
    return null;
  }
};

module.exports = ({ strapi }) => ({
  async log(crm, action, targetUid, targetId, before, after) {
    try {
      await strapi.documents(UID.audit).create({
        data: {
          actor: crm?.profileId || null,
          actor_user_id: crm?.user?.id || null,
          action,
          target_uid: targetUid,
          target_id: targetId ? String(targetId) : null,
          before: trim(before),
          after: trim(after),
          ip: crm?.ip || null,
          occurred_at: nowIso(),
        },
      });
    } catch (e) {
      strapi.log.warn(`[crm] audit log failed for ${action}: ${e.message}`);
    }
  },
});
