'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/sales/revenue-attribution', handler: 'sales.getRevenueAttribution', config: { auth: false } },
    { method: 'GET', path: '/sales/client-lifetime-value', handler: 'sales.getClientLifetimeValue', config: { auth: false } },
    { method: 'GET', path: '/sales/campaign-roi', handler: 'sales.getCampaignROI', config: { auth: false } },
    { method: 'GET', path: '/sales/territory-performance', handler: 'sales.getTerritoryPerformance', config: { auth: false } },
    { method: 'GET', path: '/sales/lead-efficiency', handler: 'sales.getLeadEfficiency', config: { auth: false } },
    { method: 'GET', path: '/sales/conversion-funnels', handler: 'sales.getConversionFunnels', config: { auth: false } },
    { method: 'GET', path: '/sales/click-through-rate', handler: 'sales.getClickThroughRate', config: { auth: false } },
    { method: 'GET', path: '/sales/rate-card-utilization', handler: 'sales.getRateCardUtilization', config: { auth: false } },
    { method: 'GET', path: '/sales/impression-share', handler: 'sales.getImpressionShare', config: { auth: false } },
    { method: 'GET', path: '/sales/ab-test-results', handler: 'sales.getABTestResults', config: { auth: false } },
    { method: 'GET', path: '/sales/campaign-attribution', handler: 'sales.getCampaignAttribution', config: { auth: false } },
    { method: 'GET', path: '/sales/brand-lift', handler: 'sales.getBrandLift', config: { auth: false } },
    { method: 'GET', path: '/sales/contract-value-trends', handler: 'sales.getContractValueTrends', config: { auth: false } },
    { method: 'GET', path: '/sales/supervisor-analytics', handler: 'sales.getSupervisorAnalytics', config: { auth: false } },
  ],
};
