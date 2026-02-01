'use strict';

module.exports = {
  /**
   * Get active sales agents
   * Returns only id, name, and email of active sales agents
   */
  async getActiveSalesAgents(ctx) {
    try {
      console.log('Fetching active sales agents...');
      
      // Query the database for active sales agents
      const salesAgents = await strapi.db.query('api::vgams-sales-person.vgams-sales-person').findMany({
        where: {
          isActive: true
        },
        select: ['id', 'name', 'email'],
        orderBy: { name: 'asc' }
      });

      console.log(`Found ${salesAgents.length} active sales agents`);

      return {
        success: true,
        data: salesAgents,
        count: salesAgents.length,
        message: 'Active sales agents retrieved successfully'
      };

    } catch (error) {
      console.error('Error fetching active sales agents:', error);
      
      return ctx.badRequest('Failed to fetch active sales agents', {
        error: error.message
      });
    }
  },

  /**
   * Search active sales agents by name or email
   */
  async searchActiveSalesAgents(ctx) {
    try {
      const { q } = ctx.query;
      
      if (!q) {
        return ctx.badRequest('Search query is required');
      }

      const salesAgents = await strapi.db.query('api::vgams-sales-person.vgams-sales-person').findMany({
        where: {
          isActive: true,
          $or: [
            { name: { $contains: q } },
            { email: { $contains: q } }
          ]
        },
        select: ['id', 'name', 'email'],
        orderBy: { name: 'asc' },
        limit: 20
      });

      return {
        success: true,
        data: salesAgents,
        count: salesAgents.length,
        searchQuery: q
      };

    } catch (error) {
      console.error('Error searching sales agents:', error);
      return ctx.badRequest('Failed to search sales agents', {
        error: error.message
      });
    }
  },

  /**
   * Get sales agent by ID
   */
  async getSalesAgentById(ctx) {
    try {
      const { id } = ctx.params;
      
      if (!id) {
        return ctx.badRequest('Sales agent ID is required');
      }

      const salesAgent = await strapi.db.query('api::vgams-sales-person.vgams-sales-person').findOne({
        where: {
          id: id,
          isActive: true
        },
        select: ['id', 'name', 'email']
      });

      if (!salesAgent) {
        return ctx.notFound('Sales agent not found or is inactive');
      }

      return {
        success: true,
        data: salesAgent,
        message: 'Sales agent retrieved successfully'
      };

    } catch (error) {
      console.error(`Error fetching sales agent with ID ${ctx.params.id}:`, error);
      return ctx.badRequest('Failed to fetch sales agent', {
        error: error.message
      });
    }
  }
};
