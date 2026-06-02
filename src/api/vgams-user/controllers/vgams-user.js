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
      if (!loginModule || (loginModule !== 'sfa' && loginModule !== 'article-analytics')) {
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
      // No collection lookup — AD authentication is the only gate.
      // Any active @newvision.co.ug account that passes AD auth gets access.
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
     // No collection lookup — AD authentication is the only gate.
     // Any active @newvision.co.ug account that passes AD auth gets access.
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
}));
