'use strict';

module.exports = {
  async getClients(ctx) {
    const { page = 1, pageSize = 1000 } = ctx.query;
    
    try {
      const [clients, total] = await Promise.all([
        strapi.entityService.findMany('api::client.client', {
          fields: ['id', 'company_name'],
          sort: 'id:asc',
          start: (parseInt(page) - 1) * parseInt(pageSize),
          limit: parseInt(pageSize)
        }),
        strapi.entityService.count('api::client.client')
      ]);
      
      return ctx.send({
        data: clients,
        meta: {
          pagination: {
            page: parseInt(page),
            pageSize: parseInt(pageSize),
            pageCount: Math.ceil(total / parseInt(pageSize)),
            total
          }
        }
      });
    } catch (error) {
      return ctx.badRequest('Error fetching clients', error);
    }
  }
};
