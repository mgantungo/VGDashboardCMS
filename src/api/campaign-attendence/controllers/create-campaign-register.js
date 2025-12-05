'use strict';
module.exports = {

  async createFromForm(ctx) {
    try {
      const { request, response } = ctx;
      
      // 1. Check if request is coming from WordPress plugin (allow multiple origins)
      const referer = request.headers.referer || request.headers.origin;
      const allowedOrigins = [
        'https://epapers.visiongroup.co.ug',
        'visiongroup.co.ug',
        // Add your WordPress site domains here
      ];
      
      // If referer exists, check if it's from allowed origins
      if (referer) {
        const isAllowed = allowedOrigins.some(origin => referer.includes(origin));
        if (!isAllowed) {
          strapi.log.warn(`Blocked request from unauthorized origin: ${referer}`);
          return response.forbidden('Access denied. Unauthorized request source.');
        }
      }
      
      // 2. Get the raw request body for logging
      const rawBody = request.body;
      
      // 3. Validate required fields based on WordPress plugin data structure
      const { 
        name, 
        email, 
        phone, 
        transaction,
        // Campaign data from WordPress plugin
        slug,
        campaign_name,
        campaign_type,
        source,
        // Technical metadata
        submission_date,
        ip_address,
        user_agent,
        referrer,
        wordpress_site,
        plugin_version,
        submission_id
      } = rawBody;
      
      // Required fields from WordPress form
      if (!name || !phone || !transaction) {
        return response.badRequest('Name, phone, and transaction ID are required.');
      }
      
      // 4. Validate data formats (match WordPress validation)
      const nameRegex = /^[A-Za-z\s]{2,50}$/;
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
      const transactionRegex = /^[A-Za-z0-9\-_]{6,50}$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!nameRegex.test(name.trim())) {
        return response.badRequest('Invalid name format. 2-50 letters and spaces only.');
      }
      
      if (!phoneRegex.test(phone.trim())) {
        return response.badRequest('Invalid phone number. 10-15 digits required.');
      }
      
      if (!transactionRegex.test(transaction.trim())) {
        return response.badRequest('Invalid transaction ID. 6-50 alphanumeric characters required.');
      }
      
      if (email && !emailRegex.test(email.trim())) {
        return response.badRequest('Invalid email format.');
      }
      
      // 5. Get or create the campaign based on slug
      let campaign = null;
      if (slug) {
        campaign = await strapi.db.query('api::campaign.campaign').findOne({
          where: { slug: slug }
        });
        
        // If campaign doesn't exist, create it
         /* campaign ids shall always be given by the admin of the cms
        if (!campaign) {
          campaign = await strapi.db.query('api::campaign.campaign').create({
            data: {
              campaignName: campaign_name || 'Epaper Subscribe & Win Campaign',
              slug: slug,
              isActive: true,
              owner: 'Epaper', // Default owner, you might want to make this configurable
              publishedAt: new Date()
            }
          });
        }
        */
        
        // Check if campaign is active
        if (!campaign.isActive) {
          return response.badRequest('This campaign is currently inactive.');
        }
      }
      
      // 6. Check for duplicate entries
      const existingEntry = await strapi.db.query('api::campaign-attendence.campaign-attendence').findOne({
        where: {
          $or: [
            { phone: phone.trim() },
            { email: email ? email.trim() : undefined },
            { promoCode: transaction.trim() }
          ]
        }
      });
      
      if (existingEntry) {
        return response.badRequest('An entry with these details already exists.');
      }
      
      // 7. Prepare data for campaign attendance
      const attendenceData = {
        fullName: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        promoCode: transaction.trim(),
        uniqueSecret: transaction.trim(),
        processes: false,
        publishedAt: new Date()
      };
      
      // 8. Create the campaign attendance entry
      const entry = await strapi.entityService.create('api::campaign-attendence.campaign-attendence', {
        data: attendenceData,
        populate: ['campaigns']
      });
      
      // 9. If campaign exists, link the attendance to the campaign
      if (campaign) {
        await strapi.db.query('api::campaign-attendence.campaign-attendence').update({
          where: { id: entry.id },
          data: {
            campaigns: {
              connect: [{ id: campaign.id }]
            }
          }
        });
        
        // Also update the campaign to link to this attendance
        await strapi.db.query('api::campaign.campaign').update({
          where: { id: campaign.id },
          data: {
            campaign_attendences: {
              connect: [{ id: entry.id }]
            }
          }
        });
      }
      
      // 10. Log the successful submission (optional)
      strapi.log.info(`Campaign attendance created: ${entry.id} for campaign: ${slug}`);
      
      // 11. Return success response
      return response.ok({
        success: true,
        message: 'Registration successful!',
        data: {
          id: entry.id,
          name: entry.fullName,
          transactionId: entry.promoCode,
          campaignSlug: slug,
          campaignName: campaign?.campaignName || campaign_name,
          timestamp: new Date().toISOString(),
          submissionId: submission_id // Return the WordPress submission ID
        },
        metadata: {
          pluginVersion: plugin_version,
          wordpressSite: wordpress_site,
          ipAddress: ip_address
        }
      });
      
    } catch (error) {
      // Log detailed error for debugging
      strapi.log.error('Campaign registration error:', error);
      
      // Return user-friendly error message
      return response.internalServerError('An error occurred during registration. Please try again.');
    }
  },
  
  // Optional: Add a method to verify submission
  async verifySubmission(ctx) {
    try {
      const { transactionId } = ctx.params;
      
      if (!transactionId) {
        return response.badRequest('Transaction ID is required.');
      }
      
      const entry = await strapi.db.query('api::campaign-attendence.campaign-attendence').findOne({
        where: { promoCode: transactionId },
        populate: ['campaigns']
      });
      
      if (!entry) {
        return response.notFound('No registration found with this transaction ID.');
      }
      
      return response.ok({
        success: true,
        data: {
          name: entry.fullName,
          phone: entry.phone,
          email: entry.email,
          registeredAt: entry.createdAt,
          status: entry.processes ? 'Processed' : 'Pending',
          campaign: entry.campaigns?.[0]?.campaignName || 'Unknown Campaign'
        }
      });
      
    } catch (error) {
      strapi.log.error('Verification error:', error);
      return response.internalServerError('Unable to verify submission.');
    }
  }
}
