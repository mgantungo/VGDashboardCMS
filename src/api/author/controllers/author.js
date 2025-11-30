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
      
      // Send email via remote service
      try {
        const emailResult = await strapi
          .service('api::author.email-service')
          .sendTokenEmail(email, token, author.display_name || author.username);
          
        if (!emailResult.success) {
          console.warn('⚠️ Email sending failed, but login process continued:', emailResult.error);
          // Continue with login process even if email fails
        } else {
          console.log('✅ Token email sent successfully via remote service');
        }
      } catch (emailError) {
        console.warn('⚠️ Email service error, but login process continued:', emailError.message);
        // Continue with login process even if email fails
      }
      
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
      
      // Send email via remote service
      try {
        const emailResult = await strapi
          .service('api::author.email-service')
          .sendTokenEmail(email, newToken, author.display_name || author.username);
          
        if (!emailResult.success) {
          console.warn('⚠️ Email sending failed during resend:', emailResult.error);
          // Still return success since token was generated
        } else {
          console.log('✅ Resend token email sent successfully via remote service');
        }
      } catch (emailError) {
        console.warn('⚠️ Email service error during resend:', emailError.message);
        // Still return success since token was generated
      }
      
      return {
        success: true,
        message: 'New verification token sent to your email',
        email: author.email
      };

    } catch (error) {
      console.error('💥 Token resend error:', error);
      return ctx.internalServerError('Failed to resend token');
    }
  },

  async testEmailService(ctx) {
    try {
      const { testEmail } = ctx.request.body;

      if (!testEmail) {
        return ctx.badRequest('testEmail is required');
      }

      console.log('🧪 Testing email service for:', testEmail);
      
      const testToken = '123456';
      const testUserName = 'Test User';
      
      const emailResult = await strapi
        .service('api::author.email-service')
        .sendTokenEmail(testEmail, testToken, testUserName);
      
      if (emailResult.success) {
        return {
          success: true,
          message: 'Test email sent successfully',
          data: emailResult
        };
      } else {
        return ctx.internalServerError('Test email failed: ' + emailResult.error);
      }

    } catch (error) {
      console.error('💥 Test email service error:', error);
      return ctx.internalServerError('Test email service failed: ' + error.message);
    }
  },

  async checkSMTPConfig(ctx) {
    try {
      console.log('🔧 Checking remote email service configuration...');
      
      // Since we're using remote service, we'll test with a simple HTTP request
      const testEmail = "test@visiongroup.co.ug";
      const testToken = "TEST123";
      const testUserName = "Test User";
      
      const emailResult = await strapi
        .service('api::author.email-service')
        .sendTokenEmail(testEmail, testToken, testUserName);
      
      if (emailResult.success) {
        return {
          success: true,
          message: 'Remote email service is operational',
          data: {
            service: 'remote_php_mailer',
            status: 'connected',
            test_result: emailResult
          }
        };
      } else {
        return {
          success: false,
          message: 'Remote email service check failed',
          error: emailResult.error
        };
      }

    } catch (error) {
      console.error('💥 SMTP config check error:', error);
      return {
        success: false,
        message: 'Failed to check remote email service',
        error: error.message
      };
    }
  },

  async getMyProfile(ctx) {
    try {
      const { id } = ctx.params;

      console.log('👤 Fetching profile for author ID:', id);
      
      const author = await strapi.db.query('api::author.author').findOne({
        where: { 
          id: id,
          accountstatus: 'active'
        },
        select: ['id', 'username', 'email', 'display_name', 'first_name', 'last_name', 'bio', 'avatar_url', 'wp_id', 'accountstatus']
      });

      if (!author) {
        return ctx.notFound('Author not found');
      }

      return {
        success: true,
        data: author
      };

    } catch (error) {
      console.error('💥 Get profile error:', error);
      return ctx.internalServerError('Failed to fetch profile');
    }
  },

  async updateProfile(ctx) {
    try {
      const { id } = ctx.params;
      const updateData = ctx.request.body;

      console.log('✏️ Updating profile for author ID:', id);
      
      // Remove fields that shouldn't be updated
      const allowedFields = ['display_name', 'first_name', 'last_name', 'bio', 'avatar_url'];
      const filteredData = {};
      
      allowedFields.forEach(field => {
        if (updateData[field] !== undefined) {
          filteredData[field] = updateData[field];
        }
      });

      if (Object.keys(filteredData).length === 0) {
        return ctx.badRequest('No valid fields to update');
      }

      const updatedAuthor = await strapi.db.query('api::author.author').update({
        where: { id: id },
        data: filteredData
      });

      if (!updatedAuthor) {
        return ctx.notFound('Author not found');
      }

      // Return updated profile (excluding sensitive data)
      const userData = {
        id: updatedAuthor.id,
        username: updatedAuthor.username,
        email: updatedAuthor.email,
        display_name: updatedAuthor.display_name,
        first_name: updatedAuthor.first_name,
        last_name: updatedAuthor.last_name,
        bio: updatedAuthor.bio,
        avatar_url: updatedAuthor.avatar_url,
        wp_id: updatedAuthor.wp_id,
        accountstatus: updatedAuthor.accountstatus
      };

      return {
        success: true,
        message: 'Profile updated successfully',
        data: userData
      };

    } catch (error) {
      console.error('💥 Update profile error:', error);
      return ctx.internalServerError('Failed to update profile');
    }
  },

  async changePassword(ctx) {
    try {
      const { id } = ctx.params;
      const { currentPassword, newPassword } = ctx.request.body;

      if (!currentPassword || !newPassword) {
        return ctx.badRequest('Current password and new password are required');
      }

      console.log('🔒 Changing password for author ID:', id);
      
      const author = await strapi.db.query('api::author.author').findOne({
        where: { id: id }
      });

      if (!author) {
        return ctx.notFound('Author not found');
      }

      // Verify current password
      const validCurrentPassword = await bcrypt.compare(currentPassword, author.password);
      if (!validCurrentPassword) {
        return ctx.unauthorized('Current password is incorrect');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await strapi.db.query('api::author.author').update({
        where: { id: id },
        data: { password: hashedNewPassword }
      });

      console.log('✅ Password changed successfully for author ID:', id);

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      console.error('💥 Change password error:', error);
      return ctx.internalServerError('Failed to change password');
    }
  },

  async forgotPassword(ctx) {
    try {
      const { email } = ctx.request.body;

      if (!email) {
        return ctx.badRequest('Email is required');
      }

      console.log('🔑 Forgot password requested for:', email);
      
      const author = await strapi.db.query('api::author.author').findOne({
        where: { 
          email: email.toLowerCase(),
          accountstatus: 'active'
        }
      });

      if (!author) {
        // For security, don't reveal if email exists or not
        console.log('📧 Password reset requested for non-existent email:', email);
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        };
      }

      // Generate reset token (valid for 1 hour)
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      await strapi.db.query('api::author.author').update({
        where: { id: author.id },
        data: { 
          resetToken: resetToken,
          resetTokenExpiry: resetTokenExpiry
        }
      });

      console.log('✅ Reset token generated for:', email);

      // TODO: Send password reset email via remote service
      // You can implement this similar to the token email

      return {
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      };

    } catch (error) {
      console.error('💥 Forgot password error:', error);
      return ctx.internalServerError('Failed to process password reset request');
    }
  },

  async resetPassword(ctx) {
    try {
      const { token, newPassword } = ctx.request.body;

      if (!token || !newPassword) {
        return ctx.badRequest('Reset token and new password are required');
      }

      console.log('🔄 Resetting password with token');
      
      const author = await strapi.db.query('api::author.author').findOne({
        where: { 
          resetToken: token,
          resetTokenExpiry: { $gt: new Date() }
        }
      });

      if (!author) {
        return ctx.unauthorized('Invalid or expired reset token');
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear reset token
      await strapi.db.query('api::author.author').update({
        where: { id: author.id },
        data: { 
          password: hashedNewPassword,
          resetToken: null,
          resetTokenExpiry: null
        }
      });

      console.log('✅ Password reset successfully for:', author.email);

      return {
        success: true,
        message: 'Password reset successfully'
      };

    } catch (error) {
      console.error('💥 Reset password error:', error);
      return ctx.internalServerError('Failed to reset password');
    }
  },

/********************************************************
 * Get posts for authenticated author with pagination
 */
  async getMyPosts(ctx) {
    try {
      const authorId = ctx.state.user.id;
      const { page, pageSize, status, publication } = ctx.params;

      const start = (parseInt(page) - 1) * parseInt(pageSize);
      
      // Build filters
      const filters = {
        authors: { id: authorId }
      };

      if (status && status !== 'null') {
        filters.publishedAt = status === 'published' ? { $notNull: true } : { $null: true };
      }

      if (publication && publication !== 'null') {
        filters.categories = {
          publications: { id: parseInt(publication) }
        };
      }

      const [posts, total] = await Promise.all([
        strapi.db.query('api::post.post').findMany({
          where: filters,
          populate: [
            'categories',
            'categories.publications', 
            'tags',
            'featured_image',
            'authors'
          ],
          limit: parseInt(pageSize),
          offset: start,
          orderBy: { createdAt: 'desc' }
        }),
        strapi.db.query('api::post.post').count({
          where: filters
        })
      ]);

      // Transform posts to match your frontend structure
      const transformedPosts = posts.map(post => ({
        id: post.id,
        title: post.title,
        status: post.publishedAt ? 'published' : 'draft',
        category: post.categories?.[0]?.id || null,
        categories: post.categories || [],
        authors: post.authors?.map(author => author.id) || [],
        authorDetails: post.authors || [],
        publishedAt: post.publishedAt || post.wp_published_at,
        live: !!post.publishedAt,
        featured: post.featured || false,
        breakingNews: post.breakingNews || false,
        breakingDuration: post.breakingDuration || null,
        premium: post.isPremium || false,
        tags: post.tags?.map(tag => tag.name) || [],
        summary: post.excerpt || '',
        content: post.content,
        featuredImage: post.featured_image ? {
          url: post.featured_image.url,
          alt: post.featured_image.alternativeText,
          caption: post.featured_image.caption,
          credit: post.featured_image.credit
        } : null,
        album: post.gallery || [],
        secondaryCategory: post.categories?.[1]?.id || null,
        publicationId: post.categories?.[0]?.publications?.[0]?.id || null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      }));

      return {
        success: true,
        data: transformedPosts,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pageCount: Math.ceil(total / parseInt(pageSize)),
          total
        }
      };

    } catch (error) {
      console.error('💥 Get my posts error:', error);
      return ctx.internalServerError('Failed to fetch posts');
    }
  },

/***********************************************
 * Get categories for authenticated author's publications - UPDATED with path params
 */
async getMyCategories(ctx) {
    try {
      const authorId = ctx.state.user.id;
      const { publication } = ctx.params;

      const author = await strapi.db.query('api::author.author').findOne({
        where: { id: authorId },
        populate: ['publications.categories']
      });

      if (!author) {
        return ctx.notFound('Author not found');
      }

      let categories = [];
      
      if (publication && publication !== 'null') {
        // Get categories for specific publication
        const pub = author.publications.find(p => p.id == parseInt(publication));
        categories = pub?.categories || [];
      } else {
        // Get all categories from all publications
        categories = author.publications.flatMap(pub => pub.categories || []);
        
        // Remove duplicates by id
        categories = categories.filter((cat, index, self) => 
          index === self.findIndex(c => c.id === cat.id)
        );
      }

      return {
        success: true,
        data: categories,
        count: categories.length
      };

    } catch (error) {
      console.error('💥 Get my categories error:', error);
      return ctx.internalServerError('Failed to fetch categories');
    }
  },

  /**
 * Get publications for authenticated author
 */
async getMyPublications(ctx) {
  try {
    // Get the authenticated author ID from the request context
    const authorId = ctx.state.user.id;

    console.log('📚 Fetching publications for author ID:', authorId);

    // Find the author with their publications populated
    const author = await strapi.db.query('api::author.author').findOne({
      where: { 
        id: authorId,
        accountstatus: 'active'
      },
      populate: {
        publications: {
          select: ['id', 'name', 'slug', 'description', 'publishedAt'],
          where: {
            publishedAt: { $notNull: true } // Only get published publications
          }
        }
      }
    });

    if (!author) {
      console.log('❌ Author not found or not active:', authorId);
      return ctx.notFound('Author not found or account is not active');
    }

    const publications = author.publications || [];

    console.log('✅ Found', publications.length, 'publications for author:', authorId);

    // Return the publications data
    return {
      success: true,
      data: publications,
      count: publications.length,
      message: publications.length > 0 
        ? 'Publications retrieved successfully' 
        : 'No publications found for this author'
    };

  } catch (error) {
    console.error('💥 Get my publications error:', error);
    
    // Return appropriate error response
    if (error.name === 'ValidationError') {
      return ctx.badRequest('Invalid request parameters');
    }
    
    return ctx.internalServerError('Failed to fetch publications. Please try again later.');
  }
}
  
}));
