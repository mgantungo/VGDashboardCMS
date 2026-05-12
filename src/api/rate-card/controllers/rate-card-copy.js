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
            const rawCode = location.Code || '';
            const rawName = location.Name || 'No Name';
            
            // Still sanitize but now it's a text field - we can be more permissive
            // But let's keep it clean by removing any extreme characters
            const sanitizedCode = rawCode.replace(/[^\w\s\-_.~]/g, '_');
            
            // If sanitization changed the value, log it
            if (sanitizedCode !== rawCode) {
              console.log(`⚠️ Sanitized code from "${rawCode}" to "${sanitizedCode}"`);
            }
            
            if (dimensionCode === 'REVSTREAM') {
              revenueStreams.push({
                code: sanitizedCode,
                name: rawName
              });
            } else if (dimensionCode === 'COST CENTRE') {
              costStreams.push({
                code: sanitizedCode,
                name: rawName
              });
            }
          });
      
          console.log(`📊 Found ${revenueStreams.length} revenue streams and ${costStreams.length} cost streams`);
      
          // Save revenue streams - check code first
          const revenueResults = {
            created: [],
            skipped: [],
            failed: []
          };
      
          for (const revenueStream of revenueStreams) {
            try {
              // Skip if code is empty after sanitization
              if (!revenueStream.code) {
                console.log(`❌ Skipped revenue stream - empty code: ${JSON.stringify(revenueStream)}`);
                revenueResults.failed.push({
                  ...revenueStream,
                  reason: 'Empty code after sanitization'
                });
                continue;
              }
      
              // Check if a record with this code already exists
              const existing = await strapi.entityService.findMany(
                'api::revenue-stream.revenue-stream',
                {
                  filters: { code: revenueStream.code },
                  limit: 1
                }
              );
      
              if (existing.length === 0) {
                // Code doesn't exist - create new record
                const created = await strapi.entityService.create(
                  'api::revenue-stream.revenue-stream',
                  {
                    data: revenueStream
                  }
                );
                revenueResults.created.push({
                  code: revenueStream.code,
                  name: revenueStream.name,
                  id: created.id
                });
                console.log(`✅ Created revenue stream: ${revenueStream.code} - ${revenueStream.name}`);
              } else {
                // Code already exists - skip
                revenueResults.skipped.push({
                  code: revenueStream.code,
                  name: revenueStream.name,
                  existingId: existing[0].id
                });
                console.log(`⏭️ Skipped revenue stream (already exists): ${revenueStream.code} - ${revenueStream.name}`);
              }
            } catch (error) {
              console.error(`❌ Failed to process revenue stream ${revenueStream.code}:`, error.message);
              revenueResults.failed.push({
                ...revenueStream,
                reason: error.message
              });
            }
          }
      
          // Save cost streams - check code first
          const costResults = {
            created: [],
            skipped: [],
            failed: []
          };
      
          for (const costStream of costStreams) {
            try {
              // Skip if code is empty after sanitization
              if (!costStream.code) {
                console.log(`❌ Skipped cost stream - empty code: ${JSON.stringify(costStream)}`);
                costResults.failed.push({
                  ...costStream,
                  reason: 'Empty code after sanitization'
                });
                continue;
              }
      
              // Check if a record with this code already exists
              const existing = await strapi.entityService.findMany(
                'api::cost-stream.cost-stream',
                {
                  filters: { code: costStream.code },
                  limit: 1
                }
              );
      
              if (existing.length === 0) {
                // Code doesn't exist - create new record
                const created = await strapi.entityService.create(
                  'api::cost-stream.cost-stream',
                  {
                    data: costStream
                  }
                );
                costResults.created.push({
                  code: costStream.code,
                  name: costStream.name,
                  id: created.id
                });
                console.log(`✅ Created cost stream: ${costStream.code} - ${costStream.name}`);
              } else {
                // Code already exists - skip
                costResults.skipped.push({
                  code: costStream.code,
                  name: costStream.name,
                  existingId: existing[0].id
                });
                console.log(`⏭️ Skipped cost stream (already exists): ${costStream.code} - ${costStream.name}`);
              }
            } catch (error) {
              console.error(`❌ Failed to process cost stream ${costStream.code}:`, error.message);
              costResults.failed.push({
                ...costStream,
                reason: error.message
              });
            }
          }
      
          // Log summary
          console.log('\n📈 PROCESSING SUMMARY:');
          console.log(`Revenue Streams - Created: ${revenueResults.created.length}, Skipped: ${revenueResults.skipped.length}, Failed: ${revenueResults.failed.length}`);
          console.log(`Cost Streams - Created: ${costResults.created.length}, Skipped: ${costResults.skipped.length}, Failed: ${costResults.failed.length}`);
      
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
                skipped: revenueResults.skipped.length,
                failed: revenueResults.failed.length
              },
              costStreams: {
                total: costStreams.length,
                created: costResults.created.length,
                skipped: costResults.skipped.length,
                failed: costResults.failed.length
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
      },

 /**
   * PATCH /api/rate-cards/:id/fields
   * Selectively update one or more fields on a single rate card.
   *
   * Body:  { fields: { full_color_no: "AC0001", base_unit_of_measure: "ADS", ... } }
   *
   * Allowed fields (whitelist – anything else is silently ignored):
   *   ad_type, full_color_no, black_color_no, base_unit_of_measure,
   *   size_dimension, duration, price_fc, price_bw, time_slot,
   *   currency, effective_date, expiry_date, surcharge_percentage, metadata
   */
  async updateRateCardFields(ctx) {
    try {
      const { id } = ctx.params;
 
      if (!id) {
        return ctx.badRequest('Rate card ID is required');
      }
 
      const { fields } = ctx.request.body;
 
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
        return ctx.badRequest('Request body must contain a "fields" object');
      }
 
      if (Object.keys(fields).length === 0) {
        return ctx.badRequest('At least one field must be provided');
      }
 
      // Strict whitelist — do not allow relational or system fields
      const ALLOWED = [
        'ad_type',
        'full_color_no',
        'black_color_no',
        'base_unit_of_measure',
        'size_dimension',
        'duration',
        'price_fc',
        'price_bw',
        'time_slot',
        'currency',
        'effective_date',
        'expiry_date',
        'surcharge_percentage',
        'metadata',
      ];
 
      const sanitized = {};
      const rejected  = [];
 
      for (const [key, value] of Object.entries(fields)) {
        if (ALLOWED.includes(key)) {
          // Coerce empty strings to null for nullable fields
          const nullable = ['full_color_no', 'black_color_no', 'base_unit_of_measure',
                            'size_dimension', 'duration', 'time_slot', 'expiry_date',
                            'price_fc', 'price_bw', 'surcharge_percentage'];
          sanitized[key] = (nullable.includes(key) && value === '') ? null : value;
        } else {
          rejected.push(key);
        }
      }
 
      if (Object.keys(sanitized).length === 0) {
        return ctx.badRequest(
          `None of the supplied fields are updatable. Allowed: ${ALLOWED.join(', ')}`
        );
      }
 
      // Confirm the rate card exists
      const existing = await strapi.entityService.findOne(
        'api::rate-card.rate-card',
        id,
        { populate: ['product'] }
      );
 
      if (!existing) {
        return ctx.notFound(`Rate card #${id} not found`);
      }
 
      // Perform the update
      const updated = await strapi.entityService.update(
        'api::rate-card.rate-card',
        id,
        {
          data:    sanitized,
          populate: ['product'],
        }
      );
 
      console.log(`✅ Rate card #${id} updated. Fields: ${Object.keys(sanitized).join(', ')}`);
 
      return ctx.send({
        success:       true,
        message:       `Rate card #${id} updated successfully`,
        id:            Number(id),
        updatedFields: Object.keys(sanitized),
        ...(rejected.length > 0 && {
          ignoredFields: rejected,
          note: `Fields not in the whitelist were ignored: ${rejected.join(', ')}`,
        }),
        data: updated,
      });
 
    } catch (err) {
      console.error('Error in updateRateCardFields:', err);
      return ctx.throw(500, err);
    }
  },


  
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
