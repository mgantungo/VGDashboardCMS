// src/api/bc-dataset/controllers/bc-dataset.js
'use strict';

/**
 * bc-dataset controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::bc-dataset.bc-dataset', ({ strapi }) => ({
  
  // Define the allowed fields to return
  getAllowedFields() {
    return [
      'locale',
      'Entry_No',
      'Transaction_No',
      'G_L_Account_No',
      'Posting_Date',
      'Document_Date',
      'Document_Type',
      'Document_No',
      'Source_Code',
      'Job_No',
      'Business_Unit_Code',
      'Reason_Code',
      'Gen_Posting_Type',
      'Gen_Bus_Posting_Group',
      'Gen_Prod_Posting_Group',
      'Tax_Area_Code',
      'Tax_Liable',
      'Tax_Group_Code',
      'Use_Tax',
      'VAT_Bus_Posting_Group',
      'VAT_Prod_Posting_Group',
      'IC_Partner_Code',
      'Amount',
      'Debit_Amount',
      'Credit_Amount',
      'VAT_Amount',
      'Additional_Currency_Amount',
      'Add_Currency_Debit_Amount',
      'Add_Currency_Credit_Amount',
      'Dimension_Set_ID',
      'G_L_Account_Name'
    ];
  },

  // Helper function to filter entry data to only include allowed fields
  filterEntryData(entry) {
    const allowedFields = this.getAllowedFields();
    const filteredAttributes = {};
    
    // Only include allowed fields
    allowedFields.forEach(field => {
      if (entry.hasOwnProperty(field)) {
        filteredAttributes[field] = entry[field];
      }
    });
    
    return {
      id: entry.id,
      attributes: filteredAttributes
    };
  },

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
      
      const allowedFields = this.getAllowedFields();
      
      // Query BC datasets within the date range with only allowed fields
      const entries = await strapi.db.query('api::bc-dataset.bc-dataset').findMany({
        select: ['id', ...allowedFields],
        where: {
          publishedAt: {
            $notNull: true,
          },
          // Use date filtering on Posting_Date field
          Posting_Date: {
            $gte: startDate + 'T00:00:00.000Z',
            $lte: endDate + 'T23:59:59.999Z',
          },
        },
        orderBy: { Posting_Date: 'desc' },
      });

      // Transform data to only include filtered fields
      const transformedData = entries.map(entry => this.filterEntryData(entry));

      // Calculate summary statistics
      const summary = {
        totalRecords: transformedData.length,
        dateRange: {
          startDate,
          endDate,
        },
        fieldsReturned: allowedFields.length,
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
      
      const allowedFields = this.getAllowedFields();
      
      // Query BC datasets for the specific date with only allowed fields
      const entries = await strapi.db.query('api::bc-dataset.bc-dataset').findMany({
        select: ['id', ...allowedFields],
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

      // Transform data to only include filtered fields
      const transformedData = entries.map(entry => this.filterEntryData(entry));

      // Return structured response
      ctx.body = {
        data: transformedData,
        meta: {
          summary: {
            totalRecords: transformedData.length,
            date,
            fieldsReturned: allowedFields.length,
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
    
    // Default behavior with field filtering
    try {
      const allowedFields = this.getAllowedFields();
      
      // Use direct database query to control fields
      const entries = await strapi.db.query('api::bc-dataset.bc-dataset').findMany({
        select: ['id', ...allowedFields],
        where: {
          publishedAt: {
            $notNull: true,
          },
        },
        orderBy: { Entry_No: 'desc' },
        limit: query.limit || 100,
        offset: query.offset || 0,
      });

      // Transform to only include filtered fields
      const transformedData = entries.map(entry => this.filterEntryData(entry));

      return { 
        data: transformedData,
        meta: {
          summary: {
            totalRecords: transformedData.length,
            fieldsReturned: allowedFields.length,
            generatedAt: new Date().toISOString(),
          },
          pagination: {
            total: transformedData.length,
            limit: query.limit || 100,
            offset: query.offset || 0,
          }
        }
      };
    } catch (err) {
      console.error('BC Dataset find error:', err);
      ctx.throw(500, err);
    }
  }

}));
