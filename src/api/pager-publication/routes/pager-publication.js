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
      path: '/pager-publications/:id/decrease-pages',
      handler: 'pager-publication.decreasePages',
      config: {
        auth: false,
        description: 'Remove trailing pages in multiples of 4. Body: { reducePages }. Fails if any of the removed pages have adverts.',
      },
    },
    {
      method: 'POST',
      path: '/pager-publications/:id/queue-adverts',
      handler: 'pager-publication.queueAdverts',
      config: {
        auth: false,
        description: 'Round-robins each printable unit (a file group or a single advert) across non-cover pages as a starting layout — a group\u2019s adverts always land together, but a page can end up holding more than one unit. Final composition is still up to the editor via the manual assign/unassign endpoints. Body: { units: [{ advertIds: [] }] } — legacy flat { advertIds: [] } still accepted, treated as one unit per advert.',
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
