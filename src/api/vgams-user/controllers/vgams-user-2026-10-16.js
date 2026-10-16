// src/api/vgams-user/controllers/vgams-user.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const https = require('https');
const url   = require('url');

const AD_AUTH_URL = 'https://vg-one-id-auth.newvision.co.ug/api/auth/login';
const SERVICE_KEY = 'ee222c03986f8323764f8f47ae4c37634d55e5cc89bd541a14fb05343ff565e6';

// ── HTTPS helper ──────────────────────────────────────────────────────────────
function makeHttpsRequest(urlString, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(urlString);
    const postData  = JSON.stringify(data);

    const options = {
      hostname:           parsedUrl.hostname,
      port:               parsedUrl.port || 443,
      path:               parsedUrl.path,
      method:             'POST',
      headers: {
        'Content-Type':   'application/json',
        'X-Dev-Key':      SERVICE_KEY,
        'Content-Length': Buffer.byteLength(postData),
      },
      rejectUnauthorized: false,
      timeout:            10000,
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data',  chunk => { responseData += chunk; });
      res.on('end', () => {
        try   { resolve(JSON.parse(responseData)); }
        catch { reject(new Error('Failed to parse response JSON')); }
      });
    });

    req.on('error',   err => reject(err));
    req.on('timeout', ()  => { req.destroy(); reject(new Error('Request timeout')); });

    req.write(postData);
    req.end();
  });
}

// ── Shared AD authentication step ─────────────────────────────────────────────
async function authenticateWithAD(email, password) {
  const adResponse = await makeHttpsRequest(AD_AUTH_URL, { email, password });

  if (adResponse?.authenticated !== true || adResponse?.status !== 'SUCCESS') {
    const messages = {
      INVALID_CREDENTIALS: 'Incorrect password.',
      USER_NOT_FOUND:      'No Active Directory account found for this email.',
      ACCOUNT_DISABLED:    'Your Active Directory account has been disabled. Contact your administrator.',
      ACCOUNT_LOCKED:      'Your Active Directory account is locked. Contact your administrator.',
      SERVICE_UNAVAILABLE: 'Authentication service temporarily unavailable.',
    };
    const reason = messages[adResponse?.status] || adResponse?.message || 'Authentication failed.';
    throw Object.assign(new Error(reason), { adStatus: adResponse?.status });
  }

  return adResponse;
}

// ── Admin-management guard ─────────────────────────────────────────────────────
// Every /vgams-users/admin/* endpoint requires the caller to identify
// themselves via `adminEmail` (body or `x-admin-email` header). We look that
// account up and confirm it is an active administrator before allowing the
// action. This mirrors the existing SFA branch's "confirm active salesperson"
// pattern — there is no Strapi JWT in play here, so this check IS the guard.
async function requireAdmin(ctx) {
  const adminEmail = (
    ctx.request.body?.adminEmail ||
    ctx.request.query?.adminEmail ||
    ctx.request.header['x-admin-email'] ||
    ''
  ).toLowerCase().trim();

  if (!adminEmail) {
    ctx.forbidden('Administrator email is required to perform this action.');
    return null;
  }

  const admin = await strapi.db.query('api::vgams-user.vgams-user').findOne({
    where: { email: adminEmail },
  });

  if (!admin || admin.role !== 'administrator' || !admin.isActive) {
    ctx.forbidden('This action requires an active administrator account.');
    return null;
  }

  return admin;
}

const VALID_ROLES = [
  'booking_clerk', 'sub_editor', 'advertising_manager', 'design_house',
  'finance_team', 'administrator', 'sales_team', 'hr_team',
];

// Accounts that cannot be edited or deleted through the admin User
// Management UI, regardless of who is asking. This is the real
// enforcement — the frontend disabling the buttons is just UX.
const PROTECTED_EMAILS = [
  'vmujuzi@newvision.co.ug',
  'fssembajjwe@newvision.co.ug',
  'pikanza@newvision.co.ug',
];

// ── Controller ────────────────────────────────────────────────────────────────
module.exports = createCoreController('api::vgams-user.vgams-user', ({ strapi }) => ({

  // ── GET login — UNCHANGED ─────────────────────────────────────────────────
  async initiateLogin(ctx) {
    try {
      const email    = (ctx.params?.email    || ctx.request.body?.email    || '').toLowerCase().trim();
      const password =  ctx.params?.password || ctx.request.body?.password || '';

      if (!email || !password) return ctx.badRequest('Email and password are required');

      if (!['newvision.co.ug'].includes(email.split('@')[1])) {
        return ctx.unauthorized('Only company email addresses are permitted.');
      }

      const user = await strapi.db.query('api::vgams-user.vgams-user').findOne({ where: { email } });
      if (!user) return ctx.notFound('No VGAMS account found for this email address.');

      let adResponse;
      try { adResponse = await authenticateWithAD(email, password); }
      catch (e) { return ctx.unauthorized(e.message); }

      const roleDisplayNames = {
        booking_clerk: 'Booking Clerk', sub_editor: 'Sub-Editor',
        advertising_manager: 'Advertising Manager', design_house: 'Design House',
        finance_team: 'Finance Team', administrator: 'Administrator',
      };
      const roleRedirects = {
        booking_clerk: '/dashboard/booking', sub_editor: '/dashboard/review',
        design_house: '/dashboard/design', finance_team: '/dashboard/finance',
        advertising_manager: '/dashboard/approval', administrator: '/dashboard/admin',
      };
      const adUser = adResponse.user ?? {};

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id, name: user.name, email: user.email,
          role: user.role, displayRole: roleDisplayNames[user.role] || user.role,
          createdAt: user.createdAt, updatedAt: user.updatedAt,
          adProfile: {
            displayName:   adUser.displayName   ?? null,
            department:    adUser.department    ?? null,
            jobTitle:      adUser.jobTitle      ?? null,
            phone:         adUser.phone         ?? null,
            accountActive: adUser.accountStatus?.active ?? null,
          },
        },
        redirectTo: roleRedirects[user.role] || '/dashboard',
      };

    } catch (error) {
      console.error('💥 VGAMS Login error:', error);
      return ctx.internalServerError('Authentication failed');
    }
  },

  // ── POST login — standard, SFA, and article-analytics ────────────────────
  async initiateLoginPost(ctx) {
    try {
      const { email: rawEmail, password, module: loginModule } = ctx.request.body;

      if (!rawEmail || !password) return ctx.badRequest('Email and password are required');

      const email = rawEmail.toLowerCase().trim();

      // ── Standard login ─────────────────────────────────────────────────
      if (!loginModule || (loginModule !== 'sfa' && loginModule !== 'article-analytics' && loginModule !== 'jobs-website' && loginModule !== 'ai_agent_workers' && loginModule !== 'exhibitor-access')) {
        return await this.initiateLogin(ctx);
      }

      // ── Domain check (shared by all module branches) ───────────────────
      if (!['newvision.co.ug'].includes(email.split('@')[1])) {
        return ctx.unauthorized('Only company email addresses are permitted.');
      }

      // ── AD authentication (shared by all module branches) ──────────────
      let adResponse;
      try {
        adResponse = await authenticateWithAD(email, password);
      } catch (e) {
        return ctx.unauthorized(e.message);
      }

      const adUser = adResponse.user ?? {};

      // ── ARTICLE-ANALYTICS BRANCH ───────────────────────────────────────
      if (loginModule === 'article-analytics') {
        console.log('📊 Article-Analytics login for:', email);

        return {
          success:    true,
          message:    'Login successful',
          user: {
            name:       adUser.displayName || email.split('@')[0],
            email,
            role:       'analyst',
            adProfile: {
              displayName:   adUser.displayName   ?? null,
              department:    adUser.department    ?? null,
              jobTitle:      adUser.jobTitle      ?? null,
              phone:         adUser.phone         ?? null,
              accountActive: adUser.accountStatus?.active ?? null,
            },
          },
          redirectTo: '/',
        };
      }

     // ── JOBS-WEBSITE BRANCH ────────────────────────────────────────────
      if (loginModule === 'jobs-website') {
        console.log('💼 Jobs-Website login for:', email);

        return {
          success:    true,
          message:    'Login successful',
          user: {
            name:       adUser.displayName || email.split('@')[0],
            email,
            role:       'jobs-websiteadmin',
            adProfile: {
              displayName:   adUser.displayName   ?? null,
              department:    adUser.department    ?? null,
              jobTitle:      adUser.jobTitle      ?? null,
              phone:         adUser.phone         ?? null,
              accountActive: adUser.accountStatus?.active ?? null,
            },
          },
          redirectTo: '/admin',
        };
      }

     // ── AIHUB BRANCH ────────────────────────────────────────────
      if (loginModule === 'ai_agent_workers') {
        console.log('💼 aihub login for:', email);

        return {
          success:    true,
          message:    'Login successful',
          user: {
            name:       adUser.displayName || email.split('@')[0],
            email,
            role:       'ai_agent_workers',
            adProfile: {
              displayName:   adUser.displayName   ?? null,
              department:    adUser.department    ?? null,
              jobTitle:      adUser.jobTitle      ?? null,
              phone:         adUser.phone         ?? null,
              accountActive: adUser.accountStatus?.active ?? null,
            },
          },
          redirectTo: '/',
        };
      }

      // ── Exhibitor ACCESS BRANCH ───────────────────────────────────────
      if (loginModule === 'exhibitor-access') {
        console.log('📊 Exhibitor login for:', email);

        return {
          success:    true,
          message:    'Login successful',
          user: {
            name:       adUser.displayName || email.split('@')[0],
            email,
            role:       'analyst',
            adProfile: {
              displayName:   adUser.displayName   ?? null,
              department:    adUser.department    ?? null,
              jobTitle:      adUser.jobTitle      ?? null,
              phone:         adUser.phone         ?? null,
              accountActive: adUser.accountStatus?.active ?? null,
            },
          },
          redirectTo: '/badge-setup',
        };
      }


      // ── SFA BRANCH ─────────────────────────────────────────────────────
      console.log('🔐 SFA login requested for:', email);
      console.log('✅ AD auth passed for SFA:', email);

      const [salesPerson] = await strapi.documents(
        'api::vgams-sales-person.vgams-sales-person'
      ).findMany({
        filters: { email: { $eqi: email }, isActive: { $eq: true } },
        limit: 1,
      });

      if (!salesPerson) {
        console.log('🚫 SFA: not an active sales person:', email);
        return ctx.forbidden(
          'Your account is not listed as an active sales person. ' +
          'Contact your administrator to get SFA access.'
        );
      }
      console.log('✅ SFA: sales person confirmed:', salesPerson.name);

      const [sfaProfile] = await strapi.documents(
        'api::sfa-agent-profile.sfa-agent-profile'
      ).findMany({
        filters: {
          vgams_sales_person: { documentId: { $eq: salesPerson.documentId } },
          is_active:          { $eq: true },
        },
        populate: ['vgams_sales_person', 'unit'],
        limit: 1,
      });

      if (!sfaProfile) {
        console.log('🚫 SFA: no agent profile for:', email);
        return ctx.notFound(
          'No SFA profile is configured for your account. ' +
          'Ask an administrator to create one under Content Manager → SFA Agent Profile.'
        );
      }
      console.log('✅ SFA: profile loaded — role:', sfaProfile.sfa_role);

      return {
        success: true,
        message: 'SFA login successful',
        salesPerson: {
          id:         salesPerson.id,
          documentId: salesPerson.documentId,
          name:       salesPerson.name,
          email:      salesPerson.email,
          bc_code:    salesPerson.bc_code || null,
        },
        sfaProfile: {
          id:            sfaProfile.id,
          documentId:    sfaProfile.documentId,
          sfa_role:      sfaProfile.sfa_role,
          employee_code: sfaProfile.employee_code || null,
          unit: sfaProfile.unit ? {
            id:         sfaProfile.unit.id,
            documentId: sfaProfile.unit.documentId,
            name:       sfaProfile.unit.name,
          } : null,
        },
        redirectTo: '/dashboard/sfa',
      };

    } catch (error) {
      console.error('💥 POST Login error:', error);
      return ctx.internalServerError('Authentication failed');
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  USER MANAGEMENT (Admin Hub) — NEW
  //  All actions below require a valid, active administrator identified by
  //  `adminEmail` (see requireAdmin()). None of these rely on the default
  //  Strapi REST CRUD for vgams-user — those routes are already in use
  //  elsewhere in the system and are left untouched.
  // ═══════════════════════════════════════════════════════════════════════

  // ── GET /vgams-users/admin/list ───────────────────────────────────────
  async listUsers(ctx) {
    try {
      const admin = await requireAdmin(ctx);
      if (!admin) return;

      const users = await strapi.db.query('api::vgams-user.vgams-user').findMany({
        select: ['id', 'name', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'],
        orderBy: [{ name: 'asc' }],
      });

      return { success: true, count: users.length, users };

    } catch (error) {
      console.error('💥 listUsers error:', error);
      return ctx.internalServerError('Failed to load users.');
    }
  },

  // ── POST /vgams-users/admin/create ────────────────────────────────────
  async createUser(ctx) {
    try {
      const admin = await requireAdmin(ctx);
      if (!admin) return;

      const { name, email: rawEmail, role, isActive } = ctx.request.body;

      if (!name || !rawEmail || !role) {
        return ctx.badRequest('Name, email, and role are required.');
      }

      const email = rawEmail.toLowerCase().trim();

      if (!['newvision.co.ug'].includes(email.split('@')[1])) {
        return ctx.badRequest('Only company email addresses are permitted.');
      }

      if (!VALID_ROLES.includes(role)) {
        return ctx.badRequest(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
      }

      const existing = await strapi.db.query('api::vgams-user.vgams-user').findOne({ where: { email } });
      if (existing) {
        return ctx.badRequest('A VGAMS account with this email already exists.');
      }

      // Access is actually gated by Active Directory at login time (see
      // initiateLogin) — the stored `password` field is never read during
      // authentication. It's schema-required, so we set a random value the
      // account will never use.
      const placeholderPassword = require('crypto').randomBytes(24).toString('hex');

      const user = await strapi.documents('api::vgams-user.vgams-user').create({
        data: {
          name: name.trim(),
          email,
          password: placeholderPassword,
          role,
          isActive: isActive !== undefined ? !!isActive : true,
        },
      });

      console.log('✅ VGAMS user created:', email, 'role:', role, 'by:', admin.email);

      return {
        success: true,
        message: 'User created successfully.',
        user: {
          id: user.id, documentId: user.documentId,
          name: user.name, email: user.email,
          role: user.role, isActive: user.isActive,
        },
      };

    } catch (error) {
      console.error('💥 createUser error:', error);
      return ctx.internalServerError('Failed to create user.');
    }
  },

  // ── PUT /vgams-users/admin/:id ────────────────────────────────────────
  // Body: any of { name, email, role, isActive }. Only provided fields change.
  async updateUserAdmin(ctx) {
    try {
      const admin = await requireAdmin(ctx);
      if (!admin) return;

      const { id } = ctx.params;
      const { name, email: rawEmail, role, isActive } = ctx.request.body;

      const target = await strapi.db.query('api::vgams-user.vgams-user').findOne({ where: { id } });
      if (!target) return ctx.notFound('User not found.');

      if (PROTECTED_EMAILS.includes(target.email.toLowerCase())) {
        return ctx.badRequest('This account is protected and cannot be modified.');
      }

      const data = {};

      if (name !== undefined) {
        if (!name.trim()) return ctx.badRequest('Name cannot be empty.');
        data.name = name.trim();
      }

      if (rawEmail !== undefined) {
        const email = rawEmail.toLowerCase().trim();
        if (!['newvision.co.ug'].includes(email.split('@')[1])) {
          return ctx.badRequest('Only company email addresses are permitted.');
        }
        if (email !== target.email) {
          const dupe = await strapi.db.query('api::vgams-user.vgams-user').findOne({ where: { email } });
          if (dupe) return ctx.badRequest('A VGAMS account with this email already exists.');
        }
        data.email = email;
      }

      if (role !== undefined) {
        if (!VALID_ROLES.includes(role)) {
          return ctx.badRequest(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
        }
        if (target.id === admin.id && role !== 'administrator') {
          return ctx.badRequest('You cannot remove your own administrator role.');
        }
        data.role = role;
      }

      if (isActive !== undefined) {
        if (target.id === admin.id && !isActive) {
          return ctx.badRequest('You cannot deactivate your own account.');
        }
        data.isActive = !!isActive;
      }

      if (Object.keys(data).length === 0) {
        return ctx.badRequest('No changes provided.');
      }

      const updated = await strapi.documents('api::vgams-user.vgams-user').update({
        documentId: target.documentId,
        data,
      });

      console.log('✅ VGAMS user updated:', target.email, 'fields:', Object.keys(data).join(', '), 'by:', admin.email);

      return {
        success: true,
        message: 'User updated successfully.',
        user: {
          id: updated.id, documentId: updated.documentId,
          name: updated.name, email: updated.email,
          role: updated.role, isActive: updated.isActive,
        },
      };

    } catch (error) {
      console.error('💥 updateUserAdmin error:', error);
      return ctx.internalServerError('Failed to update user.');
    }
  },

  // ── DELETE /vgams-users/admin/:id ─────────────────────────────────────
  // Hard delete. Prefer updateUserAdmin with { isActive: false } where
  // possible — a user with linked adverts/payments/workflow_logs may fail
  // to delete cleanly depending on relation constraints.
  async deleteUserAdmin(ctx) {
    try {
      const admin = await requireAdmin(ctx);
      if (!admin) return;

      const { id } = ctx.params;
      const target = await strapi.db.query('api::vgams-user.vgams-user').findOne({ where: { id } });
      if (!target) return ctx.notFound('User not found.');

      if (target.id === admin.id) {
        return ctx.badRequest('You cannot delete your own account.');
      }

      if (PROTECTED_EMAILS.includes(target.email.toLowerCase())) {
        return ctx.badRequest('This account is protected and cannot be deleted.');
      }

      await strapi.documents('api::vgams-user.vgams-user').delete({ documentId: target.documentId });

      console.log('🗑️ VGAMS user deleted:', target.email, 'by:', admin.email);

      return { success: true, message: 'User deleted successfully.' };

    } catch (error) {
      console.error('💥 deleteUserAdmin error:', error);
      return ctx.internalServerError(
        'Failed to delete user. They may have linked adverts, payments, or workflow logs — consider deactivating instead.'
      );
    }
  },

}));