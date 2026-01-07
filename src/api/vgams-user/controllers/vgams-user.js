// src/api/vgams-user/controllers/vgams-user.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const bcrypt = require('bcryptjs');

module.exports = createCoreController('api::vgams-user.vgams-user', ({ strapi }) => ({
  async initiateLogin(ctx) {
    try {
      // Get email and password from params (for GET) or body (for POST)
      const { email, password } = ctx.params || ctx.request.body;
      
      if (!email || !password) {
        return ctx.badRequest('Email and password are required');
      }
      
      console.log('🔐 VGAMS Login initiation requested for:', email);
      console.log('📧 Email:', email);
      console.log('🔑 Password provided:', '***');
      
      // Find user by email
      const user = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { 
          email: email.toLowerCase().trim()
        }
      });

      if (!user) {
        console.log('❌ VGAMS User not found:', email);
        return ctx.notFound('User not found');
      }

      console.log('✅ VGAMS User found:', user.email);
      console.log('📋 User role:', user.role);
      console.log('🔐 Stored password hash:', user.password ? '***' : 'missing');
      
      // Verify password using bcrypt
      let validPassword = false;
      try {
        console.log('🔑 Comparing password with bcrypt hash...');
        console.log('🔑 Password to check:', '***');
        console.log('🔑 Hash to check against:', user.password ? '***' : 'missing');
        
        validPassword = await bcrypt.compare(password, user.password);
        console.log('🔑 Bcrypt comparison result:', validPassword);
        
        // If bcrypt compare fails, try direct comparison (for testing)
        if (!validPassword) {
          console.log('⚠️ Trying direct comparison for debugging...');
          console.log('🔑 Provided password:', password);
          console.log('🔑 Stored password:', user.password);
          // Don't actually do direct comparison in production!
        }
      } catch (bcryptError) {
        console.error('❌ Bcrypt comparison error:', bcryptError);
        console.error('❌ Error details:', bcryptError.message);
        return ctx.unauthorized('Invalid password');
      }

      if (!validPassword) {
        console.log('❌ Invalid password for:', email);
        console.log('❌ Possible issues:');
        console.log('❌ 1. Password not hashed properly during user creation');
        console.log('❌ 2. Wrong password entered');
        console.log('❌ 3. Password hash corrupted');
        return ctx.unauthorized('Invalid password');
      }

      console.log('✅ Password verified successfully');
      
      // Map role enum values to display names
      const roleDisplayNames = {
        'booking_clerk': 'Booking Clerk',
        'sub_editor': 'Sub-Editor',
        'advertising_manager': 'Advertising Manager',
        'design_house': 'Design House',
        'finance_team': 'Finance Team',
        'administrator': 'Administrator'
      };
      
      const displayRole = roleDisplayNames[user.role] || user.role;
      
      console.log('🎯 Login successful for:', email, 'Role:', displayRole);
      
      // Return user data with proper role
      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role, // Raw enum value
          displayRole: displayRole, // Human-readable role
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        redirectTo: '/dashboard'
      };

    } catch (error) {
      console.error('💥 VGAMS Login initiation error:', error);
      console.error('💥 Error stack:', error.stack);
      return ctx.internalServerError('Authentication failed');
    }
  },

  async initiateLoginPost(ctx) {
    try {
      const { email, password } = ctx.request.body;
      
      if (!email || !password) {
        return ctx.badRequest('Email and password are required');
      }
      
      // Call the initiateLogin method with params
      return await this.initiateLogin(ctx);
      
    } catch (error) {
      console.error('💥 POST Login error:', error);
      return ctx.internalServerError('Authentication failed');
    }
  },

  // Override default find method to exclude password
  async find(ctx) {
    const { data, meta } = await super.find(ctx);
    
    // Remove password from response
    if (data && Array.isArray(data)) {
      data.forEach(item => {
        if (item.attributes && item.attributes.password) {
          delete item.attributes.password;
        }
      });
    }
    
    return { data, meta };
  },
  
  // Override default findOne method to exclude password
  async findOne(ctx) {
    const { data, meta } = await super.findOne(ctx);
    
    // Remove password from response
    if (data && data.attributes && data.attributes.password) {
      delete data.attributes.password;
    }
    
    return { data, meta };
  }
}));
