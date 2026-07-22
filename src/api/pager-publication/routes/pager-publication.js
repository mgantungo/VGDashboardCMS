// api/pager-publication/routes/pager-publication.js

module.exports = {
  routes: [
    // ── Named routes first — must sit above /:id routes ──────────────────
    {
      method: 'GET',
      path: '/pager-publications',
      handler: 'pager-publication.find',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/pager-publications',
      handler: 'pager-publication.create',
      config: {
        auth: false,
        description: 'Initialize a new publication. Auto-generates page_number rows 1..total_pages.',
      },
    },
    {
      method: 'GET',
      path: '/pager-publications/:id/layout',
      handler: 'pager-publication.getLayout',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/pager-publications/:id/increase-pages',
      handler: 'pager-publication.increasePages',
      config: {
        auth: false,
        description: 'Append pages in multiples of 4. Body: { additionalPages }',
      },
    },
    {
      method: 'PUT',
      path: '/pager-publications/:id/lock',
      handler: 'pager-publication.lock',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/pager-publications/:id/status',
      handler: 'pager-publication.setStatus',
      config: {
        auth: false,
        description: 'Body: { status } — one of draft, in_progress, locked, published',
      },
    },
    // ── Parameterized routes last ─────────────────────────────────────────
    {
      method: 'GET',
      path: '/pager-publications/:id',
      handler: 'pager-publication.findOne',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/pager-publications/:id',
      handler: 'pager-publication.update',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/pager-publications/:id',
      handler: 'pager-publication.delete',
      config: { auth: false },
    },
  ],
};
