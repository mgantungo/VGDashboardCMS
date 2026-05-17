'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::sfa-agent-profile.sfa-agent-profile',
  ({ strapi }) => ({

    /**
     * GET /api/sfa-agent-profiles/me
     * Returns the SFA agent profile for the currently authenticated user.
     */
    async me(ctx) {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('You must be logged in.');
      }

      const [profile] = await strapi.documents('api::sfa-agent-profile.sfa-agent-profile').findMany({
        filters: { user: { id: { $eq: user.id } } },
        populate: ['user', 'unit', 'unit.supervisor'],
        limit: 1,
      });

      if (!profile) {
        return ctx.notFound('No SFA profile found for this user.');
      }

      return ctx.send({ data: profile });
    },
  })
);
