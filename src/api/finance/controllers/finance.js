'use strict';

const { validateApiKey } = require('../../../utils/auth');

module.exports = {

  // GET /api/finance/accounts-payable-receivable
  async getAccountsPayableReceivable(ctx) {
    if (!validateApiKey(ctx)) return;
    //AP/AR entries
    const {startDate, endDate} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          Entry_No: 'ENT-001',
          Document_No: 'DOC-2024-1001',
          Document_Date: '2024-07-05',
          Posting_Date: '2024-07-06',
          Due_Date: '2024-08-05',
          Amount: 1250000,
          Document_Type: 'Invoice',
          G_L_Account_No: '20001',
          G_L_Account_Name: 'Accounts Receivable',
          Vendor_Customer_Name: 'ABC Advertisers Ltd',
          Payment_Date: '2024-07-30',
        },
        {
          Entry_No: 'ENT-002',
          Document_No: 'DOC-2024-1002',
          Document_Date: '2024-07-10',
          Posting_Date: '2024-07-11',
          Due_Date: '2024-08-10',
          Amount: 580000,
          Document_Type: 'Payment',
          G_L_Account_No: '30001',
          G_L_Account_Name: 'Accounts Payable',
          Vendor_Customer_Name: 'Print Supplies Co.',
          Payment_Date: null,
        },
      ],
    });
  },

  // GET /api/finance/asset-depreciation
  async getAssetDepreciation(ctx) {
    if (!validateApiKey(ctx)) return;
    //Asset depreciation schedules
    const {startDate, endDate} = ctx.request.body;

    
    
    ctx.send({
      data: [
        {
          asset_id: 'EQUIP-2019-07',
          asset_name: 'Office Printer X500',
          acquisition_date: '2019-07-15',
          acquisition_cost: 8000000,
          useful_life_years: 4,
          residual_value: 500000,
          depreciation_method: 'straight_line',
          accumulated_depreciation: 6000000,
          current_value: 2000000,
          schedule: [
            { year: 2019, amount: 1875000 },
            { year: 2020, amount: 2000000 },
            { year: 2021, amount: 2125000 },
          ],
        },
        {
          asset_id: 'VEH-2021-03',
          asset_name: 'Delivery Van KCC 123X',
          acquisition_date: '2021-03-10',
          acquisition_cost: 45000000,
          useful_life_years: 5,
          residual_value: 3000000,
          depreciation_method: 'straight_line',
          accumulated_depreciation: 16800000,
          current_value: 28200000,
          schedule: [
            { year: 2021, amount: 8400000 },
            { year: 2022, amount: 8400000 },
            { year: 2023, amount: 8400000 },
          ],
        },
      ],
    });
  },

  // GET /api/finance/bad-debt-ratios
  async getBadDebtRatios(ctx) {
    if (!validateApiKey(ctx)) return;
    //Bad debt ratios by quarter 
    const {startDate, endDate} = ctx.request.body;

    
    
    
    ctx.send({
      data: [
        { date: '2023-12-31', quarter: 'Q4', creditSales: 42000, badDebts: 3550, badDebtRatioPercentage: 8.45 },
        { date: '2023-09-30', quarter: 'Q3', creditSales: 38000, badDebts: 2660, badDebtRatioPercentage: 7.0 },
        { date: '2023-06-30', quarter: 'Q2', creditSales: 40000, badDebts: 2800, badDebtRatioPercentage: 7.0 },
        { date: '2023-03-31', quarter: 'Q1', creditSales: 35000, badDebts: 3150, badDebtRatioPercentage: 9.0 },
      ],
    });
  },

  // GET /api/finance/budget-variance
  async getBudgetVariance(ctx) {
    if (!validateApiKey(ctx)) return;
    //Budget vs actual variance
    const {startDate, endDate} = ctx.request.body;
    
    ctx.send({
      data: [
        { G_L_Account_No: '40001', G_L_Account_Name: 'Salaries & Wages', actual: 85000000, budget: 80000000, department: 'HR', variancePercent: -6.25 },
        { G_L_Account_No: '40002', G_L_Account_Name: 'Office Supplies', actual: 2100000, budget: 2500000, department: 'Admin', variancePercent: 16.0 },
        { G_L_Account_No: '40003', G_L_Account_Name: 'Print Production', actual: 48000000, budget: 45000000, department: 'Operations', variancePercent: -6.67 },
        { G_L_Account_No: '40004', G_L_Account_Name: 'Marketing Expenses', actual: 12000000, budget: 15000000, department: 'Sales', variancePercent: 20.0 },
      ],
    });
  },

  // GET /api/finance/capital-expenditure
  async getCapitalExpenditure(ctx) {
    if (!validateApiKey(ctx)) return;
    //CapEx transactions
    const {startDate, endDate} = ctx.request.body;
    
    
    ctx.send({
      data: [
        {
          Posting_Date: '2021-01-15',
          G_L_Account_No: '10001',
          G_L_Account_Name: 'Head Office Construction',
          Document_No: 'DOC-2021-001',
          Document_Type: 'Payment',
          Amount: 500000000000,
          capexCategory: 'Buildings & Infrastructure',
        },
        {
          Posting_Date: '2023-06-01',
          G_L_Account_No: '10005',
          G_L_Account_Name: 'Printing Press Equipment',
          Document_No: 'DOC-2023-045',
          Document_Type: 'Payment',
          Amount: 280000000,
          capexCategory: 'Plant & Machinery',
        },
      ],
    });
  },

  // GET /api/finance/collection-efficiency
  async getCollectionEfficiency(ctx) {
    if (!validateApiKey(ctx)) return;
    //Collection efficiency
    const {startDate, endDate} = ctx.request.body;

    
    ctx.send({
      data: [
        { date: '2023-12-31', quarter: 'Q4', totalReceivables: 150000, collectedAmount: 120000, collectionEfficiencyPercentage: 80.0 },
        { date: '2023-09-30', quarter: 'Q3', totalReceivables: 135000, collectedAmount: 112000, collectionEfficiencyPercentage: 82.96 },
        { date: '2023-06-30', quarter: 'Q2', totalReceivables: 120000, collectedAmount: 104000, collectionEfficiencyPercentage: 86.67 },
      ],
    });
  },

  // GET /api/finance/daily-sales-outstanding
  async getDailySalesOutstanding(ctx) {
    if (!validateApiKey(ctx)) return;
    //DSO metrics
    const {startDate, endDate} = ctx.request.body;
    
    ctx.send({
      data: [
        { date: '2023-12-31', totalReceivables: 150000, totalCreditSales: 600000, dso: 91.25 },
        { date: '2023-09-30', totalReceivables: 135000, totalCreditSales: 520000, dso: 94.9 },
        { date: '2023-06-30', totalReceivables: 120000, totalCreditSales: 480000, dso: 91.25 },
      ],
    });
  },

  // GET /api/finance/expense-categorization
  async getExpenseCategorization(ctx) {
    if (!validateApiKey(ctx)) return;
    //Categorized expenses
    const {startDate, endDate} = ctx.request.body;
    
    
    ctx.send({
      totalAmount: 2290329118,
      categories: [
        {
          category: 'Cash Control',
          total: 1112443942,
          accounts: ['10060', '10061', '10062'],
        },
        {
          category: 'Editorial Expenses',
          total: 480000000,
          accounts: ['20010', '20011'],
        },
        {
          category: 'Distribution',
          total: 320000000,
          accounts: ['30005', '30006'],
        },
      ],
      transactions: [
        {
          entryNo: '19511',
          transactionNo: '2223',
          postingDate: '2021-08-10',
          documentDate: '2021-08-10',
          documentType: 'Payment',
          documentNo: 'B-SK000020RN',
          sourceCode: 'CASHRECJNL',
          amount: 19000,
          accountName: 'Mbarara Cash Control',
          accountNo: '10060',
          category: 'Cash Control',
        },
      ],
    });
  },

  // GET /api/finance/forecasting
  async getFinanceForecasting(ctx) {
    if (!validateApiKey(ctx)) return;
    //Financial forecasts
    const {startDate, endDate} = ctx.request.body;
    
    
    
    ctx.send({
      data: [
        {
          G_L_Account_Name: 'Advertising Revenue',
          G_L_Account_No: '50001',
          Amount: 320000000,
          Debit_Amount: 0,
          Credit_Amount: 320000000,
          Document_Type: 'Invoice',
          Posting_Date: '2025-03-01',
          forecastPeriod: 'Q1 2025',
          forecastType: 'Revenue',
        },
        {
          G_L_Account_Name: 'Digital Subscription Revenue',
          G_L_Account_No: '50010',
          Amount: 48000000,
          Debit_Amount: 0,
          Credit_Amount: 48000000,
          Document_Type: 'Invoice',
          Posting_Date: '2025-03-01',
          forecastPeriod: 'Q1 2025',
          forecastType: 'Revenue',
        },
      ],
    });
  },

  // GET /api/finance/general-ledger
  async getGeneralLedger(ctx) {
    if (!validateApiKey(ctx)) return;
    //GL reconciliation
    const {startDate, endDate} = ctx.request.body;
    
    
    
    ctx.send({
      data: [
        {
          date: '2022-12-07',
          accountName: 'Discount on Adverts',
          entryType: 'Debit',
          amount: 1810807,
          generalLedgerDebitBalance: 104180445,
          generalLedgerCreditBalance: 104177445,
          subLedgerBalance: 0,
          reconciliationStatus: 'Discrepancy',
        },
        {
          date: '2022-12-14',
          accountName: 'Print Revenue',
          entryType: 'Credit',
          amount: 12500000,
          generalLedgerDebitBalance: 0,
          generalLedgerCreditBalance: 12500000,
          subLedgerBalance: 12500000,
          reconciliationStatus: 'Matched',
        },
      ],
    });
  },

  // GET /api/finance/invoice-metrics
  async getInvoiceMetrics(ctx) {
    if (!validateApiKey(ctx)) return;
    //Invoice processing KPIs
    const {startDate, endDate} = ctx.request.body;
    
    
    
    ctx.send({
      data: [
        {
          date: '2025-08-25',
          totalInvoices: 140,
          avgProcessingTimeDays: 3.6,
          approvalCycleTimeDays: 1.8,
          onTimePaymentRate: 96.3,
          exceptionRate: 9.6,
          earlyPaymentDiscountUsage: 66.9,
          firstPassMatchRate: 81.0,
          topVendorsByVolume: [
            { vendor: 'Prime Logistics', invoices: 22 },
            { vendor: 'Office Essentials', invoices: 27 },
          ],
        },
      ],
    });
  },

  // GET /api/finance/pipeline-metrics
  async getPipelineMetrics(ctx) {
    if (!validateApiKey(ctx)) return;
    //Data pipeline health
    const {startDate, endDate} = ctx.request.body;
    
    
    ctx.send({
      data: [
        {
          recordId: 'PIPE-0001',
          date: '2025-01-01',
          sourceSystem: 'ERP',
          pipelineJob: 'Daily GL Sync',
          recordsExpected: 5000,
          recordsLoaded: 4987,
          errors: 13,
          dropped: 5,
          latency: 120,
          manualFixes: 3,
        },
        {
          recordId: 'PIPE-0002',
          date: '2025-01-02',
          sourceSystem: 'CRM',
          pipelineJob: 'Invoice Import',
          recordsExpected: 300,
          recordsLoaded: 300,
          errors: 0,
          dropped: 0,
          latency: 45,
          manualFixes: 0,
        },
      ],
    });
  },

  // GET /api/finance/reporting-accuracy
  async getReportingAccuracy(ctx) {
    if (!validateApiKey(ctx)) return;
    //Report accuracy summary eg "Income Statements"
    const {reportCategory} = ctx.request.body;

    /*
    ctx.send({
      summary: [
        { report_category: 'Income Statements', no_of_reports: 15, no_of_modified_reports: 6, accuracyRate: 60 },
        { report_category: 'Balance Sheets', no_of_reports: 12, no_of_modified_reports: 2, accuracyRate: 83.33 },
        { report_category: 'Cash Flow Statements', no_of_reports: 8, no_of_modified_reports: 1, accuracyRate: 87.5 },
      ],
    });
    */
    
    ctx.send({
      summary: [
        { report_category: 'Income Statements', no_of_reports: 15, no_of_modified_reports: 6, accuracyRate: 60 }
      ],
    });
  },

  // GET /api/finance/statement-variance
  async getStatementVariance(ctx) {
    if (!validateApiKey(ctx)) return;
    //Financial statement variance
    const {startDate, endDate} = ctx.request.body;
      
    ctx.send({
      data: [
        {
          date: '2021-03-01',
          assetValue: 1020000,
          grossProfit: 220000,
          netProfit: 160000,
          revenue: 470000,
          expenses: 310000,
          liabilities: 210000,
          equity: 320000,
          netIncome: 160000,
        },
        {
          date: '2021-06-01',
          assetValue: 1080000,
          grossProfit: 240000,
          netProfit: 175000,
          revenue: 510000,
          expenses: 335000,
          liabilities: 195000,
          equity: 345000,
          netIncome: 175000,
        },
      ],
    });
  },

  // GET /api/finance/system-integration-health
  async getSystemIntegrationHealth(ctx) {
    if (!validateApiKey(ctx)) return;
    //ERP/CRM integration health
    const {startDate, endDate} = ctx.request.body;
    
    ctx.send({
      data: [
        {
          system: 'Audit & Compliance',
          status: 'offline',
          lastSynced: '2025-07-13T21:30:00Z',
          uptime: 87.5,
          failedSyncs: 8,
          latency: null,
        },
        {
          system: 'ERP',
          status: 'online',
          lastSynced: '2025-08-01T06:00:00Z',
          uptime: 99.2,
          failedSyncs: 1,
          latency: 230,
        },
        {
          system: 'CRM',
          status: 'online',
          lastSynced: '2025-08-01T05:45:00Z',
          uptime: 98.7,
          failedSyncs: 2,
          latency: 180,
        },
      ],
    });
  },

  // GET /api/finance/tax-provisioning
  async getTaxProvisioning(ctx) {
    if (!validateApiKey(ctx)) return;
    //Tax provisioning data
    const {startDate, endDate} = ctx.request.body;
    
    ctx.send({
      data: [
        {
          taxType: 'Corporate Income Tax',
          provisionedAmount: 20000000,
          totalSpent: 19500000,
          transactions: [
            { date: '2021-03-15', amount: 12000000 },
            { date: '2021-06-15', amount: 7500000 },
          ],
        },
        {
          taxType: 'VAT',
          provisionedAmount: 8500000,
          totalSpent: 8500000,
          transactions: [
            { date: '2021-01-31', amount: 2100000 },
            { date: '2021-02-28', amount: 2150000 },
            { date: '2021-03-31', amount: 4250000 },
          ],
        },
      ],
    });
  },

  // GET /api/finance/total-asset-value
  async getTotalAssetValue(ctx) {
    if (!validateApiKey(ctx)) return;
    //Total asset value
    const {startDate, endDate} = ctx.request.body;
    
    ctx.send({
      data: [
        {
          G_L_Account_Category: 'Assets',
          Debit_Balance: 500000000,
          Credit_Balance: 150000000,
          netAssetValue: 350000000,
        },
      ],
      summary: {
        totalAssets: 500000000,
        totalLiabilities: 150000000,
        netWorth: 350000000,
      },
    });
  },

  // GET /api/finance/close-metrics
  async getFinanceCloseMetrics(ctx) {
    if (!validateApiKey(ctx)) return;
    //Finance close entries
    const {startDate, endDate} = ctx.request.body;
    
    ctx.send({
      data: [
        {
          id: 1,
          entryNo: 'ENT-FC-001',
          transactionNo: 'TXN-3301',
          postingDate: '2025-01-31',
          documentDate: '2025-01-31',
          documentType: 'Journal Entry',
          documentNo: 'JE-2025-0131',
          accountNo: '60001',
          accountName: 'Monthly Close Adjustment',
          amount: 450000,
          debitAmount: 450000,
          creditAmount: 0,
        },
      ],
    });
  },

  // GET /api/finance/audit-trail
  async getAuditTrail(ctx) {
    if (!validateApiKey(ctx)) return;
    //Audit trail analysis
    const {startDate, endDate} = ctx.request.body;
    
    ctx.send({
      data: [
        {
          entryNo: 'ENT-AT-001',
          transactionNo: 'TXN-4401',
          postingDate: '2025-01-15',
          documentDate: '2025-01-14',
          documentType: 'Payment',
          documentNo: 'PAY-2025-0042',
          sourceCode: 'GENLJNL',
          accountNo: '10060',
          accountName: 'Kampala Cash Control',
          amount: 1200000,
          debitAmount: 1200000,
          creditAmount: 0,
          dimensionSetId: 'DIM-FIN-01',
        },
      ],
    });
  },

  // GET /api/finance/regional-pl
  async getRegionalPL(ctx) {
    if (!validateApiKey(ctx)) return;
    //Regional P&L breakdown
    const {startDate, endDate} = ctx.request.body;
    
    
    ctx.send({
      data: [
        {
          region: 'Central',
          entryNo: 'ENT-PL-001',
          postingDate: '2025-01-31',
          dimensionSetId: 'DIM-CENT-01',
          accountNo: '50001',
          accountName: 'Advertising Revenue - Central',
          debitAmount: 0,
          creditAmount: 85000000,
          amount: 85000000,
          documentType: 'Invoice',
        },
        {
          region: 'Western',
          entryNo: 'ENT-PL-002',
          postingDate: '2025-01-31',
          dimensionSetId: 'DIM-WEST-01',
          accountNo: '50002',
          accountName: 'Advertising Revenue - Western',
          debitAmount: 0,
          creditAmount: 32000000,
          amount: 32000000,
          documentType: 'Invoice',
        },
      ],
    });
  },
};
