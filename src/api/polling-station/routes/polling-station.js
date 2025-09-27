'use strict';

/**
 * polling-station router
 *

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::polling-station.polling-station');
*/
module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/polling-stations',
      handler: 'polling-station.find'
    },
    {
      method: 'GET',
      path: '/polling-stations/search',
      handler: 'polling-station.search'
    },
    {
      method: 'GET',
      path: '/polling-stations/:districtName/:enumerationAreaName/:parishName',
      handler: 'polling-station.findByParish'
    }
  ]
};
