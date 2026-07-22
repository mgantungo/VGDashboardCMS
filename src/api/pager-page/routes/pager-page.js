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
        description: 'Body: { advertId }',
      },
    },
    {
      method: 'DELETE',
      path: '/pager-pages/:id/advert/:advertId',
      handler: 'pager-page.unassignAdvert',
      config: { auth: false },
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
