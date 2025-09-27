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
      return this.transformResponse([], { 
        pagination: { 
          page: 1, 
          pageSize: parseInt(pageSize), 
          pageCount: 0, 
          total: 0 
        } 
      });
    }

    const searchTerm = q.trim();
    const limit = Math.min(parseInt(pageSize), 100);
    const currentPage = parseInt(page);

    try {
      // Method 1: Use Strapi entityService with OR filters
      const searchFilters = {
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
      };

      // Get the results
      const results = await strapi.entityService.findMany('api::polling-station.polling-station', {
        filters: searchFilters,
        populate: {
          parish: {
            fields: ['name'],
            populate: {
              sub_county: {
                fields: ['name'],
                populate: {
                  enumeration_area: {
                    fields: ['name'],
                    populate: {
                      district: {
                        fields: ['name'],
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
        fields: ['id', 'code', 'name'],
        pagination: {
          page: currentPage,
          pageSize: limit
        },
        sort: 'name:asc'
      });

      // Get total count
      const total = await strapi.entityService.count('api::polling-station.polling-station', {
        filters: searchFilters
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
          parish: parish?.name || 'Unknown',
          subCounty: subCounty?.name || 'Unknown',
          enumerationArea: ea?.name || 'Unknown',
          district: district?.name || 'Unknown',
          region: region?.name || 'Unknown',
          matchType: station.name.toLowerCase().includes(searchTerm.toLowerCase()) 
            ? 'station' 
            : 'location'
        };
      });

      const pageCount = Math.ceil(total / limit);

      return this.transformResponse(transformedResults, { 
        pagination: { 
          page: currentPage, 
          pageSize: limit, 
          pageCount, 
          total 
        } 
      });

    } catch (error) {
      console.error('Search failed:', error);
      
      // Fallback: Try simpler search if complex query fails
      try {
        console.log('Trying fallback search...');
        
        const simpleResults = await strapi.entityService.findMany('api::polling-station.polling-station', {
          filters: {
            name: { $containsi: searchTerm }
          },
          populate: {
            parish: {
              fields: ['name'],
              populate: {
                sub_county: {
                  fields: ['name'],
                  populate: {
                    enumeration_area: {
                      fields: ['name'],
                      populate: {
                        district: {
                          fields: ['name'],
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
          fields: ['id', 'code', 'name'],
          pagination: {
            page: currentPage,
            pageSize: limit
          },
          sort: 'name:asc'
        });

        const simpleTotal = await strapi.entityService.count('api::polling-station.polling-station', {
          filters: {
            name: { $containsi: searchTerm }
          }
        });

        const transformedResults = simpleResults.map(station => {
          const parish = station.parish;
          const subCounty = parish?.sub_county;
          const ea = subCounty?.enumeration_area;
          const district = ea?.district;
          const region = district?.region;

          return {
            id: station.id,
            code: station.code,
            name: station.name,
            parish: parish?.name || 'Unknown',
            subCounty: subCounty?.name || 'Unknown',
            enumerationArea: ea?.name || 'Unknown',
            district: district?.name || 'Unknown',
            region: region?.name || 'Unknown',
            matchType: 'station'
          };
        });

        return this.transformResponse(transformedResults, { 
          pagination: { 
            page: currentPage, 
            pageSize: limit, 
            pageCount: Math.ceil(simpleTotal / limit), 
            total: simpleTotal
          } 
        });

      } catch (fallbackError) {
        console.error('Fallback search also failed:', fallbackError);
        return ctx.badRequest('Search failed', { error: fallbackError.message });
      }
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
