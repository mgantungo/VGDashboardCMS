
'use strict';

module.exports = {
  routes: [
          {
            method: 'GET',
            path: '/posts/author/:username/:startdate?/:enddate?',
            handler: 'individual-articles.findArticlesByAuthorAndDate',
            config: {
              policies: [],
              middlewares: [],
              description: "Get articles by author username and date range"
            },
          },
  ]
}
