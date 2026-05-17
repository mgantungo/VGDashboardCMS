'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::sfa-contact.sfa-contact',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-contacts/by-company
     * Fetch all contacts for a given prospect company.
     */
    async byCompany(ctx) {
      const { companyId } = ctx.request.body;
      if (!companyId) return ctx.badRequest('companyId is required.');

      const contacts = await strapi.documents('api::sfa-contact.sfa-contact').findMany({
        filters: { company: { documentId: { $eq: companyId } } },
        sort: 'full_name:asc',
      });

      return ctx.send(contacts);
    },

    /**
     * POST /api/sfa-contacts/create
     */
    async createContact(ctx) {
      const { full_name, phone, email, position, company } = ctx.request.body;
      if (!full_name) return ctx.badRequest('full_name is required.');

      const contact = await strapi.documents('api::sfa-contact.sfa-contact').create({
        data: { full_name, phone, email, position, company },
      });

      return ctx.send({ data: contact });
    },

    /**
     * POST /api/sfa-contacts/update
     */
    async updateContact(ctx) {
      const { id, ...data } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const updated = await strapi.documents('api::sfa-contact.sfa-contact').update({
        documentId: id,
        data,
      });

      return ctx.send({ data: updated });
    },

    /**
     * POST /api/sfa-contacts/remove
     */
    async removeContact(ctx) {
      const { id } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      await strapi.documents('api::sfa-contact.sfa-contact').delete({
        documentId: id,
      });

      return ctx.send({ deleted: true });
    },
  })
);
