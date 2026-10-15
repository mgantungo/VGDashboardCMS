'use strict';

/**
 * Configuration that lives as data (blueprint principle 7):
 * settings, pipeline stages, approval policies, commission policy, lookups.
 * `seed()` creates sensible defaults once and never overwrites admin edits.
 */
const { UID, today } = require('../utils/crm-helpers');

const DEFAULT_SETTINGS = {
  company_name: 'Vision Group', currency: 'UGX', default_allocation_method: 'selling_price',
  salesperson_discount_limit_pct: 5, min_margin_pct: 35, standard_payment_terms_days: 30,
  quote_validity_days: 14, cold_after_days: 30, heavy_load_clients: 8, reminder_days_before_expiry: 2,
};

const BUSINESS_UNITS = [
  ['Radio', 'RAD'], ['TV', 'TV'], ['Print', 'PRT'], ['Digital', 'DIG'], ['Outdoor', 'OUT'],
  ['Events', 'EVT'], ['Content', 'CNT'], ['Courier', 'COU'], ['Sponsorship', 'SPN'],
];

const STAGES = [
  [1, 'Lead', 'talking', 10, null],
  [2, 'Qualified', 'talking', 15, null],
  [3, 'Needs discovery', 'talking', 20, null],
  [4, 'Solution design', 'quoting', 25, null],
  [5, 'Contributors engaged', 'quoting', 30, null],
  [6, 'Costing', 'quoting', 35, null],
  [7, 'Internal approval', 'quoting', 40, null],
  [8, 'Submitted to client', 'waiting', 50, ['approved_version']],
  [9, 'Client review', 'waiting', 55, null],
  [10, 'Negotiation', 'waiting', 60, null],
  [11, 'Revised proposal', 'waiting', 65, null],
  [12, 'Verbal acceptance', 'waiting', 80, null],
  [13, 'Contract / LPO received', 'waiting', 90, ['lpo_or_contract']],
  [14, 'Won', 'won', 100, ['accepted_version']],
  [15, 'Lost', 'lost', 0, ['loss_reason']],
];

const POLICIES = [
  ['Discount 5–10%', 'discount', 5, 10, 'supervisor', 24, 1],
  ['Discount 10–15%', 'discount', 10, 15, 'senior_manager', 24, 2],
  ['Discount above 15%', 'discount', 15, 100, 'executive', 48, 3],
  ['Margin below floor', 'low_margin', 35, null, 'executive', 48, 4],
  ['Payment terms beyond standard', 'payment_terms', 30, null, 'finance', 24, 5],
  ['Third-party supplier not yet approved', 'third_party', null, null, 'procurement', 24, 6],
  ['Value above client credit limit', 'credit', null, null, 'finance', 24, 7],
  ['Project change request', 'change_request', null, null, 'senior_manager', 48, 8],
  ['Early project closure', 'early_closure', null, null, 'executive', 48, 9],
  ['Billing without LPO', 'lpo_exception', null, null, 'finance', 24, 10],
  ['Contract variation', 'contract_variation', null, null, 'senior_manager', 48, 11],
];

const LOOKUPS = {
  loss_reason: ['Price too high', 'Chose a competitor', 'Budget cut', 'No response', 'Bad timing', 'Client not interested', 'Merged into another deal'],
  industry: ['FMCG', 'Banking & finance', 'Telecom', 'Agriculture', 'Manufacturing', 'Hospitality & tourism', 'Government',
    'NGO', 'Education', 'Health', 'Energy', 'Retail', 'Real estate', 'Transport & logistics'],
  client_category: ['corporate', 'sme', 'government', 'ngo', 'agency', 'individual'],
  region: ['Kampala', 'Central', 'Eastern', 'Northern', 'Western'],
};

const SAMPLE_PRODUCTS = [
  ['RAD-60-120', 'Radio spots', 'Radio', 'internal', 'package', 24000000, 9600000, '60s · 120 spots', 'fixed_term'],
  ['TV-30-40', 'TV prime-time slots', 'TV', 'internal', 'package', 36000000, 16200000, '30s · 40 prime-time slots', 'fixed_term'],
  ['PRT-FP-6', 'Newspaper full-page ad', 'Print', 'internal', 'package', 18000000, 7200000, 'Full colour page · 6 insertions', 'fixed_term'],
  ['DIG-HP-2W', 'Website homepage takeover', 'Digital', 'internal', 'package', 12000000, 4800000, 'Homepage · 2 weeks', 'one_off'],
  ['OUT-BB-12M', 'Billboard, 12 months', 'Outdoor', 'third_party', 'month', 1500000, 1350000, '1 site · per month', 'long_running'],
  ['EVT-SPN', 'Event sponsorship', 'Events', 'internal', 'event', 20000000, 9000000, 'Title sponsorship · 1 event', 'one_off'],
  ['COU-BUNDLE', 'Courier distribution', 'Courier', 'internal', 'month', 2500000, 1500000, 'Per month', 'fixed_term'],
];

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');

  return {
    async settings() {
      let s = await strapi.documents(UID.setting).findFirst();
      if (!s) s = await strapi.documents(UID.setting).create({ data: DEFAULT_SETTINGS });
      const out = { ...DEFAULT_SETTINGS };
      Object.keys(DEFAULT_SETTINGS).forEach((k) => { if (s[k] !== null && s[k] !== undefined) out[k] = s[k]; });
      return out;
    },

    async stages() {
      return store().find(UID.stage, { filters: { is_active: true }, sort: ['position:asc'], limit: 100 });
    },

    async stageAt(position) {
      return store().first(UID.stage, { filters: { position } });
    },

    async policies(triggerType) {
      const filters = { is_active: true };
      if (triggerType) filters.trigger_type = triggerType;
      return store().find(UID.approvalPolicy, { filters, sort: ['sort:asc'], limit: 100 });
    },

    async commissionPolicy(onDate = today()) {
      const policies = await store().find(UID.commissionPolicy, {
        filters: { is_active: true }, sort: ['effective_from:desc'], populate: { rules: { populate: ['product', 'business_unit'] } }, limit: 20,
      });
      return policies.find((p) => (!p.effective_from || p.effective_from <= onDate) && (!p.effective_to || p.effective_to >= onDate))
        || policies[0] || null;
    },

    async lookups(listType) {
      const filters = { is_active: true };
      if (listType) filters.list_type = listType;
      return store().find(UID.lookup, { filters, sort: ['sort:asc'], limit: 500 });
    },

    /** Idempotent: only creates what is missing. */
    async seed({ sampleCatalogue = false } = {}) {
      const s = store();
      const made = {};
      const bump = (k) => { made[k] = (made[k] || 0) + 1; };
      await this.settings();

      const bus = {};
      for (const [name, code] of BUSINESS_UNITS) {
        let bu = await s.first(UID.businessUnit, { filters: { name } });
        if (!bu) { bu = await s.create(UID.businessUnit, { name, code, is_active: true }); bump('business_units'); }
        bus[name] = bu;
      }

      const stageByPos = {};
      for (const [position, name, step, prob, evidence] of STAGES) {
        let st = await s.first(UID.stage, { filters: { position } });
        if (!st) {
          st = await s.create(UID.stage, {
            position, name, simple_step: step, default_probability: prob, required_evidence: evidence,
            is_won: step === 'won', is_lost: step === 'lost', is_active: true,
          });
          bump('stages');
        }
        stageByPos[position] = st;
      }

      if (!(await s.count(UID.approvalPolicy, {}))) {
        for (const [name, trigger, min, max, role, sla, sort] of POLICIES) {
          await s.create(UID.approvalPolicy, {
            name, trigger_type: trigger, min_value: min, max_value: max, approver_role: role, sla_hours: sla, sort, is_active: true,
          });
          bump('approval_policies');
        }
      }

      if (!(await s.count(UID.commissionPolicy, {}))) {
        const policy = await s.create(UID.commissionPolicy, {
          name: 'Commission policy', version_label: 'v1', effective_from: `${today().slice(0, 4)}-01-01`,
          basis: 'collected', payment_trigger: 'collected', discount_treatment: 'net_of_discount',
          cancellation_treatment: 'reverse', bad_debt_treatment: 'reverse', default_rate: 5, is_active: true,
        });
        bump('commission_policies');
        const rates = { Digital: 6, Events: 4, Courier: 3 };
        for (const [name] of BUSINESS_UNITS) {
          await s.create(UID.commissionRule, {
            policy: policy.documentId, name: `${name} default`, business_unit: bus[name].documentId,
            role: 'any', rate: rates[name] || 5, role_weight: 100,
          });
          bump('commission_rules');
        }
      }

      for (const [listType, values] of Object.entries(LOOKUPS)) {
        for (let i = 0; i < values.length; i += 1) {
          const exists = await s.first(UID.lookup, { filters: { list_type: listType, value: values[i] } });
          if (!exists) { await s.create(UID.lookup, { list_type: listType, value: values[i], label: values[i], sort: i, is_active: true }); bump('lookups'); }
        }
      }

      if (!(await s.count(UID.docRule, {}))) {
        await s.create(UID.docRule, { name: 'No billing without LPO or signed contract', applies_to: 'billing', document_types: ['lpo', 'contract'], blocks: true, exception_allowed: true, is_active: true });
        await s.create(UID.docRule, { name: 'LPO or contract before stage 13', applies_to: 'stage', stage: stageByPos[13].documentId, document_types: ['lpo', 'contract'], blocks: true, exception_allowed: false, is_active: true });
        await s.create(UID.docRule, { name: 'Completion evidence to close a workstream', applies_to: 'project_close', document_types: ['evidence'], blocks: true, exception_allowed: true, is_active: true });
        bump('document_rules');
      }

      if (sampleCatalogue && !(await s.count(UID.product, {}))) {
        let provider = await s.first(UID.provider, { filters: { name: 'Sample outdoor provider' } });
        if (!provider) provider = await s.create(UID.provider, { name: 'Sample outdoor provider', services: 'Billboard sites', approval_state: 'approved' });
        for (const [code, name, bu, type, unit, price, cost, note, duration] of SAMPLE_PRODUCTS) {
          await s.create(UID.product, {
            code, name, short_label: name, package_note: note, business_unit: bus[bu].documentId, product_type: type, unit,
            list_price: String(price), floor_price: String(Math.round(price * 0.8)), standard_cost: String(cost),
            default_quantity: unit === 'month' ? 12 : 1, default_duration_type: duration,
            preferred_provider: type === 'third_party' ? provider.documentId : null, is_active: true,
          });
          bump('sample_products');
        }
      }
      return { created: made };
    },
  };
};
