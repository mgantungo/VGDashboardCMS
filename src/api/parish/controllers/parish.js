'use strict';

/**
 * parish controller
 *

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::parish.parish');
*/
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::parish.parish', ({ strapi }) => ({
  // Get parishes by enumeration area
  async findByEnumerationArea(ctx) {
    const { districtName, enumerationAreaName } = ctx.params;
    
    try {
      const parishes = await strapi.entityService.findMany('api::parish.parish', {
        filters: {
          sub_county: {
            enumeration_area: {
              name: {
                $eq: enumerationAreaName
              },
              district: {
                name: {
                  $eq: districtName
                }
              }
            }
          }
        },
        populate: {
          sub_county: {
            populate: {
              enumeration_area: {
                populate: {
                  district: {
                    fields: ['name']
                  }
                }
              }
            }
          },
          polling_stations: {
            fields: ['id', 'code', 'name']
          }
        },
        sort: 'name:asc'
      });

      const parishesWithStats = parishes.map(parish => ({
        id: parish.id,
        code: parish.code,
        name: parish.name,
        subCounty: parish.sub_county?.name,
        enumerationArea: parish.sub_county?.enumeration_area?.name,
        district: parish.sub_county?.enumeration_area?.district?.name,
        totalStations: parish.polling_stations?.length || 0,
        stations: parish.polling_stations?.map(station => ({
          id: station.id,
          code: station.code,
          name: station.name
        })) || []
      }));

      return this.transformResponse(parishesWithStats);
    } catch (error) {
      return ctx.badRequest('Error fetching parishes', { error: error.message });
    }
  }
}));
