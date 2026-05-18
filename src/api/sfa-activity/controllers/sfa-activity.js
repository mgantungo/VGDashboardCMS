'use strict';
// src/api/sfa-activity/controllers/sfa-activity.js

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveSfaProfile }    = require('../../../_sfa-helpers/sfa-profile');

module.exports = createCoreController(
  'api::sfa-activity.sfa-activity',
  ({ strapi }) => ({

    // POST /api/sfa-activities/log
    async log(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const isMultipart = ctx.is('multipart');
      let data, files;

      if (isMultipart) {
        try { data = JSON.parse(ctx.request.body.data || '{}'); }
        catch { return ctx.badRequest('Invalid JSON in data field.'); }
        files = ctx.request.files;
      } else {
        data = ctx.request.body;
      }

      const { opportunity, type, activity_date, summary, outcome, next_followup_date } = data;

      if (!opportunity || !type || !activity_date || !summary) {
        return ctx.badRequest('opportunity, type, activity_date, and summary are required.');
      }

      const activity = await strapi.documents('api::sfa-activity.sfa-activity').create({
        data: {
          opportunity,
          type,
          activity_date,
          summary,
          outcome:            outcome            || null,
          next_followup_date: next_followup_date || null,
          logged_by:          caller.profile.documentId,
        },
        populate: ['logged_by', 'logged_by.vgams_sales_person'],
      });

      // Upload attachments if provided
      if (isMultipart && files?.['files.attachments']) {
        const attachments = Array.isArray(files['files.attachments'])
          ? files['files.attachments']
          : [files['files.attachments']];

        for (const file of attachments) {
          await strapi.plugins.upload.services.upload.upload({
            data: { refId: activity.id, ref: 'api::sfa-activity.sfa-activity', field: 'attachments' },
            files: file,
          });
        }
      }

      return ctx.send({ data: activity });
    },

    // POST /api/sfa-activities/by-opportunity
    async byOpportunity(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { opportunityId } = ctx.request.body;
      if (!opportunityId) return ctx.badRequest('opportunityId is required.');

      // Always populate attachments — never let the request body omit them
      const populate = [
        'logged_by',
        'logged_by.vgams_sales_person',
        'attachments',
      ];

      const activities = await strapi.documents('api::sfa-activity.sfa-activity').findMany({
        filters: { opportunity: { documentId: { $eq: opportunityId } } },
        populate,
        sort: 'activity_date:desc',
      });

      return ctx.send(activities);
    },

    // POST /api/sfa-activities/due-followups  — returns follow-ups due today/overdue for caller
    async dueFollowups(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const today = new Date().toISOString().slice(0, 10);

      const activities = await strapi.documents('api::sfa-activity.sfa-activity').findMany({
        filters: {
          logged_by:          { documentId: { $eq: caller.profile.documentId } },
          next_followup_date: { $lte: today },
          opportunity:        { is_converted: { $eq: false } },
        },
        populate: ['opportunity', 'opportunity.company', 'opportunity.existing_client'],
        sort:     'next_followup_date:asc',
        limit:    50,
      });

      return ctx.send(activities);
    },

    // POST /api/sfa-activities/remove  — only own activities
    async remove(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { id } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const activity = await strapi.documents('api::sfa-activity.sfa-activity').findOne({
        documentId: id,
        populate:   ['logged_by'],
      });

      if (!activity) return ctx.notFound('Activity not found.');

      const isOwner   = activity.logged_by?.documentId === caller.profile.documentId;
      const isManager = ['manager', 'admin'].includes(caller.role);

      if (!isOwner && !isManager) {
        return ctx.forbidden('You can only delete your own activity records.');
      }

      await strapi.documents('api::sfa-activity.sfa-activity').delete({ documentId: id });
      return ctx.send({ deleted: true });
    },
  })
);
