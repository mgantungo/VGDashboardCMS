// src/services/email-service.js
'use strict';

const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    this.transporter = nodemailer.createTransport({
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      requireTLS: true,
      auth: {
        user: "notifications@visiongroup.co.ug",
        pass: "Note09876"
      },
      // Anti-spam measures
      logger: false,
      debug: false
    });

    // Verify connection configuration
    this.transporter.verify()
      .then(() => {
        strapi.log.info('Email transporter is ready');
      })
      .catch((error) => {
        strapi.log.error('Email transporter failed:', error);
      });
  }

  async sendTokenEmail(toEmail, token, userName) {
    try {
      const subject = 'Your New Vision Editor Verification Code';
      
      const htmlBody = this.generateTokenEmailHTML(userName, token);
      const textBody = this.generateTokenEmailText(userName, token);

      const mailOptions = {
        from: {
          name: 'Vision Group',
          address: 'notifications@visiongroup.co.ug'
        },
        to: toEmail,
        replyTo: 'notifications@visiongroup.co.ug',
        subject: subject,
        html: htmlBody,
        text: textBody,
        // Anti-spam headers
        headers: {
          'Precedence': 'bulk',
          'List-Unsubscribe': '<mailto:notifications@visiongroup.co.ug>',
          'X-Mailer': ' ' // Hide mailer version
        }
      };

      strapi.log.info(`Sending verification token to: ${toEmail}`);
      
      const result = await this.transporter.sendMail(mailOptions);
      
      strapi.log.info(`Token email sent successfully to ${toEmail}. Message ID: ${result.messageId}`);
      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };

    } catch (error) {
      strapi.log.error('Failed to send token email:', error);
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

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
            background: #3b82f6;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 10px 0;
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
  }

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
  }

  // Method to send general notifications (optional)
  async sendNotificationEmail(toEmail, subject, message, userName = '') {
    try {
      const mailOptions = {
        from: {
          name: 'Vision Group',
          address: 'notifications@visiongroup.co.ug'
        },
        to: toEmail,
        replyTo: 'notifications@visiongroup.co.ug',
        subject: subject,
        html: this.generateNotificationEmailHTML(userName, subject, message),
        text: this.generateNotificationEmailText(userName, subject, message),
        headers: {
          'Precedence': 'bulk',
          'List-Unsubscribe': '<mailto:notifications@visiongroup.co.ug>',
          'X-Mailer': ' '
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      strapi.log.info(`Notification email sent to ${toEmail}. Message ID: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      strapi.log.error('Failed to send notification email:', error);
      throw error;
    }
  }

  generateNotificationEmailHTML(userName, subject, message) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>New Vision Editor</h1>
            <h2>${subject}</h2>
        </div>
        <div class="content">
            <p>Hello ${userName || 'there'},</p>
            <p>${message}</p>
            <p>Best regards,<br><strong>Vision Group Team</strong></p>
        </div>
        <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  generateNotificationEmailText(userName, subject, message) {
    return `
NEW VISION EDITOR - ${subject}

Hello ${userName || 'there'},

${message}

Best regards,
Vision Group Team

---
This is an automated message. Please do not reply to this email.
    `;
  }
}

module.exports = new EmailService();
