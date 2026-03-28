'use strict';

const axios = require('axios');

module.exports = {
  // Sync customers from Business Central to Strapi clients collection
  // @param {boolean} insertNew - If true, insert new clients; if false, only check/validate without inserting
  async syncClientsFromBC(ctx) {
    const startTime = Date.now();
    
    // Get insertNew parameter from query string (default: true for backward compatibility)
    const insertNew = ctx.query.insertNew !== 'false'; // Default to true unless explicitly 'false'
    
    try {
      // Get credentials from environment variables
      const externalApiUrl = process.env.EXTERNAL_API_URL_CUSTOMERS;
      const username = process.env.EXTERNAL_API_USERNAME;
      const password = process.env.EXTERNAL_API_PASSWORD;

      // Validate environment variables
      if (!externalApiUrl || !username || !password) {
        return ctx.badRequest('External API configuration is missing. Check your .env file.');
      }

      // Make request to external API with Basic Auth (5 minute timeout = 300000ms)
      const response = await axios.get(externalApiUrl, {
        auth: {
          username: username,
          password: password
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 300000 // 5 minutes in milliseconds
      });

      // Check if we have data
      if (!response.data.value || response.data.value.length === 0) {
        return ctx.send({
          success: true,
          message: 'No clients found in Business Central',
          data: [],
          stats: {
            fetched: 0,
            inserted: 0,
            skipped: 0,
            errors: 0,
            executionTimeMs: Date.now() - startTime,
            insertMode: insertNew ? 'insert' : 'validate-only'
          }
        });
      }

      // Process each customer
      const bcCustomers = response.data.value;
      const results = {
        fetched: bcCustomers.length,
        inserted: 0,
        skipped: 0,
        errors: 0,
        skippedDetails: [],
        errorDetails: [],
        wouldInsert: [] // For validation mode, track which records would be inserted
      };

      // Process each customer
      for (const bcCustomer of bcCustomers) {
        try {
          const bcNo = bcCustomer.No;
          const companyName = bcCustomer.Name?.trim();
          const phone = bcCustomer.Phone_No?.trim() || bcCustomer.Mobile_Phone_No_40404?.trim() || '';

          // Validation checks
          const skipReasons = [];

          // Check if name is empty
          if (!companyName) {
            skipReasons.push('Empty company name');
          }

          // Check for special characters in bc_no (only allow alphanumeric, dash, underscore)
          if (bcNo && /[^a-zA-Z0-9\-_]/.test(bcNo)) {
            skipReasons.push('Contains special characters');
          }

          // Check if phone is empty
          if (!phone) {
            skipReasons.push('No phone number');
          }

          // Skip if any validation failed
          if (skipReasons.length > 0) {
            results.skipped++;
            results.skippedDetails.push({
              bc_no: bcNo,
              name: companyName || '[No Name]',
              reasons: skipReasons
            });
            continue;
          }

          // Check if client already exists by bc_no
          const existingClient = await strapi.db.query('api::client.client').findOne({
            where: { bc_no: bcNo }
          });

          if (existingClient) {
            // Optionally update existing client (uncomment if you want to update)
            // await strapi.db.query('api::client.client').update({
            //   where: { id: existingClient.id },
            //   data: {
            //     company_name: companyName,
            //     phone: phone,
            //     contact_person: bcCustomer.Contact?.trim() || '',
            //     address: bcCustomer.Address68302?.trim() || bcCustomer.Address_272351?.trim() || '',
            //     is_active: true
            //   }
            // });
            
            results.skipped++;
            results.skippedDetails.push({
              bc_no: bcNo,
              name: companyName,
              reasons: ['Already exists in database']
            });
          } else {
            // Record that this would be inserted (for validation mode)
            const newClientData = {
              company_name: companyName,
              bc_no: bcNo,
              phone: phone,
              contact_person: bcCustomer.Contact?.trim() || '',
              address: bcCustomer.Address68302?.trim() || bcCustomer.Address_272351?.trim() || '',
              is_active: true,
              credit_approved: false,
              credit_limit: bcCustomer.Balance_LCY || 0,
              payment_terms: 'cash',
            };

            results.wouldInsert.push(newClientData);

            // Only insert if insertNew is true
            if (insertNew) {
              const newClient = await strapi.db.query('api::client.client').create({
                data: newClientData
              });
              results.inserted++;
            } else {
              // In validate-only mode, count as "would insert"
              results.inserted++; // Count as would be inserted
            }
          }
        } catch (itemError) {
          results.errors++;
          results.errorDetails.push({
            bc_no: bcCustomer.No,
            name: bcCustomer.Name || '[No Name]',
            error: itemError.message
          });
          console.error('Error processing client:', bcCustomer.No, itemError.message);
        }
      }

      const executionTime = Date.now() - startTime;

      // Prepare response based on mode
      const responseData = {
        success: true,
        message: insertNew ? 'Clients sync completed' : 'Clients validation completed (dry run)',
        summary: {
          fetched: results.fetched,
          inserted: results.inserted,
          skipped: results.skipped,
          errors: results.errors,
          executionTimeMs: executionTime,
          executionTimeSeconds: Math.round(executionTime / 1000),
          insertMode: insertNew ? 'insert' : 'validate-only'
        },
        details: {
          skipped: results.skippedDetails,
          errors: results.errorDetails
        }
      };

      // Add wouldInsert details in validation mode
      if (!insertNew && results.wouldInsert.length > 0) {
        responseData.details.wouldInsert = results.wouldInsert;
        responseData.summary.wouldInsertCount = results.wouldInsert.length;
      }

      // Return comprehensive results
      return ctx.send(responseData);

    } catch (error) {
      console.error('Error syncing clients from Business Central:', error);

      // Handle specific error types
      if (error.code === 'ECONNREFUSED') {
        return ctx.badRequest('Unable to connect to Business Central API. Please check if the server is accessible.');
      }
      
      if (error.code === 'ECONNABORTED') {
        return ctx.badRequest('Request timeout after 5 minutes. The Business Central API is taking too long to respond.');
      }
      
      if (error.response) {
        if (error.response.status === 401) {
          return ctx.unauthorized('Invalid Business Central API credentials. Check your username and password.');
        }
        if (error.response.status === 404) {
          return ctx.notFound('Business Central API endpoint not found. Check the URL.');
        }
        
        return ctx.badRequest(`Business Central API error: ${error.response.status} - ${error.response.statusText}`);
      }
      
      if (error.request) {
        return ctx.badRequest('Business Central API did not respond. Please check network connectivity.');
      }

      return ctx.badRequest(`Failed to sync clients: ${error.message}`);
    }
  },
};
