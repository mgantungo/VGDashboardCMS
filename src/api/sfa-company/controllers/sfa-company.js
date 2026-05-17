'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::sfa-company.sfa-company',
  ({ strapi }) => ({

    /**
     * POST /api/sfa-companies/search
     * Search prospect companies by name (used in opportunity creation modal).
     */
    async search(ctx) {
      const { search = '', pagination = { page: 1, pageSize: 30 } } = ctx.request.body;

      const results = await strapi.documents('api::sfa-company.sfa-company').findMany({
        filters: search
          ? { company_name: { $containsi: search } }
          : {},
        populate: ['contacts'],
        limit:  pagination.pageSize || 30,
        start:  ((pagination.page || 1) - 1) * (pagination.pageSize || 30),
        sort:   'company_name:asc',
      });

      return ctx.send(results);
    },

    /**
     * POST /api/sfa-companies/create
     * Create a new prospect company.
     * Fields mirror the clients collection for eventual BC matching.
     */
    async createCompany(ctx) {
      const {
        company_name, contact_person, email, phone,
        address, industry, location,
      } = ctx.request.body;

      if (!company_name) {
        return ctx.badRequest('company_name is required.');
      }

      const existing = await strapi.documents('api::sfa-company.sfa-company').findMany({
        filters: { company_name: { $eqi: company_name } },
        limit: 1,
      });

      if (existing.length) {
        return ctx.badRequest('A company with this name already exists.', {
          existing: existing[0],
        });
      }

      const company = await strapi.documents('api::sfa-company.sfa-company').create({
        data: { company_name, contact_person, email, phone, address, industry, location },
      });

      return ctx.send({ data: company });
    },

    /**
     * POST /api/sfa-companies/update
     * Update a prospect company.
     */
    async updateCompany(ctx) {
      const { id, ...data } = ctx.request.body;

      if (!id) return ctx.badRequest('id is required.');

      const updated = await strapi.documents('api::sfa-company.sfa-company').update({
        documentId: id,
        data,
      });

      return ctx.send({ data: updated });
    },
  })
);
