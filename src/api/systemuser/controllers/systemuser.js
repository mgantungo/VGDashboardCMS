'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::systemuser.systemuser', ({ strapi }) => ({
  
  // Main authentication function (adapted from your working Strapi 4 code)
  async authenticate(ctx) {
    try {
      const { username, password } = ctx.request.body;
      
      // Input validation
      if (!username || !password) {
        return ctx.badRequest('Username and password are required');
      }
      
      console.log('=== Authentication Request ===');
      console.log('Looking for user:', username);
      
      // Find the user using strapi query builder (same as your working code)
      const user = await strapi.db.query('api::systemuser.systemuser').findOne({
        where: { 
          username: username,
          is_active: true  // Note: using is_active instead of isActive
        }
      });
      
      // Check if user exists
      if (!user) {
        console.log('User not found or inactive');
        return ctx.badRequest('Invalid credentials');
      }
      
      console.log('Found user:', {
        id: user.id,
        username: user.username,
        passwordHash: user.userpass ? user.userpass.substring(0, 10) + '...' : 'undefined',
        is_active: user.is_active
      });
      
      // Check if password field exists
      if (!user.userpass) {
        console.log('No password set for user');
        return ctx.badRequest('Invalid credentials');
      }
      
      // Compare password using Strapi admin auth service (same as your working code)
      let validPassword = false;
      
      try {
        validPassword = await strapi.admin.services.auth.validatePassword(
          password,
          user.userpass
        );
        console.log('Strapi admin auth validation result:', validPassword);
      } catch (authError) {
        console.log('Strapi admin auth failed, trying direct comparison:', authError.message);
        // Fallback to direct comparison for plain text passwords
        validPassword = (user.userpass === password);
        console.log('Direct comparison result:', validPassword);
      }
      
      if (!validPassword) {
        console.log('Password validation failed');
        return ctx.badRequest('Invalid credentials');
      }
      
      console.log('Password validation succeeded');
      
      // Generate JWT token for authentication (same as your working code)
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          // Add any other fields you need in the token
        },
        process.env.JWT_SECRET || 'your-jwt-secret',
        { expiresIn: '1d' }
      );
      
      // Return success response with user data and token (same structure as your working code)
      return ctx.send({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          is_active: user.is_active
        },
        message: 'Authentication successful'
      });
      
    } catch (err) {
      console.error('Authentication error:', err);
      return ctx.badRequest('An error occurred during authentication: ' + err.message);
    }
  },
  
  // Token verification function (adapted from your working code)
  async verifyToken(ctx) {
    try {
      // Get token from Authorization header
      const token = ctx.request.header.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return ctx.badRequest('Authorization header is required');
      }
      
      // Verify token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
      
      // Get user from database
      const user = await strapi.db.query('api::systemuser.systemuser').findOne({
        where: { id: decoded.id, is_active: true }
      });
      
      if (!user) {
        return ctx.badRequest('Invalid token');
      }
      
      // Return user data
      return ctx.send({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          is_active: user.is_active
        }
      });
    } catch (err) {
      console.error('Token verification error:', err);
      return ctx.badRequest('Invalid token');
    }
  },
  
  // Get current user function (adapted from your working code)
  async me(ctx) {
    try {
      // Get token from Authorization header
      const token = ctx.request.header.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return ctx.badRequest('Authorization header is required');
      }
      
      // Verify token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
      
      // Get user from database
      const user = await strapi.db.query('api::systemuser.systemuser').findOne({
        where: { id: decoded.id, is_active: true }
      });
      
      if (!user) {
        return ctx.badRequest('Invalid token');
      }
      
      // Return user data (same structure as your working code)
      return ctx.send({
        id: user.id,
        username: user.username,
        is_active: user.is_active
      });
    } catch (err) {
      console.error('Get user profile error:', err);
      return ctx.badRequest('Invalid token');
    }
  },

  // Debug method to check what's in the database
  async debugUser(ctx) {
    try {
      const username = ctx.query.username || ctx.request.body.username;
      
      if (!username) {
        return ctx.badRequest('Username is required as query parameter or in body');
      }

      console.log('=== Debug User Data ===');
      console.log('Looking for username:', username);

      // Get user data
      const user = await strapi.db.query('api::systemuser.systemuser').findOne({
        where: { username: username }
      });

      console.log('Raw user data from database:', user);

      if (!user) {
        return ctx.send({
          message: 'User not found',
          username: username
        });
      }

      // Return all user data (including password for debugging)
      return ctx.send({
        message: 'User found',
        user: {
          id: user.id,
          username: user.username,
          userpass: user.userpass,
          userpass_length: user.userpass ? user.userpass.length : 0,
          userpass_type: typeof user.userpass,
          is_active: user.is_active,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });

    } catch (error) {
      console.error('Debug error:', error);
      return ctx.internalServerError('Debug failed: ' + error.message);
    }
  },

  // Simple method to set/update password
  async setPassword(ctx) {
    try {
      const { userId, password } = ctx.request.body;
      
      if (!userId || !password) {
        return ctx.badRequest('userId and password are required');
      }

      console.log('Setting password for user ID:', userId);

      // Update the password
      const updatedUser = await strapi.db.query('api::systemuser.systemuser').update({
        where: { id: userId },
        data: { userpass: password }
      });

      console.log('Password updated successfully');

      return ctx.send({
        success: true,
        message: 'Password set successfully',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          is_active: updatedUser.is_active
        }
      });

    } catch (error) {
      console.error('Set password error:', error);
      return ctx.internalServerError('Failed to set password: ' + error.message);
    }
  },

  // Helper method to hash password when creating/updating users
  async create(ctx) {
    try {
      const { data } = ctx.request.body;

      if (!data) {
        return ctx.badRequest('Data is required');
      }

      // Hash password if provided using Strapi admin auth service
      if (data.userpass) {
        try {
          data.userpass = await strapi.admin.services.auth.hashPassword(data.userpass);
          console.log('Password hashed successfully');
        } catch (hashError) {
          console.log('Password hashing failed, storing as plain text:', hashError.message);
          // Keep original password if hashing fails
        }
      }

      // Call the default create method
      const response = await super.create(ctx);
      
      // Remove password from response
      if (response.data && response.data.userpass) {
        delete response.data.userpass;
      }

      return response;

    } catch (error) {
      console.error('Create user error:', error);
      return ctx.badRequest('Failed to create user');
    }
  },

  // Helper method to update password
  async update(ctx) {
    try {
      const { data } = ctx.request.body;

      // Hash password if provided using Strapi admin auth service
      if (data && data.userpass) {
        try {
          data.userpass = await strapi.admin.services.auth.hashPassword(data.userpass);
          console.log('Password hashed successfully for update');
        } catch (hashError) {
          console.log('Password hashing failed during update, storing as plain text:', hashError.message);
          // Keep original password if hashing fails
        }
      }

      // Call the default update method
      const response = await super.update(ctx);
      
      // Remove password from response
      if (response.data && response.data.userpass) {
        delete response.data.userpass;
      }

      return response;

    } catch (error) {
      console.error('Update user error:', error);
      return ctx.badRequest('Failed to update user');
    }
  }

}));
