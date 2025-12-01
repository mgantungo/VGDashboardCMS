'use strict';
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/create-campaign-attendences/createFromForm',
      handler: 'campaign-attendence.createFromForm',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
