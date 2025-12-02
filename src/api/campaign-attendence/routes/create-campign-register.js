'use strict';
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/create-campaign-attendences/createFromForm',
      handler: 'create-campaign-register.getEpaperCampaign',
      config: {
        policies: [],
        middlewares: [],
        description:"Register campaign for epaper"
      },
    },
  ],
};
