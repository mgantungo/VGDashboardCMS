'use strict';

/**
 * polling-station controller
 *

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::polling-station.polling-station');
*/
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::polling-station.polling-station', ({ strapi }) => ({
  // Override default find with better population
  async find(ctx) {
    const { query } = ctx;
    
    try {
      const entities = await strapi.entityService.findMany('api::polling-station.polling-station', {
        ...query,
        populate: {
          parish: {
            populate: {
              sub_county: {
                populate: {
                  enumeration_area: {
                    populate: {
                      district: {
                        populate: {
                          region: {
                            fields: ['name']
                          }
                        }
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

      const transformedStations = entities.map(station => {
        const parish = station.parish;
        const subCounty = parish?.sub_county;
        const ea = subCounty?.enumeration_area;
        const district = ea?.district;
        const region = district?.region;

        return {
          id: station.id,
          code: station.code,
          name: station.name,
          parish: {
            id: parish?.id,
            code: parish?.code,
            name: parish?.name
          },
          subCounty: {
            id: subCounty?.id,
            code: subCounty?.code,
            name: subCounty?.name
          },
          enumerationArea: {
            id: ea?.id,
            code: ea?.code,
            name: ea?.name
          },
          district: {
            id: district?.id,
            code: district?.code,
            name: district?.name
          },
          region: {
            name: region?.name
          }
        };
      });

      return this.transformResponse(transformedStations);
    } catch (error) {
      return ctx.badRequest('Error fetching polling stations', { error: error.message });
    }
  },

  // Global search method
  async search(ctx) {
    const { query } = ctx;
    const { q, page = 1, pageSize = 50 } = query;
    
    if (!q || q.trim().length < 2) {
      return this.transformResponse([], { pagination: { total: 0, page: 1, pageCount: 0 } });
    }

    const searchTerm = q.trim();

    try {
      const { results, pagination } = await strapi.entityService.findWithCount('api::polling-station.polling-station', {
        filters: {
          $or: [
            { name: { $containsi: searchTerm } },
            {
              parish: {
                name: { $containsi: searchTerm }
              }
            },
            {
              parish: {
                sub_county: {
                  name: { $containsi: searchTerm }
                }
              }
            },
            {
              parish: {
                sub_county: {
                  enumeration_area: {
                    name: { $containsi: searchTerm }
                  }
                }
              }
            },
            {
              parish: {
                sub_county: {
                  enumeration_area: {
                    district: {
                      name: { $containsi: searchTerm }
                    }
                  }
                }
              }
            }
          ]
        },
        populate: {
          parish: {
            populate: {
              sub_county: {
                populate: {
                  enumeration_area: {
                    populate: {
                      district: {
                        populate: {
                          region: {
                            fields: ['name']
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        },
        sort: 'name:asc'
      });

      const transformedResults = results.map(station => {
        const parish = station.parish;
        const subCounty = parish?.sub_county;
        const ea = subCounty?.enumeration_area;
        const district = ea?.district;
        const region = district?.region;

        return {
          id: station.id,
          code: station.code,
          name: station.name,
          parish: parish?.name,
          subCounty: subCounty?.name,
          enumerationArea: ea?.name,
          district: district?.name,
          region: region?.name,
          matchType: station.name.toLowerCase().includes(searchTerm.toLowerCase()) 
            ? 'station' 
            : 'location'
        };
      });

      return this.transformResponse(transformedResults, { pagination });
    } catch (error) {
      return ctx.badRequest('Search failed', { error: error.message });
    }
  },

  // Get stations by parish
  async findByParish(ctx) {
    const { districtName, enumerationAreaName, parishName } = ctx.params;
    
    try {
      const stations = await strapi.entityService.findMany('api::polling-station.polling-station', {
        filters: {
          parish: {
            name: {
              $eq: parishName
            },
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
          }
        },
        populate: {
          parish: {
            populate: {
              sub_county: true
            }
          }
        },
        sort: 'name:asc'
      });

      const transformedStations = stations.map(station => ({
        id: station.id,
        code: station.code,
        name: station.name,
        parish: station.parish?.name,
        subCounty: station.parish?.sub_county?.name
      }));

      return this.transformResponse(transformedStations);
    } catch (error) {
      return ctx.badRequest('Error fetching stations by parish', { error: error.message });
    }
  }
}));
