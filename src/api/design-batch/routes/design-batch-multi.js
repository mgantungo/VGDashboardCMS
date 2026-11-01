// api/design-batch/routes/design-batch-multi.js
//
// Workflow re-order — standalone route file so routes/design-batch.js stays
// untouched. Strapi merges every file under routes/ automatically.
// New route files need a full Strapi restart.
'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/design-batches/:id/attach-multi',
      handler: 'design-batch.attachMulti',
      config: {
        auth: false,
        description: "Attach a batch to its target date plus later run dates (array or 'all_pending'), carrying the artwork forward",
      },
    },
  ],
};
