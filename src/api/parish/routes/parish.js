'use strict';

/**
 * parish router
 *

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::parish.parish');
*/
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/parishes',
      handler: 'parish.find'
    },
    {
      method: 'GET',
      path: '/parishes/:districtName/:enumerationAreaName',
      handler: 'parish.findByEnumerationArea'
    }
  ]
};
