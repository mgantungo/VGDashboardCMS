// src/api/vgams-user/controllers/vgams-user.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const bcrypt = require('bcryptjs');

module.exports = createCoreController('api::vgams-user.vgams-user', ({ strapi }) => ({
  async initiateLogin(ctx) {
    try {
      // For GET requests: use ctx.params
      // For POST requests: use ctx.request.body
      let email, password;
      
      if (ctx.params && ctx.params.email && ctx.params.password) {
        // GET request with URL parameters
        email = ctx.params.email;
        password = ctx.params.password;
      } else if (ctx.request.body && ctx.request.body.email && ctx.request.body.password) {
        // POST request with JSON body
        email = ctx.request.body.email;
        password = ctx.request.body.password;
      } else {
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
      console.log('🔐 Stored password hash present:', !!user.password);
      
      // Debug: Check password hash format
      if (user.password) {
        console.log('🔐 Password hash starts with:', user.password.substring(0, 10));
        console.log('🔐 Password hash length:', user.password.length);
      }
      
      // Verify password using bcrypt
      let validPassword = false;
      try {
        console.log('🔑 Comparing password with bcrypt hash...');
        
        // IMPORTANT: Check if password looks like a bcrypt hash
        // Bcrypt hashes start with $2a$, $2b$, or $2y$
        if (user.password && user.password.startsWith('$2')) {
          console.log('✅ Password appears to be a bcrypt hash');
          validPassword = await bcrypt.compare(password, user.password);
        } else {
          console.log('⚠️ Password does not appear to be hashed with bcrypt');
          console.log('⚠️ Stored password format:', user.password);
          // Try comparing anyway (might be plain text for debugging)
          validPassword = (password === user.password);
        }
        
        console.log('🔑 Password comparison result:', validPassword);
        
      } catch (bcryptError) {
        console.error('❌ Bcrypt comparison error:', bcryptError);
        console.error('❌ Error details:', bcryptError.message);
        return ctx.unauthorized('Invalid password');
      }

      if (!validPassword) {
        console.log('❌ Invalid password for:', email);
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
      
      // Create user response without password
      const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // Raw enum value
        displayRole: displayRole, // Human-readable role
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
      
      // Return user data with proper role
      return {
        success: true,
        message: 'Login successful',
        user: userResponse,
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
      
      console.log('📧 POST Login attempt for:', email);
      
      // Create a mock ctx with params for the initiateLogin method
      const mockCtx = {
        ...ctx,
        params: { email, password }
      };
      
      return await this.initiateLogin(mockCtx);
      
    } catch (error) {
      console.error('💥 POST Login error:', error);
      return ctx.internalServerError('Authentication failed');
    }
  }
}));
