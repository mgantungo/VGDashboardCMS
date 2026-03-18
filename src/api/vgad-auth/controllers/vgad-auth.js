'use strict';

const { validateApiKey } = require('../../../utils/auth');

const DUMMY_USERS = [
  {
    email: 'admin@test.com',
    password: 'Admin@123',
    username: 'Admin User',
    role: 'Admin',
    departments: { name: 'Finance', code: 'FIN001' },
    status: 'active',
  },
  {
    email: 'manager@test.com',
    password: 'Manager@123',
    username: 'Manager User',
    role: 'Manager',
    departments: [{ name: 'HR', code: 'HR' }],
    status: 'active',
  },
  {
    email: 'inactive@test.com',
    password: 'User@123',
    username: 'Inactive User',
    role: 'Staff',
    departments: [{ name: 'Editorial', code: 'EDT' }],
    status: 'inactive',
  },
];

module.exports = {

  // POST /api/vgad-auth/login
  async login(ctx) {
    if (!validateApiKey(ctx)) return;
    const { email, password } = ctx.request.body;

    if (!email || !password) {
      return ctx.badRequest('Email and password are required.');
    }

    const user = DUMMY_USERS.find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      return ctx.send({
        isAuthenticated: false,
        message: 'Invalid email or password.',
      }, 401);
    }

    return ctx.send({
      username: user.username,
      role: user.role,
      departments: user.departments,
      status: user.status,
      isAuthenticated: true,
    });
  },
};
