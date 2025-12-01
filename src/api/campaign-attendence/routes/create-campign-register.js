'use strict';
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/create-campaign-attendences/createFromForm',
      handler: 'campaign-attendence.getEpaperCampaign',
      config: {
        policies: [],
        middlewares: [],
        description:"Register campaign for epaper"
      },
    },
  ],
};
