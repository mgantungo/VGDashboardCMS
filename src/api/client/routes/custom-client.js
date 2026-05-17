'use strict';
// src/api/client/routes/custom-client.js
//
// Drop this file into your EXISTING src/api/client/routes/ folder.
// Strapi auto-discovers all .js files in routes/ so this is picked up automatically.
// The existing client.js routes file is NOT touched.

module.exports = {
  routes: [
    {
      method:  'POST',
      path:    '/clients/find-match',
      handler: 'client-extension.findMatch',
      config:  { auth: false, policies: [] },
    },
    {
      method:  'POST',
      path:    '/clients/search-by-name',
      handler: 'client-extension.searchByName',
      config:  { auth: false, policies: [] },
    },
  ],
};
