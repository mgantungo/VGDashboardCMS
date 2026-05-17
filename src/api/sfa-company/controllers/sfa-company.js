'use strict';
// src/api/sfa-company/controllers/sfa-company.js

const { createCoreController } = require('@strapi/strapi').factories;
const { resolveSfaProfile }    = require('../../../_sfa-helpers/sfa-profile');

module.exports = createCoreController(
  'api::sfa-company.sfa-company',
  ({ strapi }) => ({

    // POST /api/sfa-companies/search
    async search(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { search = '', pagination = { page: 1, pageSize: 30 } } = ctx.request.body;

      const results = await strapi.documents('api::sfa-company.sfa-company').findMany({
        filters: search ? { company_name: { $containsi: search } } : {},
        populate: ['contacts'],
        limit:  pagination.pageSize || 30,
        start:  ((pagination.page || 1) - 1) * (pagination.pageSize || 30),
        sort:   'company_name:asc',
      });

      return ctx.send(results);
    },

    // POST /api/sfa-companies/create
    async createCompany(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { company_name, contact_person, email, phone, address, industry, location } = ctx.request.body;

      if (!company_name) return ctx.badRequest('company_name is required.');

      const [existing] = await strapi.documents('api::sfa-company.sfa-company').findMany({
        filters: { company_name: { $eqi: company_name } },
        limit: 1,
      });
      if (existing) {
        return ctx.badRequest('A prospect company with this name already exists.', { existing });
      }

      const company = await strapi.documents('api::sfa-company.sfa-company').create({
        data: { company_name, contact_person, email, phone, address, industry, location },
      });

      return ctx.send({ data: company });
    },

    // POST /api/sfa-companies/update
    async updateCompany(ctx) {
      const caller = await resolveSfaProfile(ctx, strapi);
      if (!caller) return;

      const { id, sfaProfileDocumentId, ...data } = ctx.request.body;
      if (!id) return ctx.badRequest('id is required.');

      const updated = await strapi.documents('api::sfa-company.sfa-company').update({
        documentId: id,
        data,
      });

      return ctx.send({ data: updated });
    },
  })
);
