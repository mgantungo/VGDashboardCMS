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
    // ── Advert CRUD ───────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/adverts',
      handler: 'advert.create',
      config: {
        auth: false
      }
    },
    {
      // POST so the body carries { vgamsUserId } without exposing it in the URL.
      // Previously pointed to advert.findByVgamsUser (broken – read from headers).
      // Now points to advert.findMyAdverts which correctly reads from body.
      method: 'POST',
      path: '/adverts/my-adverts',
      handler: 'advert.findMyAdverts',
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
    // ── Date Range ────────────────────────────────────────────────────────
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
    // ── Schedule Range (run date, not booked date — see advert-schedule.js) ─
    {
      method: 'GET',
      path: '/adverts/schedule-range',
      handler: 'advert-schedule.getScheduleAdverts',
      config: {
        auth: false
      }
    },
    // ── Payments ──────────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/adverts/filtered-transactions',
      handler: 'prepare-payment.getFilteredTransactions',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get filtered transactions by date range from request body',
        notes: 'Returns transactions where isActive=false, isPaid=false, isCanceled=false. Accepts dates in request body (not query params).',
        tags: ['Transactions', 'Filtered'],
        body: {
          startDate: { type: 'string', required: true, description: 'Start date (YYYY-MM-DD)', example: '2026-01-01' },
          endDate:   { type: 'string', required: true, description: 'End date (YYYY-MM-DD)',   example: '2026-01-31' }
        }
      }
    },
    {
      method: 'POST',
      path: '/adverts/mark-paid',
      handler: 'prepare-payment.markAsPaid',
      config: {
        policies: [],
        middlewares: [],
        description: 'Mark an advert as fully paid using reference number (for cash payments - NO invoice created). Sets isPaid=true and isActive=true'
      }
    },
    {
      method: 'POST',
      path: '/adverts/record-payment',
      handler: 'prepare-payment.recordPayment',
      config: {
        policies: [],
        middlewares: [],
        description: 'Record a partial or full payment for an advert. Automatically marks as paid when total payments >= total amount'
      }
    },
    {
      method: 'GET',
      path: '/adverts/payment-history/:referenceNumber',
      handler: 'prepare-payment.getPaymentHistory',
      config: {
        policies: [],
        middlewares: [],
        description: 'Get payment history for an advert by reference number'
      }
    },
    // ── Design House ──────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/design-house/active-adverts',
      handler: 'design-house.getActiveAdverts',
      config: {
        auth: false,
        description: 'Get active adverts for design work with optional date range and product/category filter',
        tags: ['Design House'],
        body: {
          startDate: { type: 'string', required: false, description: 'YYYY-MM-DD', example: '2026-08-01' },
          endDate:   { type: 'string', required: false, description: 'YYYY-MM-DD', example: '2026-08-31' },
          productId: { type: 'number', required: false, description: 'Scope results to one product (masthead), e.g. New Vision', example: 3 },
          scope:     { type: 'string', required: false, description: "category_type to scope by, or 'all' to lift the constraint. Defaults to 'print'.", example: 'print' }
        }
      }
    },
    {
      method: 'POST',
      path: '/design-house/adverts/by-date',
      handler: 'design-house.getBookingsByDate',
      config: {
        auth: false,
        description: 'Get every advert booked to run on a specific date, flagged with whether that date is already scheduled',
        tags: ['Design House'],
        body: {
          date: { type: 'string', required: true, description: 'YYYY-MM-DD', example: '2026-08-03' },
          productId: { type: 'number', required: false, description: 'Scope results to one product (masthead), e.g. New Vision', example: 3 },
          scope:     { type: 'string', required: false, description: "category_type to scope by, or 'all' to lift the constraint. Defaults to 'print'.", example: 'print' }
        }
      }
    },
    {
      method: 'GET',
      path: '/design-house/product-categories',
      handler: 'design-house.getProductCategories',
      config: {
        auth: false,
        description: 'List every product category (Print, TV, Radio, Billboard, Web, …) — powers the scope radio buttons',
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
      method: 'GET',
      path: '/adverts/:id/edit',
      handler: 'advert.findForEdit',
      config: {
        auth: false, // server-side identity resolution, same as the rest of this module
      },
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
          notes:         { type: 'string', description: 'Notes about the design completion', required: false },
          designerEmail: { type: 'string', description: 'Email of the designer who completed the work', required: false }
        }
      }
    },
    {
      method: 'POST',
      path: '/design-house/adverts/:id/unmark-complete',
      handler: 'design-house.unmarkDesignComplete',
      config: {
        auth: false,
        description: 'Reverse an accidental design-complete mark - server re-verifies the BC reference code the client asked the user to confirm',
        tags: ['Design House'],
        body: {
          bcCodeSuffix: { type: 'string', description: 'The advert\'s BC reference code (with or without the B-SO- prefix), typed by the user to confirm', required: true },
          notes:        { type: 'string', description: 'Optional reason for the reversal', required: false }
        }
      }
    },
    {
      method: 'GET',
      path: '/design-house/products',
      handler: 'design-house.getProducts',
      config: {
        auth: false,
        description: "List active products, scoped by ?scope=<category_type> (defaults to 'print'; pass 'all' to lift the constraint)",
        tags: ['Design House']
      }
    },
    {
      method: 'POST',
      path: '/design-house/stats',
      handler: 'design-house.getDesignStats',
      config: {
        auth: false,
        description: 'Get design statistics with optional date range and product filter',
        tags: ['Design House'],
        body: {
          startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format (optional, defaults to today)', example: '2026-01-01' },
          endDate:   { type: 'string', description: 'End date in YYYY-MM-DD format (optional, defaults to today)',   example: '2026-01-31' },
          productId: { type: 'number', required: false, description: 'Scope results to one product (masthead), e.g. New Vision', example: 3 },
          scope:     { type: 'string', required: false, description: "category_type to scope by, or 'all' to lift the constraint. Defaults to 'print'.", example: 'print' }
        }
      }
    },
    // ── Daily Advert Schedules ────────────────────────────────────────────
    {
      method: 'POST',
      path: '/advert-daily-schedules/schedule',
      handler: 'daily-advert-schedule.scheduleAdvert',
      config: {
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/advert-daily-schedules/advert/:advertId',
      handler: 'daily-advert-schedule.getAdvertSchedules',
      config: {
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/advert-daily-schedules/date-range',
      handler: 'daily-advert-schedule.getSchedulesByDateRange',
      config: {
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'DELETE',
      path: '/advert-daily-schedules/unschedule/:scheduleId',
      handler: 'daily-advert-schedule.unscheduleAdvert',
      config: {
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'PUT',
      path: '/advert-daily-schedules/publish/:scheduleId',
      handler: 'daily-advert-schedule.togglePublishStatus',
      config: {
        auth: false,
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/advert-daily-schedules/full',
      handler: 'daily-advert-schedule.getFullSchedules',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get advert daily schedules with full details including advert and client data'
      }
    },
    {
      method: 'PUT',
      path: '/advert-daily-schedules/:scheduleId/page',
      handler: 'daily-advert-schedule.updateSchedulePage',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Update page number for a specific schedule'
      }
    },
    {
      method: 'PUT',
      path: '/advert-daily-schedules/:scheduleId/update',
      handler: 'daily-advert-schedule.updateScheduleRun',
      config: {
        auth: false,
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
        description: 'Bulk update page numbers for multiple schedules'
      }
    },
    // ── Office Locations ──────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/advert-office-locations/get-office-locations',
      handler: 'advert-office-locations.getBCLocations',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Locations of offices from business central'
      }
    },
    {
      method: 'GET',
      path: '/advert/get-office-location',
      handler: 'advert-office-locations.getOfficeLocations',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get office location from VGAD'
      }
    },
    {
      method: 'GET',
      path: '/advert/get-and-sync-office-locations-from-bc',
      handler: 'advert-office-locations.getAndPopulateBCLocations',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get and sync office locations from business central'
      }
    },
    // ── Clients ───────────────────────────────────────────────────────────
    {
      method: 'GET',
      path: '/clients/get-ad-client',
      handler: 'clients.getClients',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get Clients List'
      }
    },
    // ── Market ───────────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/market-sectors/populate',
      handler: 'market-sector.populateBCMarketSectors',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get MarketSector List'
      }
    },
    // ── Market ───────────────────────────────────────────────────────────
    {
      method: 'POST',
      path: '/sections-commission/populate',
      handler: 'sections-commission.populateBCSectionsCommission',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
        description: 'Get Section commission List'
      }
    },
    {
      method: 'GET',
      path: '/market-sectors',
      handler: 'market-sector.getMarketSectors',
      config: {
        auth: false,
        description: 'Get Market sector data'
      }
    },        
    {
      method: 'GET',
      path: '/adverts/bc-status/:reference',
      handler: 'advert.getBcSyncStatusByReferenceParam',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    // ── BC SYnc Monitor ───────────────────────────────────────────────────────────
    // Get adverts that need payment check
    {
      method: 'GET',
      path: '/bc/check-payment',
      handler: 'bc-sync-monitor.getAdvertsForPaymentCheck',
      config: {
        auth: false,
        description: 'Get adverts that need payment status check (isPaid=false with bc_reference_number)',
        tags: ['Payment Monitor']
      }
    },
    
    // Update single advert payment status
    {
      method: 'PUT',
      path: '/bc/:id/payment',
      handler: 'bc-sync-monitor.updatePaymentStatus',
      config: {
        auth: false,
        description: 'Update advert payment status (only updates isPaid)',
        tags: ['Payment Monitor'],
        body: {
          isPaid: { type: 'boolean', required: true, description: 'Payment status from Business Central' }
        }
      }
    },
    
    // Bulk update multiple adverts payment status
    {
      method: 'POST',
      path: '/bc/bulk-payment',
      handler: 'bc-sync-monitor.bulkUpdatePaymentStatus',
      config: {
        auth: false,
        description: 'Bulk update payment status for multiple adverts',
        tags: ['Payment Monitor'],
        body: {
          updates: {
            type: 'array',
            required: true,
            description: 'Array of updates with id and isPaid',
            items: {
              id: { type: 'number', required: true },
              isPaid: { type: 'boolean', required: true }
            }
          }
        }
      }
    },
    
    // Check payment status by BC reference number
    {
      method: 'GET',
      path: '/bc/payment/:reference',
      handler: 'bc-sync-monitor.checkPaymentByBcReference',
      config: {
        auth: false,
        description: 'Check sync status by Business Central reference number',
        tags: ['Payment Monitor']
      }
    },
    // ── BC Test Bypass (dev/test only — gated by ALLOW_BC_TEST_BYPASS) ────
    {
      method: 'POST',
      path: '/bc/test/mark-paid',
      handler: 'bc-test.markPaidForTesting',
      config: {
        auth: false,
        description: 'TEST ONLY — bypass BC and update isPaid/isActive/start_date/end_date/publishing_dates by bc_reference_number. Gated by ALLOW_BC_TEST_BYPASS=true.',
        tags: ['Payment Monitor', 'Test'],
        body: {
          bc_reference_number: { type: 'string', required: true, example: 'B-SO-216545N' },
          isPaid:            { type: 'boolean', required: false, description: 'default true' },
          isActive:          { type: 'boolean', required: false, description: 'default true' },
          start_date:        { type: 'string',  required: false, example: '2026-08-02' },
          end_date:          { type: 'string',  required: false, example: '2026-08-06' },
          publishing_dates:  { type: 'array',   required: false, example: ['2026-08-02', '2026-08-03'] }
        }
      }
    },
    {
      method: 'GET',
      path: '/bc/test/lookup/:bc_reference_number',
      handler: 'bc-test.lookupByBcReference',
      config: {
        auth: false,
        description: 'TEST ONLY — look up current field values for an advert by bc_reference_number. Gated by ALLOW_BC_TEST_BYPASS=true.',
        tags: ['Payment Monitor', 'Test']
      }
    },
    //testing salesorder endpoint
    {
      method: 'GET',
      path: '/bc/test/sales-order-fields',
      handler: 'bc-test.getSalesOrderFields',
      config: {
        auth: false,
        description: 'TEST ONLY — list valid field names for BC sales order entity types via $metadata. Gated by ALLOW_BC_TEST_BYPASS=true.',
        tags: ['Payment Monitor', 'Test']
      }
    },
    {
      method: 'GET',
      path: '/bc/test/sales-order/:number',
      handler: 'bc-test.getSalesOrderByNumber',
      config: {
        auth: false,
        description: 'TEST ONLY — fetch a raw sales order from BC by number to inspect its real fields. Gated by ALLOW_BC_TEST_BYPASS=true.',
        tags: ['Payment Monitor', 'Test']
      }
    },
  ]
};
