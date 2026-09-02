'use strict';
/**
 * api-listing controller
 */
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::api-listing.api-listing', ({ strapi }) => ({
  
  // Custom method for dashboard data
  async getDashboardData(ctx) {
    try {
      // Fetch all api-listings with only the required fields
      const entries = await strapi.entityService.findMany('api::api-listing.api-listing', {
        fields: ['purpose', 'url', 'method', 'usage', 'callback', 'active', 'grouping', 'public', 'private'],
        filters: {
          publishedAt: {
            $notNull: true,
          },
          active: true
        },
        sort: { createdAt: 'desc' },
      });
      
      // Transform data to match frontend expectations
      const transformedData = entries.map(entry => ({
        id: entry.id,
        attributes: {
          purpose: entry.purpose || '',
          url: entry.url || '',
          method: entry.method || 'GET',
          usage: entry.usage || '',
          callback: entry.callback || '',
          active: entry.active !== undefined ? entry.active : true,
          grouping: entry.grouping || '',
          public: entry.public !== undefined ? entry.public : false,
          private: entry.private !== undefined ? entry.private : false,
        }
      }));
      
      // Calculate statistics
      const stats = {
        total: transformedData.length,
        active: transformedData.filter(item => item.attributes.active).length,
        public: transformedData.filter(item => item.attributes.public).length,
        private: transformedData.filter(item => item.attributes.private).length,
        methods: {
          GET: transformedData.filter(item => item.attributes.method === 'GET').length,
          POST: transformedData.filter(item => item.attributes.method === 'POST').length,
          PUT: transformedData.filter(item => item.attributes.method === 'PUT').length,
          DELETE: transformedData.filter(item => item.attributes.method === 'DELETE').length,
        },
        groups: [...new Set(transformedData.map(item => item.attributes.grouping).filter(Boolean))]
      };
      
      // Return structured response
      ctx.body = {
        data: transformedData,
        meta: {
          stats,
          pagination: {
            total: transformedData.length,
          }
        }
      };
    } catch (err) {
      console.error('Dashboard data error:', err);
      ctx.throw(500, err);
    }
  },
  
  // Override default find method to return limited fields if needed
  async find(ctx) {
    const { query } = ctx;
    
    // If dashboard query parameter is present, use custom method
    if (query.dashboard === 'true') {
      return this.getDashboardData(ctx);
    }
    
    try {
      // Debug: First, let's see what data exists without filters
      console.log('=== DEBUGGING API LISTING FIND ===');
      
      // Check all entries without filters
      const allEntries = await strapi.entityService.findMany('api::api-listing.api-listing', {
        fields: ['purpose', 'url', 'method', 'usage', 'callback', 'active', 'grouping', 'public', 'private', 'publishedAt'],
      });
      console.log('Total entries found:', allEntries.length);
      console.log('Sample entry:', allEntries[0]);
      
      // Check active entries
      const activeEntries = await strapi.entityService.findMany('api::api-listing.api-listing', {
        fields: ['purpose', 'url', 'method', 'usage', 'callback', 'active', 'grouping', 'public', 'private', 'publishedAt'],
        filters: {
          active: true
        },
      });
      console.log('Active entries found:', activeEntries.length);
      
      // Check published entries
      const publishedEntries = await strapi.entityService.findMany('api::api-listing.api-listing', {
        fields: ['purpose', 'url', 'method', 'usage', 'callback', 'active', 'grouping', 'public', 'private', 'publishedAt'],
        filters: {
          publishedAt: {
            $notNull: true,
          },
        },
      });
      console.log('Published entries found:', publishedEntries.length);
      
      // Try different approaches for published filter
      const publishedEntries2 = await strapi.entityService.findMany('api::api-listing.api-listing', {
        fields: ['purpose', 'url', 'method', 'usage', 'callback', 'active', 'grouping', 'public', 'private', 'publishedAt'],
        filters: {
          publishedAt: {
            $ne: null,
          },
        },
      });
      console.log('Published entries (using $ne): found:', publishedEntries2.length);
      
      // For regular requests, also limit fields but include more for admin use
      const sanitizedQuery = await this.sanitizeQuery(ctx);
      
      // Override fields to only return what we need
      sanitizedQuery.fields = ['purpose', 'url', 'method', 'usage', 'callback', 'active', 'grouping', 'public', 'private'];
      
      // Try with just active filter first
      sanitizedQuery.filters = {
        ...sanitizedQuery.filters, // Preserve any existing filters from query params
        active: true
      };
      
      console.log('Final sanitized query:', JSON.stringify(sanitizedQuery, null, 2));
      
      const results = await strapi.entityService.findMany('api::api-listing.api-listing', sanitizedQuery);
      console.log('Final results count:', results.length);
      console.log('=== END DEBUG ===');
      
      // Transform the results to match expected format
      const transformedResults = results.map(entry => ({
        id: entry.id,
        attributes: {
          purpose: entry.purpose || '',
          url: entry.url || '',
          method: entry.method || 'GET',
          usage: entry.usage || '',
          callback: entry.callback || '',
          active: entry.active !== undefined ? entry.active : true,
          grouping: entry.grouping || '',
          public: entry.public !== undefined ? entry.public : false,
          private: entry.private !== undefined ? entry.private : false,
        }
      }));
      
      return { data: transformedResults };
    } catch (err) {
      console.error('Find method error:', err);
      ctx.throw(500, err);
    }
  },

  /**
   * Get article session duration analytics using URL parameters
   * GET /api/api-listings/article-session-duration/2025-01-01/2025-05-01
   */
  async getArticleSessionDuration(ctx) {
    try {
      const { startDate, endDate } = ctx.params;

      // Validate required parameters
      if (!startDate || !endDate) {
        return ctx.badRequest('Both startDate and endDate are required in the URL path');
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return ctx.badRequest('Date format must be YYYY-MM-DD');
      }

      // Validate date range (endDate should be after startDate)
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return ctx.badRequest('Invalid date format');
      }

      if (end <= start) {
        return ctx.badRequest('endDate must be after startDate');
      }

      // Make request to external API using query parameters
      const url = `https://analytics-api.newvisionapp.com/ga4/article-session-duration?startDate=${startDate}&endDate=${endDate}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Strapi-Analytics-Proxy/1.0'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        // If external API returns an error, pass it through
        const errorData = await response.text();
        return ctx.send(errorData, response.status);
      }

      const data = await response.json();
      
      // Return the raw data exactly as provided by the external API
      ctx.send(data);

    } catch (error) {
      // Handle different types of errors
      if (error.name === 'AbortError') {
        return ctx.requestTimeout('Request timed out');
      }

      if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED') {
        return ctx.serviceUnavailable('Unable to connect to analytics service');
      }

      // Other errors
      strapi.log.error('Unexpected error:', error);
      return ctx.internalServerError('An unexpected error occurred');
    }
  },



/**
   * Get articles with reorganized fields and date filtering
   * GET /api/api-listings/articles/2025-01-01/2025-07-18/0
   */
  async getArticles(ctx) {
    try {
      const { startDate, endDate, offset } = ctx.params;
      const { limit = 10 } = ctx.query;

      // Validate required parameters
      if (!startDate || !endDate || offset === undefined) {
        return ctx.badRequest('startDate, endDate, and offset are required in the URL path');
      }

      // Validate and parse offset
      const offsetNum = parseInt(offset, 10);
      if (isNaN(offsetNum) || offsetNum < 0) {
        return ctx.badRequest('offset must be a non-negative integer (0, 10, 20, etc.)');
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return ctx.badRequest('Date format must be YYYY-MM-DD');
      }

      // Validate date range (endDate should be after startDate)
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return ctx.badRequest('Invalid date format');
      }

      if (end <= start) {
        return ctx.badRequest('endDate must be after startDate');
      }

      // Build the external API URL using the correct daterange endpoint
      const baseUrl = 'https://api.newvisionapp.com/v1/Articles/daterange';
      
      const queryParams = new URLSearchParams({
        currentDate: endDate,        // The later date
        pastDate: startDate,         // The earlier date
        limit: limit.toString(),
        offset: offsetNum.toString()
      });

      const url = `${baseUrl}?${queryParams}`;
      
      console.log('Requesting URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Strapi-Articles-Proxy/1.0'
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        return ctx.send(errorData, response.status);
      }

      const data = await response.json();
      return this.transformArticleData(ctx, data);

    } catch (error) {
      // Handle different types of errors
      if (error.name === 'AbortError') {
        return ctx.requestTimeout('Request timed out');
      }

      if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED') {
        return ctx.serviceUnavailable('Unable to connect to articles service');
      }

      // Other errors
      strapi.log.error('Unexpected error in getArticles:', error);
      return ctx.internalServerError('An unexpected error occurred');
    }
  },

  /**
   * Helper method to transform article data
   */
  transformArticleData(ctx, responseData) {
    // Extract the data array from the response
    const articles = responseData.data || [];
    
    // Transform the data to reorganize fields and remove unwanted fields
    const transformedData = articles.map(article => ({
      id: article.id,
      externalId: article.externalId,
      created_on: article.created_on,
      published_on: article.published_on,
      title: article.title,
      urlSlug: article.urlSlug,
      plain_text_summary: article.plain_text_summary,
      summary: '',
      tags: article.tags,
      category: article.category,
      author: article.author,
      authors: article.authors,
      bookmarked: article.bookmarked,
      bookmarkId: article.bookmarkId,
      timeToRead: article.timeToRead,
      breaking_news: article.breaking_news,
      breaking_news_duration: article.breaking_news_duration,
      is_featured: article.is_featured,
      premium: article.premium,
      subscribed: article.subscribed,
      editor: article.editor
      // Removed: details, plain_text_details, featured_image, featured_image_thumbnails, featured_image_caption, relatedArticles, secondarycategories, oldArticles
    }));
    
    // Include pagination metadata
    const response = {
      data: transformedData,
      meta: {
        totalCount: responseData.totalCount || 0,
        offset: responseData.offset || 0,
        limit: responseData.limit || 10,
        pagination: {
          total: responseData.totalCount || 0,
          page: Math.floor((responseData.offset || 0) / (responseData.limit || 10)) + 1,
          pageSize: responseData.limit || 10,
          pageCount: Math.ceil((responseData.totalCount || 0) / (responseData.limit || 10))
        }
      }
    };
    
    ctx.send(response);
  },


}));
