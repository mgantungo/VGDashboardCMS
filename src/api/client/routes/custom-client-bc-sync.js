'use strict';

module.exports = {
  routes: [
          // Sync from Business Central
          {
            method: 'POST',
            path: '/clients/sync-from-bc',
            handler: 'custom-client-bc-sync.syncClientsFromBC',
            config: {
              auth: false,
              policies: [],
              middlewares: [],
            },
          },
      ],
};
