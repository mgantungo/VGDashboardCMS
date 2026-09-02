// api/design-batch/routes/design-batch.js

module.exports = {
  routes: [
    // ── Batch CRUD ──────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/design-batches',
      handler: 'design-batch.createBatch',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/design-batches',
      handler: 'design-batch.listBatches',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/design-batches/:id',
      handler: 'design-batch.getBatchDetail',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/design-batches/:id',
      handler: 'design-batch.updateBatch',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/design-batches/:id',
      handler: 'design-batch.deleteBatch',
      config: { auth: false },
    },

    // ── File groups ─────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/design-batches/:id/file-groups',
      handler: 'design-batch.addFileGroup',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/design-batches/:id/file-groups/:groupId',
      handler: 'design-batch.removeFileGroup',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/design-batches/:id/file-groups/:groupId/adverts',
      handler: 'design-batch.addAdvertToFileGroup',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/design-batches/:id/file-groups/:groupId/adverts/:advertId',
      handler: 'design-batch.removeAdvertFromFileGroup',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/design-batches/:id/file-groups/:groupId/upload',
      handler: 'design-batch.uploadFileToGroup',
      config: { auth: false },
    },

    // ── Workflow actions ────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/design-batches/:id/attach',
      handler: 'design-batch.attachToSchedule',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/design-batches/:id/mark-ready',
      handler: 'design-batch.markReady',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/design-batches/:id/archive',
      handler: 'design-batch.archiveBatch',
      config: { auth: false },
    },
  ],
};
