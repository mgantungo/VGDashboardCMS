'use strict';

/**
 * In-app notifications. Email/SMS/WhatsApp delivery is an adapter hook:
 * set CRM_NOTIFY_WEBHOOK_URL to forward every notification to a gateway.
 */
const { UID, uniq } = require('../utils/crm-helpers');

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');

  return {
    async toProfiles(profileIds, { event, title, body, link }, exceptProfileId) {
      const ids = uniq(profileIds).filter((id) => id !== exceptProfileId);
      for (const id of ids) {
        try {
          const n = await store().create(UID.notification, {
            recipient: id, event, title, body: body || null, link: link || null, channel: 'in_app', delivery: 'sent',
          });
          await this.forward(n);
        } catch (e) {
          strapi.log.warn(`[crm] notification failed: ${e.message}`);
        }
      }
    },

    async toSalesPersons(spIds, payload, exceptProfileId) {
      const ids = uniq(spIds);
      if (!ids.length) return;
      const profiles = await store().rows(UID.profile, {
        where: { sales_person: { documentId: { $in: ids } } }, select: ['id', 'documentId'],
      });
      await this.toProfiles(profiles.map((p) => p.documentId), payload, exceptProfileId);
    },

    async toRole(role, payload, exceptProfileId) {
      const profiles = await store().rows(UID.profile, {
        where: { crm_role: role, is_active: true }, select: ['id', 'documentId'],
      });
      await this.toProfiles(profiles.map((p) => p.documentId), payload, exceptProfileId);
    },

    async forward(notification) {
      const url = process.env.CRM_NOTIFY_WEBHOOK_URL;
      if (!url || typeof fetch !== 'function') return;
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: notification.documentId, title: notification.title, body: notification.body, link: notification.link }),
        });
      } catch (e) {
        strapi.log.warn(`[crm] notification forward failed: ${e.message}`);
      }
    },

    async list(crm, { unreadOnly } = {}) {
      const filters = { recipient: { documentId: crm.profileId } };
      if (unreadOnly) filters.is_read = false;
      const items = await store().find(UID.notification, { filters, sort: ['createdAt:desc'], limit: 50 });
      const unread = await store().count(UID.notification, { recipient: { documentId: crm.profileId }, is_read: false });
      return { items, unread };
    },

    async markRead(crm, ids) {
      const filters = { recipient: { documentId: crm.profileId }, is_read: false };
      if (Array.isArray(ids) && ids.length) filters.documentId = { $in: ids };
      const items = await store().find(UID.notification, { filters, limit: 200 });
      for (const n of items) await store().update(UID.notification, n.documentId, { is_read: true });
      return { updated: items.length };
    },
  };
};
