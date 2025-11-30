'use strict';

/**
 * post router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::post.post', {
  config: {
    find: {
      auth: false,
      policies: [],
      middlewares: [],
    },
    findOne: {
      auth: false,
      policies: [],
      middlewares: [],
    }
  },
  routes: [
    // Authenticated post routes with path parameters
    {
      method: 'GET',
      path: '/posts/me/:page/:pageSize/:publication?/:status?/:category?/:search?',
      handler: 'post.findMyPosts',
      config: {
        policies: ['is-authenticated']
      }
    },
    {
      method: 'POST',
      path: '/posts/me',
      handler: 'post.createMyPost',
      config: {
        policies: ['is-authenticated']
      }
    },
    {
      method: 'PUT',
      path: '/posts/me/:id',
      handler: 'post.updateMyPost',
      config: {
        policies: ['is-authenticated']
      }
    }
  ]
});
