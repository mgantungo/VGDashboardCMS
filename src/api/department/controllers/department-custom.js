'use strict';

/**
 * department controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::department.department', ({ strapi }) => ({
  // Create a new department
  async create(ctx) {
    try {
      const data = ctx.request.body;
      const entity = await strapi.db.query('api::department.department').create({ data });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Get all departments
  async find(ctx) {
    try {
      const entities = await strapi.db.query('api::department.department').findMany({
        populate: ['staff', 'offices'],
      });
      return entities;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Get a single department by ID
  async findOne(ctx) {
    const { id } = ctx.params;
    const entity = await strapi.db.query('api::department.department').findOne({
      where: { id },
      populate: ['staff', 'offices'],
    });
    if (!entity) {
      return ctx.notFound('Department not found');
    }
    return entity;
  },

  // Update a department
  async update(ctx) {
    const { id } = ctx.params;
    const data = ctx.request.body;
    try {
      const entity = await strapi.db.query('api::department.department').update({
        where: { id },
        data,
      });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },

  // Delete a department
  async delete(ctx) {
    const { id } = ctx.params;
    try {
      const entity = await strapi.db.query('api::department.department').delete({
        where: { id },
      });
      return entity;
    } catch (err) {
      ctx.throw(400, err);
    }
  },
}));
