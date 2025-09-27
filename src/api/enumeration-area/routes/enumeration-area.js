'use strict';

/**
 * enumeration-area router
 */

//const { createCoreRouter } = require('@strapi/strapi').factories;

//module.exports = createCoreRouter('api::enumeration-area.enumeration-area');
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/enumeration-areas',
      handler: 'enumeration-area.find'
    },
    {
      method: 'GET',
      path: '/enumeration-areas/district/:districtName',
      handler: 'enumeration-area.findByDistrict'
    }
  ]
};
