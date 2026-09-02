'use strict';

/**
 * company-asset controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::company-asset.company-asset', ({ strapi }) => ({
  // Create a new company asset
  async create(ctx) {
    try {
      const data = ctx.request.body;
      const entity = await strapi.db.query('api::company-asset.company-asset').create({ data });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Get all company assets
  async find(ctx) {
    try {
      const entities = await strapi.db.query('api::company-asset.company-asset').findMany({
        populate: ['staff', 'access_logs', 'anomalies', 'office'],
      });
      return entities;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Get a single company asset by ID
  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.db.query('api::company-asset.company-asset').findOne({
      where: { id },
      populate: ['staff', 'access_logs', 'anomalies', 'office'],
    });
    if (!entity) {
      return ctx.notFound('Company Asset not found');
    }
    return entity;
  },

  // Update a company asset
  async update(ctx) {
    const { id } = ctx.params;
    const data = ctx.request.body;
    try {
      const entity = await strapi.db.query('api::company-asset.company-asset').update({
        where: { id },
        data,
      });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Delete a company asset
  async delete(ctx) {
    const { id } = ctx.params;
    try {
      const entity = await strapi.db.query('api::company-asset.company-asset').delete({
        where: { id },
      });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },
}));
