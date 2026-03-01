// api/advert/routes/custom-routes.js

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/adverts/calculate-price',
      handler: 'price-calculator.calculate',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/adverts/:id/submit',
      handler: 'workflow.submitForReview',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/adverts/:id/editor-review',
      handler: 'workflow.editorReview',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/adverts/:id/manager-approval',
      handler: 'workflow.managerApproval',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/product-categories',
      handler: 'product-category.findCategories',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/product-categories/:categoryType',
      handler: 'product-category.findByType',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'POST',
      path: '/adverts',
      handler: 'advert.create',
      config: {
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/adverts/my-adverts',
      handler: 'advert.findByVgamsUser',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/adverts/:id',
      handler: 'advert.findOne',
      config: {
        auth: false
      }
    },
    {
      method: 'PUT',
      path: '/adverts/:id',
      handler: 'advert.update',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/adverts/my-adverts/:userId',
      handler: 'advert.findMyAdverts',
      config: {
        auth: false
      }
    },
    // ADD THIS ROUTE - DATE RANGE ADVERTS
    {
      method: 'GET',
      path: '/adverts/date-range',
      handler: 'advert.getDateRangeAdverts',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/adverts-by-date-range',  
      handler: 'advert.getDateRangeAdverts',
      config: {
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/adverts/filtered-transactions',
      handler: 'prepare-payment.getFilteredTransactions',
      config: {
        auth: false, // Set to true for production
        policies: [],
        middlewares: [],
        description: 'Get filtered transactions by date range from request body',
        notes: 'Returns transactions where isActive=false, isPaid=false, isCanceled=false. Accepts dates in request body (not query params).',
        tags: ['Transactions', 'Filtered'],
        body: {
          startDate: {
            type: 'string',
            required: true,
            description: 'Start date (YYYY-MM-DD)',
            example: '2026-01-01'
          },
          endDate: {
            type: 'string',
            required: true,
            description: 'End date (YYYY-MM-DD)',
            example: '2026-01-31'
          }
        }
      }
    },
    {
      "method": "POST",
      "path": "/adverts/mark-paid",
      "handler": "prepare-payment.markAsPaid",
      "config": {
        "policies": [],
        "middlewares": [],
        "description": "Mark an advert as fully paid using reference number (for cash payments - NO invoice created). Sets isPaid=true and isActive=true"
      }
    },
    {
      "method": "POST",
      "path": "/adverts/record-payment",
      "handler": "prepare-payment.recordPayment",
      "config": {
        "policies": [],
        "middlewares": [],
        "description": "Record a partial or full payment for an advert. Automatically marks as paid when total payments >= total amount"
      }
    },
    {
      "method": "GET",
      "path": "/adverts/payment-history/:referenceNumber",
      "handler": "prepare-payment.getPaymentHistory",
      "config": {
        "policies": [],
        "middlewares": [],
        "description": "Get payment history for an advert by reference number"
      }
    },
    {
      method: 'POST',  // Changed from GET to POST to accept body parameters
      path: '/design-house/active-adverts',
      handler: 'design-house.getActiveAdverts',
      config: {
        auth: false,  // Set to true if authentication required
        description: 'Get active adverts for design work with optional date range',
        tags: ['Design House']
        }
    },
    {
      method: 'GET',
      path: '/design-house/adverts/:id',
      handler: 'design-house.getAdvertDetails',
      config: {
        auth: false,
        description: 'Get specific advert details for design work',
        tags: ['Design House']
      }
    },
    {
      method: 'POST',
      path: '/design-house/adverts/:id/upload',
      handler: 'design-house.uploadDesignFiles',
      config: {
        auth: false,
        description: 'Upload design files for an advert',
        tags: ['Design House']
      }
    },
    {
      method: 'POST',
      path: '/design-house/adverts/:id/complete',
      handler: 'design-house.markDesignComplete',
      config: {
        auth: false,
        description: 'Mark design work as complete',
        tags: ['Design House'],
        body: {
          notes: {
            type: 'string',
            description: 'Notes about the design completion',
            required: false
          },
          designerEmail: {
            type: 'string',
            description: 'Email of the designer who completed the work',
            required: false
          }
        }
      }
    },
    {
      method: 'POST',  // Changed from GET to POST to accept body parameters
      path: '/design-house/stats',
      handler: 'design-house.getDesignStats',
      config: {
        auth: false,
        description: 'Get design statistics with optional date range',
        tags: ['Design House'],
        body: {
          startDate: {
            type: 'string',
            description: 'Start date in YYYY-MM-DD format (optional, defaults to today)',
            example: '2026-01-01'
          },
          endDate: {
            type: 'string',
            description: 'End date in YYYY-MM-DD format (optional, defaults to today)',
            example: '2026-01-31'
          }
        }
      }
    },
    /*Daily Advert Schedule routes*/
    {
      method: 'POST',
      path: '/advert-daily-schedules/schedule',
      handler: 'daily-advert-schedule.scheduleAdvert',
      config: {
        auth: false, // Set to true if you want authentication
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/advert-daily-schedules/advert/:advertId',
      handler: 'daily-advert-schedule.getAdvertSchedules',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/advert-daily-schedules/date-range',
      handler: 'daily-advert-schedule.getSchedulesByDateRange',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/advert-daily-schedules/unschedule/:scheduleId',
      handler: 'daily-advert-schedule.unscheduleAdvert',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/advert-daily-schedules/publish/:scheduleId',
      handler: 'daily-advert-schedule.togglePublishStatus',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
        method: 'GET',
        path: '/advert-daily-schedules/full',
        handler: 'daily-advert-schedule.getFullSchedules',
        config: {
          auth: false,
          policies: [],
          middlewares: [],
          description: 'Get advert daily schedules with full details including advert and client data',
        },
      },
      {
        method: 'PUT',
        path: '/advert-daily-schedules/:scheduleId/page',
        handler: 'daily-advert-schedule.updateSchedulePage',
        config: {
          auth: false,
          policies: [],
          middlewares: [],
          description: 'Update page number for a specific schedule',
        },
      },
      {
        method: 'PUT',
        path: '/advert-daily-schedules/bulk-update-pages',
        handler: 'daily-advert-schedule.bulkUpdatePages',
        config: {
          auth: false,
          policies: [],
          middlewares: [],
          description: 'Bulk update page numbers for multiple schedules',
        },
      },
      {
        method: 'GET',
        path: '/advert-office-locations/get-office-locations',
        handler: 'advert-office-locations.getBCLocations',
        config: {
          auth: false,
          policies: [],
          middlewares: [],
          description: 'Locations of offices',
        },
      },
      {
        method: 'GET',
        path: '/clients/get-ad-client',
        handler: 'clients.getClients',
        config: {
          auth: false,
          policies: [],
          middlewares: [],
          description: 'Get Clients List',
        },
      },
      {
        method: 'GET',
        path: '/advert/get-office-location',
        handler: 'office-location.getOfficeLocations',
        config: {
          auth: false,
          policies: [],
          middlewares: [],
          description: 'Get office location',
        },
      },
  ]
};
