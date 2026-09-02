'use strict';

/**
 * bc-dataset controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::bc-dataset.bc-dataset', ({ strapi }) => ({
  
  // Custom method to get BC datasets by date range
  async getByDateRange(ctx) {
    try {
      const { startDate, endDate } = ctx.params;
      
      // Validate date formats (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return ctx.badRequest('Invalid date format. Use YYYY-MM-DD format.');
      }
      
      // Convert to Date objects for validation
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return ctx.badRequest('Invalid date values provided.');
      }
      
      if (start > end) {
        return ctx.badRequest('Start date cannot be after end date.');
      }
      
      // Query BC datasets within the date range
      const entries = await strapi.db.query('api::bc-dataset.bc-dataset').findMany({
        where: {
          publishedAt: {
            $notNull: true,
          },
          // Assuming you have createdAt or a specific date field for filtering
          // Adjust the field name based on your actual schema
          Posting_Date: {
            $gte: startDate + 'T00:00:00.000Z',
            $lte: endDate + 'T23:59:59.999Z',
          },
        },
        orderBy: { Posting_Date: 'desc' },
      });

      // Transform data to match expected format
      const transformedData = entries.map(entry => ({
        id: entry.id,
        attributes: {
          ...entry,
          id: undefined, // Remove id from attributes since it's already at root level
        }
      }));

      // Calculate summary statistics
      const summary = {
        totalRecords: transformedData.length,
        dateRange: {
          startDate,
          endDate,
        },
        generatedAt: new Date().toISOString(),
      };

      // Return structured response
      ctx.body = {
        data: transformedData,
        meta: {
          summary,
          pagination: {
            total: transformedData.length,
          }
        }
      };

    } catch (err) {
      console.error('BC Dataset date range error:', err);
      ctx.throw(500, `Failed to fetch BC datasets: ${err.message}`);
    }
  },

  // Custom method to get BC datasets by specific date
  async getByDate(ctx) {
    try {
      const { date } = ctx.params;
      
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return ctx.badRequest('Invalid date format. Use YYYY-MM-DD format.');
      }
      
      // Convert to Date object for validation
      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return ctx.badRequest('Invalid date value provided.');
      }
      
      // Query BC datasets for the specific date
      const entries = await strapi.db.query('api::bc-dataset.bc-dataset').findMany({
        where: {
          publishedAt: {
            $notNull: true,
          },
          Posting_Date: {
            $gte: date + 'T00:00:00.000Z',
            $lte: date + 'T23:59:59.999Z',
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Transform data
      const transformedData = entries.map(entry => ({
        id: entry.id,
        attributes: {
          ...entry,
          id: undefined,
        }
      }));

      // Return structured response
      ctx.body = {
        data: transformedData,
        meta: {
          summary: {
            totalRecords: transformedData.length,
            date,
            generatedAt: new Date().toISOString(),
          },
          pagination: {
            total: transformedData.length,
          }
        }
      };

    } catch (err) {
      console.error('BC Dataset date error:', err);
      ctx.throw(500, `Failed to fetch BC datasets: ${err.message}`);
    }
  },

  // Override default find method to add query parameter support
  async find(ctx) {
    const { query } = ctx;
    
    // Check for date range in query parameters
    if (query.startDate && query.endDate) {
      ctx.params.startDate = query.startDate;
      ctx.params.endDate = query.endDate;
      return this.getByDateRange(ctx);
    }
    
    // Check for single date in query parameters
    if (query.date) {
      ctx.params.date = query.date;
      return this.getByDate(ctx);
    }
    
    // Otherwise use default behavior
    try {
      const sanitizedQuery = await this.sanitizeQuery(ctx);
      const results = await strapi.entityService.findMany('api::bc-dataset.bc-dataset', sanitizedQuery);
      
      // Transform to consistent format
      const transformedResults = Array.isArray(results) ? results.map(entry => ({
        id: entry.id,
        attributes: {
          ...entry,
          id: undefined,
        }
      })) : [];

      return { 
        data: transformedResults,
        meta: {
          pagination: {
            total: transformedResults.length,
          }
        }
      };
    } catch (err) {
      console.error('BC Dataset find error:', err);
      ctx.throw(500, err);
    }
  }

}));
