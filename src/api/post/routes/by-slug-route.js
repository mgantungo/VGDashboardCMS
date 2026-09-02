// src/api/post/routes/by-slug-route.js
'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/posts/by-slug/:slug',
      handler: 'by-slug.getBySlug',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Fetch a single post by its slug (matches on slug field or wp_id suffix)',
      },
    },
  ],
};
