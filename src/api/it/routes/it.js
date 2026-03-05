'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/it/server-infrastructure', handler: 'it.getServerInfrastructure', config: { auth: false } },
    { method: 'GET', path: '/it/storage-utilization', handler: 'it.getStorageUtilization', config: { auth: false } },
    { method: 'GET', path: '/it/cybersecurity', handler: 'it.getCybersecurity', config: { auth: false } },
    { method: 'GET', path: '/it/patch-compliance', handler: 'it.getPatchCompliance', config: { auth: false } },
    { method: 'GET', path: '/it/system-health', handler: 'it.getSystemHealth', config: { auth: false } },
    { method: 'GET', path: '/it/infrastructure-costs', handler: 'it.getInfrastructureCosts', config: { auth: false } },
    { method: 'GET', path: '/it/ticket-sla', handler: 'it.getTicketSLA', config: { auth: false } },
    { method: 'GET', path: '/it/user-satisfaction', handler: 'it.getUserSatisfaction', config: { auth: false } },
    { method: 'GET', path: '/it/asset-inventory', handler: 'it.getAssetInventory', config: { auth: false } },
    { method: 'GET', path: '/it/cpu-performance', handler: 'it.getCpuPerformance', config: { auth: false } },
  ],
};
