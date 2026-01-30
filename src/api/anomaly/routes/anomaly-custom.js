'use strict';

/**
 * anomaly routes
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/anomalies',
      handler: 'anomaly.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/anomalies/:id',
      handler: 'anomaly.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/anomalies',
      handler: 'anomaly.create',
      config: { auth: false },
    },
    {
      method: 'PUT',
      path: '/anomalies/:id',
      handler: 'anomaly.update',
      config: { auth: false },
    },
    {
      method: 'DELETE',
      path: '/anomalies/:id',
      handler: 'anomaly.delete',
      config: { auth: false },
    },
  ],
};
