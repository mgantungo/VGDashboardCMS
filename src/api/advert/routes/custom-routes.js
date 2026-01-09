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
      method: 'GET',
      path: '/adverts/transactions/date-range',
      handler: 'advert.getTransactions',
      config: {
        auth: false, // Set to true for production
        policies: [],
        middlewares: [],
        description: 'Get transactions within date range with monetary details',
        notes: 'Returns all transactions where isCanceled=false, isPaid=false, isActive=false. Includes base_price, surcharge, discount, and total_amount.',
        tags: ['Transactions', 'Reports'],
        query: {
          startDate: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD) - defaults to today',
            example: '2024-01-01'
          },
          endDate: {
            type: 'string',
            description: 'End date (YYYY-MM-DD) - defaults to today',
            example: '2024-01-31'
          }
        },
        responses: {
          200: {
            description: 'Successful response with transactions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array' },
                    meta: { type: 'object' }
                  }
                }
              }
            }
          },
          400: {
            description: 'Bad request - invalid date format'
          },
          500: {
            description: 'Internal server error'
          }
        }
      }
    }
  ]
};
