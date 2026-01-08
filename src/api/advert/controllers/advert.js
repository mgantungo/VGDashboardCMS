'use strict';

/**
 * advert controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

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
      
      // Transform camelCase to snake_case for Strapi
      const transformedData = {
        advert_title: data.advertTitle,
        client_name: data.clientName,
        contact_person: data.contactPerson || '',
        email: data.email,
        phone: data.phone,
        platform_category: data.platformCategory,
        product: data.product,
        rate_card: data.rateCard,
        ad_size: data.adSize || '',
        ad_type: data.adType,
        frequency: data.frequency,
        start_date: data.startDate,
        end_date: data.endDate || null,
        base_price: data.basePrice || 0,
        surcharge: data.surcharge || 0,
        total_amount: data.totalAmount || 0,
        payment_method: data.paymentMethod,
        special_instructions: data.specialInstructions || '',
        status: data.status || 'draft'
      };
      
      // Create advert
      const advert = await strapi.entityService.create('api::advert.advert', {
        data: {
          ...transformedData,
          reference_number: referenceNumber,
          created_by_clerk: user.id,
          publishedAt: data.status === 'draft' ? null : new Date()
        },
        populate: ['product', 'rate_card']
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
      
      return { data: adverts };
    } catch (err) {
      ctx.throw(500, err);
    }
  }
}));
