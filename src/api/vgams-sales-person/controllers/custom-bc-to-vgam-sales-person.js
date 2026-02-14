'use strict';

const axios = require('axios');

module.exports = {
  async findALLSalesPersonsBC(ctx) {
    try {
      // External API configuration
      const externalApiUrl = 'http://DEVTEST.newvision.co.ug:7069/BC180NUA/ODataV4/Company(\'The%20New%20Vision\')/SalespeopleDS';
      const username = 'INTEGRATION';
      const password = 'Vision@2601';

      // Make request to external API with Basic Auth
      const response = await axios.get(externalApiUrl, {
        auth: {
          username: username,
          password: password
        },
        params: {
          $select: 'Code,Name'
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      // Transform the data if needed
      const transformedData = response.data.value.map(item => ({
        code: item.Code,
        name: item.Name,
        // Add any additional transformation here
      }));

      // Return successful response
      return ctx.send({
        status: 'success',
        data: transformedData,
        count: transformedData.length,
        message: 'Salespeople data retrieved successfully'
      });

    } catch (error) {
      // Handle errors gracefully
      console.error('Error fetching salespeople data:', error.message);

      // Check if it's an Axios error with response
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        return ctx.send({
          status: 'error',
          message: 'External API error',
          details: {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data
          }
        }, error.response.status);
      } else if (error.request) {
        // The request was made but no response was received
        return ctx.send({
          status: 'error',
          message: 'No response received from external API',
          details: error.message
        }, 503);
      } else {
        // Something happened in setting up the request that triggered an Error
        return ctx.send({
          status: 'error',
          message: 'Error setting up the request',
          details: error.message
        }, 500);
      }
    }
  },

  // Optional: Add a method to get a single salesperson by code
  async findOneSalesPersonfromBC(ctx) {
    const { code } = ctx.params;
    
    try {
      const externalApiUrl = `http://DEVTEST.newvision.co.ug:7069/BC180NUA/ODataV4/Company('The%20New%20Vision')/SalespeopleDS?$filter=Code eq '${code}'`;
      const username = 'INTEGRATION';
      const password = 'Vision@2601';

      const response = await axios.get(externalApiUrl, {
        auth: {
          username: username,
          password: password
        },
        params: {
          $select: 'Code,Name'
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.data.value && response.data.value.length > 0) {
        const item = response.data.value[0];
        return ctx.send({
          status: 'success',
          data: {
            code: item.Code,
            name: item.Name
          },
          message: 'Salesperson data retrieved successfully'
        });
      } else {
        return ctx.send({
          status: 'error',
          message: 'Salesperson not found'
        }, 404);
      }

    } catch (error) {
      console.error('Error fetching salesperson data:', error.message);
      return ctx.send({
        status: 'error',
        message: 'Failed to fetch salesperson data',
        details: error.message
      }, 500);
    }
  }
};
