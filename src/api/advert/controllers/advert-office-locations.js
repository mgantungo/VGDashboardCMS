'use strict';

module.exports = {
  async getLocations(ctx) {
    try {
      const { EXTERNAL_API_OFFICELOCATION, EXTERNAL_API_USERNAME, EXTERNAL_API_PASSWORD } = process.env;

      // Create basic auth header
      const auth = Buffer.from(`${EXTERNAL_API_USERNAME}:${EXTERNAL_API_PASSWORD}`).toString('base64');

      const response = await fetch(EXTERNAL_API_OFFICELOCATION, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Extract only code and name from each location
      const locations = data.value.map(location => ({
        code: location.Code,
        name: location.Name || 'No Name'
      }));

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
      }, error.status || 500);
    }
  }
};
