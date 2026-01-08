'use strict';

/**
 * advert controller
 */
/*
module.exports = createCoreController('api::advert.advert', ({ strapi }) => ({

  /**
   * Override default create
   */
  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      const user = ctx.state.user;
      
      // Generate reference number
      const year = new Date().getFullYear();
      const lastAdvert = await strapi.entityService.findMany('api::advert.advert', {
        sort: { id: 'desc' },
        limit: 1
      });
      
      const lastId = lastAdvert.length > 0 ? lastAdvert[0].id : 0;
      const referenceNumber = `ADV-${year}-${lastId + 1}`;
      
      // Create advert
      const advert = await strapi.entityService.create('api::advert.advert', {
        data: {
          ...data,
          reference_number: referenceNumber,
          created_by_clerk: user.id,
          publishedAt: data.status === 'draft' ? null : new Date()
        }
      });
      
      return advert;
    } catch (err) {
      ctx.throw(500, err);
    }
  },
  
  // Add custom route for getting adverts by user
  async findByUser(ctx) {
    try {
      const user = ctx.state.user;
      const { query } = ctx;
      
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          created_by_clerk: user.id
        },
        populate: ['product', 'rate_card', 'client'],
        sort: query.sort || 'createdAt:desc',
        limit: query.limit || 50
      });
      
      return adverts;
    } catch (err) {
      ctx.throw(500, err);
    }
  }
};

}));
