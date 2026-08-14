// src/api/rate-card/controllers/rate-card.js
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Using createCoreController so that standard CRUD handlers (find, findOne,
// create, update, delete) are inherited automatically.  All existing custom
// methods are merged in via the second argument.
// ─────────────────────────────────────────────────────────────────────────────

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::rate-card.rate-card', ({ strapi }) => ({

  // ── Custom methods ────────────────────────────────────────────────────────

  async bulkUpdateExpiryDates(ctx) {
    try {
      const { expiryDate, filters = {} } = ctx.request.body;

      if (!expiryDate) {
        return ctx.badRequest('expiryDate is required in request body');
      }

      const newExpiryDate = new Date(expiryDate);
      if (isNaN(newExpiryDate.getTime())) {
        return ctx.badRequest('Invalid expiryDate format. Use YYYY-MM-DD');
      }

      const queryFilters = {};

      if (filters.productId) {
        queryFilters.product = { id: filters.productId };
      }

      if (filters.onlyNullExpiry) {
        queryFilters.$or = [
          { expiry_date: null },
          { expiry_date: { $null: true } }
        ];
      }

      if (filters.onlyExpired) {
        const today = new Date();
        queryFilters.$or = [
          { expiry_date: { $lt: today } },
          { expiry_date: null },
          { expiry_date: { $null: true } }
        ];
      }

      console.log('Updating rate cards with filters:', JSON.stringify(queryFilters));

      const rateCards = await strapi.entityService.findMany(
        'api::rate-card.rate-card',
        { filters: queryFilters, limit: -1 }
      );

      console.log(`Found ${rateCards.length} rate cards to update`);

      if (rateCards.length === 0) {
        return ctx.send({
          message: 'No rate cards found matching the criteria',
          expiryDate: newExpiryDate.toISOString().split('T')[0],
          updatedCount: 0
        });
      }

      let successCount = 0;
      let failedCount  = 0;
      const failedIds  = [];

      for (const rateCard of rateCards) {
        try {
          await strapi.entityService.update(
            'api::rate-card.rate-card',
            rateCard.id,
            { data: { expiry_date: newExpiryDate } }
          );
          successCount++;
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
        message:      `Successfully updated ${successCount} rate cards`,
        expiryDate:   newExpiryDate.toISOString().split('T')[0],
        totalFound:   rateCards.length,
        successCount,
        failedCount,
        failedIds:    failedCount > 0 ? failedIds : undefined
      });

    } catch (err) {
      console.error('Error in bulkUpdateExpiryDates:', err);
      return ctx.throw(500, err);
    }
  },

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
          message:    'No rate cards found with NULL expiry date',
          expiryDate: newExpiryDate.toISOString().split('T')[0]
        });
      }

      for (const rateCard of rateCards) {
        await strapi.entityService.update(
          'api::rate-card.rate-card',
          rateCard.id,
          { data: { expiry_date: newExpiryDate } }
        );
      }

      return ctx.send({
        message:      `Updated ${rateCards.length} rate cards with NULL expiry date`,
        expiryDate:   newExpiryDate.toISOString().split('T')[0],
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
        headers: { 'Accept': 'application/json' }
      });

      return ctx.send({
        success: true,
        data:    response.data,
        columnInfo: {
          available:    Object.keys(response.data.value[0] || {}),
          sample:       response.data.value.slice(0, 3),
          totalRecords: response.data.value.length
        }
      });
    } catch (error) {
      return ctx.badRequest(error.message);
    }
  },
  
  /**
   * Inspect Dimension Values from Business Central
   * Self-contained method using axios with security key authentication
   */
  inspectDimValuDS: async (ctx) => {
    try {
      const axios = require('axios');
      
      // Get test mode from request body, default to false (live mode)
      const { test = false } = ctx.request.body || {};

      // Validate required environment variables
      const required = [
        'EXTERNAL_API_BC_BASE_URL',
        'BC_API_SECRET_KEY'
      ];
      
      const missing = required.filter(key => !process.env[key]);
      if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }

      // Create axios instance with security key authentication (like BCClient)
      const bcClient = axios.create({
        baseURL: process.env.EXTERNAL_API_BC_BASE_URL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.BC_API_SECRET_KEY}`,
          'Accept': 'application/json'
        }
      });

      // Add response interceptor for error handling (like BCClient)
      bcClient.interceptors.response.use(
        response => response,
        error => {
          if (error.response) {
            console.error('BC API Error:', {
              status: error.response.status,
              data: error.response.data,
              url: error.config.url
            });
          }
          return Promise.reject(error);
        }
      );

      console.log('🔍 Starting Dimension Value inspection...');
      console.log(`🔐 Authentication: Using BC API Security Key`);
      console.log(`📡 Endpoint: ${process.env.EXTERNAL_API_BC_BASE_URL}/DimValuDS`);
      console.log(`🧪 Mode: ${test ? 'TEST (No changes will be saved)' : 'LIVE (Changes will be saved)'}`);

      // Fetch dimension values from Business Central
      const response = await bcClient.get('/DimValuDS', {
        params: {
          $top: 1000 // Adjust as needed
        }
      });

      if (!response || !response.data) {
        throw new Error('Invalid response from Business Central');
      }

      const records = response.data.value || [];
      console.log(`📊 Retrieved ${records.length} records from Business Central`);

      // Process records into revenue streams and cost centres
      const revenueStreams = [];
      const costStreams = [];

      records.forEach(location => {
        const dimensionCode = location.Dimension_Code31351;
        const rawCode = location.Code || '';
        const rawName = location.Name || 'No Name';
        const sanitizedCode = rawCode.replace(/[^\w\s\-_.~]/g, '_');

        if (sanitizedCode !== rawCode) {
          console.log(`⚠️ Sanitized code from "${rawCode}" to "${sanitizedCode}"`);
        }

        if (dimensionCode === 'REVSTREAM') {
          revenueStreams.push({ code: sanitizedCode, name: rawName });
        } else if (dimensionCode === 'COST CENTRE') {
          costStreams.push({ code: sanitizedCode, name: rawName });
        }
      });

      console.log(`📋 Found ${revenueStreams.length} revenue streams and ${costStreams.length} cost centres`);

      // Process revenue streams
      const revenueResults = { created: [], skipped: [], failed: [] };

      for (const rs of revenueStreams) {
        try {
          if (!rs.code) {
            revenueResults.failed.push({ ...rs, reason: 'Empty code' });
            continue;
          }
          
          const existing = await strapi.entityService.findMany('api::revenue-stream.revenue-stream', {
            filters: { code: rs.code },
            limit: 1
          });
          
          if (existing.length === 0) {
            if (!test) {
              const created = await strapi.entityService.create('api::revenue-stream.revenue-stream', { data: rs });
              revenueResults.created.push({ code: rs.code, name: rs.name, id: created.id });
              console.log(`✅ Created revenue stream: ${rs.code} - ${rs.name}`);
            } else {
              revenueResults.created.push({
                code: rs.code,
                name: rs.name,
                id: 'TEST_MODE_SKIPPED',
                testMode: true,
                message: 'Would be created in live mode'
              });
              console.log(`[TEST MODE] Would create revenue stream: ${rs.code} - ${rs.name}`);
            }
          } else {
            revenueResults.skipped.push({ code: rs.code, name: rs.name, existingId: existing[0].id });
            console.log(`⏭️ Skipped existing revenue stream: ${rs.code}`);
          }
        } catch (error) {
          revenueResults.failed.push({ ...rs, reason: error.message });
          console.error(`❌ Failed to process revenue stream ${rs.code}:`, error.message);
        }
      }

      // Process cost streams
      const costResults = { created: [], skipped: [], failed: [] };

      for (const cs of costStreams) {
        try {
          if (!cs.code) {
            costResults.failed.push({ ...cs, reason: 'Empty code' });
            continue;
          }
          
          const existing = await strapi.entityService.findMany('api::cost-stream.cost-stream', {
            filters: { code: cs.code },
            limit: 1
          });
          
          if (existing.length === 0) {
            if (!test) {
              const created = await strapi.entityService.create('api::cost-stream.cost-stream', { data: cs });
              costResults.created.push({ code: cs.code, name: cs.name, id: created.id });
              console.log(`✅ Created cost centre: ${cs.code} - ${cs.name}`);
            } else {
              costResults.created.push({
                code: cs.code,
                name: cs.name,
                id: 'TEST_MODE_SKIPPED',
                testMode: true,
                message: 'Would be created in live mode'
              });
              console.log(`[TEST MODE] Would create cost centre: ${cs.code} - ${cs.name}`);
            }
          } else {
            costResults.skipped.push({ code: cs.code, name: cs.name, existingId: existing[0].id });
            console.log(`⏭️ Skipped existing cost centre: ${cs.code}`);
          }
        } catch (error) {
          costResults.failed.push({ ...cs, reason: error.message });
          console.error(`❌ Failed to process cost centre ${cs.code}:`, error.message);
        }
      }

      // Generate summary
      const summary = {
        totalRecords: records.length,
        revenueStreams: { 
          total: revenueStreams.length, 
          ...revenueResults 
        },
        costStreams: { 
          total: costStreams.length, 
          ...costResults 
        },
        other: records.length - (revenueStreams.length + costStreams.length)
      };

      console.log('📊 Inspection Summary:');
      console.log(`   Total records: ${summary.totalRecords}`);
      console.log(`   Revenue streams: ${summary.revenueStreams.total} (Created: ${revenueResults.created.length}, Skipped: ${revenueResults.skipped.length}, Failed: ${revenueResults.failed.length})`);
      console.log(`   Cost centres: ${summary.costStreams.total} (Created: ${costResults.created.length}, Skipped: ${costResults.skipped.length}, Failed: ${costResults.failed.length})`);
      console.log(`   Other records: ${summary.other}`);

      return ctx.send({
        success: true,
        metadata: response.data['@odata.context'],
        testMode: test,
        authentication: 'BC API Security Key',
        summary: summary,
        sample: records.slice(0, 3),
        columns: records.length > 0 ? Object.keys(records[0]) : [],
        storageResults: { revenueStreams: revenueResults, costStreams: costResults }
      });

    } catch (error) {
      console.error('💥 Error in inspectDimValuDS:', error.message);
      
      // Log detailed error if available
      if (error.response) {
        console.error('BC API Response Status:', error.response.status);
        console.error('BC API Response Data:', error.response.data);
      }
      
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

      const data    = response.data;
      const records = data.value || [];

      const revenueStreams = [];
      const costStreams    = [];

      records.forEach(location => {
        const dimensionCode = location.Dimension_Code31351;
        const rawCode       = location.Code  || '';
        const rawName       = location.Name  || 'No Name';
        const sanitizedCode = rawCode.replace(/[^\w\s\-_.~]/g, '_');

        if (sanitizedCode !== rawCode) {
          console.log(`⚠️ Sanitized code from "${rawCode}" to "${sanitizedCode}"`);
        }

        if (dimensionCode === 'REVSTREAM') {
          revenueStreams.push({ code: sanitizedCode, name: rawName });
        } else if (dimensionCode === 'COST CENTRE') {
          costStreams.push({ code: sanitizedCode, name: rawName });
        }
      });

      const revenueResults = { created: [], skipped: [], failed: [] };

      for (const rs of revenueStreams) {
        try {
          if (!rs.code) { revenueResults.failed.push({ ...rs, reason: 'Empty code' }); continue; }
          const existing = await strapi.entityService.findMany('api::revenue-stream.revenue-stream', { filters: { code: rs.code }, limit: 1 });
          if (existing.length === 0) {
            const created = await strapi.entityService.create('api::revenue-stream.revenue-stream', { data: rs });
            revenueResults.created.push({ code: rs.code, name: rs.name, id: created.id });
          } else {
            revenueResults.skipped.push({ code: rs.code, name: rs.name, existingId: existing[0].id });
          }
        } catch (error) {
          revenueResults.failed.push({ ...rs, reason: error.message });
        }
      }

      const costResults = { created: [], skipped: [], failed: [] };

      for (const cs of costStreams) {
        try {
          if (!cs.code) { costResults.failed.push({ ...cs, reason: 'Empty code' }); continue; }
          const existing = await strapi.entityService.findMany('api::cost-stream.cost-stream', { filters: { code: cs.code }, limit: 1 });
          if (existing.length === 0) {
            const created = await strapi.entityService.create('api::cost-stream.cost-stream', { data: cs });
            costResults.created.push({ code: cs.code, name: cs.name, id: created.id });
          } else {
            costResults.skipped.push({ code: cs.code, name: cs.name, existingId: existing[0].id });
          }
        } catch (error) {
          costResults.failed.push({ ...cs, reason: error.message });
        }
      }

      return ctx.send({
        success:  true,
        metadata: data['@odata.context'],
        summary: {
          totalRecords:  records.length,
          revenueStreams: { total: revenueStreams.length, ...revenueResults },
          costStreams:    { total: costStreams.length,    ...costResults    },
          other: records.length - (revenueStreams.length + costStreams.length)
        },
        sample:  records.slice(0, 3),
        columns: records.length > 0 ? Object.keys(records[0]) : [],
        storageResults: { revenueStreams: revenueResults, costStreams: costResults }
      });

    } catch (error) {
      console.error('Error in inspectDimValuDS:', error.message);
      return ctx.badRequest(error.message);
    }
  }
  */
  ,

  /**
   * PATCH /api/rate-cards/:id/fields
   *
   * Selectively update one or more whitelisted fields on a rate card.
   * Body: { fields: { full_color_no: "AC0001", base_unit_of_measure: "ADS", … } }
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

      const ALLOWED = [
        'ad_type', 'full_color_no', 'black_color_no', 'base_unit_of_measure',
        'size_dimension', 'duration', 'price_fc', 'price_bw', 'time_slot',
        'currency', 'effective_date', 'expiry_date', 'surcharge_percentage', 'metadata',
      ];

      const sanitized = {};
      const rejected  = [];

      for (const [key, value] of Object.entries(fields)) {
        if (ALLOWED.includes(key)) {
          const nullable = [
            'full_color_no', 'black_color_no', 'base_unit_of_measure',
            'size_dimension', 'duration', 'time_slot', 'expiry_date',
            'price_fc', 'price_bw', 'surcharge_percentage'
          ];
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

      const existing = await strapi.entityService.findOne(
        'api::rate-card.rate-card', id, { populate: ['product'] }
      );

      if (!existing) {
        return ctx.notFound(`Rate card #${id} not found`);
      }

      const updated = await strapi.entityService.update(
        'api::rate-card.rate-card', id,
        { data: sanitized, populate: ['product'] }
      );

      console.log(`✅ Rate card #${id} updated. Fields: ${Object.keys(sanitized).join(', ')}`);

      return ctx.send({
        success:       true,
        message:       `Rate card #${id} updated successfully`,
        id:            Number(id),
        updatedFields: Object.keys(sanitized),
        ...(rejected.length > 0 && {
          ignoredFields: rejected,
          note: `Fields not in the whitelist were ignored: ${rejected.join(', ')}`
        }),
        data: updated,
      });

    } catch (err) {
      console.error('Error in updateRateCardFields:', err);
      return ctx.throw(500, err);
    }
  },

    /**
   * POST /api/rate-cards/search
   * 
   * Search rate cards with complex query in request body
   * Body: { populate, filters, pagination, sort, fields }
   */
  async search(ctx) {
    try {
      const { 
        populate, 
        filters, 
        pagination, 
        sort, 
        fields 
      } = ctx.request.body;

      // Build the query parameters
      const query = {};
      
      if (populate) query.populate = populate;
      if (filters) query.filters = filters;
      if (pagination) query.pagination = pagination;
      if (sort) query.sort = sort;
      if (fields) query.fields = fields;

      // Use entityService.findMany for more control
      // or delegate to the default find method
      const result = await strapi.entityService.findMany(
        'api::rate-card.rate-card',
        query
      );

      // Get pagination info if needed
      const count = await strapi.entityService.count(
        'api::rate-card.rate-card',
        { filters }
      );

      const page = pagination?.page || 1;
      const pageSize = pagination?.pageSize || 25;
      const pageCount = Math.ceil(count / pageSize);

      return ctx.send({
        data: result,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount,
            total: count
          }
        }
      });

    } catch (err) {
      console.error('Error in rate-card search:', err);
      return ctx.throw(500, err);
    }
  },

}));
