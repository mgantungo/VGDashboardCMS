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
    /*
    {
      method: 'GET',
      path: '/products/:productId/rate-cards',
      handler: 'price-calculator.getRateCards',
      config: {
        policies: [],
        middlewares: []
      }
    },
    */
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
        auth: false // Using VGAMS auth
      }
    },
    {
      method: 'GET',
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
    /*
    {
      method: 'GET',
      path: '/products',
      handler: 'products.findAll',
      config: {
        policies: [],
        middlewares: []
      }
    },
    {
      method: 'GET',
      path: '/products/category/:categoryId',
      handler: 'products.findByCategory',
      config: {
        policies: [],
        middlewares: []
      }
    }
    */
  ]
};
