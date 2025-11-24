// src/api/post/routes/latest-news-routes.js
// Custom routes for latest news endpoints

'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/posts/latest-news',
      handler: 'latest-news.getLatestNews',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/posts/latest-simple',
      handler: 'latest-news.getLatestSimple',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      "method": "GET",
      "path": "/posts/latest-news-alt",
      "handler": "latest-news.getLatestNewsAlt"
    },
    
    {
      method: 'GET',
      path: '/posts/category-articles/:categorySlug',
      handler: 'category-news.getCategoryArticles',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/posts/by-categories',
      handler: 'latest-news.getByCategories',
      config: {
        policies: [],
        middlewares: [],
      },
    }
    
  ],

};
