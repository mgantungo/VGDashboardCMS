'use strict';

/**
 * district controller
 *


const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::district.district');
*/

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::district.district', ({ strapi }) => ({
  // Override the default find method
  async find(ctx) {
    const { query } = ctx;
    
    try {
      const entities = await strapi.entityService.findMany('api::district.district', {
        ...query,
        populate: {
          region: {
            fields: ['name']
          },
          enumeration_areas: {
            populate: {
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
            }
          }
        },
        sort: 'name:asc'
      });

      // Calculate statistics for each district
      const districtsWithStats = entities.map(district => {
        let totalStations = 0;
        let totalParishes = 0;
        const totalEAs = district.enumeration_areas?.length || 0;

        if (district.enumeration_areas) {
          district.enumeration_areas.forEach(ea => {
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
          });
        }

        return {
          id: district.id,
          code: district.code,
          name: district.name,
          region: district.region?.name,
          totalStations,
          totalParishes,
          totalEAs,
          // Don't return nested data to keep response light
          enumeration_areas: undefined
        };
      });

      return this.transformResponse(districtsWithStats);
    } catch (error) {
      return ctx.badRequest('Error fetching districts', { error: error.message });
    }
  },

  // Custom method to get districts by region
  async findByRegion(ctx) {
    const { regionName } = ctx.params;
    
    try {
      const districts = await strapi.entityService.findMany('api::district.district', {
        filters: {
          region: {
            name: {
              $eq: regionName
            }
          }
        },
        populate: {
          region: {
            fields: ['name']
          }
        },
        sort: 'name:asc'
      });

      return this.transformResponse(districts);
    } catch (error) {
      return ctx.badRequest('Error fetching districts by region', { error: error.message });
    }
  }
}));
