// src/api/author/controllers/author.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

module.exports = createCoreController('api::author.author', ({ strapi }) => ({
  async initiateLogin(ctx) {
    try {
      const { email, password } = ctx.params;
      
      console.log('🔐 Login initiation requested for:', email);
      
      // Find author by email
      const author = await strapi.db.query('api::author.author').findOne({
        where: { 
          email: email.toLowerCase(),
          accountstatus: 'active'
        }
      });

      if (!author) {
        console.log('❌ Author not found:', email);
        return ctx.notFound('Author not found or account is not active');
      }

      console.log('✅ Author found:', author.email);
      
      // Verify password using bcrypt
      let validPassword = false;
      try {
        console.log('🔑 Comparing password with bcrypt hash...');
        validPassword = await bcrypt.compare(password, author.password);
        console.log('🔑 Bcrypt comparison result:', validPassword);
      } catch (bcryptError) {
        console.error('❌ Bcrypt comparison error:', bcryptError);
        return ctx.unauthorized('Invalid password');
      }

      if (!validPassword) {
        console.log('❌ Invalid password for:', email);
        return ctx.unauthorized('Invalid password');
      }

      // Generate random 8-character alphanumeric token
      const token = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      console.log('🔑 Generated token for', email, ':', token);
      
      // Update author with access token
      await strapi.db.query('api::author.author').update({
        where: { id: author.id },
        data: { 
          accessToken: token,
          tokenGeneratedAt: new Date()
        }
      });

      console.log('✅ Token saved to database');
      
      return {
        success: true,
        message: 'Verification token sent to your email',
        email: author.email,
        userId: author.id,
      };

    } catch (error) {
      console.error('💥 Login initiation error:', error);
      return ctx.internalServerError('Authentication failed');
    }
  },

  async verifyToken(ctx) {
    try {
      const { email, token } = ctx.request.body;

      console.log('🔐 Token verification for:', email, 'with token:', token);
      
      // Find author with matching email and token
      const author = await strapi.db.query('api::author.author').findOne({
        where: { 
          email: email.toLowerCase(),
          accessToken: token,
          accountstatus: 'active'
        }
      });

      if (!author) {
        console.log('❌ Invalid token for:', email);
        return ctx.unauthorized('Invalid token or email');
      }

      // Check if token is expired (15 minutes)
      if (author.tokenGeneratedAt) {
        const tokenGeneratedAt = new Date(author.tokenGeneratedAt);
        const now = new Date();
        const tokenAge = (now - tokenGeneratedAt) / (1000 * 60);

        if (tokenAge > 15) {
          console.log('❌ Token expired for:', email);
          
          await strapi.db.query('api::author.author').update({
            where: { id: author.id },
            data: { 
              accessToken: null,
              tokenGeneratedAt: null
            }
          });
          
          return ctx.unauthorized('Token has expired. Please request a new one.');
        }
      }

      // Clear the access token after successful verification
      await strapi.db.query('api::author.author').update({
        where: { id: author.id },
        data: { 
          accessToken: null,
          tokenGeneratedAt: null
        }
      });

      console.log('✅ Token verified successfully for:', email);
      
      // Return user data (excluding sensitive information)
      const userData = {
        id: author.id,
        username: author.username,
        email: author.email,
        display_name: author.display_name,
        first_name: author.first_name,
        last_name: author.last_name,
        bio: author.bio,
        avatar_url: author.avatar_url,
        wp_id: author.wp_id,
        accountstatus: author.accountstatus
      };

      return {
        success: true,
        user: userData,
        message: 'Login successful'
      };

    } catch (error) {
      console.error('💥 Token verification error:', error);
      return ctx.internalServerError('Token verification failed');
    }
  },

  async resendToken(ctx) {
    try {
      const { email } = ctx.request.body;

      console.log('🔄 Resend token requested for:', email);
      
      const author = await strapi.db.query('api::author.author').findOne({
        where: { 
          email: email.toLowerCase(),
          accountstatus: 'active'
        }
      });

      if (!author) {
        return ctx.notFound('Author not found or account is not active');
      }

      const newToken = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      await strapi.db.query('api::author.author').update({
        where: { id: author.id },
        data: { 
          accessToken: newToken,
          tokenGeneratedAt: new Date()
        }
      });

      console.log('📧 New token generated for', email, ':', newToken);
      
      return {
        success: true,
        message: 'New verification token sent to your email',
        email: author.email
      };

    } catch (error) {
      console.error('💥 Token resend error:', error);
      return ctx.internalServerError('Failed to resend token');
    }
  }
}));
