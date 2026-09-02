'use strict';
// src/api/sfa-agent-profile/controllers/sfa-agent-profile.js

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::sfa-agent-profile.sfa-agent-profile',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-agent-profiles/me
     * Called at SFA login to verify SFA access.
     * Looks up by vgams_sales_person email — no JWT needed.
     *
     * Body: { email }
     * Returns: the full sfa-agent-profile with salesPerson and unit.
     */
    async me(ctx) {
      const { email } = ctx.request.body;

      if (!email) {
        return ctx.badRequest('email is required.');
      }

      const [salesPerson] = await strapi.documents(
        'api::vgams-sales-person.vgams-sales-person'
      ).findMany({
        filters: { email: { $eqi: email }, isActive: { $eq: true } },
        limit: 1,
      });

      if (!salesPerson) {
        return ctx.forbidden(
          'Your account is not listed as an active sales person. ' +
          'Contact your administrator to get SFA access.'
        );
      }

      const [profile] = await strapi.documents(
        'api::sfa-agent-profile.sfa-agent-profile'
      ).findMany({
        filters: {
          vgams_sales_person: { documentId: { $eq: salesPerson.documentId } },
          is_active:          { $eq: true },
        },
        populate: ['vgams_sales_person', 'unit'],
        limit: 1,
      });

      if (!profile) {
        return ctx.notFound(
          'No SFA profile is configured for your account. ' +
          'Ask an administrator to create one under Content Manager → SFA Agent Profile.'
        );
      }

      return ctx.send({ data: profile });
    },
  })
);
