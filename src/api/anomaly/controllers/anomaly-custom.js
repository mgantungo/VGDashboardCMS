'use strict';

/**
 * anomaly controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::anomaly.anomaly', ({ strapi }) => ({
  // Create a new anomaly
  async create(ctx) {
    try {
      const data = ctx.request.body;
      const entity = await strapi.db.query('api::anomaly.anomaly').create({ data });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Get all anomalies
  async find(ctx) {
    try {
      const entities = await strapi.db.query('api::anomaly.anomaly').findMany({
        populate: ['access_log', 'staff', 'company_asset'],
      });
      return entities;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Get a single anomaly by ID
  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.db.query('api::anomaly.anomaly').findOne({
      where: { id },
      populate: ['access_log', 'staff', 'company_asset'],
    });
    if (!entity) {
      return ctx.notFound('Anomaly not found');
    }
    return entity;
  },

  // Update an anomaly
  async update(ctx) {
    const { id } = ctx.params;
    const data = ctx.request.body;
    try {
      const entity = await strapi.db.query('api::anomaly.anomaly').update({
        where: { id },
        data,
      });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Delete an anomaly
  async delete(ctx) {
    const { id } = ctx.params;
    try {
      const entity = await strapi.db.query('api::anomaly.anomaly').delete({
        where: { id },
      });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },
}));
