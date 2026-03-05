// src/api/rate-card/controllers/rate-card.js
'use strict';

module.exports = {

  async bulkUpdateExpiryDates(ctx) {
    try {
      const { expiryDate, filters = {} } = ctx.request.body;
      
      // Validate required fields
      if (!expiryDate) {
        return ctx.badRequest('expiryDate is required in request body');
      }
      
      // Validate date format
      const newExpiryDate = new Date(expiryDate);
      if (isNaN(newExpiryDate.getTime())) {
        return ctx.badRequest('Invalid expiryDate format. Use YYYY-MM-DD');
      }
      
      // Build query filters
      const queryFilters = {};
      
      // Optionally filter by product
      if (filters.productId) {
        queryFilters.product = { id: filters.productId };
      }
      
      // Optionally only update NULL expiry dates
      if (filters.onlyNullExpiry) {
        queryFilters.$or = [
          { expiry_date: null },
          { expiry_date: { $null: true } }
        ];
      }
      
      // Optionally only update expired rate cards
      if (filters.onlyExpired) {
        const today = new Date();
        queryFilters.$or = [
          { expiry_date: { $lt: today } },
          { expiry_date: null },
          { expiry_date: { $null: true } }
        ];
      }
      
      console.log('Updating rate cards with filters:', JSON.stringify(queryFilters));
      
      // Get rate cards to update
      const rateCards = await strapi.entityService.findMany(
        'api::rate-card.rate-card',
        {
          filters: queryFilters,
          limit: -1 // Get all records
        }
      );
      
      console.log(`Found ${rateCards.length} rate cards to update`);
      
      if (rateCards.length === 0) {
        return ctx.send({
          message: 'No rate cards found matching the criteria',
          expiryDate: newExpiryDate.toISOString().split('T')[0],
          updatedCount: 0
        });
      }
      
      // Update each rate card
      let successCount = 0;
      let failedCount = 0;
      const failedIds = [];
      
      for (const rateCard of rateCards) {
        try {
          await strapi.entityService.update(
            'api::rate-card.rate-card',
            rateCard.id,
            {
              data: {
                expiry_date: newExpiryDate
              }
            }
          );
          successCount++;
          
          // Log progress every 100 updates
          if (successCount % 100 === 0) {
            console.log(`Updated ${successCount} rate cards...`);
          }
        } catch (error) {
          failedCount++;
          failedIds.push({ id: rateCard.id, error: error.message });
          console.error(`Failed to update rate card ${rateCard.id}:`, error.message);
        }
      }
      
      return ctx.send({
        message: `Successfully updated ${successCount} rate cards`,
        expiryDate: newExpiryDate.toISOString().split('T')[0],
        totalFound: rateCards.length,
        successCount,
        failedCount,
        failedIds: failedCount > 0 ? failedIds : undefined
      });
      
    } catch (err) {
      console.error('Error in bulkUpdateExpiryDates:', err);
      return ctx.throw(500, err);
    }
  },

  // Simple method to update all NULL expiry dates
  async updateNullExpiryDates(ctx) {
    try {
      const { expiryDate } = ctx.request.body;
      
      if (!expiryDate) {
        return ctx.badRequest('expiryDate is required in request body');
      }
      
      const newExpiryDate = new Date(expiryDate);
      if (isNaN(newExpiryDate.getTime())) {
        return ctx.badRequest('Invalid expiryDate format. Use YYYY-MM-DD');
      }
      
      // Find rate cards with NULL expiry_date
      const rateCards = await strapi.entityService.findMany(
        'api::rate-card.rate-card',
        {
          filters: {
            $or: [
              { expiry_date: null },
              { expiry_date: { $null: true } }
            ]
          },
          limit: -1
        }
      );
      
      console.log(`Found ${rateCards.length} rate cards with NULL expiry date`);
      
      if (rateCards.length === 0) {
        return ctx.send({
          message: 'No rate cards found with NULL expiry date',
          expiryDate: newExpiryDate.toISOString().split('T')[0]
        });
      }
      
      // Update all NULL expiry dates
      for (const rateCard of rateCards) {
        await strapi.entityService.update(
          'api::rate-card.rate-card',
          rateCard.id,
          {
            data: {
              expiry_date: newExpiryDate
            }
          }
        );
      }
      
      return ctx.send({
        message: `Updated ${rateCards.length} rate cards with NULL expiry date`,
        expiryDate: newExpiryDate.toISOString().split('T')[0],
        updatedCount: rateCards.length
      });
      
    } catch (err) {
      console.error('Error in updateNullExpiryDates:', err);
      return ctx.throw(500, err);
    }
  },
  async analyzeResources(ctx) {
            try {
              const axios = require('axios');
              
              const response = await axios.get(process.env.EXTERNAL_API_URL_RESOURCEDS, {
                auth: {
                  username: process.env.EXTERNAL_API_USERNAME,
                  password: process.env.EXTERNAL_API_PASSWORD
                },
                headers: {
                  'Accept': 'application/json'
                }
              });
          
              // Return the raw data for analysis
              return ctx.send({
                success: true,
                data: response.data,
                columnInfo: {
                  available: Object.keys(response.data.value[0] || {}),
                  sample: response.data.value.slice(0, 3), // First 3 records as sample
                  totalRecords: response.data.value.length
                }
              });
            } catch (error) {
              return ctx.badRequest(error.message);
            }
    },
  /*get cost and revenue center*/
  async inspectDimValuDS(ctx) {
  try {
    const axios = require('axios');
    
    const response = await axios.get(process.env.EXTERNAL_API_URL_DimValuDS, {
      auth: {
        username: process.env.EXTERNAL_API_USERNAME,
        password: process.env.EXTERNAL_API_PASSWORD
      },
      timeout: 30000
    });

    const data = response.data;
    const records = data.value || [];

    // Separate locations based on Dimension_Code31351
    const revenueStreams = [];
    const costStreams = [];

    records.forEach(location => {
      const dimensionCode = location.Dimension_Code31351;
      
      if (dimensionCode === 'REVSTREAM') {
        revenueStreams.push({
          uuid: location.Code,
          name: location.Name || 'No Name'
        });
      } else if (dimensionCode === 'COST CENTRE') {
        costStreams.push({
          uuid: location.Code,
          name: location.Name || 'No Name'
        });
      }
    });

    // Save revenue streams - check UUID first
    const revenueResults = {
      created: [],
      skipped: []
    };

    for (const revenueStream of revenueStreams) {
      // Check if a record with this UUID already exists
      const existing = await strapi.entityService.findMany(
        'api::revenue-stream.revenue-stream',
        {
          filters: { uuid: revenueStream.uuid },
          limit: 1
        }
      );

      if (existing.length === 0) {
        // UUID doesn't exist - create new record
        const created = await strapi.entityService.create(
          'api::revenue-stream.revenue-stream',
          {
            data: revenueStream
          }
        );
        revenueResults.created.push({
          uuid: revenueStream.uuid,
          name: revenueStream.name,
          id: created.id
        });
        console.log(`✅ Created revenue stream: ${revenueStream.uuid} - ${revenueStream.name}`);
      } else {
        // UUID already exists - skip
        revenueResults.skipped.push({
          uuid: revenueStream.uuid,
          name: revenueStream.name,
          existingId: existing[0].id
        });
        console.log(`⏭️ Skipped revenue stream (already exists): ${revenueStream.uuid} - ${revenueStream.name}`);
      }
    }

    // Save cost streams - check UUID first
    const costResults = {
      created: [],
      skipped: []
    };

    for (const costStream of costStreams) {
      // Check if a record with this UUID already exists
      const existing = await strapi.entityService.findMany(
        'api::cost-stream.cost-stream',
        {
          filters: { uuid: costStream.uuid },
          limit: 1
        }
      );

      if (existing.length === 0) {
        // UUID doesn't exist - create new record
        const created = await strapi.entityService.create(
          'api::cost-stream.cost-stream',
          {
            data: costStream
          }
        );
        costResults.created.push({
          uuid: costStream.uuid,
          name: costStream.name,
          id: created.id
        });
        console.log(`✅ Created cost stream: ${costStream.uuid} - ${costStream.name}`);
      } else {
        // UUID already exists - skip
        costResults.skipped.push({
          uuid: costStream.uuid,
          name: costStream.name,
          existingId: existing[0].id
        });
        console.log(`⏭️ Skipped cost stream (already exists): ${costStream.uuid} - ${costStream.name}`);
      }
    }

    // Return comprehensive analysis with storage results
    return ctx.send({
      success: true,
      metadata: data['@odata.context'],
      recordCount: records.length,
      summary: {
        totalRecords: records.length,
        revenueStreams: {
          total: revenueStreams.length,
          created: revenueResults.created.length,
          skipped: revenueResults.skipped.length
        },
        costStreams: {
          total: costStreams.length,
          created: costResults.created.length,
          skipped: costResults.skipped.length
        },
        other: records.length - (revenueStreams.length + costStreams.length)
      },
      sample: records.slice(0, 3),
      columns: records.length > 0 ? Object.keys(records[0]) : [],
      storageResults: {
        revenueStreams: revenueResults,
        costStreams: costResults
      }
    });

  } catch (error) {
    console.error('Error in inspectDimValuDS:', error.message);
    return ctx.badRequest(error.message);
  }
}
  /*
  async inspectDimValuDS(ctx) {
      try {
        const axios = require('axios');
        
        const response = await axios.get(process.env.EXTERNAL_API_URL_DimValuDS, {
          auth: {
            username: process.env.EXTERNAL_API_USERNAME,
            password: process.env.EXTERNAL_API_PASSWORD
          },
          timeout: 30000
        });
    
        // Return useful analysis
        const data = response.data;
        return ctx.send({
          success: true,
          metadata: data['@odata.context'],
          recordCount: data.value?.length || 0,
          sample: data.value?.slice(0, 3), // First 3 records
          allData: data.value, // Full dataset
          columns: data.value?.length > 0 ? Object.keys(data.value[0]) : []
        });
      } catch (error) {
        return ctx.badRequest(error.message);
      }
    }
  */
};
