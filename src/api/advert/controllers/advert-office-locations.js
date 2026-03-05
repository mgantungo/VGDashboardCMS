'use strict';

const axios = require('axios');

module.exports={

/*
Get Cost / Revenue Streams from Business Central
*/
  async getBCLocations(ctx) {
  try {
    const { EXTERNAL_API_OFFICELOCATION, EXTERNAL_API_USERNAME, EXTERNAL_API_PASSWORD } = process.env;

    // Make the API request with basic authentication
    const response = await axios.get(EXTERNAL_API_OFFICELOCATION, {
      auth: {
        username: EXTERNAL_API_USERNAME,
        password: EXTERNAL_API_PASSWORD
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Separate locations based on Dimension_Code31351
    const revenueStreams = [];
    const costStreams = [];

    response.data.value.forEach(location => {
      const dimensionCode = location.Dimension_Code31351;
      
      if (dimensionCode === 'REVSTREAM') {
        revenueStreams.push({
          uuid: location.Code,
          name: location.Name || 'No Name'
        });
      } else if (dimensionCode === 'COST CENTRE') {
        costStreams.push({
          uuid: location.Code,
          name: location.Name || 'No Name'
        });
      }
    });

    // Save revenue streams - check UUID first
    const revenueResults = {
      created: [],
      skipped: []
    };

    for (const revenueStream of revenueStreams) {
      // Check if a record with this UUID already exists
      const existing = await strapi.entityService.findMany(
        'api::revenue-stream.revenue-stream',
        {
          filters: { uuid: revenueStream.uuid },
          limit: 1
        }
      );

      if (existing.length === 0) {
        // UUID doesn't exist - create new record
        const created = await strapi.entityService.create(
          'api::revenue-stream.revenue-stream',
          {
            data: revenueStream
          }
        );
        revenueResults.created.push({
          uuid: revenueStream.uuid,
          name: revenueStream.name,
          id: created.id
        });
        console.log(`✅ Created revenue stream: ${revenueStream.uuid} - ${revenueStream.name}`);
      } else {
        // UUID already exists - skip
        revenueResults.skipped.push({
          uuid: revenueStream.uuid,
          name: revenueStream.name,
          existingId: existing[0].id
        });
        console.log(`⏭️ Skipped revenue stream (already exists): ${revenueStream.uuid} - ${revenueStream.name}`);
      }
    }

    // Save cost streams - check UUID first
    const costResults = {
      created: [],
      skipped: []
    };

    for (const costStream of costStreams) {
      // Check if a record with this UUID already exists
      const existing = await strapi.entityService.findMany(
        'api::cost-stream.cost-stream',
        {
          filters: { uuid: costStream.uuid },
          limit: 1
        }
      );

      if (existing.length === 0) {
        // UUID doesn't exist - create new record
        const created = await strapi.entityService.create(
          'api::cost-stream.cost-stream',
          {
            data: costStream
          }
        );
        costResults.created.push({
          uuid: costStream.uuid,
          name: costStream.name,
          id: created.id
        });
        console.log(`✅ Created cost stream: ${costStream.uuid} - ${costStream.name}`);
      } else {
        // UUID already exists - skip
        costResults.skipped.push({
          uuid: costStream.uuid,
          name: costStream.name,
          existingId: existing[0].id
        });
        console.log(`⏭️ Skipped cost stream (already exists): ${costStream.uuid} - ${costStream.name}`);
      }
    }

    // Send the filtered data with creation results
    ctx.send({
      success: true,
      summary: {
        totalRecords: response.data.value.length,
        revenueStreams: {
          total: revenueStreams.length,
          created: revenueResults.created.length,
          skipped: revenueResults.skipped.length
        },
        costStreams: {
          total: costStreams.length,
          created: costResults.created.length,
          skipped: costResults.skipped.length
        },
        other: response.data.value.length - (revenueStreams.length + costStreams.length)
      },
      data: {
        revenueStreams: revenueStreams,
        costStreams: costStreams
      },
      results: {
        revenueStreams: revenueResults,
        costStreams: costResults
      }
    });

  } catch (error) {
    console.error('Error fetching locations:', error.message);
    
    ctx.send({
      success: false,
      message: 'Failed to fetch locations',
      error: error.message
    }, error.response?.status || 500);
  }
}
  /*
  async getBCLocations(ctx) {
    try {
      const { EXTERNAL_API_OFFICELOCATION, EXTERNAL_API_USERNAME, EXTERNAL_API_PASSWORD } = process.env;

      // Make the API request with basic authentication
      const response = await axios.get(EXTERNAL_API_OFFICELOCATION, {
        auth: {
          username: EXTERNAL_API_USERNAME,
          password: EXTERNAL_API_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Extract only code and name from each location
      const locations = response.data.value.map(location => ({
        code: location.Code,
        name: location.Name || 'No Name' // Handle empty names by providing default
      }));

      // Send the filtered data
      ctx.send({
        success: true,
        data: locations,
        count: locations.length
      });

    } catch (error) {
      console.error('Error fetching locations:', error.message);
      
      ctx.send({
        success: false,
        message: 'Failed to fetch locations',
        error: error.message
      }, error.response?.status || 500);
    }
  }
  */
  ,
  async getOfficeLocations(ctx) {
    try {
      // Fetch all office locations from Strapi
      const entries = await strapi.entityService.findMany('api::office-location.office-location', {
        fields: ['bc_code', 'office_location'],
        publicationState: 'live'
      });

      // Transform data to match desired format (bc_code as code, office_location as office)
      const locations = entries.map(entry => ({
        code: entry.bc_code,
        office: entry.office_location || 'No Office Name' // Handle empty values
      }));

      // Send response
      ctx.send({
        success: true,
        data: locations,
        count: locations.length
      });

    } catch (error) {
      console.error('Error fetching office locations:', error.message);
      
      ctx.send({
        success: false,
        message: 'Failed to fetch office locations',
        error: error.message
      }, 500);
    }
  },
  async getAndPopulateBCLocations(ctx) {
  try {
    const { EXTERNAL_API_OFFICELOCATION, EXTERNAL_API_USERNAME, EXTERNAL_API_PASSWORD } = process.env;

    // Fetch locations from Business Central
    const response = await axios.get(EXTERNAL_API_OFFICELOCATION, {
      auth: {
        username: EXTERNAL_API_USERNAME,
        password: EXTERNAL_API_PASSWORD
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Get all existing locations for comparison (optional)
    const existingLocations = await strapi.entityService.findMany('api::office-location.office-location', {
      fields: ['bc_code'],
    });

    // Create a Set of existing codes for quick lookup
    const existingCodes = new Set(existingLocations.map(loc => loc.bc_code));

    // Track results
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Process each location from BC
    for (const location of response.data.value) {
      try {
        const bcCode = location.Code;
        const officeLocation = location.Name || 'No Name';

        // Check if location already exists by bc_code
        const existingLocation = await strapi.entityService.findMany('api::office-location.office-location', {
          filters: { bc_code: bcCode },
          limit: 1
        });

        if (existingLocation && existingLocation.length > 0) {
          // Update existing location
          await strapi.entityService.update('api::office-location.office-location', existingLocation[0].id, {
            data: {
              office_location: officeLocation,
              // If you want to track last sync
              // last_sync: new Date()
            }
          });
          updated++;
        } else {
          // Create new location
          await strapi.entityService.create('api::office-location.office-location', {
            data: {
              bc_code: bcCode,
              office_location: officeLocation,
              publishedAt: new Date() // If using draftAndPublish
            }
          });
          created++;
        }
      } catch (itemError) {
        errors.push({
          code: location.Code,
          error: itemError.message
        });
        skipped++;
      }
    }

    // Send response with results
    ctx.send({
      success: true,
      message: 'Office locations synced successfully',
      data: {
        total_processed: response.data.value.length,
        created,
        updated,
        skipped,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Error syncing locations:', error);
    
    ctx.send({
      success: false,
      message: 'Failed to sync locations',
      error: error.message
    }, error.response?.status || 500);
  }
}

}
