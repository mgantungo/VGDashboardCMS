'use strict';
module.exports={

  async getLocations(ctx) {
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

}
