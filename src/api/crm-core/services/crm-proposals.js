'use strict';

/**
 * Proposals, immutable versions, lines, package-discount allocation,
 * approval-policy evaluation, submission, negotiation and acceptance.
 */
const {
  UID, num, money, today, nowIso, addDays, fail, forbid, uniq, ConflictError, fmtM,
} = require('../utils/crm-helpers');
const { computeTotals, compareVersions } = require('../utils/crm-pricing');

const TERMS_DAYS = { cash: 0, credit_7: 7, credit_15: 15, credit_30: 30, pdc: 30 };
const RANK = { salesperson: 0, product_manager: 1, supervisor: 1, senior_manager: 2, executive: 3 };

const LINE_POPULATE = {
  product: { populate: { business_unit: { fields: ['name'] } } },
  provider: { fields: ['name', 'approval_state'] },
  business_unit: { fields: ['name'] },
  contributors: { populate: { sales_person: { fields: ['name'] } } },
};
const VERSION_POPULATE = {
  lines: { populate: LINE_POPULATE, sort: ['sort:asc'] },
  approvals: { populate: { approver: { fields: ['display_name'] }, requested_by: { fields: ['display_name'] } } },
  proposal: { populate: { client: true, opportunity: { fields: ['title', 'state'] }, owner: { fields: ['display_name'] }, sales_person: { fields: ['name'] } } },
  previous_version: { populate: { lines: { populate: { product: { fields: ['name'] } } } } },
  created_by_profile: { fields: ['display_name'] },
  acceptance_evidence: true,
};

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const notify = () => strapi.service('api::crm-core.crm-notify');
  const config = () => strapi.service('api::crm-core.crm-config');
  const pipeline = () => strapi.service('api::crm-core.crm-pipeline');
  const commission = () => strapi.service('api::crm-core.crm-commission');
  const clientsSvc = () => strapi.service('api::crm-core.crm-clients');

  const loadVersion = (id) => store().must(UID.version, id, { populate: VERSION_POPULATE }, 'Proposal version');

  async function assertAccess(crm, proposal, version) {
    if (proposal.owner?.documentId === crm.profileId) return;
    if (proposal.sales_person?.documentId && proposal.sales_person.documentId === crm.spId) return;
    const contributor = (version?.lines || []).some((l) => (l.contributors || []).some((c) => c.sales_person?.documentId === crm.spId));
    if (contributor) return;
    await access().assertClient(crm, proposal.client?.documentId);
  }

  function canEdit(crm, proposal, version) {
    if (version.state !== 'draft') return false;
    return proposal.owner?.documentId === crm.profileId
      || (crm.spId && proposal.sales_person?.documentId === crm.spId)
      || Boolean(crm.can.manager) || crm.role === 'product_manager';
  }

  async function nextReference(prefix = 'VG-P-') {
    let n = (await store().count(UID.proposal, {})) + 1;
    for (;;) {
      const ref = `${prefix}${String(n).padStart(4, '0')}`;
      if (!(await store().count(UID.proposal, { reference: ref }))) return ref;
      n += 1;
    }
  }

  /** Line data from a catalogue product (prices and standard costs come from the catalogue). */
  function lineFromProduct(versionId, product, spec = {}, sort = 0) {
    const qty = num(spec.quantity) || num(product.default_quantity) || 1;
    const list = num(product.list_price);
    const unit = spec.unit_price !== undefined && spec.unit_price !== null && spec.unit_price !== '' ? num(spec.unit_price) : list;
    const cost = Math.round(num(product.standard_cost) * qty);
    return {
      version: versionId,
      product: product.documentId,
      business_unit: product.business_unit?.documentId || null,
      description: spec.description || [product.name, product.package_note].filter(Boolean).join(' — '),
      quantity: qty,
      list_price: money(list),
      unit_price: money(unit),
      line_discount: money(spec.line_discount || 0),
      internal_cost: money(product.product_type === 'third_party' ? 0 : cost),
      third_party_cost: money(product.product_type === 'third_party' ? cost : 0),
      other_cost: '0',
      duration_type: product.default_duration_type || 'fixed_term',
      provider: product.preferred_provider?.documentId || null,
      start_date: spec.start_date || null,
      end_date: spec.end_date || null,
      sort,
    };
  }

  /** Who gets credit on a new line: the BU's contributor on the deal, plus the originator. */
  async function defaultContributors(crm, opportunityId, product) {
    const opp = opportunityId ? await store().one(UID.opportunity, opportunityId, {
      populate: { contributors: { populate: ['sales_person', 'business_unit'] }, lead_sales_person: true },
    }) : null;
    const me = crm.spId;
    const buId = product.business_unit?.documentId;
    const unitSeller = (opp?.contributors || []).find((c) => c.business_unit?.documentId === buId && c.sales_person && c.sales_person.documentId !== me && c.role !== 'account_lead');
    if (me && unitSeller) {
      return [
        { sales_person: unitSeller.sales_person.documentId, role: 'product_seller', percentage: 70 },
        { sales_person: me, role: 'originator', percentage: 30 },
      ];
    }
    if (me) return [{ sales_person: me, role: 'originator', percentage: 100 }];
    const fallback = opp?.lead_sales_person?.documentId;
    return fallback ? [{ sales_person: fallback, role: 'account_lead', percentage: 100 }] : [];
  }

  async function addLines(crm, versionId, opportunityId, specs) {
    const ids = uniq(specs.map((s) => s.product));
    const products = ids.length ? await store().find(UID.product, { filters: { documentId: { $in: ids } }, populate: ['business_unit', 'preferred_provider'] }) : [];
    const existing = await store().count(UID.line, { version: { documentId: versionId } });
    let sort = existing;
    for (const spec of specs) {
      const product = products.find((p) => p.documentId === spec.product);
      if (!product) fail('A product on this quote is not in the catalogue.');
      const line = await store().create(UID.line, lineFromProduct(versionId, product, spec, sort));
      sort += 1;
      for (const c of await defaultContributors(crm, opportunityId, product)) {
        await store().create(UID.lineContributor, { line: line.documentId, ...c });
      }
    }
  }

  async function deleteLine(lineId) {
    const contributors = await store().find(UID.lineContributor, { filters: { line: { documentId: lineId } } });
    for (const c of contributors) await store().remove(UID.lineContributor, c.documentId);
    await store().remove(UID.line, lineId);
  }

  return {
    LINE_POPULATE, VERSION_POPULATE, loadVersion,

    /** Re-runs the pricing maths and stores line and version totals. */
    async recompute(versionId) {
      const v = await store().must(UID.version, versionId, { populate: { lines: { sort: ['sort:asc'] } } }, 'Proposal version');
      const { lines, totals, warnings } = computeTotals(v.lines || [], { packagePrice: v.package_price, method: v.allocation_method });
      for (const l of lines) {
        const orig = v.lines.find((x) => x.documentId === l.documentId);
        if (num(orig.selling_price) !== l.selling_price || num(orig.allocated_discount) !== l.allocated_discount || num(orig.net_price) !== l.net_price) {
          await store().update(UID.line, l.documentId, {
            selling_price: money(l.selling_price), allocated_discount: money(l.allocated_discount), net_price: money(l.net_price),
          });
        }
      }
      await store().update(UID.version, versionId, {
        list_total: money(totals.list_total), selling_total: money(totals.selling_total), discount_total: money(totals.discount_total),
        net_total: money(totals.net_total), cost_total: money(totals.cost_total), contribution_total: money(totals.contribution_total),
        margin_pct: totals.margin_pct, discount_pct: totals.discount_pct,
      });
      return { totals, warnings, lines };
    },

    async create(crm, data) {
      const clientId = data.client;
      if (!clientId) fail('Choose a client.');
      await access().assertClient(crm, clientId);
      const client = await store().must(UID.client, clientId, { fields: ['company_name', 'payment_terms'] }, 'Client');
      const settings = await config().settings();
      let oppId = data.opportunity || null;
      if (!oppId) {
        const made = await pipeline().create(crm, { client: clientId, source: 'quick_create', products: (data.lines || []).map((l) => l.product) });
        oppId = made.opportunity.id;
      }
      const opp = await store().must(UID.opportunity, oppId, { fields: ['title'] }, 'Opportunity');
      const proposal = await store().create(UID.proposal, {
        reference: await nextReference(), title: data.title || opp.title, client: clientId, opportunity: oppId,
        state: 'draft', owner: crm.profileId, sales_person: crm.spId,
      });
      const terms = data.payment_terms_days !== undefined && data.payment_terms_days !== null
        ? Number(data.payment_terms_days)
        : (TERMS_DAYS[client.payment_terms] ?? settings.standard_payment_terms_days);
      const version = await store().create(UID.version, {
        proposal: proposal.documentId, version_number: 1, state: 'draft',
        valid_until: addDays(null, Number(data.valid_days) || settings.quote_validity_days),
        payment_terms_days: terms, currency: settings.currency,
        allocation_method: data.allocation_method || settings.default_allocation_method,
        executive_summary: data.executive_summary || null, requirements: data.requirements || null,
        terms: data.terms || 'Standard Vision Group terms: cancellation, make-goods and proof of airing/publication apply.',
        created_by_profile: crm.profileId,
      });
      await store().update(UID.proposal, proposal.documentId, { current_version: version.documentId });
      await addLines(crm, version.documentId, oppId, data.lines || []);
      await this.applyPackage(version.documentId, data);
      await this.recompute(version.documentId);
      await pipeline().advance(crm, oppId, 6, 'Quote being prepared');
      await audit().log(crm, 'proposal.create', UID.proposal, proposal.documentId, null, { reference: proposal.reference, client: clientId });
      return { proposal: { id: proposal.documentId, reference: proposal.reference }, version: { id: version.documentId } };
    },

    /** discount_pct or package_price → package_price on the version. */
    async applyPackage(versionId, data) {
      if (data.package_price === undefined && data.discount_pct === undefined) return;
      if (data.discount_pct !== undefined && data.discount_pct !== null && data.package_price === undefined) {
        const v = await store().one(UID.version, versionId, { populate: ['lines'] });
        const { totals } = computeTotals(v.lines || [], {});
        const pct = num(data.discount_pct);
        await store().update(UID.version, versionId, { package_price: pct > 0 ? money(totals.selling_total * (1 - pct / 100)) : null });
      } else {
        await store().update(UID.version, versionId, { package_price: data.package_price === null || data.package_price === '' ? null : money(data.package_price) });
      }
    },

    /** The salesperson's 2-tap quote: ticked products + discount → submitted or routed for approval. */
    async quickQuote(crm, data) {
      const clientId = data.client;
      if (!clientId) fail('Choose a client.');
      if (!data.products || !data.products.length) fail('Tick at least one product.');
      await access().assertClient(crm, clientId);
      let oppId = data.opportunity || null;
      if (!oppId) {
        const mine = await store().find(UID.opportunity, {
          filters: {
            client: { documentId: clientId }, state: 'open',
            $or: [{ contributors: { sales_person: { documentId: crm.spId || '__none__' } } }, { lead_sales_person: { documentId: crm.spId || '__none__' } }],
          },
          sort: ['updatedAt:desc'], limit: 1,
        });
        oppId = mine[0]?.documentId || null;
      }
      const specs = data.products.map((p) => (typeof p === 'string' ? { product: p } : p));
      const pkg = { discount_pct: num(data.discount_pct) };
      if (data.payment_terms_days !== undefined) pkg.payment_terms_days = data.payment_terms_days;
      let versionId;
      const existing = oppId ? await store().first(UID.proposal, {
        filters: { opportunity: { documentId: oppId }, state: { $notIn: ['accepted', 'rejected', 'expired'] } },
        populate: ['current_version'], sort: ['updatedAt:desc'],
      }) : null;
      if (existing?.current_version) {
        const cv = existing.current_version;
        if (cv.state === 'draft') {
          const lines = await store().find(UID.line, { filters: { version: { documentId: cv.documentId } } });
          for (const l of lines) await deleteLine(l.documentId);
          await addLines(crm, cv.documentId, oppId, specs);
          await store().update(UID.version, cv.documentId, { package_price: null, ...(pkg.payment_terms_days !== undefined ? { payment_terms_days: Number(pkg.payment_terms_days) } : {}) });
          await this.applyPackage(cv.documentId, pkg);
          await this.recompute(cv.documentId);
          versionId = cv.documentId;
        } else {
          const rev = await this.revise(crm, cv.documentId, { reason: data.reason || 'Revised quote', replaceLines: specs, ...pkg });
          versionId = rev.version.id;
        }
      } else {
        const made = await this.create(crm, { client: clientId, opportunity: oppId, lines: specs, ...pkg });
        versionId = made.version.id;
      }
      return this.submit(crm, versionId);
    },

    async get(crm, proposalId, { version: versionId } = {}) {
      const proposal = await store().must(UID.proposal, proposalId, {
        populate: {
          client: true, opportunity: { populate: ['stage'] }, owner: { fields: ['display_name'] }, sales_person: { fields: ['name'] },
          versions: { fields: ['version_number', 'state', 'net_total', 'discount_pct', 'margin_pct', 'submitted_at', 'createdAt', 'change_reason'], sort: ['version_number:desc'] },
          current_version: { fields: ['version_number'] }, accepted_version: { fields: ['version_number'] },
        },
      }, 'Proposal');
      const vid = versionId || proposal.current_version?.documentId;
      const version = vid ? await loadVersion(vid) : null;
      await assertAccess(crm, proposal, version);
      let live = null; let diff = null;
      if (version) {
        live = computeTotals(version.lines || [], { packagePrice: version.package_price, method: version.allocation_method });
        live.lines = live.lines.map((l) => ({ id: l.documentId, contribution: l.contribution, margin: l.margin, below_cost: l.below_cost, line_cost: l.line_cost }));
        if (version.previous_version) diff = compareVersions(version.previous_version, version);
      }
      const accepted = proposal.accepted_version?.documentId;
      const [lpos, contracts, project] = accepted ? await Promise.all([
        store().find(UID.lpo, { filters: { version: { documentId: accepted } }, populate: ['attachment'] }),
        store().find(UID.contract, { filters: { version: { documentId: accepted } }, populate: ['attachment'] }),
        store().first(UID.project, { filters: { version: { documentId: accepted } }, fields: ['name', 'state'] }),
      ]) : [[], [], null];
      const settings = await config().settings();
      return {
        proposal, version, live, diff, lpos, contracts, project,
        settings: { min_margin_pct: settings.min_margin_pct, salesperson_discount_limit_pct: settings.salesperson_discount_limit_pct },
        can: {
          edit: version ? canEdit(crm, proposal, version) : false,
          edit_costs: Boolean(crm.can.cost) && version?.state === 'draft',
          submit: version?.state === 'draft' && canEdit(crm, proposal, version),
          revise: version && ['submitted', 'approved', 'rejected', 'in_review'].includes(version.state),
          accept: version && ['submitted', 'approved'].includes(version.state),
          extend: version && ['submitted', 'approved'].includes(version.state),
        },
      };
    },

    async assertEditable(crm, versionId, lock) {
      const version = await loadVersion(versionId);
      const proposal = await store().must(UID.proposal, version.proposal.documentId, { populate: ['owner', 'sales_person', 'client'] }, 'Proposal');
      await assertAccess(crm, proposal, version);
      if (version.state !== 'draft') fail('This version has been submitted and is locked. Revise it to make changes.');
      if (!canEdit(crm, proposal, version)) forbid('You cannot edit this quote.');
      if (lock !== undefined && lock !== null && Number(lock) !== num(proposal.lock_token)) {
        throw new ConflictError('Someone else changed this quote a moment ago. Reload to see their changes.');
      }
      return { version, proposal };
    },

    async bumpLock(proposalId) {
      const p = await store().one(UID.proposal, proposalId, { fields: ['lock_token'] });
      await store().update(UID.proposal, proposalId, { lock_token: num(p.lock_token) + 1 });
      return num(p.lock_token) + 1;
    },

    async updateVersion(crm, versionId, data) {
      const { proposal } = await this.assertEditable(crm, versionId, data.lock);
      const patch = {};
      ['valid_until', 'executive_summary', 'requirements', 'solution', 'terms', 'change_reason', 'allocation_method'].forEach((k) => { if (data[k] !== undefined) patch[k] = data[k]; });
      if (data.payment_terms_days !== undefined) patch.payment_terms_days = Number(data.payment_terms_days);
      if (Object.keys(patch).length) await store().update(UID.version, versionId, patch);
      await this.applyPackage(versionId, data);
      const out = await this.recompute(versionId);
      const lock = await this.bumpLock(proposal.documentId);
      await audit().log(crm, 'proposal.version.update', UID.version, versionId, null, { ...patch, package_price: data.package_price, discount_pct: data.discount_pct });
      return { ...out, lock };
    },

    async addLine(crm, versionId, spec) {
      const { version, proposal } = await this.assertEditable(crm, versionId, spec.lock);
      await addLines(crm, versionId, version.proposal?.opportunity?.documentId, [spec]);
      const out = await this.recompute(versionId);
      return { ...out, lock: await this.bumpLock(proposal.documentId) };
    },

    async updateLine(crm, lineId, data) {
      const line = await store().must(UID.line, lineId, { populate: ['version'] }, 'Line');
      const { proposal } = await this.assertEditable(crm, line.version.documentId, data.lock);
      const patch = {};
      ['description', 'start_date', 'end_date', 'duration_type'].forEach((k) => { if (data[k] !== undefined) patch[k] = data[k]; });
      if (data.quantity !== undefined) patch.quantity = num(data.quantity);
      if (data.unit_price !== undefined) patch.unit_price = money(data.unit_price);
      if (data.line_discount !== undefined) patch.line_discount = money(data.line_discount);
      if (data.allocated_discount !== undefined) patch.allocated_discount = money(data.allocated_discount);
      if (data.provider !== undefined) patch.provider = data.provider;
      if (crm.can.cost) ['internal_cost', 'third_party_cost', 'other_cost'].forEach((k) => { if (data[k] !== undefined) patch[k] = money(data[k]); });
      await store().update(UID.line, lineId, patch);
      const out = await this.recompute(line.version.documentId);
      await audit().log(crm, 'proposal.line.update', UID.line, lineId, null, patch);
      return { ...out, lock: await this.bumpLock(proposal.documentId) };
    },

    async removeLine(crm, lineId, lock) {
      const line = await store().must(UID.line, lineId, { populate: ['version'] }, 'Line');
      const { proposal } = await this.assertEditable(crm, line.version.documentId, lock);
      await deleteLine(lineId);
      const out = await this.recompute(line.version.documentId);
      await audit().log(crm, 'proposal.line.remove', UID.line, lineId, null, null);
      return { ...out, lock: await this.bumpLock(proposal.documentId) };
    },

    async setLineContributors(crm, lineId, contributors = []) {
      const line = await store().must(UID.line, lineId, { populate: ['version'] }, 'Line');
      await this.assertEditable(crm, line.version.documentId);
      const total = contributors.reduce((a, c) => a + num(c.percentage), 0);
      if (contributors.length && Math.round(total) !== 100) fail(`Contribution shares must add up to 100% (now ${total}%).`);
      const existing = await store().find(UID.lineContributor, { filters: { line: { documentId: lineId } } });
      for (const c of existing) await store().remove(UID.lineContributor, c.documentId);
      for (const c of contributors) {
        await store().create(UID.lineContributor, { line: lineId, sales_person: c.sales_person, role: c.role || 'product_seller', percentage: num(c.percentage) });
      }
      await audit().log(crm, 'proposal.line.contributors', UID.line, lineId, existing.map((c) => ({ role: c.role, pct: c.percentage })), contributors);
      return { ok: true };
    },

    /** Approval Policy evaluation (blueprint 4.4): returns the approvals this version needs. */
    async evaluate(crm, version, client) {
      const settings = await config().settings();
      const policies = await config().policies();
      const triggers = [];
      const add = (trigger, detail, role, policy) => triggers.push({ trigger_type: trigger, detail, approver_role: role, policy: policy?.documentId || null, sla_hours: policy?.sla_hours || 24 });
      const covers = (role) => RANK[crm.role] !== undefined && RANK[role] !== undefined && RANK[crm.role] >= RANK[role];

      const authority = num(crm.profile?.discount_authority_pct ?? settings.salesperson_discount_limit_pct);
      const pct = num(version.discount_pct);
      if (pct > authority) {
        const bands = policies.filter((p) => p.trigger_type === 'discount');
        const band = bands.filter((p) => pct > num(p.min_value) && (p.max_value === null || p.max_value === undefined || pct <= num(p.max_value)))
          .sort((a, b) => num(b.min_value) - num(a.min_value))[0] || bands[0];
        const role = band?.approver_role || 'supervisor';
        if (!covers(role)) add('discount', `Discount ${pct}% (your limit is ${authority}%)`, role, band);
      }
      const marginPolicy = policies.find((p) => p.trigger_type === 'low_margin');
      const floor = num(marginPolicy?.min_value ?? settings.min_margin_pct);
      if (num(version.net_total) > 0 && num(version.margin_pct) < floor) {
        const role = marginPolicy?.approver_role || 'executive';
        if (!covers(role)) add('low_margin', `Margin ${num(version.margin_pct)}% is below the ${floor}% floor`, role, marginPolicy);
      }
      const termsPolicy = policies.find((p) => p.trigger_type === 'payment_terms');
      const standard = num(termsPolicy?.min_value ?? settings.standard_payment_terms_days);
      if (num(version.payment_terms_days) > standard && crm.role !== (termsPolicy?.approver_role || 'finance')) {
        add('payment_terms', `${version.payment_terms_days}-day payment terms exceed the ${standard}-day standard`, termsPolicy?.approver_role || 'finance', termsPolicy);
      }
      const tpPolicy = policies.find((p) => p.trigger_type === 'third_party');
      const unapproved = (version.lines || []).filter((l) => (num(l.third_party_cost) > 0 || l.product?.product_type === 'third_party') && (!l.provider || l.provider.approval_state !== 'approved'));
      if (unapproved.length && crm.role !== (tpPolicy?.approver_role || 'procurement')) {
        add('third_party', `${unapproved.length} third-party line${unapproved.length > 1 ? 's' : ''} without an approved supplier`, tpPolicy?.approver_role || 'procurement', tpPolicy);
      }
      const creditPolicy = policies.find((p) => p.trigger_type === 'credit');
      if (client?.credit_approved && num(client.credit_limit) > 0 && num(version.net_total) > num(client.credit_limit) && crm.role !== (creditPolicy?.approver_role || 'finance')) {
        add('credit', `Quote ${fmtM(version.net_total)} is above the client's credit limit of ${fmtM(client.credit_limit)}`, creditPolicy?.approver_role || 'finance', creditPolicy);
      }
      return triggers;
    },

    async resolveApprover(crm, role) {
      if (role === 'supervisor') {
        const team = crm.teamId ? await store().one(UID.team, crm.teamId, { populate: ['supervisor'] }) : null;
        if (team?.supervisor) return team.supervisor.documentId;
      }
      return null; // role queue: anyone with that role can decide
    },

    async submit(crm, versionId) {
      const version = await loadVersion(versionId);
      const proposal = version.proposal;
      await assertAccess(crm, proposal, version);
      if (version.state === 'approved') return this.finalizeSubmit(crm, versionId);
      if (version.state !== 'draft') fail('This version is already submitted.');
      if (!(version.lines || []).length) fail('Add at least one product.');
      await this.recompute(versionId);
      const fresh = await loadVersion(versionId);
      if (fresh.lines.some((l) => num(l.net_price) <= 0)) fail('Every line needs a price.');
      const client = await store().one(UID.client, proposal.client.documentId);
      await strapi.service('api::crm-core.crm-interactions').closeActions(crm, proposal.client.documentId, ['send_quote']);
      const triggers = await this.evaluate(crm, fresh, client);
      if (!triggers.length) return this.finalizeSubmit(crm, versionId);

      const due = (h) => new Date(Date.now() + h * 3600000).toISOString();
      const names = [];
      for (const t of triggers) {
        const approver = await this.resolveApprover(crm, t.approver_role);
        await store().create(UID.approval, {
          version: versionId, policy: t.policy, trigger_type: t.trigger_type, detail: t.detail,
          requested_by: crm.profileId, approver_role: t.approver_role, approver, decision: 'pending',
          sla_hours: t.sla_hours, due_at: due(t.sla_hours),
        });
        const msg = {
          event: 'approval.requested', title: `Approval needed: ${proposal.reference} v${fresh.version_number}`,
          body: `${t.detail} · ${proposal.client?.company_name} · ${fmtM(fresh.net_total)}`, link: '/crm/approvals',
        };
        if (approver) await notify().toProfiles([approver], msg, crm.profileId);
        else await notify().toRole(t.approver_role, msg, crm.profileId);
        if (approver) {
          const p = await store().one(UID.profile, approver, { fields: ['display_name'] });
          names.push(p?.display_name || t.approver_role.replace('_', ' '));
        } else names.push(t.approver_role.replace('_', ' '));
      }
      await store().update(UID.version, versionId, { state: 'in_review', auto_submit_on_approval: true });
      await store().update(UID.proposal, proposal.documentId, { state: 'in_review' });
      if (proposal.opportunity) await pipeline().advance(crm, proposal.opportunity.documentId, 7, 'Waiting for internal approval');
      await audit().log(crm, 'proposal.submit.routed', UID.version, versionId, null, { triggers });
      return {
        state: 'in_review',
        proposal: { id: proposal.documentId, reference: proposal.reference },
        version: { id: versionId },
        approvals: triggers.map((t) => ({ role: t.approver_role, detail: t.detail })),
        message: `Sent to ${uniq(names).join(' and ')} for a quick OK`,
        message2: `The client gets the quote the moment it's approved. You don't need to chase it.`,
      };
    },

    async finalizeSubmit(crm, versionId) {
      const version = await loadVersion(versionId);
      const proposal = version.proposal;
      await store().update(UID.version, versionId, { state: 'submitted', submitted_at: nowIso() });
      await store().update(UID.proposal, proposal.documentId, { state: version.version_number > 1 ? 'negotiating' : 'submitted' });
      if (proposal.opportunity) await pipeline().advance(crm, proposal.opportunity.documentId, version.version_number > 1 ? 11 : 8, 'Quote submitted to client');
      const emailed = await this.emailQuote(version).catch(() => false);
      const contact = proposal.client?.contact_person || proposal.client?.company_name;
      await audit().log(crm, 'proposal.submit', UID.version, versionId, null, { net_total: num(version.net_total) });
      if (crm.profileId !== proposal.owner?.documentId && proposal.owner) {
        await notify().toProfiles([proposal.owner.documentId], {
          event: 'proposal.submitted', title: `${proposal.reference} v${version.version_number} approved and sent`,
          body: `${proposal.client?.company_name} · ${fmtM(version.net_total)}`, link: `/crm/proposals/${proposal.documentId}`,
        });
      }
      return {
        state: 'submitted',
        proposal: { id: proposal.documentId, reference: proposal.reference },
        version: { id: versionId },
        approvals: [],
        message: emailed ? `Quote sent to ${contact}` : `Quote ready for ${contact}`,
        message2: `${proposal.client?.company_name} · UGX ${fmtM(version.net_total)}. ${emailed ? 'PDF emailed.' : 'Share the PDF from the deal.'} We'll remind you in 3 days if they go quiet.`,
      };
    },

    /** Optional: email the quote if the CMS has an email provider and CRM_EMAIL_QUOTES=true. */
    async emailQuote(version) {
      if (process.env.CRM_EMAIL_QUOTES !== 'true') return false;
      const to = version.proposal?.client?.email;
      const emailSvc = strapi.plugin('email')?.service('email');
      if (!to || !emailSvc) return false;
      const rows = (version.lines || []).map((l) => `<tr><td>${l.description}</td><td style="text-align:right">${num(l.net_price).toLocaleString()}</td></tr>`).join('');
      await emailSvc.send({
        to,
        subject: `Proposal ${version.proposal.reference} from Vision Group`,
        html: `<p>Dear ${version.proposal.client.contact_person || 'client'},</p><p>Please find our proposal below.</p><table>${rows}</table><p><strong>Total: UGX ${num(version.net_total).toLocaleString()}</strong></p><p>Valid until ${version.valid_until}. Payment terms: ${version.payment_terms_days} days.</p>`,
      });
      return true;
    },

    /** Called after any approval decision on a version. */
    async onApprovalsChanged(crm, versionId) {
      const approvals = await store().find(UID.approval, { filters: { version: { documentId: versionId }, decision: { $ne: 'cancelled' } } });
      const version = await loadVersion(versionId);
      if (approvals.some((a) => a.decision === 'rejected')) {
        await store().update(UID.version, versionId, { state: 'rejected' });
        await store().update(UID.proposal, version.proposal.documentId, { state: 'draft' });
        return { outcome: 'rejected' };
      }
      if (approvals.some((a) => a.decision === 'returned')) {
        for (const a of approvals.filter((x) => x.decision === 'pending')) await store().update(UID.approval, a.documentId, { decision: 'cancelled' });
        await store().update(UID.version, versionId, { state: 'draft', auto_submit_on_approval: false });
        await store().update(UID.proposal, version.proposal.documentId, { state: 'draft' });
        return { outcome: 'returned' };
      }
      if (approvals.length && approvals.every((a) => a.decision === 'approved')) {
        await store().update(UID.version, versionId, { state: 'approved' });
        await store().update(UID.proposal, version.proposal.documentId, { state: 'approved' });
        if (version.auto_submit_on_approval) {
          const owner = version.proposal.owner?.documentId;
          const ownerCtx = { ...crm, profileId: owner || crm.profileId };
          return { outcome: 'approved', submitted: await this.finalizeSubmit(ownerCtx, versionId) };
        }
        return { outcome: 'approved' };
      }
      return { outcome: 'pending' };
    },

    /** Counter-offer: copy into a new draft version (submitted versions are never overwritten). */
    async revise(crm, versionId, data = {}) {
      const old = await loadVersion(versionId);
      const proposal = await store().must(UID.proposal, old.proposal.documentId, { populate: ['owner', 'sales_person', 'client', 'versions', 'opportunity'] }, 'Proposal');
      await assertAccess(crm, proposal, old);
      if (old.state === 'draft') fail('This version is still a draft — edit it directly.');
      if (old.state === 'accepted') fail('Accepted versions are frozen. Use a change request on the project instead.');
      const number = Math.max(...(proposal.versions || []).map((v) => v.version_number)) + 1;
      const copy = {};
      ['valid_until', 'executive_summary', 'requirements', 'solution', 'terms', 'payment_terms_days', 'currency', 'allocation_method', 'package_price'].forEach((k) => { copy[k] = old[k]; });
      const settings = await config().settings();
      const nv = await store().create(UID.version, {
        ...copy, proposal: proposal.documentId, version_number: number, state: 'draft', previous_version: versionId,
        change_reason: data.reason || null, created_by_profile: crm.profileId,
        valid_until: old.valid_until && old.valid_until > today() ? old.valid_until : addDays(null, settings.quote_validity_days),
      });
      if (data.replaceLines) {
        await addLines(crm, nv.documentId, proposal.opportunity?.documentId, data.replaceLines);
        await store().update(UID.version, nv.documentId, { package_price: null });
      } else {
        for (const l of old.lines || []) {
          const fields = {};
          ['description', 'quantity', 'list_price', 'unit_price', 'line_discount', 'allocated_discount', 'internal_cost', 'third_party_cost', 'other_cost', 'start_date', 'end_date', 'duration_type', 'sort']
            .forEach((k) => { fields[k] = l[k]; });
          const nl = await store().create(UID.line, {
            ...fields, version: nv.documentId, product: l.product?.documentId || null, business_unit: l.business_unit?.documentId || null, provider: l.provider?.documentId || null,
          });
          for (const c of l.contributors || []) {
            await store().create(UID.lineContributor, { line: nl.documentId, sales_person: c.sales_person?.documentId, role: c.role, percentage: c.percentage });
          }
        }
      }
      // pending approvals on the old version no longer matter
      for (const a of (old.approvals || []).filter((x) => x.decision === 'pending')) await store().update(UID.approval, a.documentId, { decision: 'cancelled' });
      if (['submitted', 'approved', 'in_review', 'rejected'].includes(old.state)) await store().update(UID.version, versionId, { state: 'superseded' });
      await store().update(UID.proposal, proposal.documentId, { current_version: nv.documentId, state: old.state === 'submitted' ? 'negotiating' : 'draft' });
      const patch = {};
      if (data.payment_terms_days !== undefined) patch.payment_terms_days = Number(data.payment_terms_days);
      if (Object.keys(patch).length) await store().update(UID.version, nv.documentId, patch);
      await this.applyPackage(nv.documentId, data);
      await this.recompute(nv.documentId);
      const after = await loadVersion(nv.documentId);
      await store().update(UID.version, nv.documentId, { change_summary: compareVersions(old, after) });
      if (old.state === 'submitted' && proposal.opportunity) await pipeline().advance(crm, proposal.opportunity.documentId, 10, 'Client counter-offer');
      await audit().log(crm, 'proposal.revise', UID.version, nv.documentId, { from: versionId }, { version_number: number, reason: data.reason });
      return { version: { id: nv.documentId, version_number: number }, proposal: { id: proposal.documentId } };
    },

    async compare(crm, aId, bId) {
      const [a, b] = await Promise.all([loadVersion(aId), loadVersion(bId)]);
      await assertAccess(crm, a.proposal, a);
      return { a: { id: aId, version_number: a.version_number }, b: { id: bId, version_number: b.version_number }, diff: compareVersions(a, b) };
    },

    async extendValidity(crm, versionId, days = 7) {
      const v = await loadVersion(versionId);
      await assertAccess(crm, v.proposal, v);
      if (!['submitted', 'approved'].includes(v.state)) fail('Only a quote that is with the client can be extended.');
      const base = v.valid_until && v.valid_until > today() ? v.valid_until : today();
      const until = addDays(base, Number(days) || 7);
      await store().update(UID.version, versionId, { valid_until: until });
      if (v.proposal.state === 'expired') await store().update(UID.proposal, v.proposal.documentId, { state: v.version_number > 1 ? 'negotiating' : 'submitted' });
      await audit().log(crm, 'proposal.extend', UID.version, versionId, { valid_until: v.valid_until }, { valid_until: until });
      return { valid_until: until, message: `Quote now valid until ${until}` };
    },

    /** Records acceptance and freezes the version (prices, costs and commission policy snapshot). */
    async accept(crm, versionId, data = {}) {
      const v = await loadVersion(versionId);
      const proposal = v.proposal;
      await assertAccess(crm, proposal, v);
      if (!['submitted', 'approved'].includes(v.state)) fail('Only a quote that has been submitted can be accepted.');
      const policy = await config().commissionPolicy();
      const snapshot = {
        totals: { list_total: num(v.list_total), net_total: num(v.net_total), cost_total: num(v.cost_total), contribution_total: num(v.contribution_total), margin_pct: num(v.margin_pct), discount_pct: num(v.discount_pct) },
        payment_terms_days: v.payment_terms_days,
        commission_policy: policy ? { id: policy.documentId, name: policy.name, version: policy.version_label } : null,
        lines: (v.lines || []).map((l) => ({
          id: l.documentId, product: l.product?.name, list_price: num(l.list_price), unit_price: num(l.unit_price), quantity: num(l.quantity),
          net_price: num(l.net_price), internal_cost: num(l.internal_cost), third_party_cost: num(l.third_party_cost), other_cost: num(l.other_cost),
          contributors: (l.contributors || []).map((c) => ({ sales_person: c.sales_person?.documentId, role: c.role, percentage: num(c.percentage) })),
        })),
        frozen_at: nowIso(),
      };
      await store().update(UID.version, versionId, {
        state: 'accepted', accepted_at: data.accepted_on ? new Date(`${data.accepted_on}T12:00:00Z`).toISOString() : nowIso(),
        accepted_by_contact: data.accepted_by_contact || null, acceptance_evidence: data.evidence_file || null,
        is_frozen: true, frozen_snapshot: snapshot,
      });
      const others = await store().find(UID.version, { filters: { proposal: { documentId: proposal.documentId }, documentId: { $ne: versionId }, state: { $notIn: ['rejected', 'superseded', 'accepted'] } } });
      for (const o of others) await store().update(UID.version, o.documentId, { state: 'superseded' });
      await store().update(UID.proposal, proposal.documentId, { state: 'accepted', accepted_version: versionId, current_version: versionId });
      if (proposal.opportunity) {
        const won = await store().first(UID.stage, { filters: { is_won: true } });
        await pipeline().move(crm, proposal.opportunity.documentId, { stage: won?.documentId, note: 'Client accepted the quote' }, { system: true });
      }
      const cp = await clientsSvc().profileFor(proposal.client.documentId);
      if (cp) await store().update(UID.clientProfile, cp.documentId, { lifecycle: 'active' });
      await commission().accrueForVersion(crm, versionId);
      const contributorSps = (v.lines || []).flatMap((l) => (l.contributors || []).map((c) => c.sales_person?.documentId));
      await notify().toSalesPersons(contributorSps, {
        event: 'proposal.accepted', title: `Won: ${proposal.client?.company_name}`,
        body: `${proposal.reference} accepted at UGX ${fmtM(v.net_total)}.`, link: `/crm/proposals/${proposal.documentId}`,
      }, crm.profileId);
      await notify().toRole('finance', { event: 'proposal.accepted', title: `New accepted deal: ${proposal.client?.company_name}`, body: `${proposal.reference} · UGX ${fmtM(v.net_total)} · LPO and billing to follow.`, link: `/crm/proposals/${proposal.documentId}` });
      await audit().log(crm, 'proposal.accept', UID.version, versionId, null, snapshot.totals);
      return {
        accepted: true, proposal: { id: proposal.documentId }, version: { id: versionId },
        message: 'Deal won. Well done!',
        message2: `${proposal.title || proposal.reference} · UGX ${fmtM(v.net_total)}. When the LPO arrives, snap it with + and we do the rest.`,
      };
    },

    /** "They said yes" from a deal: accepts the quote that is with the client. */
    async acceptFromOpportunity(crm, oppId, data) {
      const p = await store().first(UID.proposal, {
        filters: { opportunity: { documentId: oppId }, state: { $notIn: ['accepted', 'rejected'] } },
        populate: ['current_version'], sort: ['updatedAt:desc'],
      });
      if (!p?.current_version || !['submitted', 'approved'].includes(p.current_version.state)) {
        fail(p?.current_version?.state === 'in_review' ? 'The quote is still waiting for approval.' : 'Send a quote first, then mark it won.');
      }
      return this.accept(crm, p.current_version.documentId, data);
    },
  };
};
