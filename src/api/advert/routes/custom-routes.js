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
      "handler": "prepare-payments.markAsPaid",
      "config": {
        "policies": [],
        "middlewares": [],
        "description": "Mark an advert as fully paid using reference number (for cash payments - NO invoice created). Sets isPaid=true and isActive=true"
      }
    },
    {
      "method": "POST",
      "path": "/adverts/record-payment",
      "handler": "prepare-payments.recordPayment",
      "config": {
        "policies": [],
        "middlewares": [],
        "description": "Record a partial or full payment for an advert. Automatically marks as paid when total payments >= total amount"
      }
    },
    {
      "method": "GET",
      "path": "/adverts/payment-history/:referenceNumber",
      "handler": "prepare-payments.getPaymentHistory",
      "config": {
        "policies": [],
        "middlewares": [],
        "description": "Get payment history for an advert by reference number"
      }
    },
  ]
};
