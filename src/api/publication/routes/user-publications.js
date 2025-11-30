'use strict';
module.exports = {

    routes: [
        {
          method: 'GET',
          path: '/publications/author/:username/call',
          handler: 'user-publications.findByAuthorUsername',
          config: {
            policies: [],
            middlewares: [],
            description:"Provides publications and categories associated to the publications for the given user"
          },
        },

}
