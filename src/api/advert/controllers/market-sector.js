'use strict';

const axios = require('axios');

module.exports = {
  async populateBCMarketSectors(ctx) {
    try {
      const { EXTERNAL_API_MARKETSECTOR, EXTERNAL_API_USERNAME, EXTERNAL_API_PASSWORD } = process.env;

      // Fetch data from Business Central
      const response = await axios.get(EXTERNAL_API_MARKETSECTOR, {
        auth: {
          username: EXTERNAL_API_USERNAME,
          password: EXTERNAL_API_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Transform and filter out empty names
      const marketSectors = response.data.value
        .filter(item => item.Name && item.Name.trim() !== '')
        .map(item => ({
          code: item.Code,
          name: item.Name
        }));

      // Counter for tracking
      let created = 0;
      let updated = 0;

      // Create or update each market sector
      for (const sector of marketSectors) {
        const existingSector = await strapi.entityService.findMany('api::market-sector.market-sector', {
          filters: { code: sector.code }
        });

        if (existingSector && existingSector.length > 0) {
          // Update existing
          await strapi.entityService.update('api::market-sector.market-sector', existingSector[0].id, {
            data: { name: sector.name }
          });
          updated++;
        } else {
          // Create new
          await strapi.entityService.create('api::market-sector.market-sector', {
            data: {
              code: sector.code,
              name: sector.name
            }
          });
          created++;
        }
      }

      return ctx.send({
        message: 'Market sectors populated successfully',
        data: {
          total: marketSectors.length,
          created,
          updated
        }
      });

    } catch (error) {
      console.error('Error:', error.message);
      return ctx.badRequest('Failed to populate market sectors', { error: error.message });
    }
  },
  //Get all market sectors from the collection
  async getMarketSectors(ctx) {
    try {
      // Fetch all market sectors from the database
      const marketSectors = await strapi.entityService.findMany('api::market-sector.market-sector', {
        fields: ['code', 'name'], // Only return code and name fields
        sort: { name: 'ASC' } // Optional: sort by name alphabetically
      });

      return ctx.send({
        message: 'Market sectors retrieved successfully',
        data: marketSectors
      });

    } catch (error) {
      console.error('Error:', error.message);
      return ctx.badRequest('Failed to retrieve market sectors', { error: error.message });
    }
  }
};
