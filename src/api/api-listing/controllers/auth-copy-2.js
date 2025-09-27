'use strict';

/**
 * ADFS Authentication Controller using ldapjs (lighter alternative)
 * Save this as: src/api/api-listing/controllers/auth.js
 * 
 * Install with: npm install ldapjs
 */

module.exports = {
  
  /**
   * ADFS Configuration
   */
  getAdfsConfig() {
    return {
      adfs_url: 'https://adfs.newvision.co.ug',
      ldap_host: 'newvision.co.ug',
      ldap_port: 389,
      ldap_base_dn: 'DC=adcserver4.newvision.co.ug,DC=com',
      ldap_bind_dn: 'CN=ServiceAccount,OU=Users,DC=newvision.co.ug,DC=com',
      ldap_bind_password: '"Bwalugando_4',
      ldap_timeout: 10000
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
      
      const testResult = await this.testLdapConnection(config);
      
      if (testResult.success) {
        strapi.log.info('LDAP connection test successful');
        return ctx.send({
          success: true,
          message: 'LDAP connection successful',
          server: `${config.ldap_host}:${config.ldap_port}`,
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
   * Test LDAP connection using ldapjs
   */
  async testLdapConnection(config) {
    return new Promise((resolve) => {
      try {
        const ldap = require('ldapjs');
        
        const client = ldap.createClient({
          url: `ldap://${config.ldap_host}:${config.ldap_port}`,
          timeout: config.ldap_timeout,
          connectTimeout: config.ldap_timeout,
        });

        client.on('error', (err) => {
          client.unbind();
          resolve({
            success: false,
            error: `Connection error: ${err.message}`
          });
        });

        // Test bind with service account
        client.bind(config.ldap_bind_dn, config.ldap_bind_password, (err) => {
          if (err) {
            client.unbind();
            resolve({
              success: false,
              error: `Authentication failed: ${err.message}`
            });
            return;
          }

          client.unbind();
          resolve({
            success: true,
            message: 'LDAP connection and authentication successful'
          });
        });

      } catch (error) {
        resolve({
          success: false,
          error: `Test failed: ${error.message}`
        });
      }
    });
  },

  /**
   * Authenticate with LDAP using ldapjs
   */
  async authenticateWithLdap(username, email, password) {
    return new Promise((resolve) => {
      try {
        const ldap = require('ldapjs');
        const config = this.getAdfsConfig();
        
        const client = ldap.createClient({
          url: `ldap://${config.ldap_host}:${config.ldap_port}`,
          timeout: config.ldap_timeout,
          connectTimeout: config.ldap_timeout,
        });

        client.on('error', (err) => {
          client.unbind();
          resolve({
            success: false,
            error: 'Connection error',
            code: 'CONNECTION_ERROR'
          });
        });

        // First bind with service account to search for user
        client.bind(config.ldap_bind_dn, config.ldap_bind_password, (bindErr) => {
          if (bindErr) {
            client.unbind();
            resolve({
              success: false,
              error: 'Service account authentication failed',
              code: 'SERVICE_AUTH_ERROR'
            });
            return;
          }

          // Search for the user
          const searchFilter = `(|(sAMAccountName=${username})(userPrincipalName=${email}))`;
          const searchOptions = {
            scope: 'sub',
            filter: searchFilter,
            attributes: [
              'dn', 'sAMAccountName', 'userPrincipalName', 'displayName', 
              'givenName', 'sn', 'mail', 'department', 'title', 
              'telephoneNumber', 'physicalDeliveryOfficeName', 'memberOf'
            ]
          };

          client.search(config.ldap_base_dn, searchOptions, (searchErr, searchRes) => {
            if (searchErr) {
              client.unbind();
              resolve({
                success: false,
                error: 'User search failed',
                code: 'SEARCH_ERROR'
              });
              return;
            }

            let userDn = null;
            let userData = null;

            searchRes.on('searchEntry', (entry) => {
              userDn = entry.dn.toString();
              userData = entry.pojo;
            });

            searchRes.on('error', (err) => {
              client.unbind();
              resolve({
                success: false,
                error: 'Search error',
                code: 'SEARCH_ERROR'
              });
            });

            searchRes.on('end', (result) => {
              if (!userDn) {
                client.unbind();
                resolve({
                  success: false,
                  error: 'User not found',
                  code: 'USER_NOT_FOUND'
                });
                return;
              }

              // Create new client for user authentication
              const userClient = ldap.createClient({
                url: `ldap://${config.ldap_host}:${config.ldap_port}`,
                timeout: config.ldap_timeout,
                connectTimeout: config.ldap_timeout,
              });

              // Try to bind with user credentials
              userClient.bind(userDn, password, (userBindErr) => {
                client.unbind();
                userClient.unbind();

                if (userBindErr) {
                  resolve({
                    success: false,
                    error: 'Invalid credentials',
                    code: 'INVALID_CREDENTIALS'
                  });
                  return;
                }

                // Authentication successful, extract user details
                const userDetails = this.extractUserDetailsFromLdap(userData, username, email);
                resolve({
                  success: true,
                  user: userDetails
                });
              });
            });
          });
        });

      } catch (error) {
        strapi.log.error('LDAP authentication error:', error);
        resolve({
          success: false,
          error: 'Authentication service error',
          code: 'SERVICE_ERROR'
        });
      }
    });
  },

  /**
   * Fetch user details from LDAP
   */
  async fetchUserDetails(username, config) {
    return new Promise((resolve) => {
      try {
        const ldap = require('ldapjs');
        
        const client = ldap.createClient({
          url: `ldap://${config.ldap_host}:${config.ldap_port}`,
          timeout: config.ldap_timeout,
          connectTimeout: config.ldap_timeout,
        });

        client.on('error', (err) => {
          client.unbind();
          resolve(null);
        });

        // Bind with service account
        client.bind(config.ldap_bind_dn, config.ldap_bind_password, (bindErr) => {
          if (bindErr) {
            client.unbind();
            resolve(null);
            return;
          }

          // Search for the user
          const searchFilter = `(sAMAccountName=${username})`;
          const searchOptions = {
            scope: 'sub',
            filter: searchFilter,
            attributes: [
              'sAMAccountName', 'userPrincipalName', 'displayName', 
              'givenName', 'sn', 'mail', 'department', 'title', 
              'telephoneNumber', 'physicalDeliveryOfficeName', 'memberOf'
            ]
          };

          client.search(config.ldap_base_dn, searchOptions, (searchErr, searchRes) => {
            if (searchErr) {
              client.unbind();
              resolve(null);
              return;
            }

            let userData = null;

            searchRes.on('searchEntry', (entry) => {
              userData = entry.pojo;
            });

            searchRes.on('error', (err) => {
              client.unbind();
              resolve(null);
            });

            searchRes.on('end', (result) => {
              client.unbind();
              
              if (userData) {
                const userDetails = this.extractUserDetailsFromLdap(userData, username, `${username}@newvision.co.ug`);
                resolve(userDetails);
              } else {
                resolve(null);
              }
            });
          });
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
  extractUserDetailsFromLdap(ldapData, username, email) {
    try {
      const attrs = ldapData.attributes || {};
      
      // Helper to get attribute value
      const getValue = (attrName) => {
        const attr = attrs[attrName];
        if (!attr) return null;
        return Array.isArray(attr) ? attr[0] : attr;
      };

      return {
        username: username,
        email: email,
        display_name: getValue('displayName') || getValue('cn') || username,
        first_name: getValue('givenName') || '',
        last_name: getValue('sn') || '',
        department: getValue('department') || null,
        title: getValue('title') || null,
        phone: getValue('telephoneNumber') || null,
        office: getValue('physicalDeliveryOfficeName') || null,
        groups: this.extractGroupsFromLdap(attrs['memberOf'] || []),
        last_login: new Date().toISOString(),
        dn: ldapData.dn || null
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
  extractGroupsFromLdap(memberOf) {
    if (!Array.isArray(memberOf)) {
      return [];
    }

    return memberOf.map(groupDn => {
      const match = groupDn.match(/^CN=([^,]+)/);
      return match ? match[1] : null;
    }).filter(Boolean);
  }
};
