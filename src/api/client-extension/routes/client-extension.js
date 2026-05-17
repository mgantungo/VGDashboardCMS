'use strict';

/**
 * src/api/client/routes/client-sfa-extension.js
 *
 * Add these two routes to your existing client API.
 * Place this file alongside your existing client routes file.
 * Strapi will automatically pick up all route files in the routes/ folder.
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/clients/find-match',
      handler: 'client-sfa-extension.findMatch',
      config: {
        policies: [],
        description: 'Find a BC client by company name (exact then fuzzy). Used on order conversion.',
      },
    },
    {
      method: 'POST',
      path: '/clients/search-by-name',
      handler: 'client-sfa-extension.searchByName',
      config: {
        policies: [],
        description: 'Typeahead search of the BC client list.',
      },
    },
  ],
};
