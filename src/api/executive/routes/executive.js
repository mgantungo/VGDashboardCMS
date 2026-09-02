'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/executive/ceo-analytics', handler: 'executive.getCeoAnalytics', config: { auth: false } },
    { method: 'GET', path: '/executive/risk-cases', handler: 'executive.getRiskCases', config: { auth: false } },
    { method: 'GET', path: '/executive/retention', handler: 'executive.getRetention', config: { auth: false } },
    { method: 'GET', path: '/executive/compensation', handler: 'executive.getCompensation', config: { auth: false } },
    { method: 'GET', path: '/executive/company-kpis', handler: 'executive.getCompanyKPIs', config: { auth: false } },
    { method: 'GET', path: '/executive/compliance', handler: 'executive.getCompliance', config: { auth: false } },
    { method: 'GET', path: '/executive/control-effectiveness', handler: 'executive.getControlEffectiveness', config: { auth: false } },
    { method: 'GET', path: '/executive/cost-optimization', handler: 'executive.getCostOptimization', config: { auth: false } },
    { method: 'GET', path: '/executive/finance-health', handler: 'executive.getFinanceHealth', config: { auth: false } },
    { method: 'GET', path: '/executive/liquidity-ratios', handler: 'executive.getLiquidityRatios', config: { auth: false } },
    { method: 'GET', path: '/executive/market-share', handler: 'executive.getMarketShare', config: { auth: false } },
    { method: 'GET', path: '/executive/risk-heatmap', handler: 'executive.getRiskHeatmap', config: { auth: false } },
    { method: 'GET', path: '/executive/roi-analysis', handler: 'executive.getROIAnalysis', config: { auth: false } },
    { method: 'GET', path: '/executive/strategic-initiatives', handler: 'executive.getStrategicInitiatives', config: { auth: false } },
  ],
};
