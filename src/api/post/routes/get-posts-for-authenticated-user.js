'use strict';

module.exports = {
  routes: [
        {
          method: 'GET',
          path: '/posts/posts-for-authenticated-user/:userid/call',
          handler: 'get-posts-for-authenticated-users.findMyPosts',
          config: {
            auth: false,
            policies: [],
            middlewares: [],
          },
        }
    ]
}
