'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::systemuser.systemuser', ({ strapi }) => ({
  
  // Simple authentication method
  async authenticate(ctx) {
    try {
      console.log('=== Authentication Request ===');
      console.log('Request body:', ctx.request.body);
      
      const { username, password } = ctx.request.body;

      // Basic validation
      if (!username || !password) {
        console.log('Missing username or password');
        return ctx.badRequest('Username and password are required');
      }

      console.log('Looking for user:', username);

      // Find user by username
      const users = await strapi.entityService.findMany('api::systemuser.systemuser', {
        filters: {
          username: username
        }
      });

      console.log('Found users:', users);

      if (!users || users.length === 0) {
        console.log('No user found');
        return ctx.badRequest('User not found');
      }

      const user = users[0];
      console.log('User found:', { id: user.id, username: user.username, is_active: user.is_active });

      // Check if user is active
      if (!user.is_active) {
        console.log('User is not active');
        return ctx.badRequest('User account is inactive');
      }

      // Simple password check (plain text for now)
      console.log('Checking password...');
      console.log('Stored password:', user.userpass);
      console.log('Provided password:', password);

      if (user.userpass !== password) {
        console.log('Password does not match');
        return ctx.badRequest('Invalid password');
      }

      console.log('Authentication successful!');

      // Return success
      return ctx.send({
        success: true,
        message: 'Authentication successful',
        user: {
          id: user.id,
          username: user.username,
          is_active: user.is_active
        }
      });

    } catch (error) {
      console.error('Authentication error:', error);
      return ctx.internalServerError('Authentication failed');
    }
  },

  // Override find to exclude passwords
  async find(ctx) {
    try {
      console.log('=== Find Users Request ===');
      
      const users = await strapi.entityService.findMany('api::systemuser.systemuser', {
        fields: ['id', 'username', 'is_active', 'createdAt', 'updatedAt']
      });

      console.log('Found users:', users);

      return ctx.send({
        data: users
      });

    } catch (error) {
      console.error('Find users error:', error);
      return ctx.internalServerError('Failed to fetch users');
    }
  },

  // Override create to handle password
  async create(ctx) {
    try {
      console.log('=== Create User Request ===');
      console.log('Request body:', ctx.request.body);

      const { data } = ctx.request.body;

      if (!data) {
        return ctx.badRequest('Data is required');
      }

      // Validate required fields
      if (!data.username || !data.userpass) {
        return ctx.badRequest('Username and password are required');
      }

      // Check if username already exists
      const existingUsers = await strapi.entityService.findMany('api::systemuser.systemuser', {
        filters: {
          username: data.username
        }
      });

      if (existingUsers && existingUsers.length > 0) {
        return ctx.badRequest('Username already exists');
      }

      // Create user
      const newUser = await strapi.entityService.create('api::systemuser.systemuser', {
        data: {
          username: data.username,
          userpass: data.userpass, // Plain text for now
          is_active: data.is_active !== undefined ? data.is_active : true
        }
      });

      console.log('User created:', newUser);

      // Return user without password
      return ctx.send({
        data: {
          id: newUser.id,
          username: newUser.username,
          is_active: newUser.is_active,
          createdAt: newUser.createdAt,
          updatedAt: newUser.updatedAt
        }
      });

    } catch (error) {
      console.error('Create user error:', error);
      return ctx.internalServerError('Failed to create user');
    }
  },
async checkUsername(ctx) {
  try {
    const { username } = ctx.request.body;

    if (!username) {
      return ctx.badRequest('Username is required');
    }

    const users = await strapi.entityService.findMany('api::systemuser.systemuser', {
      filters: {
        username: username
      }
    });

    ctx.send({
      exists: users && users.length > 0,
      isActive: users && users.length > 0 ? users[0].is_active : false
    });

  } catch (error) {
    strapi.log.error('Check username error:', error);
    return ctx.internalServerError('Failed to check username');
  }
}

}));
