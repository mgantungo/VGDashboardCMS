'use strict';


module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/posts/by-categories',
      handler: 'posts-by-category.getByCategories',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};

