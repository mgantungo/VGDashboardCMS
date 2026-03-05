'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/administrator/meetings',
      handler: 'administrator.getMeetings',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/administrator/process-throughput',
      handler: 'administrator.getProcessThroughput',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/administrator/rvs-analytics',
      handler: 'administrator.getRvsAnalytics',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/administrator/schedule-efficiency',
      handler: 'administrator.getScheduleEfficiency',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/administrator/task-completion',
      handler: 'administrator.getTaskCompletion',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/administrator/visitor-patterns',
      handler: 'administrator.getVisitorPatterns',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/administrator/wait-time',
      handler: 'administrator.getWaitTime',
      config: { auth: false },
    },
  ],
};
