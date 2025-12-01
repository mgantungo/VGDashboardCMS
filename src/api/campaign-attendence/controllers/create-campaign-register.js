'use strict';
module.exports = {

   async getEpaperCampaign(ctx) {
    try {
      const { request, response } = ctx;
      
      // 1. Check if request is coming from allowed origin
      const referer = request.headers.referer || request.headers.origin;
      const allowedOrigin = 'https://epapers.visiongroup.co.ug';
      
      if (!referer || !referer.includes(allowedOrigin)) {
        return response.forbidden('Access denied. Please submit from the official website.');
      }
      
      // 2. Validate required fields
      const { name, phone, email, transaction } = request.body;
      
      if (!name || !phone || !transaction) {
        return response.badRequest('Name, phone, and transaction ID are required.');
      }
      
      // 3. Validate data formats
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
      
      // 4. Check for duplicate entries (optional, based on your business logic)
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
        // You can modify this based on your needs - either update or reject
        return response.badRequest('An entry with these details already exists.');
      }
      
      // 5. Generate unique secret (same as promoCode as per requirement)
      const uniqueSecret = transaction.trim(); // Using transaction as both promoCode and uniqueSecret
      
      // 6. Create the entry
      const entry = await strapi.entityService.create('api::campaign-attendence.campaign-attendence', {
        data: {
          fullName: name.trim(),
          phone: phone.trim(),
          email: email ? email.trim() : null,
          promoCode: uniqueSecret,
          uniqueSecret: uniqueSecret,
          processes: false, // Default as per schema
          publishedAt: new Date()
        }
      });
      
      // 7. Return confirmation response
      return response.ok({
        success: true,
        message: 'Registration successful!',
        data: {
          id: entry.id,
          name: entry.fullName,
          transactionId: entry.promoCode,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      return response.internalServerError('An error occurred during registration. Please try again.');
    }
  }

}
