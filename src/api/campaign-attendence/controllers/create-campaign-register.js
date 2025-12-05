
'use strict';
module.exports = {

  async createFromForm(ctx) {
    try {
      const { request, response } = ctx;
      
      strapi.log.info('=== START FORM SUBMISSION ===');
      strapi.log.info('Request received at:', new Date().toISOString());
      strapi.log.info('Request method:', request.method);
      strapi.log.info('Request URL:', request.url);
      
      // 1. Get the raw request body
      const rawBody = request.body;
      
      strapi.log.info('=== RAW REQUEST BODY ===');
      strapi.log.info('Full body object:', JSON.stringify(rawBody, null, 2));
      strapi.log.info('Body keys:', Object.keys(rawBody));
      strapi.log.info('=======================');
      
      // 2. Extract fields
      const { 
        name, 
        email, 
        phone, 
        transaction,
        slug,
        campaign_name
      } = rawBody;
      
      strapi.log.info('=== EXTRACTED FIELDS ===');
      strapi.log.info('name:', name, '(type:', typeof name, ')');
      strapi.log.info('email:', email, '(type:', typeof email, ')');
      strapi.log.info('phone:', phone, '(type:', typeof phone, ')');
      strapi.log.info('transaction:', transaction, '(type:', typeof transaction, ')');
      strapi.log.info('slug:', slug, '(type:', typeof slug, ')');
      strapi.log.info('campaign_name:', campaign_name, '(type:', typeof campaign_name, ')');
      strapi.log.info('=========================');
      
      // 3. Required fields validation
      strapi.log.info('Checking required fields...');
      if (!name) {
        strapi.log.error('Missing required field: name');
        return response.badRequest('Name is required.');
      }
      if (!phone) {
        strapi.log.error('Missing required field: phone');
        return response.badRequest('Phone is required.');
      }
      if (!transaction) {
        strapi.log.error('Missing required field: transaction');
        return response.badRequest('Transaction ID is required.');
      }
      strapi.log.info('Required fields check: PASSED');
      
      // 4. Data format validation
      strapi.log.info('Starting data format validation...');
      const nameRegex = /^[A-Za-z\s]{2,50}$/;
      const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
      const transactionRegex = /^[A-Za-z0-9\-_]{6,50}$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!nameRegex.test(name.trim())) {
        strapi.log.error('Name validation failed:', name);
        return response.badRequest('Invalid name format. 2-50 letters and spaces only.');
      }
      strapi.log.info('Name validation: PASSED');
      
      if (!phoneRegex.test(phone.trim())) {
        strapi.log.error('Phone validation failed:', phone);
        return response.badRequest('Invalid phone number. 10-15 digits required.');
      }
      strapi.log.info('Phone validation: PASSED');
      
      if (!transactionRegex.test(transaction.trim())) {
        strapi.log.error('Transaction validation failed:', transaction);
        return response.badRequest('Invalid transaction ID. 6-50 alphanumeric characters required.');
      }
      strapi.log.info('Transaction validation: PASSED');
      
      if (email && !emailRegex.test(email.trim())) {
        strapi.log.error('Email validation failed:', email);
        return response.badRequest('Invalid email format.');
      }
      if (email) {
        strapi.log.info('Email validation: PASSED');
      }
      
      strapi.log.info('All data format validations: PASSED');
      
      // 5. Get campaign
      let campaign = null;
      const campaignSlug = slug || 'epaper-subscribe-and-win-2025-12';
      strapi.log.info('Looking for campaign with slug:', campaignSlug);
      
      if (campaignSlug) {
        campaign = await strapi.db.query('api::campaign.campaign').findOne({
          where: { slug: campaignSlug }
        });
        
        if (campaign) {
          strapi.log.info('Campaign found:', campaign.campaignName);
          
          if (!campaign.isActive) {
            strapi.log.warn('Campaign is not active:', campaignSlug);
            return response.badRequest('This campaign is currently inactive.');
          }
          strapi.log.info('Campaign active status: PASSED');
        } else {
          strapi.log.error('Campaign not found:', campaignSlug);
          return response.badRequest(`Campaign "${campaignSlug}" not found.`);
        }
      }
      
      // 6. Check for duplicate transaction ID (promoCode)
      strapi.log.info('Checking for duplicate transaction ID...');
      const existingEntry = await strapi.db.query('api::campaign-attendence.campaign-attendence').findOne({
        where: {
          promoCode: transaction.trim()
        }
      });
      
      if (existingEntry) {
        strapi.log.warn('Duplicate transaction ID found:', transaction.trim());
        return response.badRequest('This transaction ID has already been used. Please use a different transaction ID.');
      }
      strapi.log.info('Transaction ID is unique');
      
      // 7. Prepare attendance data
      strapi.log.info('Preparing attendance data...');
      const attendenceData = {
        fullName: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        promoCode: transaction.trim(),
        uniqueSecret: transaction.trim(),
        processes: false,
        publishedAt: new Date()
      };
      
      strapi.log.info('Attendance data prepared:', JSON.stringify(attendenceData, null, 2));
      
      // 8. Create the campaign attendance entry
      strapi.log.info('Creating attendance entry...');
      const entry = await strapi.entityService.create('api::campaign-attendence.campaign-attendence', {
        data: attendenceData
      });
      
      strapi.log.info('Attendance created with ID:', entry.id);
      strapi.log.info('Entry fullName:', entry.fullName);
      strapi.log.info('Entry promoCode:', entry.promoCode);
      
      // 9. Link to campaign
      if (campaign) {
        strapi.log.info('Linking attendance to campaign...');
        await strapi.db.query('api::campaign-attendence.campaign-attendence').update({
          where: { id: entry.id },
          data: {
            campaigns: {
              connect: [{ id: campaign.id }]
            }
          }
        });
        
        strapi.log.info('Linked attendance', entry.id, 'to campaign', campaign.id);
      }
      
      // 10. Prepare success response
      strapi.log.info('Preparing success response...');
      const successResponse = {
        success: true,
        message: 'Registration successful!',
        data: {
          id: entry.id,
          name: entry.fullName,
          transactionId: entry.promoCode,
          timestamp: new Date().toISOString()
        }
      };
      
      strapi.log.info('Success response:', JSON.stringify(successResponse, null, 2));
      strapi.log.info('=== FORM SUBMISSION COMPLETE ===');
      
      // 11. Return success response
      return response.ok(successResponse);
      
    } catch (error) {
      // Log detailed error for debugging
      strapi.log.error('=== FORM SUBMISSION ERROR ===');
      strapi.log.error('Error message:', error.message);
      strapi.log.error('Error stack:', error.stack);
      strapi.log.error('Error name:', error.name);
      strapi.log.error('=== END ERROR LOG ===');
      
      // Return user-friendly error message - USE ctx.response
      return ctx.response.internalServerError('An error occurred during registration. Please try again.');
    }
  }

  ,
  
  // Optional: Add a method to verify submission
  async verifySubmission(ctx) {
    try {
      const { response } = ctx;
      const { transactionId } = ctx.params;
      
      strapi.log.info('Verifying submission for transactionId:', transactionId);
      
      if (!transactionId) {
        return response.badRequest('Transaction ID is required.');
      }
      
      const entry = await strapi.db.query('api::campaign-attendence.campaign-attendence').findOne({
        where: { promoCode: transactionId },
        populate: ['campaigns']
      });
      
      if (!entry) {
        strapi.log.info('No registration found for transactionId:', transactionId);
        return response.notFound('No registration found with this transaction ID.');
      }
      
      strapi.log.info('Verification successful for entry:', entry.id);
      
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

