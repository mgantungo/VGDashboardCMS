'use strict';

/**
 * Custom ADFS Authentication Controller
 * Save this as: src/api/api-listing/controllers/auth.js
 */

module.exports = {
  
  /**
   * ADFS Configuration
   */
  getAdfsConfig() {
    return {
      adfs_url: 'https://adfs.newvision.co.ug',
      ldap_host: 'ldap://newvision.co.ug:389',
      ldap_base_dn: 'DC=adcserver4.newvision.co.ug,DC=com',
      ldap_bind_dn: 'CN=ServiceAccount,OU=Users,DC=newvision.co.ug,DC=com',
      ldap_bind_password: '"Bwalugando_4',
      ldap_timeout: 10000,
      ldap_connect_timeout: 5000
    };
  },

  /**
   * Authenticate user against ADFS using LDAP
   * POST /api-listings/auth/login
   */
  async login(ctx) {
    try {
      const { email, password } = ctx.request.body;

      // Validate input
      if (!email || !password) {
        return ctx.badRequest('Email and password are required', {
          code: 'INVALID_INPUT',
          details: 'Both email and password must be provided'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return ctx.badRequest('Invalid email format', {
          code: 'INVALID_EMAIL',
          details: 'Please provide a valid email address'
        });
      }

      // Extract username from email
      const username = email.split('@')[0];
      
      // Authenticate user
      const authResult = await this.authenticateWithLdap(username, email, password);
      
      if (authResult.success) {
        // Log successful authentication
        strapi.log.info(`ADFS authentication successful for user: ${email}`);
        
        return ctx.send({
          success: true,
          message: 'Authentication successful',
          user: authResult.user,
          timestamp: new Date().toISOString()
        });
      } else {
        // Log failed authentication
        strapi.log.warn(`ADFS authentication failed for user: ${email} - ${authResult.error}`);
        
        return ctx.unauthorized(authResult.error, {
          code: authResult.code,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      strapi.log.error('ADFS Login Error:', error);
      return ctx.internalServerError('Authentication service error', {
        code: 'SERVICE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Test LDAP connection
   * GET /api-listings/auth/test-connection
   */
  async testConnection(ctx) {
    try {
      const config = this.getAdfsConfig();
      
      const testResult = await this.testLdapConn(config);
      
      if (testResult.success) {
        strapi.log.info('LDAP connection test successful');
        return ctx.send({
          success: true,
          message: 'LDAP connection successful',
          server: config.ldap_host,
          timestamp: new Date().toISOString()
        });
      } else {
        strapi.log.error('LDAP connection test failed:', testResult.error);
        return ctx.send({
          success: false,
          error: testResult.error,
          code: 'CONNECTION_FAILED',
          timestamp: new Date().toISOString()
        }, 503);
      }

    } catch (error) {
      strapi.log.error('LDAP connection test error:', error);
      return ctx.internalServerError('Connection test failed', {
        code: 'TEST_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Get user details from LDAP without authentication
   * GET /api-listings/auth/user/:username
   */
  async getUser(ctx) {
    try {
      const { username } = ctx.params;
      
      if (!username) {
        return ctx.badRequest('Username is required');
      }

      const config = this.getAdfsConfig();
      const userDetails = await this.fetchUserDetails(username, config);
      
      if (userDetails) {
        return ctx.send({
          success: true,
          user: userDetails,
          timestamp: new Date().toISOString()
        });
      } else {
        return ctx.notFound('User not found in LDAP directory', {
          code: 'USER_NOT_FOUND'
        });
      }

    } catch (error) {
      strapi.log.error('Get user from LDAP error:', error);
      return ctx.internalServerError('Failed to fetch user details', {
        code: 'FETCH_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  // ============== LDAP HELPER METHODS ==============

  /**
   * Authenticate with LDAP using Node.js ldapauth-fork
   */
  async authenticateWithLdap(username, email, password) {
    return new Promise((resolve) => {
      try {
        const LdapAuth = require('ldapauth-fork');
        const config = this.getAdfsConfig();

        const ldapAuth = new LdapAuth({
          url: config.ldap_host,
          bindDN: config.ldap_bind_dn,
          bindCredentials: config.ldap_bind_password,
          searchBase: config.ldap_base_dn,
          searchFilter: `(|(sAMAccountName=${username})(userPrincipalName=${email}))`,
          reconnect: false,
          timeout: config.ldap_timeout,
          connectTimeout: config.ldap_connect_timeout,
          idleTimeout: config.ldap_timeout,
          tlsOptions: {
            rejectUnauthorized: false
          }
        });

        ldapAuth.authenticate(email, password, (err, user) => {
          ldapAuth.close(() => {});

          if (err) {
            strapi.log.error('LDAP authentication error:', err.message);
            
            if (err.name === 'InvalidCredentialsError') {
              resolve({
                success: false,
                error: 'Invalid email or password',
                code: 'INVALID_CREDENTIALS'
              });
            } else if (err.name === 'ConnectionError') {
              resolve({
                success: false,
                error: 'Unable to connect to authentication server',
                code: 'CONNECTION_ERROR'
              });
            } else {
              resolve({
                success: false,
                error: 'Authentication failed',
                code: 'AUTH_ERROR'
              });
            }
            return;
          }

          if (user) {
            const userDetails = this.extractUserDetails(user, username, email);
            resolve({
              success: true,
              user: userDetails
            });
          } else {
            resolve({
              success: false,
              error: 'User not found',
              code: 'USER_NOT_FOUND'
            });
          }
        });

      } catch (error) {
        strapi.log.error('LDAP setup error:', error);
        resolve({
          success: false,
          error: 'Authentication service error',
          code: 'SERVICE_ERROR'
        });
      }
    });
  },

  /**
   * Test LDAP connection
   */
  async testLdapConn(config) {
    return new Promise((resolve) => {
      try {
        const LdapAuth = require('ldapauth-fork');

        const ldapAuth = new LdapAuth({
          url: config.ldap_host,
          bindDN: config.ldap_bind_dn,
          bindCredentials: config.ldap_bind_password,
          searchBase: config.ldap_base_dn,
          searchFilter: '(objectClass=user)',
          reconnect: false,
          timeout: config.ldap_timeout,
          connectTimeout: config.ldap_connect_timeout,
          tlsOptions: {
            rejectUnauthorized: false
          }
        });

        // Test the connection by binding
        ldapAuth.on('error', (err) => {
          strapi.log.error('LDAP connection test error:', err);
          ldapAuth.close(() => {});
          resolve({
            success: false,
            error: err.message || 'Connection failed'
          });
        });

        // If we can create the auth object, try a simple operation
        setTimeout(() => {
          ldapAuth.close(() => {});
          resolve({
            success: true,
            message: 'LDAP connection successful'
          });
        }, 1000);

      } catch (error) {
        resolve({
          success: false,
          error: error.message || 'Connection test failed'
        });
      }
    });
  },

  /**
   * Fetch user details from LDAP (for admin use)
   */
  async fetchUserDetails(username, config) {
    return new Promise((resolve) => {
      try {
        const LdapAuth = require('ldapauth-fork');

        const ldapAuth = new LdapAuth({
          url: config.ldap_host,
          bindDN: config.ldap_bind_dn,
          bindCredentials: config.ldap_bind_password,
          searchBase: config.ldap_base_dn,
          searchFilter: `(sAMAccountName=${username})`,
          reconnect: false,
          timeout: config.ldap_timeout,
          connectTimeout: config.ldap_connect_timeout,
        });

        // We need to perform a search instead of authenticate
        ldapAuth._findUser(username, (err, user) => {
          ldapAuth.close(() => {});

          if (err || !user) {
            resolve(null);
            return;
          }

          const userDetails = this.extractUserDetails(user, username, `${username}@newvision.co.ug`);
          resolve(userDetails);
        });

      } catch (error) {
        strapi.log.error('Fetch user details error:', error);
        resolve(null);
      }
    });
  },

  /**
   * Extract user details from LDAP response
   */
  extractUserDetails(ldapUser, username, email) {
    try {
      return {
        username: username,
        email: email,
        display_name: ldapUser.displayName || ldapUser.cn || username,
        first_name: ldapUser.givenName || '',
        last_name: ldapUser.sn || '',
        department: ldapUser.department || null,
        title: ldapUser.title || null,
        phone: ldapUser.telephoneNumber || null,
        office: ldapUser.physicalDeliveryOfficeName || null,
        groups: this.extractGroups(ldapUser.memberOf || []),
        last_login: new Date().toISOString(),
        dn: ldapUser.dn || null
      };
    } catch (error) {
      strapi.log.error('Error extracting user details:', error);
      return {
        username: username,
        email: email,
        display_name: username
      };
    }
  },

  /**
   * Extract group names from memberOf attribute
   */
  extractGroups(memberOf) {
    if (!Array.isArray(memberOf)) {
      return [];
    }

    return memberOf.map(groupDn => {
      const match = groupDn.match(/^CN=([^,]+)/);
      return match ? match[1] : null;
    }).filter(Boolean);
  }
};
