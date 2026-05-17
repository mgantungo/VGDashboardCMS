'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::sfa-activity.sfa-activity',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-activities/log
     * Log a new activity against an opportunity.
     * Supports multipart/form-data when file attachments are included.
     */
    async log(ctx) {
      const user = ctx.state.user;
      const isMultipart = ctx.is('multipart');

      let data;
      let files;

      if (isMultipart) {
        // Parse JSON data field from multipart
        try {
          data  = JSON.parse(ctx.request.body.data || '{}');
          files = ctx.request.files;
        } catch {
          return ctx.badRequest('Invalid JSON in data field.');
        }
      } else {
        data = ctx.request.body;
      }

      const {
        opportunity, type, activity_date, summary, outcome, next_followup_date,
      } = data;

      if (!opportunity || !type || !activity_date || !summary) {
        return ctx.badRequest('opportunity, type, activity_date, and summary are required.');
      }

      const activity = await strapi.documents('api::sfa-activity.sfa-activity').create({
        data: {
          opportunity,
          type,
          activity_date,
          summary,
          outcome:            outcome || null,
          next_followup_date: next_followup_date || null,
          logged_by:          user.id,
        },
        populate: ['logged_by'],
      });

      // Upload attachments if provided
      if (isMultipart && files && files['files.attachments']) {
        const attachments = Array.isArray(files['files.attachments'])
          ? files['files.attachments']
          : [files['files.attachments']];

        for (const file of attachments) {
          await strapi.plugins.upload.services.upload.upload({
            data: {
              refId:    activity.id,
              ref:      'api::sfa-activity.sfa-activity',
              field:    'attachments',
            },
            files: file,
          });
        }
      }

      return ctx.send({ data: activity });
    },

    /**
     * POST /api/sfa-activities/by-opportunity
     * Return all activities for an opportunity, sorted newest first.
     */
    async byOpportunity(ctx) {
      const { opportunityId, populate = ['logged_by', 'attachments'] } = ctx.request.body;
      if (!opportunityId) return ctx.badRequest('opportunityId is required.');

      const activities = await strapi.documents('api::sfa-activity.sfa-activity').findMany({
        filters: { opportunity: { documentId: { $eq: opportunityId } } },
        populate,
        sort: 'activity_date:desc',
      });

      return ctx.send(activities);
    },

    /**
     * POST /api/sfa-activities/due-followups
     * Returns activities with next_followup_date <= today for the current user.
     */
    async dueFollowups(ctx) {
      const user = ctx.state.user;
      const today = new Date().toISOString().slice(0, 10);

      const activities = await strapi.documents('api::sfa-activity.sfa-activity').findMany({
        filters: {
          logged_by: { id: { $eq: user.id } },
          next_followup_date: { $lte: today },
          opportunity: { is_converted: { $eq: false } },
        },
        populate: ['opportunity', 'opportunity.company'],
        sort: 'next_followup_date:asc',
        limit: 50,
      });

      return ctx.send(activities);
    },

    /**
     * POST /api/sfa-activities/remove
     * Delete an activity (own only unless manager).
     */
    async remove(ctx) {
      const user = ctx.state.user;
      const { id } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const activity = await strapi.documents('api::sfa-activity.sfa-activity').findOne({
        documentId: id,
        populate: ['logged_by'],
      });

      if (!activity) return ctx.notFound('Activity not found.');
      if (activity.logged_by?.id !== user.id) {
        return ctx.forbidden('You can only delete your own activities.');
      }

      await strapi.documents('api::sfa-activity.sfa-activity').delete({ documentId: id });
      return ctx.send({ deleted: true });
    },
  })
);
