'use strict';

const { validateApiKey } = require('../../../utils/auth');

module.exports = {

  // GET /api/it/server-infrastructure
  async getServerInfrastructure(ctx) {
    if (!validateApiKey(ctx)) return;
    //Server load & resource usage
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          serverId: 'SRV-WEB-001',
          serverName: 'Production Web Server 1',
          serverType: 'Web Server',
          cpuUsagePercent: 67.5,
          memoryUsagePercent: 82.3,
          diskUsagePercent: 45.8,
          networkTrafficMbps: 245.7,
          uptime: 720.5,
          lastRestartDate: '2025-12-15T03:30:00Z',
          timestamp: '2026-02-16T10:30:00Z',
        },
        {
          serverId: 'SRV-DB-001',
          serverName: 'Production Database Server',
          serverType: 'Database Server',
          cpuUsagePercent: 45.2,
          memoryUsagePercent: 91.0,
          diskUsagePercent: 72.4,
          networkTrafficMbps: 180.3,
          uptime: 1440.0,
          lastRestartDate: '2025-11-01T02:00:00Z',
          timestamp: '2026-02-16T10:30:00Z',
        },
        {
          serverId: 'SRV-APP-001',
          serverName: 'Application Server 1',
          serverType: 'Application Server',
          cpuUsagePercent: 55.8,
          memoryUsagePercent: 68.5,
          diskUsagePercent: 38.2,
          networkTrafficMbps: 92.4,
          uptime: 512.3,
          lastRestartDate: '2026-01-10T04:00:00Z',
          timestamp: '2026-02-16T10:30:00Z',
        },
      ],
    });
  },

  // GET /api/it/storage-utilization
  async getStorageUtilization(ctx) {
    if (!validateApiKey(ctx)) return;
    //Storage capacity & usage
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          storageId: 'DISK-SAN-001',
          storageName: 'SAN Storage Array 1',
          storageType: 'SAN',
          totalCapacityGB: 5000,
          usedCapacityGB: 3200,
          availableCapacityGB: 1800,
          utilizationPercent: 64.0,
          growthRateGBPerMonth: 150.5,
          dataType: 'Database',
          timestamp: '2026-02-16T10:30:00Z',
        },
        {
          storageId: 'DISK-NAS-001',
          storageName: 'NAS File Share 1',
          storageType: 'NAS',
          totalCapacityGB: 8000,
          usedCapacityGB: 5840,
          availableCapacityGB: 2160,
          utilizationPercent: 73.0,
          growthRateGBPerMonth: 220.0,
          dataType: 'File Share',
          timestamp: '2026-02-16T10:30:00Z',
        },
      ],
    });
  },

  // GET /api/it/cybersecurity
  async getCybersecurity(ctx) {
    if (!validateApiKey(ctx)) return;
    //Security incidents & posture
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          incidentId: 'SEC-2026-0125',
          incidentType: 'Phishing',
          severity: 'High',
          detectedDate: '2026-01-25T09:15:00Z',
          resolvedDate: '2026-01-25T13:45:00Z',
          affectedSystems: ['SRV-WEB-001', 'WORKST-FIN-012'],
          attackVector: 'Spear-phishing email targeting finance team',
          impactLevel: 'Moderate',
          responseTimeMinutes: 25,
          resolutionTimeMinutes: 270,
          vulnerabilitiesFound: 2,
          vulnerabilitiesPatched: 2,
        },
        {
          incidentId: 'SEC-2026-0142',
          incidentType: 'Unauthorized Access',
          severity: 'Critical',
          detectedDate: '2026-02-03T02:30:00Z',
          resolvedDate: '2026-02-03T06:00:00Z',
          affectedSystems: ['DB-PROD-002'],
          attackVector: 'Brute force login attempt on database server',
          impactLevel: 'Minor',
          responseTimeMinutes: 15,
          resolutionTimeMinutes: 210,
          vulnerabilitiesFound: 1,
          vulnerabilitiesPatched: 1,
        },
      ],
      summary: {
        totalIncidents: 12,
        openIncidents: 2,
        resolvedIncidents: 10,
        criticalIncidents: 3,
        avgResponseTimeMinutes: 22,
        avgResolutionTimeMinutes: 195,
      },
    });
  },

  // GET /api/it/patch-compliance
  async getPatchCompliance(ctx) {
    if (!validateApiKey(ctx)) return;
    //System patch compliance
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          systemId: 'SYS-WIN-1245',
          systemName: 'Finance Workstation 12',
          systemType: 'Workstation',
          operatingSystem: 'Windows 11',
          osVersion: '23H2',
          lastPatchDate: '2026-02-10T03:00:00Z',
          totalPatchesAvailable: 15,
          patchesInstalled: 12,
          patchesPending: 3,
          complianceStatus: 'Partially Compliant',
          compliancePercent: 80.0,
          criticalPatchesMissing: 1,
          daysSinceLastPatch: 6,
        },
        {
          systemId: 'SRV-LNX-001',
          systemName: 'Linux Web Server 1',
          systemType: 'Server',
          operatingSystem: 'Ubuntu 22.04 LTS',
          osVersion: '22.04',
          lastPatchDate: '2026-02-14T02:00:00Z',
          totalPatchesAvailable: 8,
          patchesInstalled: 8,
          patchesPending: 0,
          complianceStatus: 'Compliant',
          compliancePercent: 100.0,
          criticalPatchesMissing: 0,
          daysSinceLastPatch: 2,
        },
      ],
      summary: {
        totalSystems: 145,
        compliantSystems: 112,
        nonCompliantSystems: 33,
        overallComplianceRate: 77.24,
        criticalPatchesMissing: 18,
      },
    });
  },

  // GET /api/it/system-health
  async getSystemHealth(ctx) {
    if (!validateApiKey(ctx)) return;
    //Overall system health scores
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          systemId: 'WEB-PORTAL-01',
          systemName: 'New Vision Web Portal',
          healthScore: 96.5,
          availabilityPercent: 99.95,
          performanceScore: 94.2,
          errorCount: 3,
          warningCount: 8,
          avgResponseTimeMs: 182.5,
          downtimeMinutes: 2,
          lastIncidentDate: '2026-01-28T14:30:00Z',
          monitoringPeriodStart: '2026-02-01T00:00:00Z',
          monitoringPeriodEnd: '2026-02-16T23:59:59Z',
        },
        {
          systemId: 'BROADCAST-SYS-01',
          systemName: 'TV Broadcast System',
          healthScore: 89.0,
          availabilityPercent: 99.8,
          performanceScore: 87.5,
          errorCount: 12,
          warningCount: 22,
          avgResponseTimeMs: 340.0,
          downtimeMinutes: 8,
          lastIncidentDate: '2026-02-10T08:15:00Z',
          monitoringPeriodStart: '2026-02-01T00:00:00Z',
          monitoringPeriodEnd: '2026-02-16T23:59:59Z',
        },
      ],
    });
  },

  // GET /api/it/infrastructure-costs
  async getInfrastructureCosts(ctx) {
    if (!validateApiKey(ctx)) return;
    //IT infrastructure costs
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          costId: 'COST-2026-0215',
          category: 'Cloud Services',
          service: 'AWS EC2 Instances',
          costAmount: 1200000,
          currency: 'UGX',
          billingPeriodStart: '2026-02-01',
          billingPeriodEnd: '2026-02-28',
          vendor: 'Amazon Web Services',
          department: 'IT Infrastructure',
          resourceUtilization: 75.5,
          budgetAmount: 1500000,
          variancePercent: -20.0,
        },
        {
          costId: 'COST-2026-0216',
          category: 'Software Licenses',
          service: 'Microsoft 365 Enterprise',
          costAmount: 3500000,
          currency: 'UGX',
          billingPeriodStart: '2026-02-01',
          billingPeriodEnd: '2026-02-28',
          vendor: 'Microsoft',
          department: 'All Departments',
          resourceUtilization: 88.0,
          budgetAmount: 3500000,
          variancePercent: 0.0,
        },
      ],
      summary: {
        totalMonthlySpend: 18750000,
        budgetedSpend: 20000000,
        variancePercent: 6.25,
        topCostCategory: 'Software Licenses',
      },
    });
  },

  // GET /api/it/ticket-sla
  async getTicketSLA(ctx) {
    if (!validateApiKey(ctx)) return;
    //Help desk tickets & SLA
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          ticketId: 'TCK-2026-0542',
          category: 'Network',
          priority: 'High',
          status: 'Resolved',
          createdDate: '2026-02-10T09:30:00Z',
          firstResponseDate: '2026-02-10T09:55:00Z',
          resolvedDate: '2026-02-10T12:30:00Z',
          closedDate: '2026-02-10T13:00:00Z',
          responseSlaMinutes: 30,
          resolutionSlaMinutes: 240,
          actualResponseTimeMinutes: 25,
          actualResolutionTimeMinutes: 180,
          slaResponseMet: true,
          slaResolutionMet: true,
          assignedAgent: 'Brian Ochieng',
          assignedTeam: 'Network Team',
          requesterName: 'Jane Smith',
          requesterDepartment: 'Finance',
          escalated: false,
        },
        {
          ticketId: 'TCK-2026-0589',
          category: 'Software',
          priority: 'Medium',
          status: 'In Progress',
          createdDate: '2026-02-14T11:00:00Z',
          firstResponseDate: '2026-02-14T11:45:00Z',
          resolvedDate: null,
          closedDate: null,
          responseSlaMinutes: 60,
          resolutionSlaMinutes: 480,
          actualResponseTimeMinutes: 45,
          actualResolutionTimeMinutes: null,
          slaResponseMet: true,
          slaResolutionMet: null,
          assignedAgent: 'David Kasozi',
          assignedTeam: 'Applications Team',
          requesterName: 'Mark Opio',
          requesterDepartment: 'Editorial',
          escalated: false,
        },
      ],
      summary: {
        totalTickets: 248,
        openTickets: 32,
        resolvedTickets: 210,
        slaComplianceRate: 87.5,
        avgResolutionTimeMinutes: 195,
        escalationRate: 5.2,
      },
    });
  },

  // GET /api/it/user-satisfaction
  async getUserSatisfaction(ctx) {
    if (!validateApiKey(ctx)) return;
    //IT satisfaction surveys
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          surveyId: 'SURV-2026-1234',
          ticketId: 'TCK-2026-0542',
          respondentDepartment: 'Finance',
          satisfactionScore: 4,
          responseTimeRating: 5,
          resolutionQualityRating: 4,
          communicationRating: 4,
          professionalismRating: 5,
          serviceType: 'Network Issue',
          npsScore: 8,
          comments: 'Very helpful and quick response',
          surveyDate: '2026-02-11T10:00:00Z',
        },
        {
          surveyId: 'SURV-2026-1235',
          ticketId: 'TCK-2026-0498',
          respondentDepartment: 'Editorial',
          satisfactionScore: 3,
          responseTimeRating: 3,
          resolutionQualityRating: 3,
          communicationRating: 4,
          professionalismRating: 4,
          serviceType: 'Software Installation',
          npsScore: 6,
          comments: 'Took longer than expected',
          surveyDate: '2026-02-09T14:30:00Z',
        },
      ],
      summary: {
        totalResponses: 85,
        avgSatisfactionScore: 4.1,
        avgNpsScore: 7.4,
        responseRate: 68.5,
      },
    });
  },

  // GET /api/it/asset-inventory
  async getAssetInventory(ctx) {
    if (!validateApiKey(ctx)) return;
    //IT asset inventory
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          assetId: 'ASSET-LAP-1234',
          assetType: 'Laptop',
          manufacturer: 'Dell',
          model: 'Latitude 7420',
          serialNumber: 'SN123456789',
          purchaseDate: '2024-05-15',
          purchaseCost: 2500000,
          currency: 'UGX',
          currentValue: 2000000,
          warrantyExpiryDate: '2027-05-15',
          assignedTo: 'John Doe',
          assignedDepartment: 'Finance',
          location: 'Kampala HQ - Floor 3',
          status: 'Active',
          lastMaintenanceDate: '2025-12-01',
          nextMaintenanceDate: '2026-06-01',
        },
        {
          assetId: 'ASSET-SRV-005',
          assetType: 'Server',
          manufacturer: 'HP',
          model: 'ProLiant DL380 Gen10',
          serialNumber: 'SN987654321',
          purchaseDate: '2022-08-10',
          purchaseCost: 42000000,
          currency: 'UGX',
          currentValue: 28000000,
          warrantyExpiryDate: '2025-08-10',
          assignedTo: null,
          assignedDepartment: 'IT',
          location: 'Server Room - Ground Floor',
          status: 'Active',
          lastMaintenanceDate: '2026-01-15',
          nextMaintenanceDate: '2026-07-15',
        },
      ],
      summary: {
        totalAssets: 412,
        activeAssets: 385,
        underRepair: 12,
        retired: 15,
        totalAssetValue: 1250000000,
      },
    });
  },

  // GET /api/it/cpu-performance
  async getCpuPerformance(ctx) {
    if (!validateApiKey(ctx)) return;
    //CPU performance details
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          serverId: 'SRV-WEB-001',
          serverName: 'Production Web Server 1',
          cpuModel: 'Intel Xeon Gold 6248R',
          coreCount: 24,
          cpuUsagePercent: 68.5,
          perCoreUsage: [45.2, 67.8, 52.1, 71.3, 58.9, 82.4, 44.0, 65.5],
          loadAverage1Min: 2.5,
          loadAverage5Min: 2.3,
          loadAverage15Min: 2.1,
          cpuTemperatureCelsius: 65.5,
          throttling: false,
          timestamp: '2026-02-16T10:30:00Z',
        },
        {
          serverId: 'SRV-DB-001',
          serverName: 'Production Database Server',
          cpuModel: 'AMD EPYC 7542',
          coreCount: 32,
          cpuUsagePercent: 42.0,
          perCoreUsage: [35.1, 48.2, 40.5, 38.0, 55.2, 42.1, 33.8, 41.9],
          loadAverage1Min: 1.8,
          loadAverage5Min: 1.9,
          loadAverage15Min: 2.0,
          cpuTemperatureCelsius: 58.2,
          throttling: false,
          timestamp: '2026-02-16T10:30:00Z',
        },
      ],
    });
  },
};
