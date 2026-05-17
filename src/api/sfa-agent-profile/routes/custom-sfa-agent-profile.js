'use strict';
// src/api/sfa-agent-profile/routes/custom-sfa-agent-profile.js

module.exports = {
  routes: [
    {
      method:  'POST',
      path:    '/sfa-agent-profiles/me',
      handler: 'sfa-agent-profile.me',
      config:  { auth: false, policies: [] },
    },
  ],
};
