'use strict';

/**
 * Logging a visit/call is the main sales action. The outcome moves the deal
 * for the salesperson, so they never pick a pipeline stage themselves.
 */
const { UID, nowIso, resolveDue, fail } = require('../utils/crm-helpers');

const NEXT_LABEL = { send_quote: 'Send quote', call_back: 'Call back', meet_again: 'Meet again', follow_up: 'Follow up', none: null };
const SUGGEST = {
  wants_quote: { next: 'send_quote', when: 'tomorrow' },
  positive: { next: 'meet_again', when: 'next_week' },
  needs_time: { next: 'call_back', when: 'friday' },
  not_interested: { next: 'none', when: null },
  no_answer: { next: 'call_back', when: 'tomorrow' },
  other: { next: 'follow_up', when: 'next_week' },
};

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const pipeline = () => strapi.service('api::crm-core.crm-pipeline');
  const clients = () => strapi.service('api::crm-core.crm-clients');

  return {
    SUGGEST,

    async log(crm, data) {
      const clientId = data.client;
      if (!clientId) fail('Choose who you met or called.');
      await access().assertClient(crm, clientId);
      const client = await store().must(UID.client, clientId, { fields: ['company_name'] }, 'Client');
      const outcome = data.outcome || 'other';
      const suggestion = SUGGEST[outcome] || SUGGEST.other;
      const nextType = data.next_action_type || suggestion.next;
      const due = nextType === 'none' ? null : (resolveDue(data.next_action_due || suggestion.when) || resolveDue('next_week'));
      const nextLabel = data.next_action || NEXT_LABEL[nextType];

      // attach to the right deal without asking: given one, or my single open deal with this client
      let oppId = data.opportunity || null;
      let createdDeal = null;
      if (!oppId) {
        const mine = await store().find(UID.opportunity, {
          filters: {
            client: { documentId: clientId }, state: 'open',
            $or: [{ contributors: { sales_person: { documentId: crm.spId || '__none__' } } }, { lead_sales_person: { documentId: crm.spId || '__none__' } }],
          },
          sort: ['updatedAt:desc'], limit: 2,
        });
        if (mine.length === 1) oppId = mine[0].documentId;
        if (!mine.length && outcome === 'wants_quote') {
          const made = await pipeline().create(crm, { client: clientId, source: data.source || 'phone', title: data.deal_title });
          oppId = made.opportunity.id;
          createdDeal = made.opportunity;
        }
      }

      // logging closes my earlier open next-actions on this client/deal
      const openFilters = { client: { documentId: clientId }, next_action_done: false, next_action_type: { $ne: 'none' }, logged_by: { documentId: crm.profileId } };
      const open = await store().find(UID.interaction, { filters: openFilters, limit: 50 });
      for (const o of open) await store().update(UID.interaction, o.documentId, { next_action_done: true });

      const interaction = await store().create(UID.interaction, {
        client: clientId,
        opportunity: oppId,
        project: data.project || null,
        sales_person: crm.spId,
        logged_by: crm.profileId,
        contacts: data.contacts || [],
        kind: data.kind || 'meeting',
        occurred_at: data.occurred_at || nowIso(),
        outcome,
        summary: data.summary || null,
        next_action: nextLabel,
        next_action_type: nextType,
        next_action_due: due,
        next_action_done: nextType === 'none',
        next_action_owner: crm.profileId,
      });
      await clients().touch(clientId);

      let message2 = null;
      if (oppId) {
        await store().update(UID.opportunity, oppId, { next_action: nextLabel, next_action_due: due, last_activity_at: nowIso() });
        if (outcome === 'wants_quote') {
          await pipeline().advance(crm, oppId, 4, 'Client asked for a quote');
          message2 = `Deal moved to Quoting.${due ? ` Reminder set: ${nextLabel.toLowerCase()}, ${due}.` : ''}`;
        } else if (outcome === 'positive') {
          await pipeline().advance(crm, oppId, 2, 'Positive meeting');
        } else if (outcome === 'not_interested') {
          await pipeline().markLost(crm, oppId, data.loss_reason || 'Client not interested');
          message2 = 'Deal closed as lost. Your manager sees the reason; nothing else to fill in.';
        }
      }
      if (!message2) message2 = due ? `Reminder set: ${nextLabel.toLowerCase()}, ${due}.` : 'Added to the client timeline.';
      if (createdDeal) message2 = `New deal added and moved to Quoting. ${due ? `Reminder set: send quote, ${due}.` : ''}`;
      await audit().log(crm, 'interaction.log', UID.interaction, interaction.documentId, null, { client: clientId, outcome, opportunity: oppId });
      return { interaction: { id: interaction.documentId }, opportunity: oppId, message: `Saved to ${client.company_name}`, message2 };
    },

    /** Doing the thing closes the reminder: e.g. sending a quote closes "Send quote". */
    async closeActions(crm, clientId, types) {
      if (!clientId) return 0;
      const filters = { client: { documentId: clientId }, next_action_done: false };
      if (types) filters.next_action_type = { $in: types };
      const open = await store().find(UID.interaction, { filters, limit: 100 });
      for (const o of open) await store().update(UID.interaction, o.documentId, { next_action_done: true });
      return open.length;
    },

    async completeNextAction(crm, id) {
      const i = await store().must(UID.interaction, id, { populate: ['client'] }, 'Interaction');
      await access().assertClient(crm, i.client?.documentId);
      await store().update(UID.interaction, id, { next_action_done: true });
      return { done: true };
    },

    async listForClient(crm, clientId) {
      await access().assertClient(crm, clientId);
      return store().find(UID.interaction, {
        filters: { client: { documentId: clientId } },
        populate: { sales_person: { fields: ['name'] }, opportunity: { fields: ['title'] }, contacts: { fields: ['name'] } },
        sort: ['occurred_at:desc'], limit: 100,
      });
    },
  };
};
