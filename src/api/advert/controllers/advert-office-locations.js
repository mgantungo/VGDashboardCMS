'use strict';

const axios = require('axios');

module.exports={

  async getBCLocations(ctx) {
    try {
      const { EXTERNAL_API_OFFICELOCATION, EXTERNAL_API_USERNAME, EXTERNAL_API_PASSWORD } = process.env;

      // Make the API request with basic authentication
      const response = await axios.get(EXTERNAL_API_OFFICELOCATION, {
        auth: {
          username: EXTERNAL_API_USERNAME,
          password: EXTERNAL_API_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Extract only code and name from each location
      const locations = response.data.value.map(location => ({
        code: location.Code,
        name: location.Name || 'No Name' // Handle empty names by providing default
      }));

      // Send the filtered data
      ctx.send({
        success: true,
        data: locations,
        count: locations.length
      });

    } catch (error) {
      console.error('Error fetching locations:', error.message);
      
      ctx.send({
        success: false,
        message: 'Failed to fetch locations',
        error: error.message
      }, error.response?.status || 500);
    }
  },
  async getOfficeLocations(ctx) {
    try {
      // Fetch all office locations from Strapi
      const entries = await strapi.entityService.findMany('api::office-location.office-location', {
        fields: ['bc_code', 'office_location'],
        publicationState: 'live'
      });

      // Transform data to match desired format (bc_code as code, office_location as office)
      const locations = entries.map(entry => ({
        code: entry.bc_code,
        office: entry.office_location || 'No Office Name' // Handle empty values
      }));

      // Send response
      ctx.send({
        success: true,
        data: locations,
        count: locations.length
      });

    } catch (error) {
      console.error('Error fetching office locations:', error.message);
      
      ctx.send({
        success: false,
        message: 'Failed to fetch office locations',
        error: error.message
      }, 500);
    }
  }

}
