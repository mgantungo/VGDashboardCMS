'use strict';

const { validateApiKey } = require('../../../utils/auth');

module.exports = {

  // GET /api/operations/delivery-timelines
  async getDeliveryTimelines(ctx) {
    if (!validateApiKey(ctx)) return;
    //Print delivery timelines
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          deliveryId: 'D001',
          publication: 'New Vision',
          dispatcher: 'Jane Mwangi',
          route: 'Kampala',
          depot: 'Kampala Depot',
          pickupTime: '2025-08-27T06:00:00Z',
          expectedDeliveryTime: '2025-08-27T08:00:00Z',
          actualDeliveryTime: '2025-08-27T07:50:00Z',
          status: 'Delivered',
          quantity: 500,
          onTime: true,
          delayMinutes: 0,
        },
        {
          deliveryId: 'D002',
          publication: 'Bukedde',
          dispatcher: 'Moses Kato',
          route: 'Entebbe',
          depot: 'Kampala Depot',
          pickupTime: '2025-08-27T05:30:00Z',
          expectedDeliveryTime: '2025-08-27T07:30:00Z',
          actualDeliveryTime: '2025-08-27T08:15:00Z',
          status: 'Delivered',
          quantity: 300,
          onTime: false,
          delayMinutes: 45,
        },
        {
          deliveryId: 'D003',
          publication: 'New Vision',
          dispatcher: 'Sarah Ouma',
          route: 'Jinja',
          depot: 'Eastern Depot',
          pickupTime: '2025-08-27T04:00:00Z',
          expectedDeliveryTime: '2025-08-27T07:00:00Z',
          actualDeliveryTime: '2025-08-27T07:05:00Z',
          status: 'Delivered',
          quantity: 250,
          onTime: true,
          delayMinutes: 5,
        },
      ],
      summary: {
        totalDeliveries: 48,
        onTimeDeliveries: 42,
        lateDeliveries: 6,
        onTimeRate: 87.5,
        avgDelayMinutes: 12,
      },
    });
  },

  // GET /api/operations/fuel-consumption
  async getFuelConsumption(ctx) {
    if (!validateApiKey(ctx)) return;
    //Vehicle & machine fuel usage
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          date: '2025-05-29',
          machine: 'generator',
          operator: 'sarah',
          distance_km: 65.0,
          fuel_consumed_l: 37.6,
          fuel_cost_usd: 45.81,
          avg_speed_kmh: 62.1,
          location: 'kampala, ug',
        },
        {
          date: '2025-05-30',
          machine: 'delivery_truck_01',
          operator: 'john_okello',
          distance_km: 120.5,
          fuel_consumed_l: 58.4,
          fuel_cost_usd: 71.12,
          avg_speed_kmh: 75.3,
          location: 'kampala to jinja, ug',
        },
        {
          date: '2025-05-30',
          machine: 'delivery_van_02',
          operator: 'mary_nakato',
          distance_km: 45.2,
          fuel_consumed_l: 18.9,
          fuel_cost_usd: 23.01,
          avg_speed_kmh: 55.8,
          location: 'kampala, ug',
        },
      ],
      summary: {
        totalFuelConsumedL: 1248.6,
        totalFuelCostUSD: 1520.42,
        avgFuelEfficiencyKmPerL: 2.8,
        fleetSize: 15,
      },
    });
  },

  // GET /api/operations/job-scheduling
  async getJobScheduling(ctx) {
    if (!validateApiKey(ctx)) return;
    //Press job scheduling
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          jobId: 'JOB001',
          machine: 'Heidelberg Speedmaster',
          operator: 'John Okello',
          service: 'Daily Newspaper',
          scheduledDate: '2025-08-28',
          scheduledStartTime: '08:00:00',
          scheduledEndTime: '08:45:00',
          actualStartTime: '08:10:00',
          actualEndTime: '08:50:00',
          delayMinutes: 10,
          efficiencyPercent: 90.0,
          status: 'Completed',
        },
        {
          jobId: 'JOB002',
          machine: 'Heidelberg Speedmaster',
          operator: 'Grace Apio',
          service: 'Weekly Magazine',
          scheduledDate: '2025-08-28',
          scheduledStartTime: '10:00:00',
          scheduledEndTime: '12:00:00',
          actualStartTime: '10:00:00',
          actualEndTime: '11:55:00',
          delayMinutes: 0,
          efficiencyPercent: 100.0,
          status: 'Completed',
        },
        {
          jobId: 'JOB003',
          machine: 'Komori Lithrone',
          operator: 'Peter Ssali',
          service: 'Commercial Print Job',
          scheduledDate: '2025-08-28',
          scheduledStartTime: '14:00:00',
          scheduledEndTime: '16:00:00',
          actualStartTime: '14:30:00',
          actualEndTime: '17:00:00',
          delayMinutes: 60,
          efficiencyPercent: 75.0,
          status: 'Completed Late',
        },
      ],
      summary: {
        totalJobs: 32,
        onTimeJobs: 25,
        lateJobs: 7,
        avgEfficiencyPercent: 88.5,
        avgDelayMinutes: 15,
      },
    });
  },

  // GET /api/operations/parts-utilization
  async getPartsUtilization(ctx) {
    if (!validateApiKey(ctx)) return;
    //Maintenance parts usage
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          partId: 'P001',
          partName: 'Compressor Coil',
          machine: 'HVAC',
          activity: 'Repair',
          quantityUsed: 2,
          unitCost: 450000,
          totalCost: 900000,
          usageDate: '2025-08-10',
          requestedBy: 'Maintenance Team',
        },
        {
          partId: 'P002',
          partName: 'Fan Belt',
          machine: 'Generator',
          activity: 'Routine Maintenance',
          quantityUsed: 1,
          unitCost: 85000,
          totalCost: 85000,
          usageDate: '2025-08-12',
          requestedBy: 'Operations Manager',
        },
        {
          partId: 'P003',
          partName: 'Circuit Board',
          machine: 'IT Rack',
          activity: 'Emergency Fix',
          quantityUsed: 1,
          unitCost: 1200000,
          totalCost: 1200000,
          usageDate: '2025-08-15',
          requestedBy: 'IT Department',
        },
        {
          partId: 'P004',
          partName: 'Pipe Connector',
          machine: 'Plumbing',
          activity: 'Repair',
          quantityUsed: 4,
          unitCost: 25000,
          totalCost: 100000,
          usageDate: '2025-08-18',
          requestedBy: 'Facilities Team',
        },
      ],
      summary: {
        totalPartsUsed: 142,
        totalCostUGX: 24850000,
        topUsedPart: 'Fan Belt',
        topCostlyRepair: 'IT Rack - Circuit Board',
      },
    });
  },

  // GET /api/operations/route-efficiency
  async getRouteEfficiency(ctx) {
    if (!validateApiKey(ctx)) return;
    //Distribution route efficiency
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          routeId: 'RT-001',
          driverId: 'D001',
          driverName: 'John Miller',
          vehicle: 'Truck A',
          destination: 'North',
          plannedDistanceKm: 120,
          actualDistanceKm: 125,
          plannedTimeMinutes: 90,
          actualTimeMinutes: 105,
          fuelUsedL: 38.5,
          deliveriesCompleted: 8,
          efficiencyScore: 82.5,
          date: '2025-08-27',
        },
        {
          routeId: 'RT-002',
          driverId: 'D002',
          driverName: 'Sophia Lopez',
          vehicle: 'Van B',
          destination: 'South',
          plannedDistanceKm: 85,
          actualDistanceKm: 84,
          plannedTimeMinutes: 70,
          actualTimeMinutes: 68,
          fuelUsedL: 22.1,
          deliveriesCompleted: 12,
          efficiencyScore: 97.5,
          date: '2025-08-27',
        },
        {
          routeId: 'RT-003',
          driverId: 'D003',
          driverName: 'Michael Brown',
          vehicle: 'Truck C',
          destination: 'East',
          plannedDistanceKm: 180,
          actualDistanceKm: 188,
          plannedTimeMinutes: 150,
          actualTimeMinutes: 175,
          fuelUsedL: 62.4,
          deliveriesCompleted: 6,
          efficiencyScore: 74.0,
          date: '2025-08-27',
        },
      ],
      summary: {
        totalRoutes: 15,
        avgEfficiencyScore: 86.2,
        totalDistanceKm: 1842,
        totalFuelUsedL: 485.3,
      },
    });
  },

  // GET /api/operations/setup-time
  async getSetupTimeOptimization(ctx) {
    if (!validateApiKey(ctx)) return;
    //Machine setup time optimization
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          jobId: 'HS_004',
          machine: 'Heidelberg Speedmaster',
          operator: 'John Okello',
          operatorExperienceLevel: 'Senior',
          service: 'Newspaper Printing',
          setupDate: '2022-01-10',
          setupStartTime: '08:15:00',
          setupEndTime: '08:50:00',
          setupDurationMinutes: 35,
          expectedSetupDurationMinutes: 35,
          changeoverType: 'Tooling',
          jobPriority: 'High',
          shift: 'Morning',
          comments: 'Smooth changeover',
          efficiencyPercent: 100,
        },
        {
          jobId: 'HS_005',
          machine: 'Komori Lithrone',
          operator: 'Grace Apio',
          operatorExperienceLevel: 'Mid',
          service: 'Magazine Printing',
          setupDate: '2022-01-10',
          setupStartTime: '13:00:00',
          setupEndTime: '13:55:00',
          setupDurationMinutes: 55,
          expectedSetupDurationMinutes: 40,
          changeoverType: 'Material',
          jobPriority: 'Medium',
          shift: 'Afternoon',
          comments: 'Ink adjustment required extra time',
          efficiencyPercent: 72.7,
        },
      ],
      summary: {
        totalSetups: 128,
        avgSetupMinutes: 38.5,
        avgExpectedMinutes: 35,
        onTimeSetups: 98,
        lateSetups: 30,
        onTimeRate: 76.6,
      },
    });
  },

  // GET /api/operations/signal-quality
  async getSignalQuality(ctx) {
    if (!validateApiKey(ctx)) return;
    //Broadcast signal quality
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          Date: '2025-03-15',
          Timestamp: '2025-03-15 13:42:09',
          Device_ID: 'DEV004',
          Cell_Tower: 'CT-1002',
          Location: 'Jinja, UG',
          RSRP_dBm: -82,
          RSRQ_dB: -12,
          SINR_dB: 10,
          RSSI_dBm: -80,
          Packet_Loss_percent: 1.82,
          Latency_ms: 75,
          SignalQuality: 'Good',
        },
        {
          Date: '2025-03-15',
          Timestamp: '2025-03-15 14:10:22',
          Device_ID: 'DEV002',
          Cell_Tower: 'CT-0505',
          Location: 'Gulu, UG',
          RSRP_dBm: -105,
          RSRQ_dB: -18,
          SINR_dB: 2,
          RSSI_dBm: -98,
          Packet_Loss_percent: 8.4,
          Latency_ms: 245,
          SignalQuality: 'Poor',
        },
      ],
      summary: {
        totalDevices: 28,
        goodSignal: 18,
        fairSignal: 6,
        poorSignal: 4,
        avgLatencyMs: 112,
        avgPacketLoss: 3.2,
      },
    });
  },

  // GET /api/operations/ticket-resolution
  async getTicketResolution(ctx) {
    if (!validateApiKey(ctx)) return;
    //Maintenance ticket resolution
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          ticketId: 'T001',
          technicianId: 'T001',
          technicianName: 'Alice Johnson',
          ticketType: 'Electrical',
          priority: 'High',
          createdAt: '2025-08-01T08:30:00Z',
          resolvedAt: '2025-08-01T11:45:00Z',
          resolutionTimeMinutes: 195,
          slaMinutes: 240,
          slaMet: true,
          status: 'Resolved',
          location: 'Production Floor',
        },
        {
          ticketId: 'T002',
          technicianId: 'T002',
          technicianName: 'Bob Smith',
          ticketType: 'HVAC',
          priority: 'Critical',
          createdAt: '2025-08-02T09:00:00Z',
          resolvedAt: '2025-08-02T10:30:00Z',
          resolutionTimeMinutes: 90,
          slaMinutes: 60,
          slaMet: false,
          status: 'Resolved',
          location: 'Server Room',
        },
        {
          ticketId: 'T003',
          technicianId: 'T003',
          technicianName: 'Charlie Lee',
          ticketType: 'IT Support',
          priority: 'Low',
          createdAt: '2025-08-03T14:00:00Z',
          resolvedAt: null,
          resolutionTimeMinutes: null,
          slaMinutes: 480,
          slaMet: null,
          status: 'In Progress',
          location: 'Editorial Office',
        },
      ],
      summary: {
        totalTickets: 156,
        resolved: 130,
        inProgress: 18,
        overdue: 8,
        avgResolutionTimeMinutes: 185,
        slaComplianceRate: 78.5,
      },
    });
  },

  // GET /api/operations/updown-time
  async getUpDownTimeLogs(ctx) {
    if (!validateApiKey(ctx)) return;
    //Machine uptime/downtime logs
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          date: '2025-05-25',
          machine: 'Streaming_Server_1',
          location: 'Editing Suite',
          status: 'down',
          uptime_hours: 6.44,
          downtime_hours: 1.56,
          downtime_reason: 'Network failure',
          uptime_start: '2025-01-01T10:33:36.000Z',
          uptime_end: '2025-01-01T17:00:00Z',
          downtime_start: '2025-01-01T09:00:00.000Z',
          downtime_end: '2025-01-01T10:33:36.000Z',
        },
        {
          date: '2025-05-26',
          machine: 'Heidelberg_Press_1',
          location: 'Print Production Floor',
          status: 'up',
          uptime_hours: 8.0,
          downtime_hours: 0.0,
          downtime_reason: null,
          uptime_start: '2025-01-02T06:00:00.000Z',
          uptime_end: '2025-01-02T14:00:00.000Z',
          downtime_start: null,
          downtime_end: null,
        },
        {
          date: '2025-05-27',
          machine: 'TV_Broadcast_Encoder_2',
          location: 'Broadcast Studio',
          status: 'down',
          uptime_hours: 20.5,
          downtime_hours: 3.5,
          downtime_reason: 'Scheduled maintenance',
          uptime_start: '2025-01-03T00:00:00.000Z',
          uptime_end: '2025-01-03T20:30:00.000Z',
          downtime_start: '2025-01-03T20:30:00.000Z',
          downtime_end: '2025-01-04T00:00:00.000Z',
        },
      ],
      summary: {
        totalMachines: 24,
        avgUptimePercent: 92.4,
        avgDowntimeHours: 1.8,
        mostFrequentDowntimeReason: 'Scheduled maintenance',
      },
    });
  },

  // GET /api/operations/material-waste
  async getMaterialWaste(ctx) {
    if (!validateApiKey(ctx)) return;
    //Material waste analysis
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          batch_id: 'BATCH-2025-001',
          material_id: 'MAT-001',
          material_name: 'Newsprint Paper',
          material_issued_kg: 5000,
          material_used_kg: 4750,
          waste_kg: 250,
          waste_reason: 'Setup offcuts and test runs',
          cost_per_kg: 1200,
          total_waste_cost: 300000,
          waste_percent: 5.0,
        },
        {
          batch_id: 'BATCH-2025-002',
          material_id: 'MAT-002',
          material_name: 'Black Ink',
          material_issued_kg: 120,
          material_used_kg: 108,
          waste_kg: 12,
          waste_reason: 'Color calibration waste',
          cost_per_kg: 8500,
          total_waste_cost: 102000,
          waste_percent: 10.0,
        },
      ],
      summary: {
        totalWasteKg: 285.4,
        totalWasteCost: 412000,
        avgWastePercent: 6.2,
        topWasteMaterial: 'Newsprint Paper',
      },
    });
  },

  // GET /api/operations/machine-oee
  async getMachineOEE(ctx) {
    if (!validateApiKey(ctx)) return;
    //Overall Equipment Effectiveness
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          machine_id: 'MACH-001',
          machine_name: 'Heidelberg Speedmaster',
          planned_runtime: 480,
          actual_runtime: 445,
          downtime: 35,
          ideal_cycle_time: 0.5,
          total_units_produced: 850,
          good_units: 840,
          availability: 92.7,
          performance: 95.5,
          quality: 98.8,
          oee: 87.3,
        },
        {
          machine_id: 'MACH-002',
          machine_name: 'Komori Lithrone',
          planned_runtime: 480,
          actual_runtime: 460,
          downtime: 20,
          ideal_cycle_time: 0.45,
          total_units_produced: 980,
          good_units: 960,
          availability: 95.8,
          performance: 94.6,
          quality: 97.9,
          oee: 88.6,
        },
      ],
      summary: {
        totalMachines: 8,
        avgOEE: 86.4,
        topPerformingMachine: 'Komori Lithrone',
        worstPerformingMachine: 'Folding Machine 2',
      },
    });
  },

  // GET /api/operations/production-yield
  async getProductionYield(ctx) {
    if (!validateApiKey(ctx)) return;
    //Production yield metrics
    const {start_date, end_date} = ctx.request.body;

    
    ctx.send({
      data: [
        {
          batch_id: 'BATCH-2025-001',
          production_date: '2025-08-27',
          shift: 'Morning',
          machine_id: 'MACH-001',
          planned_units: 900,
          actual_units_produced: 870,
          defective_units: 15,
          good_units: 855,
          operator: 'John Okello',
          yield_percent: 98.28,
          efficiency_percent: 96.67,
        },
        {
          batch_id: 'BATCH-2025-002',
          production_date: '2025-08-27',
          shift: 'Afternoon',
          machine_id: 'MACH-002',
          planned_units: 1000,
          actual_units_produced: 980,
          defective_units: 22,
          good_units: 958,
          operator: 'Grace Apio',
          yield_percent: 97.76,
          efficiency_percent: 98.0,
        },
      ],
      summary: {
        totalUnitsProduced: 8420,
        totalDefectiveUnits: 152,
        overallYieldPercent: 98.19,
        avgEfficiencyPercent: 96.8,
      },
    });
  },
};
