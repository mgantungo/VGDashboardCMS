// src/api/vgams-user/controllers/vgams-user.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const bcrypt = require('bcryptjs');

module.exports = createCoreController('api::vgams-user.vgams-user', ({ strapi }) => ({
  async initiateLogin(ctx) {
    try {
      const { email, password } = ctx.params;
      
      console.log('🔐 VGAMS Login initiation requested for:', email);
      
      // Find user by email
      const user = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { 
          email: email.toLowerCase()
        }
      });

      if (!user) {
        console.log('❌ VGAMS User not found:', email);
        return ctx.send({ 
          error: 'User not found' 
        }, 404);
      }

      console.log('✅ VGAMS User found:', user.email);
      console.log('📋 User role:', user.role);
      
      // Verify password using bcrypt
      let validPassword = false;
      try {
        console.log('🔑 Comparing password with bcrypt hash...');
        validPassword = await bcrypt.compare(password, user.password);
        console.log('🔑 Bcrypt comparison result:', validPassword);
      } catch (bcryptError) {
        console.error('❌ Bcrypt comparison error:', bcryptError);
        return ctx.send({ 
          error: 'Invalid password' 
        }, 401);
      }

      if (!validPassword) {
        console.log('❌ Invalid password for:', email);
        return ctx.send({ 
          error: 'Invalid password' 
        }, 401);
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
      return ctx.send({
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
      }, 200);

    } catch (error) {
      console.error('💥 VGAMS Login initiation error:', error);
      return ctx.send({ 
        error: 'Authentication failed',
        details: error.message
      }, 500);
    }
  },

  async initiateLoginPost(ctx) {
    try {
      const { email, password } = ctx.request.body;
      
      if (!email || !password) {
        return ctx.send({ 
          error: 'Email and password are required' 
        }, 400);
      }
      
      // Reuse the same login logic but with body params
      return await this.initiateLogin({
        ...ctx,
        params: { email, password }
      });
      
    } catch (error) {
      console.error('💥 POST Login error:', error);
      return ctx.send({ 
        error: 'Authentication failed',
        details: error.message
      }, 500);
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
  },
  
  // Optional: Custom method to get user by role
  async findByRole(ctx) {
    try {
      const { role } = ctx.params;
      
      const users = await strapi.db.query('api::vgams-user.vgams-user').findMany({
        where: { role },
        select: ['id', 'name', 'email', 'role', 'createdAt']
      });
      
      return ctx.send(users, 200);
    } catch (error) {
      console.error('Error fetching users by role:', error);
      return ctx.send({ 
        error: 'Failed to fetch users',
        details: error.message
      }, 500);
    }
  }
}));
