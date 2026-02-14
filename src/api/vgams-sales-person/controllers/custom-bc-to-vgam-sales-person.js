'use strict';

const axios = require('axios');

module.exports = {

  
  // Fetch all salespersons from Business Central and sync to Strapi collection
  async syncSalesPersonsFromBC(ctx) {
    try {
      // Get credentials from environment variables
      const externalApiUrl = process.env.EXTERNAL_API_URL_SALESPERSONS;// || 'http://DEVTEST.newvision.co.ug:7069/BC180NUA/ODataV4/Company(\'The%20New%20Vision\')/SalespeopleDS';
      const username = process.env.EXTERNAL_API_USERNAME;// || 'INTEGRATION';
      const password = process.env.EXTERNAL_API_PASSWORD;// || 'Vision@2601';

      // Make request to external API with Basic Auth
      const response = await axios.get(externalApiUrl, {
        auth: {
          username: username,
          password: password
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      // Check if we have data
      if (!response.data.value || response.data.value.length === 0) {
        return ctx.send({
          status: 'success',
          message: 'No salespersons found in Business Central',
          data: [],
          stats: {
            fetched: 0,
            inserted: 0,
            skipped: 0,
            errors: 0
          }
        });
      }

      // Transform and process each salesperson
      const bcSalesPersons = response.data.value;
      const results = {
        fetched: bcSalesPersons.length,
        inserted: 0,
        skipped: 0,
        errors: 0,
        details: []
      };

      // Process each salesperson
      for (const bcPerson of bcSalesPersons) {
        try {
          const bcCode = bcPerson.Code;
          const bcName = bcPerson.Name;

          // Check if salesperson already exists by bc_code
          const existingPerson = await strapi.db.query('api::vgams-sales-person.vgams-sales-person').findOne({
            where: { bc_code: bcCode }
          });

          if (existingPerson) {
            // Skip if already exists
            results.skipped++;
            results.details.push({
              code: bcCode,
              name: bcName,
              status: 'skipped',
              reason: 'Already exists in database'
            });
          } else {
            // Create new salesperson
            const newPerson = await strapi.db.query('api::vgams-sales-person.vgams-sales-person').create({
              data: {
                name: bcName,
                bc_code: bcCode,
                isActive: true, // Default to active, you can change this logic
                // email is not provided by the API, so we skip it
                publishedAt: new Date()
              }
            });

            results.inserted++;
            results.details.push({
              code: bcCode,
              name: bcName,
              status: 'inserted',
              id: newPerson.id
            });
          }
        } catch (itemError) {
          results.errors++;
          results.details.push({
            code: bcPerson.Code,
            name: bcPerson.Name,
            status: 'error',
            reason: itemError.message
          });
          console.error('Error processing salesperson:', bcPerson.Code, itemError.message);
        }
      }

      // Return comprehensive results
      return ctx.send({
        status: 'success',
        message: 'Salespersons sync completed',
        data: results.details,
        stats: {
          fetched: results.fetched,
          inserted: results.inserted,
          skipped: results.skipped,
          errors: results.errors
        }
      });

    } catch (error) {
      console.error('Error syncing salespersons from Business Central:', error);

      // Handle specific error types
      if (error.code === 'ECONNREFUSED') {
        return ctx.badRequest('Unable to connect to Business Central API');
      }
      
      if (error.response) {
        if (error.response.status === 401) {
          return ctx.unauthorized('Invalid Business Central API credentials');
        }
        if (error.response.status === 404) {
          return ctx.notFound('Business Central API endpoint not found');
        }
        
        return ctx.badRequest(`Business Central API error: ${error.response.status} - ${error.response.statusText}`);
      }
      
      if (error.request) {
        return ctx.badRequest('Business Central API did not respond');
      }

      return ctx.badRequest(`Failed to sync salespersons: ${error.message}`);
    }
  }


  ,
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
