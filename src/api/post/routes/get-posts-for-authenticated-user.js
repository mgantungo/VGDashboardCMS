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
        }
    ]
}
