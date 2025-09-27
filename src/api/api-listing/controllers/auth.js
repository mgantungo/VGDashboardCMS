'use strict';

/**
 * Debug ADFS Authentication Controller
 * This version includes detailed logging to help troubleshoot connection issues
 * Save this as: src/api/api-listing/controllers/auth.js
 */

module.exports = {
  
  /**
   * ADFS Configuration with multiple variations to try
   */
//ldap_base_dn: 'DC=adcserver4.newvision.co.ug,DC=com'
  getAdfsConfigs() {
    const baseConfig = {
      ldap_host: 'newvision.co.ug',
      ldap_port: 636,
      ldap_base_dn: 'DC=newvision, DC=co, DC=ug',
      ldap_bind_password: '"Bwalugando_4',
      ldap_timeout: 10000
    };

    // Try different DN formats for the service account
    return [
      {
        ...baseConfig,
        name: 'Full CN with OU',
        ldap_bind_dn: 'CN=ServiceAccount,OU=Users,DC=newvision,DC=co,DC=ug'
      },
      {
        ...baseConfig,
        name: 'Full CN with corrected domain',
        ldap_bind_dn: 'CN=ServiceAccount,OU=Users,DC=adcserver4.newvision.co.ug,DC=com'
      },
      {
        ...baseConfig,
        name: 'Simple username format',
        ldap_bind_dn: 'ServiceAccount@newvision.co.ug'
      },
      {
        ...baseConfig,
        name: 'Domain\\username format',
        ldap_bind_dn: 'NEWVISION\\ServiceAccount'
      },
      {
        ...baseConfig,
        name: 'Without OU',
        ldap_bind_dn: 'CN=ServiceAccount,DC=newvision,DC=co,DC=ug'
      }
    ];
  },

  /**
   * Test LDAP connection with multiple configurations
   * GET /api-listings/auth/test-connection
   */
  async testConnection(ctx) {
    try {
      const configs = this.getAdfsConfigs();
      const results = [];

      strapi.log.info('Starting LDAP connection tests...');

      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        strapi.log.info(`Testing configuration ${i + 1}: ${config.name}`);
        strapi.log.info(`URL: ldap://${config.ldap_host}:${config.ldap_port}`);
        strapi.log.info(`Base DN: ${config.ldap_base_dn}`);
        strapi.log.info(`Bind DN: ${config.ldap_bind_dn}`);
        
        const testResult = await this.testSingleConfig(config);
        results.push({
          config: config.name,
          ...testResult
        });

        if (testResult.success) {
          strapi.log.info(`✅ Configuration ${i + 1} (${config.name}) succeeded!`);
          break; // Stop at first successful config
        } else {
          strapi.log.warn(`❌ Configuration ${i + 1} (${config.name}) failed: ${testResult.error}`);
        }
      }

      // Return detailed results
      const successfulConfig = results.find(r => r.success);
      
      if (successfulConfig) {
        return ctx.send({
          success: true,
          message: 'LDAP connection successful',
          working_config: successfulConfig,
          all_results: results,
          timestamp: new Date().toISOString()
        });
      } else {
        return ctx.send({
          success: false,
          error: 'All configurations failed',
          all_results: results,
          troubleshooting: {
            common_issues: [
              'Service account credentials may be incorrect',
              'Service account may be disabled or locked',
              'DN format may be wrong for your domain',
              'LDAP server may not be accessible from this network',
              'Firewall may be blocking port 389'
            ],
            next_steps: [
              'Verify service account exists and is enabled',
              'Try connecting from the same network as your LDAP server',
              'Check if port 389 is open',
              'Verify the exact DN format in your Active Directory'
            ]
          },
          timestamp: new Date().toISOString()
        }, 503);
      }

    } catch (error) {
      strapi.log.error('LDAP connection test error:', error);
      return ctx.internalServerError('Connection test failed', {
        code: 'TEST_ERROR',
        details: error.message
      });
    }
  },

  /**
   * Test anonymous connection (no authentication)
   * GET /api-listings/auth/test-anonymous
   */
  async testAnonymousConnection(ctx) {
    try {
      const ldap = require('ldapjs');
      
      const client = ldap.createClient({
        url: 'ldap://newvision.co.ug:389',
        timeout: 10000,
        connectTimeout: 10000,
      });

      return new Promise((resolve) => {
        let connected = false;

        client.on('connect', () => {
          strapi.log.info('✅ Anonymous LDAP connection established');
          connected = true;
          client.unbind();
          
          ctx.send({
            success: true,
            message: 'Anonymous LDAP connection successful',
            note: 'Server is reachable, authentication issue likely with credentials',
            timestamp: new Date().toISOString()
          });
          resolve();
        });

        client.on('error', (err) => {
          strapi.log.error('❌ Anonymous LDAP connection failed:', err.message);
          client.unbind();
          
          if (!connected) {
            ctx.send({
              success: false,
              error: `Connection failed: ${err.message}`,
              note: 'Server may not be reachable or LDAP service may be down',
              troubleshooting: [
                'Check if newvision.co.ug resolves to the correct IP',
                'Verify LDAP service is running on port 389',
                'Check firewall rules'
              ],
              timestamp: new Date().toISOString()
            }, 503);
            resolve();
          }
        });

        // Timeout after 15 seconds
        setTimeout(() => {
          if (!connected) {
            client.unbind();
            ctx.send({
              success: false,
              error: 'Connection timeout',
              note: 'Server may be unreachable or very slow to respond',
              timestamp: new Date().toISOString()
            }, 503);
            resolve();
          }
        }, 15000);
      });

    } catch (error) {
      strapi.log.error('Anonymous connection test error:', error);
      return ctx.internalServerError('Anonymous connection test failed', {
        details: error.message
      });
    }
  },

  /**
   * Test with manual credentials
   * POST /api-listings/auth/test-manual
   * Body: { bindDn: "CN=...", password: "..." }
   */
  async testManualCredentials(ctx) {
    try {
      const { bindDn, password } = ctx.request.body;

      if (!bindDn || !password) {
        return ctx.badRequest('bindDn and password are required');
      }

      const config = {
        ldap_host: 'newvision.co.ug',
        ldap_port: 389,
        ldap_base_dn: 'DC=adcserver4.newvision.co.ug,DC=com',
        ldap_bind_dn: bindDn,
        ldap_bind_password: password,
        ldap_timeout: 10000
      };

      const result = await this.testSingleConfig(config);

      return ctx.send({
        success: result.success,
        message: result.success ? 'Manual credentials work!' : 'Manual credentials failed',
        error: result.error,
        config_tested: {
          bindDn: bindDn,
          host: config.ldap_host,
          baseDn: config.ldap_base_dn
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      strapi.log.error('Manual credentials test error:', error);
      return ctx.internalServerError('Manual test failed', {
        details: error.message
      });
    }
  },

  // ============== HELPER METHODS ==============

  /**
   * Test a single LDAP configuration
   */
  async testSingleConfig(config) {
    return new Promise((resolve) => {
      try {
        const ldap = require('ldapjs');
        
        const client = ldap.createClient({
          url: `ldap://${config.ldap_host}:${config.ldap_port}`,
          timeout: config.ldap_timeout,
          connectTimeout: config.ldap_timeout,
        });

        let resolved = false;

        client.on('error', (err) => {
          if (!resolved) {
            resolved = true;
            client.unbind();
            resolve({
              success: false,
              error: `Connection error: ${err.message}`,
              details: {
                code: err.code,
                errno: err.errno,
                syscall: err.syscall
              }
            });
          }
        });

        // Test bind with service account
        client.bind(config.ldap_bind_dn, config.ldap_bind_password, (err) => {
          if (!resolved) {
            resolved = true;
            
            if (err) {
              client.unbind();
              resolve({
                success: false,
                error: `Authentication failed: ${err.message}`,
                ldap_error_code: err.code,
                details: {
                  name: err.name,
                  code: err.code,
                  dn: err.dn
                }
              });
              return;
            }

            // If bind successful, try a simple search to verify everything works
            const searchOptions = {
              scope: 'base',
              filter: '(objectClass=*)',
              attributes: ['dn']
            };

            client.search(config.ldap_base_dn, searchOptions, (searchErr, searchRes) => {
              client.unbind();
              
              if (searchErr) {
                resolve({
                  success: false,
                  error: `Search failed: ${searchErr.message}`,
                  note: 'Authentication worked but search failed - check base DN'
                });
                return;
              }

              resolve({
                success: true,
                message: 'LDAP connection and authentication successful',
                tested_operations: ['connect', 'bind', 'search']
              });
            });
          }
        });

        // Timeout handler
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            client.unbind();
            resolve({
              success: false,
              error: 'Connection timeout - server may be unreachable'
            });
          }
        }, config.ldap_timeout + 2000);

      } catch (error) {
        resolve({
          success: false,
          error: `Test failed: ${error.message}`
        });
      }
    });
  },

  // ============== EXISTING AUTH METHODS (simplified for debugging) ==============

  async login(ctx) {
    return ctx.send({
      success: false,
      message: 'Login disabled during debugging. Use test-connection first.',
      timestamp: new Date().toISOString()
    });
  },

  async getUser(ctx) {
    return ctx.send({
      success: false,
      message: 'Get user disabled during debugging. Use test-connection first.',
      timestamp: new Date().toISOString()
    });
  }
};
