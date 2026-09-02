'use strict';

module.exports = {
  routes: [
    { method: 'GET', path: '/finance/accounts-payable-receivable', handler: 'finance.getAccountsPayableReceivable', config: { auth: false } },
    { method: 'GET', path: '/finance/asset-depreciation', handler: 'finance.getAssetDepreciation', config: { auth: false } },
    { method: 'GET', path: '/finance/bad-debt-ratios', handler: 'finance.getBadDebtRatios', config: { auth: false } },
    { method: 'GET', path: '/finance/budget-variance', handler: 'finance.getBudgetVariance', config: { auth: false } },
    { method: 'GET', path: '/finance/capital-expenditure', handler: 'finance.getCapitalExpenditure', config: { auth: false } },
    { method: 'GET', path: '/finance/collection-efficiency', handler: 'finance.getCollectionEfficiency', config: { auth: false } },
    { method: 'GET', path: '/finance/daily-sales-outstanding', handler: 'finance.getDailySalesOutstanding', config: { auth: false } },
    { method: 'GET', path: '/finance/expense-categorization', handler: 'finance.getExpenseCategorization', config: { auth: false } },
    { method: 'GET', path: '/finance/forecasting', handler: 'finance.getFinanceForecasting', config: { auth: false } },
    { method: 'GET', path: '/finance/general-ledger', handler: 'finance.getGeneralLedger', config: { auth: false } },
    { method: 'GET', path: '/finance/invoice-metrics', handler: 'finance.getInvoiceMetrics', config: { auth: false } },
    { method: 'GET', path: '/finance/pipeline-metrics', handler: 'finance.getPipelineMetrics', config: { auth: false } },
    { method: 'GET', path: '/finance/reporting-accuracy', handler: 'finance.getReportingAccuracy', config: { auth: false } },
    { method: 'GET', path: '/finance/statement-variance', handler: 'finance.getStatementVariance', config: { auth: false } },
    { method: 'GET', path: '/finance/system-integration-health', handler: 'finance.getSystemIntegrationHealth', config: { auth: false } },
    { method: 'GET', path: '/finance/tax-provisioning', handler: 'finance.getTaxProvisioning', config: { auth: false } },
    { method: 'GET', path: '/finance/total-asset-value', handler: 'finance.getTotalAssetValue', config: { auth: false } },
    { method: 'GET', path: '/finance/close-metrics', handler: 'finance.getFinanceCloseMetrics', config: { auth: false } },
    { method: 'GET', path: '/finance/audit-trail', handler: 'finance.getAuditTrail', config: { auth: false } },
    { method: 'GET', path: '/finance/regional-pl', handler: 'finance.getRegionalPL', config: { auth: false } },
  ],
};
