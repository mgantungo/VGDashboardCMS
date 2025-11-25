// src/api/author/services/email-service.js
'use strict';

const RemoteMailSender = require('./remote-mail-sender')();

module.exports = ({ strapi }) => ({
  async sendTokenEmail(toEmail, token, userName) {
    try {
      strapi.log.info(`📧 Sending token email via remote service to: ${toEmail}`);
      
      const result = await RemoteMailSender.sendTokenEmail(toEmail, token, userName);
      
      if (result.success) {
        strapi.log.info(`✅ Token email queued successfully for ${toEmail}`);
        strapi.log.info(`🔗 Remote response: ${JSON.stringify(result.remote_response)}`);
        
        return {
          success: true,
          message: 'Verification token email sent successfully',
          email: toEmail,
          remoteResponse: result.remote_response
        };
      } else {
        strapi.log.error(`❌ Failed to queue token email for ${toEmail}: ${result.error}`);
        return {
          success: false,
          error: result.error,
          message: 'Failed to send verification token email',
          email: toEmail
        };
      }

    } catch (error) {
      strapi.log.error('💥 Error in remote email service:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to communicate with remote email service',
        email: toEmail
      };
    }
  },

  async sendBulkNewsletter(newsletterData) {
    try {
      strapi.log.info('📧 Sending newsletter via remote service');
      
      const result = await RemoteMailSender.sendBulkNewsletter(newsletterData);
      
      if (result.success) {
        strapi.log.info('✅ Newsletter queued successfully via remote service');
        strapi.log.info(`🔗 Remote response: ${JSON.stringify(result.remote_response)}`);
        
        return {
          success: true,
          message: 'Newsletter sent successfully',
          remoteResponse: result.remote_response
        };
      } else {
        strapi.log.error(`❌ Failed to queue newsletter: ${result.error}`);
        return {
          success: false,
          error: result.error,
          message: 'Failed to send newsletter'
        };
      }

    } catch (error) {
      strapi.log.error('💥 Error in remote newsletter service:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to communicate with remote email service'
      };
    }
  },

  async testRemoteConnection() {
    try {
      strapi.log.info('🔧 Testing remote email service connection...');
      
      const testData = {
        type: 'verification_token',
        to_email: 'test@visiongroup.co.ug',
        token: 'TEST123',
        user_name: 'Test User',
        subject: 'Test Connection - New Vision Editor',
        timestamp: new Date().toISOString()
      };

      const result = await RemoteMailSender.sendToRemoteMailer(testData);
      
      strapi.log.info('✅ Remote email service connection test completed');
      
      return {
        success: true,
        message: 'Remote email service is reachable',
        remoteResponse: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      strapi.log.error('❌ Remote email service connection test failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'Remote email service is not reachable',
        timestamp: new Date().toISOString()
      };
    }
  },

  generateTokenEmailHTML(userName, token) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Code - New Vision Editor</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
        }
        .content {
            padding: 40px;
        }
        .token-display {
            background: #f8f9fa;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
            font-family: 'Courier New', monospace;
        }
        .token-code {
            font-size: 32px;
            font-weight: bold;
            color: #3b82f6;
            letter-spacing: 8px;
            margin: 10px 0;
        }
        .expiry-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin: 10px 0;
        }
        @media only screen and (max-width: 600px) {
            .content {
                padding: 20px;
            }
            .token-code {
                font-size: 24px;
                letter-spacing: 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Vision Editor</h1>
        </div>
        <div class="content">
            <h2>Verification Code Required</h2>
            <p>Hello ${userName || 'there'},</p>
            <p>You're attempting to sign in to the New Vision Editor. Please use the following verification code to complete your login:</p>
            
            <div class="token-display">
                <div class="token-code">${token}</div>
                <p style="margin: 0; color: #6c757d;">Enter this code in the verification field</p>
            </div>
            
            <div class="expiry-notice">
                <strong>⚠️ Important:</strong> This code will expire in 15 minutes for security reasons.
            </div>
            
            <p>If you didn't request this code, please ignore this email or contact our support team immediately.</p>
            
            <p>Best regards,<br>
            <strong>Vision Group Team</strong></p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>Vision Group &copy; ${new Date().getFullYear()}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  },

  generateTokenEmailText(userName, token) {
    return `
NEW VISION EDITOR - VERIFICATION CODE

Hello ${userName || 'there'},

You're attempting to sign in to the New Vision Editor. Please use the following verification code to complete your login:

VERIFICATION CODE: ${token}

This code will expire in 15 minutes for security reasons.

If you didn't request this code, please ignore this email or contact our support team immediately.

Best regards,
Vision Group Team

---
This is an automated message. Please do not reply to this email.
Vision Group © ${new Date().getFullYear()}. All rights reserved.
    `;
  },

  generatePasswordResetHTML(userName, resetLink) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset - New Vision Editor</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
        }
        .content {
            padding: 40px;
        }
        .reset-button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .expiry-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 12px;
            margin: 20px 0;
            font-size: 14px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #dee2e6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Vision Editor</h1>
        </div>
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello ${userName || 'there'},</p>
            <p>You have requested to reset your password for the New Vision Editor. Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
                <a href="${resetLink}" class="reset-button">Reset Your Password</a>
            </div>
            
            <div class="expiry-notice">
                <strong>⚠️ Important:</strong> This password reset link will expire in 1 hour for security reasons.
            </div>
            
            <p>If you didn't request a password reset, please ignore this email or contact our support team immediately.</p>
            
            <p>Best regards,<br>
            <strong>Vision Group Team</strong></p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>Vision Group &copy; ${new Date().getFullYear()}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  },

  generatePasswordResetText(userName, resetLink) {
    return `
NEW VISION EDITOR - PASSWORD RESET

Hello ${userName || 'there'},

You have requested to reset your password for the New Vision Editor. Use the link below to create a new password:

RESET LINK: ${resetLink}

This password reset link will expire in 1 hour for security reasons.

If you didn't request a password reset, please ignore this email or contact our support team immediately.

Best regards,
Vision Group Team

---
This is an automated message. Please do not reply to this email.
Vision Group © ${new Date().getFullYear()}. All rights reserved.
    `;
  },

  async sendPasswordResetEmail(toEmail, resetToken, userName) {
    try {
      strapi.log.info(`📧 Sending password reset email via remote service to: ${toEmail}`);
      
      // Generate reset link (you'll need to set up the frontend route for this)
      const resetLink = `https://editor.visiongroup.co.ug/reset-password?token=${resetToken}`;
      
      const emailData = {
        type: 'password_reset',
        to_email: toEmail,
        user_name: userName,
        reset_link: resetLink,
        subject: 'Password Reset Request - New Vision Editor',
        timestamp: new Date().toISOString()
      };

      const result = await RemoteMailSender.sendToRemoteMailer(emailData);
      
      if (result && result.success) {
        strapi.log.info(`✅ Password reset email queued successfully for ${toEmail}`);
        return {
          success: true,
          message: 'Password reset email sent successfully',
          email: toEmail,
          remoteResponse: result
        };
      } else {
        strapi.log.error(`❌ Failed to queue password reset email for ${toEmail}`);
        return {
          success: false,
          error: result?.error || 'Unknown error from remote service',
          message: 'Failed to send password reset email',
          email: toEmail
        };
      }

    } catch (error) {
      strapi.log.error('💥 Error sending password reset email:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to communicate with remote email service',
        email: toEmail
      };
    }
  },

  async sendWelcomeEmail(toEmail, userName) {
    try {
      strapi.log.info(`📧 Sending welcome email via remote service to: ${toEmail}`);
      
      const emailData = {
        type: 'welcome',
        to_email: toEmail,
        user_name: userName,
        subject: 'Welcome to New Vision Editor',
        timestamp: new Date().toISOString()
      };

      const result = await RemoteMailSender.sendToRemoteMailer(emailData);
      
      if (result && result.success) {
        strapi.log.info(`✅ Welcome email queued successfully for ${toEmail}`);
        return {
          success: true,
          message: 'Welcome email sent successfully',
          email: toEmail,
          remoteResponse: result
        };
      } else {
        strapi.log.error(`❌ Failed to queue welcome email for ${toEmail}`);
        return {
          success: false,
          error: result?.error || 'Unknown error from remote service',
          message: 'Failed to send welcome email',
          email: toEmail
        };
      }

    } catch (error) {
      strapi.log.error('💥 Error sending welcome email:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to communicate with remote email service',
        email: toEmail
      };
    }
  },

  // Method to get email service status
  async getServiceStatus() {
    try {
      const connectionTest = await this.testRemoteConnection();
      
      return {
        service: 'remote_php_mailer',
        status: connectionTest.success ? 'operational' : 'degraded',
        remoteUrl: 'https://hr.visiongroup.co.ug/apis/mail-panel-api/strapi-mail-receiver.php',
        lastTest: new Date().toISOString(),
        connectionTest: connectionTest
      };
    } catch (error) {
      return {
        service: 'remote_php_mailer',
        status: 'offline',
        remoteUrl: 'https://hr.visiongroup.co.ug/apis/mail-panel-api/strapi-mail-receiver.php',
        lastTest: new Date().toISOString(),
        error: error.message
      };
    }
  }
});
