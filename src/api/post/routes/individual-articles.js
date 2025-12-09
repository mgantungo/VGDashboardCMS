
'use strict';

module.exports = {
  routes: [
          {
            method: 'GET',
            path: '/posts/author/:username/:startdate?/:enddate?',
            handler: 'individual-articles.findPostsByAuthorAndDate',
            config: {
              policies: [],
              middlewares: [],
              description: "Get articles by author username and date range"
            },
          },
          {
            method: 'POST',
            path: '/posts/save',
            handler: 'post.saveArticle',
            config: {
              policies: [],
              middlewares: [],
            },
          }
  ]
}
