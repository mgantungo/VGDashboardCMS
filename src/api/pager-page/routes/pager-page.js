// api/pager-page/routes/pager-page.js

module.exports = {
  routes: [
    // ── Named routes first — must sit above /:id routes ──────────────────
    {
      method: 'GET',
      path: '/pager-pages/:id/available-adverts',
      handler: 'pager-page.getAvailableAdverts',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/pager-pages/:id/section',
      handler: 'pager-page.updateSection',
      config: {
        auth: false,
        description: 'Body: { section }',
      },
    },
    {
      method: 'POST',
      path: '/pager-pages/:id/assign-advert',
      handler: 'pager-page.assignAdvert',
      config: {
        auth: false,
        description: 'Single-advert convenience wrapper. Body: { advertId }. Prefer assign-adverts for anything that might belong to an ad slot.',
      },
    },
    {
      method: 'POST',
      path: '/pager-pages/:id/assign-adverts',
      handler: 'pager-page.assignAdverts',
      config: {
        auth: false,
        description: 'All-or-nothing bulk placement — used to place an entire ad slot (several adverts sharing one file) on this page together. Body: { advertIds: [] }',
      },
    },
    {
      method: 'DELETE',
      path: '/pager-pages/:id/advert/:advertId',
      handler: 'pager-page.unassignAdvert',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/pager-pages/:id/unassign-adverts',
      handler: 'pager-page.unassignAdverts',
      config: {
        auth: false,
        description: 'Removes every listed advert from this page in one update — used to pull an entire ad slot off together. Body: { advertIds: [] }',
      },
    },
    // ── Parameterized routes last ─────────────────────────────────────────
    {
      method: 'GET',
      path: '/pager-pages/:id',
      handler: 'pager-page.findOne',
      config: { auth: false },
    },
  ],
};
