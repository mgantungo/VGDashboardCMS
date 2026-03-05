'use strict';

const { validateApiKey } = require('../../../utils/auth');

module.exports = {

  // GET /api/sales/revenue-attribution
  async getRevenueAttribution(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          revenueId: 'REV-2026-00542',
          transactionDate: '2026-02-15',
          businessSegment: 'Digital Subscriptions',
          revenueAmount: 2500000,
          currency: 'UGX',
          revenueType: 'Subscription',
          customerId: 'CUST-1234',
          customerName: 'ABC Corporation Ltd',
          customerType: 'Corporate',
          salesChannel: 'Online',
          salesRepId: 'SREP-045',
          salesRepName: 'Jane Doe',
          territory: 'Central Region',
          costOfSale: 1000000,
          grossProfit: 1500000,
          profitMarginPercent: 60.0,
        },
        {
          revenueId: 'REV-2026-00543',
          transactionDate: '2026-02-15',
          businessSegment: 'TV Broadcast',
          revenueAmount: 8500000,
          currency: 'UGX',
          revenueType: 'Advertisement',
          customerId: 'CUST-5678',
          customerName: 'Stanbic Bank Uganda',
          customerType: 'Corporate',
          salesChannel: 'Direct Sales',
          salesRepId: 'SREP-022',
          salesRepName: 'Robert Kato',
          territory: 'Central Region',
          costOfSale: 2000000,
          grossProfit: 6500000,
          profitMarginPercent: 76.5,
        },
        {
          revenueId: 'REV-2026-00544',
          transactionDate: '2026-02-14',
          businessSegment: 'Print Newspaper',
          revenueAmount: 1200000,
          currency: 'UGX',
          revenueType: 'Advertisement',
          customerId: 'CUST-9012',
          customerName: 'Kampala City Council',
          customerType: 'Government',
          salesChannel: 'Direct Sales',
          salesRepId: 'SREP-031',
          salesRepName: 'Alice Nakato',
          territory: 'Central Region',
          costOfSale: 480000,
          grossProfit: 720000,
          profitMarginPercent: 60.0,
        },
      ],
      summary: {
        totalRevenue: 185000000,
        totalTransactions: 842,
        avgTransactionValue: 219715,
        topSegment: 'TV Broadcast',
        topTerritory: 'Central Region',
      },
    });
  },

  // GET /api/sales/client-lifetime-value
  async getClientLifetimeValue(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          customerId: 'CUST-5678',
          customerName: 'XYZ Enterprise',
          firstPurchaseDate: '2023-03-15',
          lastPurchaseDate: '2026-02-10',
          totalRevenue: 45000000,
          totalTransactions: 36,
          averageTransactionValue: 1250000,
          customerLifetimeMonths: 35,
          lifetimeValue: 45000000,
          predictedLifetimeValue: 75000000,
          acquisitionCost: 500000,
          customerStatus: 'VIP',
          churnRisk: 'Low',
          lastContactDate: '2026-02-08',
          customerSegment: 'Premium',
          referralSource: 'Website',
        },
        {
          customerId: 'CUST-3344',
          customerName: 'Roofings Group',
          firstPurchaseDate: '2024-06-01',
          lastPurchaseDate: '2025-12-15',
          totalRevenue: 12000000,
          totalTransactions: 8,
          averageTransactionValue: 1500000,
          customerLifetimeMonths: 18,
          lifetimeValue: 12000000,
          predictedLifetimeValue: 28000000,
          acquisitionCost: 800000,
          customerStatus: 'Active',
          churnRisk: 'Medium',
          lastContactDate: '2025-12-20',
          customerSegment: 'Standard',
          referralSource: 'Referral',
        },
      ],
      summary: {
        totalClients: 485,
        avgLifetimeValue: 18500000,
        atRiskClients: 42,
        vipClients: 38,
        avgChurnRate: 8.2,
      },
    });
  },

  // GET /api/sales/campaign-roi
  async getCampaignROI(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          campaignId: 'CAMP-2026-Q1-001',
          campaignName: 'Summer Digital Promotion 2026',
          campaignType: 'Digital Marketing',
          startDate: '2026-01-15',
          endDate: '2026-03-31',
          totalBudget: 15000000,
          actualSpend: 14200000,
          impressions: 500000,
          clicks: 25000,
          clickThroughRatePercent: 5.0,
          leads: 450,
          conversions: 90,
          conversionRatePercent: 20.0,
          revenueGenerated: 45000000,
          roi: 3.17,
          roiPercent: 217.0,
          costPerLead: 31555,
          costPerAcquisition: 157778,
          targetAudience: 'Business professionals 25-45',
          channels: ['Facebook', 'Google Ads', 'LinkedIn'],
        },
        {
          campaignId: 'CAMP-2025-Q4-008',
          campaignName: 'Year-End Print Campaign',
          campaignType: 'Print Advertising',
          startDate: '2025-10-01',
          endDate: '2025-12-31',
          totalBudget: 8000000,
          actualSpend: 7850000,
          impressions: 320000,
          clicks: null,
          clickThroughRatePercent: null,
          leads: 180,
          conversions: 42,
          conversionRatePercent: 23.33,
          revenueGenerated: 18900000,
          roi: 2.41,
          roiPercent: 140.76,
          costPerLead: 43611,
          costPerAcquisition: 186904,
          targetAudience: 'General consumers',
          channels: ['Daily Newspaper', 'Weekly Magazine'],
        },
      ],
      summary: {
        totalCampaigns: 24,
        avgROIPercent: 185.4,
        totalLeadsGenerated: 4820,
        totalConversions: 918,
        totalRevenue: 485000000,
      },
    });
  },

  // GET /api/sales/territory-performance
  async getTerritoryPerformance(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          territoryId: 'TER-CENTRAL-001',
          territoryName: 'Central Region',
          reportingDate: '2026-02-15',
          totalRevenue: 125000000,
          grossProfit: 75000000,
          netProfit: 50000000,
          profitMarginPercent: 40.0,
          totalSales: 350,
          averageSaleValue: 357142,
          prospectedClients: 1200,
          salesConversionRatePercent: 29.17,
          customerAcquisitionCost: 125000,
          returnOnMarketingInvestment: 4.5,
          activeCustomers: 850,
          newCustomers: 45,
          lostCustomers: 12,
          salesTeamSize: 8,
          topPerformer: 'Robert Kato',
        },
        {
          territoryId: 'TER-WEST-001',
          territoryName: 'Western Region',
          reportingDate: '2026-02-15',
          totalRevenue: 48000000,
          grossProfit: 28000000,
          netProfit: 18000000,
          profitMarginPercent: 37.5,
          totalSales: 142,
          averageSaleValue: 338028,
          prospectedClients: 480,
          salesConversionRatePercent: 29.58,
          customerAcquisitionCost: 138000,
          returnOnMarketingInvestment: 3.8,
          activeCustomers: 320,
          newCustomers: 18,
          lostCustomers: 5,
          salesTeamSize: 4,
          topPerformer: 'Mary Achen',
        },
      ],
      summary: {
        totalTerritories: 4,
        totalRevenue: 285000000,
        bestPerformingTerritory: 'Central Region',
        avgConversionRate: 28.4,
      },
    });
  },

  // GET /api/sales/lead-efficiency
  async getLeadEfficiency(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          leadId: 'LEAD-2026-5432',
          campaignId: 'CAMP-2026-Q1-001',
          campaignName: 'LinkedIn B2B Campaign',
          leadSource: 'LinkedIn',
          leadCreatedDate: '2026-02-01T10:30:00Z',
          currentStage: 'SQL',
          leadScore: 75,
          qualifiedDate: '2026-02-05T14:20:00Z',
          convertedDate: null,
          daysToQualification: 4,
          daysToConversion: null,
          campaignSpend: 45000,
          expectedValue: 2500000,
          actualValue: null,
          assignedSalesRep: 'Mary Johnson',
          industry: 'Banking & Finance',
          companySize: '201-500',
        },
        {
          leadId: 'LEAD-2026-5289',
          campaignId: 'CAMP-2026-Q1-001',
          campaignName: 'LinkedIn B2B Campaign',
          leadSource: 'Google Ads',
          leadCreatedDate: '2026-01-20T08:45:00Z',
          currentStage: 'Customer',
          leadScore: 92,
          qualifiedDate: '2026-01-25T09:00:00Z',
          convertedDate: '2026-02-10T14:00:00Z',
          daysToQualification: 5,
          daysToConversion: 21,
          campaignSpend: 80000,
          expectedValue: 3800000,
          actualValue: 4200000,
          assignedSalesRep: 'John Ssali',
          industry: 'Telecommunications',
          companySize: '1000+',
        },
      ],
      summary: {
        totalLeads: 1248,
        qualifiedLeads: 620,
        convertedLeads: 185,
        overallConversionRate: 14.8,
        avgDaysToConversion: 18.5,
        topLeadSource: 'Google Ads',
      },
    });
  },

  // GET /api/sales/conversion-funnels
  async getConversionFunnels(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          funnelId: 'FUNNEL-2026-02',
          periodStart: '2026-02-01',
          periodEnd: '2026-02-28',
          stage1_Visitors: 10000,
          stage2_Leads: 2500,
          stage3_MQL: 1200,
          stage4_SQL: 600,
          stage5_Opportunities: 300,
          stage6_Customers: 120,
          conversionRate_VisitorToLead: 25.0,
          conversionRate_LeadToMQL: 48.0,
          conversionRate_MQLToSQL: 50.0,
          conversionRate_SQLToOpportunity: 50.0,
          conversionRate_OpportunityToCustomer: 40.0,
          overallConversionRate: 1.2,
          averageSaleValue: 2500000,
          totalRevenue: 300000000,
          funnelType: 'B2B Sales',
        },
      ],
    });
  },

  // GET /api/sales/click-through-rate
  async getClickThroughRate(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          adId: 'AD-2026-FB-102',
          campaignId: 'CAMP-2026-Q1-001',
          adName: 'Spring Digital Subscription Offer',
          platform: 'Facebook',
          adFormat: 'Carousel',
          reportDate: '2026-02-15',
          impressions: 50000,
          clicks: 2500,
          clickThroughRatePercent: 5.0,
          cost: 1500000,
          costPerClick: 600,
          costPerImpression: 30,
          conversions: 125,
          conversionRate: 5.0,
          revenue: 7500000,
          device: 'Mobile',
          targetAudience: 'Men 25-45, Urban',
        },
        {
          adId: 'AD-2026-GG-045',
          campaignId: 'CAMP-2026-Q1-001',
          adName: 'Breaking News Alert Subscribe',
          platform: 'Google Ads',
          adFormat: 'Text',
          reportDate: '2026-02-15',
          impressions: 85000,
          clicks: 5100,
          clickThroughRatePercent: 6.0,
          cost: 2250000,
          costPerClick: 441,
          costPerImpression: 26.47,
          conversions: 280,
          conversionRate: 5.49,
          revenue: 14000000,
          device: 'Mobile',
          targetAudience: 'News readers 18-55',
        },
      ],
      summary: {
        totalImpressions: 2850000,
        totalClicks: 142500,
        avgCTRPercent: 5.0,
        totalAdSpend: 45000000,
        totalConversions: 5840,
      },
    });
  },

  // GET /api/sales/rate-card-utilization
  async getRateCardUtilization(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          rateCardId: 'RC-TV-PRIME-2026',
          productType: 'TV Advertising',
          adSlot: 'Prime Time 7-9 PM',
          standardRate: 5000000,
          averageSellingPrice: 4200000,
          discountPercent: 16.0,
          utilizationPercent: 87.5,
          totalSlots: 120,
          soldSlots: 105,
          availableSlots: 15,
          totalRevenue: 441000000,
          reportingMonth: '2026-02',
        },
        {
          rateCardId: 'RC-PRINT-FULL-2026',
          productType: 'Print Advertising',
          adSlot: 'Full Page Front Section',
          standardRate: 3500000,
          averageSellingPrice: 3150000,
          discountPercent: 10.0,
          utilizationPercent: 92.0,
          totalSlots: 50,
          soldSlots: 46,
          availableSlots: 4,
          totalRevenue: 144900000,
          reportingMonth: '2026-02',
        },
        {
          rateCardId: 'RC-DIGITAL-BANNER-2026',
          productType: 'Digital Advertising',
          adSlot: 'Homepage Banner',
          standardRate: 800000,
          averageSellingPrice: 720000,
          discountPercent: 10.0,
          utilizationPercent: 100.0,
          totalSlots: 200,
          soldSlots: 200,
          availableSlots: 0,
          totalRevenue: 144000000,
          reportingMonth: '2026-02',
        },
      ],
    });
  },

  // GET /api/sales/impression-share
  async getImpressionShare(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          recordId: 'IMP-TV-2026-02',
          platform: 'TV',
          market: 'Uganda',
          reportDate: '2026-02-15',
          ourImpressions: 12500000,
          totalMarketImpressions: 32000000,
          impressionSharePercent: 39.06,
          competitorImpressions: [
            { competitorName: 'NBS TV', impressions: 8000000, sharePercent: 25.0 },
            { competitorName: 'Spark TV', impressions: 5500000, sharePercent: 17.19 },
            { competitorName: 'UBC', impressions: 3000000, sharePercent: 9.38 },
          ],
          rankPosition: 1,
        },
        {
          recordId: 'IMP-PRINT-2026-02',
          platform: 'Print',
          market: 'Uganda',
          reportDate: '2026-02-15',
          ourImpressions: 5200000,
          totalMarketImpressions: 9500000,
          impressionSharePercent: 54.74,
          competitorImpressions: [
            { competitorName: 'Daily Monitor', impressions: 3200000, sharePercent: 33.68 },
            { competitorName: 'Red Pepper', impressions: 1100000, sharePercent: 11.58 },
          ],
          rankPosition: 1,
        },
      ],
    });
  },

  // GET /api/sales/ab-test-results
  async getABTestResults(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          testId: 'TEST-2026-EMAIL-05',
          testName: 'Email Subject Line Test',
          hypothesis: 'Subject line with urgency will increase open rate',
          startDate: '2026-02-01',
          endDate: '2026-02-07',
          variantA_Name: 'Original Subject',
          variantA_Impressions: 5000,
          variantA_Clicks: 250,
          variantA_Conversions: 25,
          variantA_ConversionRate: 10.0,
          variantB_Name: 'Urgent Subject',
          variantB_Impressions: 5000,
          variantB_Clicks: 350,
          variantB_Conversions: 42,
          variantB_ConversionRate: 12.0,
          winner: 'B',
          confidenceLevel: 95.0,
          improvementPercent: 20.0,
        },
      ],
    });
  },

  // GET /api/sales/campaign-attribution
  async getCampaignAttribution(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          customerId: 'CUST-7788',
          conversionDate: '2026-02-10T14:00:00Z',
          conversionValue: 2500000,
          touchpoints: [
            {
              touchpointId: 'TP-001',
              campaignId: 'CAMP-2026-Q1-001',
              campaignName: 'LinkedIn B2B Campaign',
              channel: 'LinkedIn',
              touchDate: '2026-01-20T10:00:00Z',
              attributionWeight: 0.2,
              attributedRevenue: 500000,
            },
            {
              touchpointId: 'TP-002',
              campaignId: 'CAMP-2026-Q1-001',
              campaignName: 'Email Retargeting',
              channel: 'Email',
              touchDate: '2026-02-01T09:00:00Z',
              attributionWeight: 0.3,
              attributedRevenue: 750000,
            },
            {
              touchpointId: 'TP-003',
              campaignId: 'CAMP-2026-Q1-001',
              campaignName: 'Direct Sales Call',
              channel: 'Direct Sales',
              touchDate: '2026-02-08T14:00:00Z',
              attributionWeight: 0.5,
              attributedRevenue: 1250000,
            },
          ],
          attributionModel: 'Position Based',
          journeyDuration: 21,
          totalTouchpoints: 3,
        },
      ],
    });
  },

  // GET /api/sales/brand-lift
  async getBrandLift(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          studyId: 'BLS-2026-Q1',
          campaignId: 'CAMP-2026-Q1-001',
          studyPeriodStart: '2026-01-15',
          studyPeriodEnd: '2026-03-31',
          sampleSize: 1000,
          metricName: 'Brand Awareness',
          baselinePercent: 45.0,
          exposedGroupPercent: 62.0,
          controlGroupPercent: 47.0,
          brandLiftPercent: 15.0,
          brandLiftPercentage: 31.91,
          statisticalSignificance: true,
        },
        {
          studyId: 'BLS-2026-Q1-RECALL',
          campaignId: 'CAMP-2026-Q1-001',
          studyPeriodStart: '2026-01-15',
          studyPeriodEnd: '2026-03-31',
          sampleSize: 1000,
          metricName: 'Brand Recall',
          baselinePercent: 32.0,
          exposedGroupPercent: 51.0,
          controlGroupPercent: 34.0,
          brandLiftPercent: 17.0,
          brandLiftPercentage: 50.0,
          statisticalSignificance: true,
        },
      ],
    });
  },

  // GET /api/sales/contract-value-trends
  async getContractValueTrends(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          contractId: 'CONTRACT-2026-0125',
          customerId: 'CUST-5678',
          customerName: 'XYZ Enterprise',
          contractType: 'Renewal',
          signedDate: '2026-01-25',
          startDate: '2026-02-01',
          endDate: '2028-01-31',
          contractValue: 25000000,
          annualContractValue: 12500000,
          contractDurationMonths: 24,
          productCategory: 'Enterprise Subscription',
          dealSize: 'Medium (5-20M)',
          paymentTerms: 'Quarterly',
          salesCycleLength: 45,
        },
        {
          contractId: 'CONTRACT-2026-0089',
          customerId: 'CUST-1122',
          customerName: 'Airtel Uganda',
          contractType: 'New Business',
          signedDate: '2026-01-10',
          startDate: '2026-02-01',
          endDate: '2027-01-31',
          contractValue: 72000000,
          annualContractValue: 72000000,
          contractDurationMonths: 12,
          productCategory: 'TV Advertising Package',
          dealSize: 'Large (20-50M)',
          paymentTerms: 'Monthly',
          salesCycleLength: 62,
        },
      ],
      summary: {
        totalContracts: 142,
        totalContractValue: 1850000000,
        avgContractValue: 13028169,
        renewalRate: 82.4,
        avgSalesCycleLength: 38,
      },
    });
  },

  // GET /api/sales/supervisor-analytics
  async getSupervisorAnalytics(ctx) {
    if (!validateApiKey(ctx)) return;
    ctx.send({
      data: [
        {
          supervisorId: 'SUP-001',
          supervisorName: 'Alice Manager',
          reportingPeriod: '2026-02',
          teamSize: 8,
          teamTotalRevenue: 150000000,
          teamTotalSales: 425,
          averageRevenuePerRep: 18750000,
          teamQuota: 140000000,
          quotaAttainmentPercent: 107.14,
          repsAtQuota: 6,
          topPerformer: 'Robert Kato',
          averageDealSize: 352941,
          winRate: 35.0,
        },
        {
          supervisorId: 'SUP-002',
          supervisorName: 'Charles Mutebi',
          reportingPeriod: '2026-02',
          teamSize: 6,
          teamTotalRevenue: 98000000,
          teamTotalSales: 315,
          averageRevenuePerRep: 16333333,
          teamQuota: 105000000,
          quotaAttainmentPercent: 93.33,
          repsAtQuota: 4,
          topPerformer: 'Grace Owino',
          averageDealSize: 311111,
          winRate: 31.5,
        },
      ],
      summary: {
        totalTeams: 5,
        totalRevenue: 485000000,
        companyQuota: 450000000,
        companyQuotaAttainment: 107.78,
        topSupervisor: 'Alice Manager',
      },
    });
  },
};
