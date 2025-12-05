'use strict';
module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/campaign-attendences/createFromForm',
      handler: 'create-campaign-register.createFromForm',
      config: {
        policies: [],
        middlewares: [],
        description: "Create campaign attendance from WordPress form submission"
      }
    },
    {
      method: 'GET',
      path: '/campaign-attendences/verify/:transactionId',
      handler: 'create-campaign-register.verifySubmission',
      config: {
        policies: [],
        middlewares: [],
        description: "Verify a submission by transaction ID"
      }
    }
  ]
};
