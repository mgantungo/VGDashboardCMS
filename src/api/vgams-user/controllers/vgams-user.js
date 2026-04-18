// src/api/vgams-user/controllers/vgams-user.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

// ── Legacy dependency (kept for reference, no longer used for auth) ───────────
// const bcrypt = require('bcryptjs');

const AD_AUTH_URL = 'https://vg-one-id-auth.newvision.co.ug/api/auth/login';
const DEV_API_KEY = process.env.AUTH_PROXY_DEV_KEY; // Add this to your Strapi .env

module.exports = createCoreController('api::vgams-user.vgams-user', ({ strapi }) => ({
  async initiateLogin(ctx) {
    try {
      let email, password;

      if (ctx.params?.email && ctx.params?.password) {
        email = ctx.params.email;
        password = ctx.params.password;
      } else if (ctx.request.body?.email && ctx.request.body?.password) {
        email = ctx.request.body.email;
        password = ctx.request.body.password;
      } else {
        return ctx.badRequest('Email and password are required');
      }

      email = email.toLowerCase().trim();
      console.log('🔐 VGAMS Login requested for:', email);

      // ── Step 1: Enforce @newvision.co.ug domain ────────────────────────────
      const domain = email.split('@')[1];
      if (domain !== 'newvision.co.ug') {
        console.log('🚫 Rejected domain:', domain);
        return ctx.unauthorized('Only @newvision.co.ug email addresses are permitted.');
      }

      // ── Step 2: Check user exists in Strapi DB ────────────────────────────
      const user = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { email }
      });

      if (!user) {
        console.log('❌ User not found in VGAMS:', email);
        return ctx.notFound('No VGAMS account found for this email address.');
      }

      console.log('✅ VGAMS user found:', user.email, '| Role:', user.role);

      // ── [LEGACY] Old bcrypt password verification — replaced by AD auth proxy ──
      // Kept here for reference. Do not re-enable unless reverting to local auth.
      //
      // console.log('🔐 Stored password hash present:', !!user.password);
      // if (user.password) {
      //   console.log('🔐 Password hash starts with:', user.password.substring(0, 10));
      //   console.log('🔐 Password hash length:', user.password.length);
      // }
      //
      // let validPassword = false;
      // try {
      //   console.log('🔑 Comparing password with bcrypt hash...');
      //
      //   // Bcrypt hashes start with $2a$, $2b$, or $2y$
      //   if (user.password && user.password.startsWith('$2')) {
      //     console.log('✅ Password appears to be a bcrypt hash');
      //     validPassword = await bcrypt.compare(password, user.password);
      //   } else {
      //     console.log('⚠️ Password does not appear to be hashed with bcrypt');
      //     console.log('⚠️ Stored password format:', user.password);
      //     // Try comparing anyway (might be plain text for debugging)
      //     validPassword = (password === user.password);
      //   }
      //
      //   console.log('🔑 Password comparison result:', validPassword);
      //
      // } catch (bcryptError) {
      //   console.error('❌ Bcrypt comparison error:', bcryptError);
      //   console.error('❌ Error details:', bcryptError.message);
      //   return ctx.unauthorized('Invalid password');
      // }
      //
      // if (!validPassword) {
      //   console.log('❌ Invalid password for:', email);
      //   return ctx.unauthorized('Invalid password');
      // }
      //
      // console.log('✅ Password verified successfully');
      // ── [END LEGACY] ──────────────────────────────────────────────────────────

      // ── Step 3: Verify credentials against AD auth proxy ──────────────────
      console.log('📡 Forwarding credentials to AD auth proxy...');

      let adResponse;
      try {
        const res = await fetch(AD_AUTH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Dev-Key': DEV_API_KEY,
          },
          body: JSON.stringify({ email, password }),
          signal: AbortSignal.timeout(10000), // 10s timeout
        });

        adResponse = await res.json();
      } catch (fetchError) {
        console.error('💥 AD auth proxy unreachable:', fetchError.message);
        return ctx.internalServerError('Authentication service is temporarily unavailable. Please try again shortly.');
      }

      console.log('📨 AD auth proxy response — status:', adResponse?.status);

      // ── Step 4: Handle AD auth result ────────────────────────────────────
      if (!adResponse?.authenticated) {
        const status   = adResponse?.status || 'UNKNOWN';
        const messages = {
          INVALID_CREDENTIALS: 'Incorrect password.',
          USER_NOT_FOUND:      'No Active Directory account found for this email.',
          ACCOUNT_DISABLED:    'Your Active Directory account has been disabled. Contact your administrator.',
          ACCOUNT_LOCKED:      'Your Active Directory account is locked. Contact your administrator.',
          SERVICE_UNAVAILABLE: 'Authentication service is temporarily unavailable. Please try again shortly.',
        };

        const message = messages[status] || adResponse?.message || 'Authentication failed.';
        console.log(`⚠️  AD auth rejected [${status}]:`, email);
        return ctx.unauthorized(message);
      }

      console.log('✅ AD authentication successful for:', email);

      // ── Step 5: Build role-mapped response ────────────────────────────────
      const roleDisplayNames = {
        booking_clerk:        'Booking Clerk',
        sub_editor:           'Sub-Editor',
        advertising_manager:  'Advertising Manager',
        design_house:         'Design House',
        finance_team:         'Finance Team',
        administrator:        'Administrator',
      };

      const roleRedirects = {
        booking_clerk:        '/dashboard/booking',
        sub_editor:           '/dashboard/review',
        design_house:         '/dashboard/design',
        finance_team:         '/dashboard/finance',
        advertising_manager:  '/dashboard/approval',
        administrator:        '/dashboard/admin',
      };

      const displayRole = roleDisplayNames[user.role] || user.role;
      const redirectTo  = roleRedirects[user.role]    || '/dashboard';

      console.log('🎯 Login complete for:', email, '| Role:', displayRole, '| Redirect:', redirectTo);

      return {
        success:    true,
        message:    'Login successful',
        user: {
          id:          user.id,
          name:        user.name,
          email:       user.email,
          role:        user.role,
          displayRole: displayRole,
          createdAt:   user.createdAt,
          updatedAt:   user.updatedAt,
          // AD-enriched fields (available when AD returns a full user object)
          adProfile: adResponse.user ? {
            displayName: adResponse.user.displayName,
            department:  adResponse.user.department,
            jobTitle:    adResponse.user.jobTitle,
            phone:       adResponse.user.phone,
            groups:      adResponse.user.groups,
          } : null,
        },
        redirectTo,
      };

    } catch (error) {
      console.error('💥 VGAMS Login error:', error);
      console.error('💥 Stack:', error.stack);
      return ctx.internalServerError('Authentication failed');
    }
  },

  async initiateLoginPost(ctx) {
    try {
      const { email, password } = ctx.request.body;

      if (!email || !password) {
        return ctx.badRequest('Email and password are required');
      }

      console.log('📧 POST Login attempt for:', email);

      // Delegate entirely to initiateLogin using the request body path
      return await this.initiateLogin(ctx);

    } catch (error) {
      console.error('💥 POST Login error:', error);
      return ctx.internalServerError('Authentication failed');
    }
  },
}));
