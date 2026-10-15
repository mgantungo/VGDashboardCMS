'use strict';

/**
 * All CRM endpoints live under /api/crm/*. They do not use the Users &
 * Permissions role matrix; the crm-authenticated policy verifies the login's
 * JWT and every service enforces record- and field-level access.
 */
const AUTH = 'api::crm-core.crm-authenticated';

const r = (method, path, handler, policyConfig = {}) => ({
  method,
  path: `/crm${path}`,
  handler,
  config: { auth: false, policies: [{ name: AUTH, config: policyConfig }] },
});

module.exports = {
  routes: [
    // session, lookups, catalogue
    r('GET', '/me', 'crm-session.me', { requireProfile: false }),
    r('GET', '/notifications', 'crm-session.notifications'),
    r('POST', '/notifications/read', 'crm-session.readNotifications'),
    r('GET', '/lookups', 'crm-session.lookups'),
    r('GET', '/stages', 'crm-session.stages'),
    r('GET', '/settings', 'crm-session.settings'),
    r('GET', '/products', 'crm-session.products'),
    r('GET', '/business-units', 'crm-session.businessUnits'),
    r('GET', '/people', 'crm-session.people'),

    // sales home and manager maps
    r('GET', '/today', 'crm-maps.today'),
    r('GET', '/dashboard', 'crm-maps.manager'),
    r('GET', '/team-map', 'crm-maps.teamMap'),
    r('GET', '/company-map', 'crm-maps.companyMap'),
    r('POST', '/assignments', 'crm-maps.assign'),
    r('POST', '/assignments/bulk', 'crm-maps.bulkAssign'),
    r('POST', '/assignments/:id/end', 'crm-maps.endAssignment'),

    // clients
    r('GET', '/clients', 'crm-clients.list'),
    r('GET', '/clients/directory', 'crm-clients.directory'),
    r('GET', '/clients/duplicates', 'crm-clients.duplicates'),
    r('POST', '/clients', 'crm-clients.create'),
    r('GET', '/clients/:id', 'crm-clients.get'),
    r('PUT', '/clients/:id/profile', 'crm-clients.updateProfile'),
    r('POST', '/clients/:id/contacts', 'crm-clients.addContact'),
    r('POST', '/clients/:id/merge', 'crm-clients.merge'),
    r('GET', '/clients/:id/interactions', 'crm-clients.interactions'),
    r('POST', '/invoices/:invoiceId/remind', 'crm-clients.remindInvoice'),

    // pipeline and interactions
    r('GET', '/opportunities', 'crm-pipeline.list'),
    r('POST', '/opportunities', 'crm-pipeline.create'),
    r('GET', '/opportunities/:id', 'crm-pipeline.get'),
    r('PUT', '/opportunities/:id', 'crm-pipeline.update'),
    r('POST', '/opportunities/:id/move', 'crm-pipeline.move'),
    r('POST', '/opportunities/:id/lost', 'crm-pipeline.lost'),
    r('POST', '/opportunities/:id/won', 'crm-pipeline.won'),
    r('POST', '/opportunities/:id/contributors', 'crm-pipeline.addContributor'),
    r('POST', '/opportunities/:id/resolve-overlap', 'crm-pipeline.resolveOverlap'),
    r('POST', '/interactions', 'crm-pipeline.logInteraction'),
    r('POST', '/interactions/:id/done', 'crm-pipeline.completeAction'),

    // proposals
    r('POST', '/proposals', 'crm-proposals.create'),
    r('POST', '/quick-quote', 'crm-proposals.quickQuote'),
    r('GET', '/proposals/:id', 'crm-proposals.get'),
    r('GET', '/versions/:id', 'crm-proposals.getVersion'),
    r('GET', '/versions/:id/compare', 'crm-proposals.compare'),
    r('PUT', '/versions/:id', 'crm-proposals.updateVersion'),
    r('POST', '/versions/:id/lines', 'crm-proposals.addLine'),
    r('PUT', '/lines/:id', 'crm-proposals.updateLine'),
    r('DELETE', '/lines/:id', 'crm-proposals.removeLine'),
    r('PUT', '/lines/:id/contributors', 'crm-proposals.setContributors'),
    r('POST', '/versions/:id/submit', 'crm-proposals.submit'),
    r('POST', '/versions/:id/revise', 'crm-proposals.revise'),
    r('POST', '/versions/:id/extend', 'crm-proposals.extend'),
    r('POST', '/versions/:id/accept', 'crm-proposals.accept'),

    // approvals
    r('GET', '/approvals', 'crm-approvals.inbox'),
    r('POST', '/approvals/:id/decide', 'crm-approvals.decide'),

    // documents, LPOs and contracts
    r('POST', '/documents', 'crm-contracts.upload'),
    r('GET', '/documents', 'crm-contracts.documents'),
    r('POST', '/lpos', 'crm-contracts.recordLpo'),
    r('POST', '/lpos/:id/resolve', 'crm-contracts.resolveLpo'),
    r('POST', '/contracts', 'crm-contracts.createContract'),
    r('PUT', '/contracts/:id', 'crm-contracts.updateContract'),
    r('POST', '/contracts/:id/amendments', 'crm-contracts.addAmendment'),

    // projects and delivery
    r('POST', '/versions/:id/project', 'crm-projects.createFromVersion'),
    r('GET', '/projects', 'crm-projects.list'),
    r('GET', '/projects/:id', 'crm-projects.get'),
    r('PUT', '/workstreams/:id', 'crm-projects.updateWorkstream'),
    r('POST', '/workstreams/:id/milestones', 'crm-projects.addMilestone'),
    r('PUT', '/milestones/:id', 'crm-projects.updateMilestone'),
    r('POST', '/tasks', 'crm-projects.addTask'),
    r('PUT', '/tasks/:id', 'crm-projects.updateTask'),
    r('POST', '/workstreams/:id/costs', 'crm-projects.addCost'),
    r('POST', '/workstreams/:id/recurring', 'crm-projects.addRecurring'),
    r('POST', '/projects/:id/change-requests', 'crm-projects.requestChange'),
    r('POST', '/projects/:id/close', 'crm-projects.close'),
    r('POST', '/projects/:id/contacts', 'crm-projects.addContact'),

    // finance
    r('GET', '/finance', 'crm-finance.overview'),
    r('POST', '/billing-items/:id/request-invoice', 'crm-finance.requestInvoice'),
    r('POST', '/billing-items/:id/exception', 'crm-finance.requestException'),
    r('POST', '/crm-invoices/:id/issued', 'crm-finance.markIssued'),
    r('POST', '/crm-invoices/:id/payments', 'crm-finance.recordPayment'),
    r('POST', '/crm-invoices/:id/write-off', 'crm-finance.writeOff'),
    {
      method: 'POST',
      path: '/crm/finance/sync',
      handler: 'crm-finance.sync',
      config: { auth: false, policies: ['api::crm-core.crm-finance-webhook'] },
    },

    // commission
    r('GET', '/commission', 'crm-commission.statement'),
    r('POST', '/commission/approve', 'crm-commission.approve'),
    r('POST', '/commission/paid', 'crm-commission.markPaid'),
    r('POST', '/commission/:id/dispute', 'crm-commission.dispute'),
    r('GET', '/commission/disputes', 'crm-commission.disputes'),
    r('POST', '/commission/disputes/:id', 'crm-commission.decideDispute'),

    // administration
    r('GET', '/admin/users', 'crm-admin.users'),
    r('GET', '/admin/sales-persons', 'crm-admin.salesPersons'),
    r('POST', '/admin/profiles', 'crm-admin.upsertProfile'),
    r('GET', '/admin/teams', 'crm-admin.teams'),
    r('POST', '/admin/teams', 'crm-admin.upsertTeam'),
    r('POST', '/admin/products', 'crm-admin.upsertProduct'),
    r('POST', '/admin/seed', 'crm-admin.seed'),
    r('POST', '/admin/backfill-assignments', 'crm-admin.backfill'),
    r('POST', '/admin/run-jobs', 'crm-admin.runJobs'),
    r('GET', '/admin/audit', 'crm-admin.audit'),
  ],
};
