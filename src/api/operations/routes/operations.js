'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/operations/delivery-timelines', handler: 'operations.getDeliveryTimelines', config: { auth: false } },
    { method: 'GET', path: '/operations/fuel-consumption', handler: 'operations.getFuelConsumption', config: { auth: false } },
    { method: 'GET', path: '/operations/job-scheduling', handler: 'operations.getJobScheduling', config: { auth: false } },
    { method: 'GET', path: '/operations/parts-utilization', handler: 'operations.getPartsUtilization', config: { auth: false } },
    { method: 'GET', path: '/operations/route-efficiency', handler: 'operations.getRouteEfficiency', config: { auth: false } },
    { method: 'GET', path: '/operations/setup-time', handler: 'operations.getSetupTimeOptimization', config: { auth: false } },
    { method: 'GET', path: '/operations/signal-quality', handler: 'operations.getSignalQuality', config: { auth: false } },
    { method: 'GET', path: '/operations/ticket-resolution', handler: 'operations.getTicketResolution', config: { auth: false } },
    { method: 'GET', path: '/operations/updown-time', handler: 'operations.getUpDownTimeLogs', config: { auth: false } },
    { method: 'GET', path: '/operations/material-waste', handler: 'operations.getMaterialWaste', config: { auth: false } },
    { method: 'GET', path: '/operations/machine-oee', handler: 'operations.getMachineOEE', config: { auth: false } },
    { method: 'GET', path: '/operations/production-yield', handler: 'operations.getProductionYield', config: { auth: false } },
  ],
};
