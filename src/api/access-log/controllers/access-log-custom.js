'use strict';

/**
 * access-log controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::access-log.access-log', ({ strapi }) => ({
  // Create a new access log
  async create(ctx) {
    try {
      const data = ctx.request.body;
      const entity = await strapi.db.query('api::access-log.access-log').create({ data });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Get all access logs
  async find(ctx) {
    try {
      const entities = await strapi.db.query('api::access-log.access-log').findMany({
        populate: ['staff', 'company_asset', 'anomalies'],
      });
      return entities;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Get a single access log by ID
  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.db.query('api::access-log.access-log').findOne({
      where: { id },
      populate: ['staff', 'company_asset', 'anomalies'],
    });
    if (!entity) {
      return ctx.notFound('Access Log not found');
    }
    return entity;
  },

  // Update an access log
  async update(ctx) {
    const { id } = ctx.params;
    const data = ctx.request.body;
    try {
      const entity = await strapi.db.query('api::access-log.access-log').update({
        where: { id },
        data,
      });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Delete an access log
  async delete(ctx) {
    const { id } = ctx.params;
    try {
      const entity = await strapi.db.query('api::access-log.access-log').delete({
        where: { id },
      });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },
}));
