'use strict';

/**
 * Shared constants and small pure helpers for the CRM API.
 * Nothing in here touches the database.
 */
const { errors } = require('@strapi/utils');

const crm = (n) => `api::crm-${n}.crm-${n}`;

const UID = {
  // existing collections (read, link to, never altered)
  client: 'api::client.client',
  salesPerson: 'api::vgams-sales-person.vgams-sales-person',
  user: 'plugin::users-permissions.user',
  advert: 'api::advert.advert',
  cmsInvoice: 'api::invoice.invoice',
  // crm collections
  businessUnit: crm('business-unit'),
  team: crm('team'),
  profile: crm('profile'),
  clientProfile: crm('client-profile'),
  assignment: crm('client-assignment'),
  contact: crm('contact'),
  interaction: crm('interaction'),
  stage: crm('pipeline-stage'),
  opportunity: crm('opportunity'),
  oppContributor: crm('opportunity-contributor'),
  stageHistory: crm('stage-history'),
  product: crm('product'),
  priceRule: crm('price-rule'),
  provider: crm('provider'),
  procurementOrder: crm('procurement-order'),
  proposal: crm('proposal'),
  version: crm('proposal-version'),
  line: crm('proposal-line'),
  lineContributor: crm('line-contributor'),
  approval: crm('approval-request'),
  approvalPolicy: crm('approval-policy'),
  lpo: crm('lpo'),
  contract: crm('contract'),
  amendment: crm('contract-amendment'),
  billingItem: crm('billing-item'),
  invoice: crm('invoice'),
  payment: crm('payment'),
  docRule: crm('required-document-rule'),
  document: crm('document'),
  project: crm('project'),
  workstream: crm('workstream'),
  milestone: crm('milestone'),
  task: crm('task'),
  recurringRule: crm('recurring-rule'),
  projectContact: crm('project-contact'),
  costEntry: crm('cost-entry'),
  changeRequest: crm('change-request'),
  baseline: crm('baseline'),
  commissionPolicy: crm('commission-policy'),
  commissionRule: crm('commission-rule'),
  commissionEntry: crm('commission-entry'),
  commissionDispute: crm('commission-dispute'),
  audit: crm('audit-log'),
  notification: crm('notification'),
  target: crm('target'),
  lookup: crm('lookup'),
  integrationLog: crm('integration-log'),
  setting: crm('setting'),
};

/** Role capabilities. Record scope + sensitive-field access (blueprint section 8). */
const ROLE_CAN = {
  salesperson: { scope: 'own', cost: false, commission: 'own', approve: false, assign: false },
  product_manager: { scope: 'bu', cost: true, commission: 'own', approve: true, assign: false },
  supervisor: { scope: 'team', cost: true, commission: 'team', approve: true, assign: true, manager: true },
  senior_manager: { scope: 'all', cost: true, commission: 'all', approve: true, assign: true, manager: true },
  executive: { scope: 'all', cost: true, commission: 'all', approve: true, assign: true, manager: true },
  project_manager: { scope: 'projects', cost: true, commission: false, approve: false, assign: false },
  finance: { scope: 'all', cost: true, commission: 'all', approve: true, assign: false, finance: true },
  procurement: { scope: 'all', cost: true, commission: false, approve: true, assign: false },
  admin: { scope: 'all', cost: true, commission: false, approve: false, assign: true, admin: true }, // cost: needed to maintain the catalogue
};

/** Fields stripped for roles without cost access. */
const COST_KEYS = new Set([
  'internal_cost', 'third_party_cost', 'other_cost', 'cost_total', 'contribution_total', 'margin_pct',
  'standard_cost', 'floor_price', 'expected_cost', 'budget', 'forecast_cost', 'committed_cost',
  'actual_cost', 'cost', 'cost_impact', 'contribution', 'margin', 'below_cost', 'line_cost',
]);

/** Whole-shilling money fields stored as BIGINT (returned by Strapi as strings). */
const MONEY_KEYS = new Set([
  'expected_revenue', 'expected_cost', 'monthly_target', 'list_price', 'floor_price', 'standard_cost', 'price',
  'cost', 'package_price', 'list_total', 'selling_total', 'discount_total', 'net_total', 'cost_total',
  'contribution_total', 'unit_price', 'line_discount', 'selling_price', 'allocated_discount', 'net_price',
  'internal_cost', 'third_party_cost', 'other_cost', 'value', 'value_impact', 'amount', 'tax', 'balance',
  'contracted_value', 'budget', 'forecast_cost', 'committed_cost', 'actual_cost', 'allocated_revenue',
  'billing_amount', 'price_impact', 'cost_impact', 'basis_amount', 'eligible_amount', 'paid_amount', 'cap',
]);

const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const money = (v) => String(Math.round(num(v)));
const round1 = (v) => Math.round(num(v) * 10) / 10;
const round2 = (v) => Math.round(num(v) * 100) / 100;

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const nowIso = () => new Date().toISOString();
const addDays = (date, n) => {
  const d = date ? new Date(`${String(date).slice(0, 10)}T12:00:00`) : new Date();
  d.setDate(d.getDate() + n);
  return isoDate(d);
};
const daysBetween = (a, b) => {
  const da = new Date(`${String(a).slice(0, 10)}T12:00:00`);
  const db = new Date(`${String(b).slice(0, 10)}T12:00:00`);
  return Math.round((db - da) / 86400000);
};
const endOfMonth = (offsetMonths = 0) => {
  const d = new Date();
  const e = new Date(d.getFullYear(), d.getMonth() + 1 + offsetMonths, 0, 12);
  return isoDate(e);
};
const monthKey = (date) => String(date || today()).slice(0, 7);
const startOfMonth = () => `${today().slice(0, 7)}-01`;

/** Friendly due-date words used by the sales UI ("tomorrow", "friday", "next_week"). */
const resolveDue = (word) => {
  if (!word) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(word)) return String(word).slice(0, 10);
  const w = String(word).toLowerCase().replace(/\s+/g, '_');
  if (w === 'today') return today();
  if (w === 'tomorrow') return addDays(null, 1);
  if (w === 'next_week') return addDays(null, 7);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = days.indexOf(w);
  if (idx >= 0) {
    const d = new Date();
    let diff = (idx - d.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(null, diff);
  }
  return null;
};

const fmtM = (v) => {
  const n = num(v);
  if (Math.abs(n) >= 1e9) return `${round2(n / 1e9)}B`;
  if (Math.abs(n) >= 1e6) return `${round1(n / 1e6)}M`;
  if (Math.abs(n) >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
};

/** Normalised company name used for duplicate detection. */
const STOP = new Set(['ltd', 'limited', 'co', 'company', 'uganda', 'u', 'the', 'and', 'inc', 'plc', 'smc', 'group', '&']);
const nameTokens = (name) => String(name || '')
  .toLowerCase()
  .replace(/[^a-z0-9\s&]/g, ' ')
  .split(/\s+/)
  .filter((t) => t && !STOP.has(t));
const dedupeKey = (name) => nameTokens(name).join(' ');
const similarity = (a, b) => {
  const A = new Set(nameTokens(a));
  const B = new Set(nameTokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => { if (B.has(t)) inter += 1; });
  return inter / (A.size + B.size - inter);
};
const normPhone = (p) => String(p || '').replace(/\D/g, '').replace(/^256/, '0').replace(/^7/, '07');

/**
 * Converts Strapi documents into API output:
 * documentId -> id, BIGINT strings -> numbers, media -> {id,url,name,mime}.
 */
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  if (value.mime && value.url) {
    return { id: value.id, url: value.url, name: value.name, mime: value.mime, size: value.size };
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k === 'id' && value.documentId) continue;
    if (k === 'documentId') { out.id = v; continue; }
    if (k === 'publishedAt' || k === 'locale' || k === 'localizations') continue;
    if (MONEY_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number')) { out[k] = num(v); continue; }
    out[k] = clean(v);
  }
  return out;
}

/** Removes cost/margin fields for roles without cost access. */
function stripCost(value) {
  if (Array.isArray(value)) return value.map(stripCost);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (COST_KEYS.has(k)) continue;
    out[k] = stripCost(v);
  }
  return out;
}

class ConflictError extends Error {
  constructor(message) { super(message); this.status = 409; this.name = 'ConflictError'; }
}

const fail = (message, details) => { throw new errors.ApplicationError(message, details); };
const forbid = (message = 'You do not have access to this record.') => { throw new errors.ForbiddenError(message); };
const notFound = (what = 'Record') => { throw new errors.NotFoundError(`${what} not found.`); };

const idOf = (rel) => (rel && typeof rel === 'object' ? rel.documentId || rel.id : rel) || null;
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

module.exports = {
  UID, ROLE_CAN, COST_KEYS, MONEY_KEYS, errors,
  num, money, round1, round2, today, nowIso, addDays, daysBetween, endOfMonth, startOfMonth, monthKey,
  resolveDue, fmtM, dedupeKey, similarity, normPhone, nameTokens,
  clean, stripCost, ConflictError, fail, forbid, notFound, idOf, uniq,
};
