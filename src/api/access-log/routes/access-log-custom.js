'use strict';

/**
 * access-log routes
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/access-logs',
      handler: 'access-log.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/access-logs/:id',
      handler: 'access-log.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/access-logs',
      handler: 'access-log.create',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/access-logs/:id',
      handler: 'access-log.update',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/access-logs/:id',
      handler: 'access-log.delete',
      config: { auth: false },
    },
  ],
};
