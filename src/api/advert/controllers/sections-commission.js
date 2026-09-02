'use strict';

const axios = require('axios');

module.exports = {
  // sections commission method
  async populateBCSectionsCommission(ctx) {
    try {
      const { EXTERNAL_API_SECTIONSCOMMISSION, EXTERNAL_API_USERNAME, EXTERNAL_API_PASSWORD } = process.env;

      // Fetch data from Business Central
      const response = await axios.get(EXTERNAL_API_SECTIONSCOMMISSION, {
        auth: {
          username: EXTERNAL_API_USERNAME,
          password: EXTERNAL_API_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Transform and filter out empty descriptions
      const sectionsCommissions = response.data.value
        .filter(item => item.Description && item.Description.trim() !== '')
        .map(item => ({
          code: item.Code,
          description: item.Description
        }));

      // Counter for tracking
      let created = 0;
      let updated = 0;

      // Create or update each sections commission
      for (const item of sectionsCommissions) {
        const existingItem = await strapi.entityService.findMany('api::sections-commission.sections-commission', {
          filters: { code: item.code }
        });

        if (existingItem && existingItem.length > 0) {
          // Update existing
          await strapi.entityService.update('api::sections-commission.sections-commission', existingItem[0].id, {
            data: { description: item.description }
          });
          updated++;
        } else {
          // Create new
          await strapi.entityService.create('api::sections-commission.sections-commission', {
            data: {
              code: item.code,
              description: item.description
            }
          });
          created++;
        }
      }

      return ctx.send({
        message: 'Sections commission populated successfully',
        data: {
          total: sectionsCommissions.length,
          created,
          updated,
          skipped: response.data.value.length - sectionsCommissions.length
        }
      });

    } catch (error) {
      console.error('Error populating sections commission:', error.message);
      return ctx.badRequest('Failed to populate sections commission', { 
        error: error.response?.data || error.message 
      });
    }
  }
};
