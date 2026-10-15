'use strict';

/**
 * OPTIONAL hook-up for the CRM extension. The CRM works without it (use
 * Admin → "Run setup" and "Run daily jobs" in the CRM app), but wiring it in
 * gives you three extras:
 *   1. default configuration is seeded on first boot (never overwrites edits)
 *   2. the daily jobs run at 05:00 Kampala time (needs cron enabled in config/server.js)
 *   3. edits made to protected CRM records from the Strapi admin panel are audited
 *
 * To enable, add two lines to your existing src/index.js (nothing else changes):
 *
 *   const crm = require('./crm-bootstrap');
 *   module.exports = {
 *     register({ strapi }) { crm.register({ strapi }); },      // keep your own code here too
 *     async bootstrap({ strapi }) { await crm.bootstrap({ strapi }); },
 *   };
 */

const PROTECTED = new Set([
  'api::crm-proposal-version.crm-proposal-version', 'api::crm-proposal-line.crm-proposal-line',
  'api::crm-line-contributor.crm-line-contributor', 'api::crm-approval-request.crm-approval-request',
  'api::crm-approval-policy.crm-approval-policy', 'api::crm-commission-policy.crm-commission-policy',
  'api::crm-commission-rule.crm-commission-rule', 'api::crm-commission-entry.crm-commission-entry',
  'api::crm-client-assignment.crm-client-assignment', 'api::crm-opportunity.crm-opportunity',
  'api::crm-product.crm-product', 'api::crm-lpo.crm-lpo', 'api::crm-contract.crm-contract',
  'api::crm-invoice.crm-invoice', 'api::crm-payment.crm-payment', 'api::crm-document.crm-document',
  'api::crm-profile.crm-profile',
]);

module.exports = {
  register({ strapi }) {
    if (!strapi.documents || typeof strapi.documents.use !== 'function') return;
    strapi.documents.use(async (context, next) => {
      if (!PROTECTED.has(context.uid) || !['create', 'update', 'delete'].includes(context.action)) return next();
      const req = strapi.requestContext && strapi.requestContext.get ? strapi.requestContext.get() : null;
      // CRM API calls write their own, richer audit entries
      if (req && req.request && String(req.request.path || '').startsWith('/api/crm')) return next();
      let before = null;
      const documentId = context.params && context.params.documentId;
      if (documentId && context.action !== 'create') {
        try { before = await strapi.db.query(context.uid).findOne({ where: { documentId } }); } catch (e) { before = null; }
      }
      const result = await next();
      try {
        const adminUser = req && req.state ? req.state.user : null;
        // the audit collection is not in PROTECTED, so this does not re-enter the middleware
        await strapi.documents('api::crm-audit-log.crm-audit-log').create({
          data: {
            action: `admin.${context.action}`, target_uid: context.uid,
            target_id: documentId || (result && result.documentId) || null,
            before, after: context.action === 'delete' ? null : (context.params && context.params.data) || null,
            actor_user_id: adminUser ? adminUser.id : null,
            ip: req && req.request ? req.request.ip : null, occurred_at: new Date().toISOString(),
          },
        });
      } catch (e) {
        strapi.log.warn(`[crm] admin audit failed: ${e.message}`);
      }
      return result;
    });
  },

  async bootstrap({ strapi }) {
    try {
      const stages = await strapi.documents('api::crm-pipeline-stage.crm-pipeline-stage').count({});
      if (!stages) {
        const res = await strapi.service('api::crm-core.crm-config').seed({});
        strapi.log.info(`[crm] seeded default configuration ${JSON.stringify(res.created)}`);
      }
    } catch (e) {
      strapi.log.warn(`[crm] seeding skipped: ${e.message}`);
    }
    if (strapi.cron && typeof strapi.cron.add === 'function') {
      strapi.cron.add({
        crmDailyJobs: {
          task: async () => {
            try {
              const out = await strapi.service('api::crm-core.crm-admin').runJobs(null);
              strapi.log.info(`[crm] daily jobs ${JSON.stringify(out)}`);
            } catch (e) {
              strapi.log.error(`[crm] daily jobs failed: ${e.message}`);
            }
          },
          options: { rule: '0 5 * * *', tz: 'Africa/Kampala' },
        },
      });
    }
  },
};
