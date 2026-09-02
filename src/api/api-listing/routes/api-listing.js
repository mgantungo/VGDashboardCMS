// src/api/api-listing/routes/api-listing.js
'use strict';

/**
 * api-listing router
 */

module.exports = {
  routes: [

// ============== ADFS AUTHENTICATION ROUTES ============    // ADFS Login route
/*    // ADFS Login route
    // ADFS Login route
    {
      method: 'POST',
      path: '/api-listings/auth/login',
      handler: 'auth.login',
      config: {
        auth: false, // No authentication required for login
        policies: [],
        middlewares: [],
      },
    },
    
    // Test LDAP connection route (comprehensive test)
    {
      method: 'GET',
      path: '/api-listings/auth/test-connection',
      handler: 'auth.testConnection',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    
    // Test network connectivity to LDAP ports
    {
      method: 'GET',
      path: '/api-listings/auth/test-network',
      handler: 'auth.testNetwork',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    
    // Test comprehensive LDAP configurations
    {
      method: 'GET',
      path: '/api-listings/auth/test-comprehensive',
      handler: 'auth.testComprehensive',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    
    // Test ADFS web endpoints
    {
      method: 'GET',
      path: '/api-listings/auth/test-adfs',
      handler: 'auth.testAdfsEndpoints',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    
    // Test Windows-style authentication
    {
      method: 'POST',
      path: '/api-listings/auth/test-windows-auth',
      handler: 'auth.testWindowsAuth',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    
    // Get user details from LDAP route (admin use)
    {
      method: 'GET',
      path: '/api-listings/auth/user/:username',
      handler: 'auth.getUser',
      config: {
        auth: false, // Set to true if you want authentication required
        policies: [],
        middlewares: [],
      },
    },
*/
    // Custom dashboard route
    {
      method: 'GET',
      path: '/api-listings/dashboard',
      handler: 'api-listing.getDashboardData',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    // Analytics route - article session duration with URL parameters
    {
      method: 'GET',
      path: '/api-listings/article-session-duration/:startDate/:endDate',
      handler: 'api-listing.getArticleSessionDuration',
      config: {
        auth: false, // Set to true if you want authentication
        policies: [],
        middlewares: [],
      },
    },
    // Articles analytics summary route with URL parameters
    {
      method: 'GET',
      path: '/api-listings/articles-analytics-summary/:pastDate/:currentDate',
      handler: 'api-listing.getArticlesAnalyticsSummary',
      config: {
        auth: false, // Set to true if you want authentication
        policies: [],
        middlewares: [],
      },
    },
    // Articles route with date filtering and reorganized fields
    {
      method: 'GET',
      path: '/api-listings/articles/:startDate/:endDate/:offset',
      handler: 'api-listing.getArticles',
      config: {
        auth: false, // Set to true if you want authentication
        policies: [],
        middlewares: [],
      },
    },
    // Default CRUD routes
    {
      method: 'GET',
      path: '/api-listings',
      handler: 'api-listing.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/api-listings/:id',
      handler: 'api-listing.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/api-listings',
      handler: 'api-listing.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/api-listings/:id',
      handler: 'api-listing.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/api-listings/:id',
      handler: 'api-listing.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
   // Newsletter analytics route with action and date parameters
   {
     method: 'GET',
     path: '/api-listings/newsletter-analytics/:action/:startDate/:endDate',
     handler: 'api-listing.getNewsletterAnalytics',
       config: {
        auth: false, // Set to true if you want authentication
        policies: [],
        middlewares: [],
  	},
    },

  ],
};
