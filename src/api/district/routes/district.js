'use strict';

/**
 * district router
 */

//const { createCoreRouter } = require('@strapi/strapi').factories;

//module.exports = createCoreRouter('api::district.district');
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/districts',
      handler: 'district.find'
    },
    {
      method: 'GET',
      path: '/districts/region/:regionName',
      handler: 'district.findByRegion'
    }
  ]
};
