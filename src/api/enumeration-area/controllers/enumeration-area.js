'use strict';

/**
 * enumeration-area controller
 *

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::enumeration-area.enumeration-area');
*/

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::enumeration-area.enumeration-area', ({ strapi }) => ({
  // Get enumeration areas by district
  async findByDistrict(ctx) {
    const { districtName } = ctx.params;
    
    try {
      const enumerationAreas = await strapi.entityService.findMany('api::enumeration-area.enumeration-area', {
        filters: {
          district: {
            name: {
              $eq: districtName
            }
          }
        },
        populate: {
          district: {
            fields: ['name']
          },
          sub_counties: {
            populate: {
              parishes: {
                populate: {
                  polling_stations: {
                    fields: ['id']
                  }
                }
              }
            }
          }
        },
        sort: 'name:asc'
      });

      // Calculate statistics
      const areasWithStats = enumerationAreas.map(ea => {
        let totalStations = 0;
        let totalParishes = 0;
        const totalSubCounties = ea.sub_counties?.length || 0;

        if (ea.sub_counties) {
          ea.sub_counties.forEach(subCounty => {
            if (subCounty.parishes) {
              totalParishes += subCounty.parishes.length;
              subCounty.parishes.forEach(parish => {
                totalStations += parish.polling_stations?.length || 0;
              });
            }
          });
        }

        return {
          id: ea.id,
          code: ea.code,
          name: ea.name,
          district: ea.district?.name,
          totalStations,
          totalParishes,
          totalSubCounties,
          // Don't return nested data
          sub_counties: undefined
        };
      });

      return this.transformResponse(areasWithStats);
    } catch (error) {
      return ctx.badRequest('Error fetching enumeration areas', { error: error.message });
    }
  }
}));
