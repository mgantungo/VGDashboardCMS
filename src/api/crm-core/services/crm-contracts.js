'use strict';

/**
 * Paper trail from acceptance to cash: documents, LPOs (checked against the
 * accepted version), contracts and amendments.
 */
const { UID, num, money, today, nowIso, addDays, fail, fmtM } = require('../utils/crm-helpers');

module.exports = ({ strapi }) => {
  const store = () => strapi.service('api::crm-core.crm-store');
  const access = () => strapi.service('api::crm-core.crm-access');
  const audit = () => strapi.service('api::crm-core.crm-audit');
  const notify = () => strapi.service('api::crm-core.crm-notify');
  const pipeline = () => strapi.service('api::crm-core.crm-pipeline');
  const approvals = () => strapi.service('api::crm-core.crm-approvals');

  async function versionFor(crm, versionId) {
    const v = await store().must(UID.version, versionId, {
      populate: { proposal: { populate: ['client', 'opportunity'] }, lines: { fields: ['end_date', 'start_date'] } },
    }, 'Proposal version');
    await access().assertClient(crm, v.proposal?.client?.documentId);
    return v;
  }

  return {
    /** Stores an uploaded file through the Upload plugin and records it as a CRM document. */
    async upload(crm, file, meta = {}) {
      if (!file) fail('Choose a file to upload.');
      if (meta.client) await access().assertClient(crm, meta.client);
      const uploaded = await strapi.plugin('upload').service('upload').upload({
        data: { fileInfo: { name: file.originalFilename || file.name, caption: meta.title || null } },
        files: file,
      });
      const f = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      const doc = await store().create(UID.document, {
        client: meta.client || null, record_type: meta.record_type || null, record_id: meta.record_id || null,
        doc_type: meta.doc_type || 'other', title: meta.title || f.name, file: f.id, uploaded_by: crm.profileId,
      });
      await audit().log(crm, 'document.upload', UID.document, doc.documentId, null, { doc_type: meta.doc_type, record_type: meta.record_type, record_id: meta.record_id });
      return { document: { id: doc.documentId, title: doc.title }, file: { id: f.id, url: f.url, name: f.name, mime: f.mime } };
    },

    async documents(crm, { client, record_type, record_id }) {
      if (client) await access().assertClient(crm, client);
      const filters = {};
      if (client) filters.client = { documentId: client };
      if (record_type) filters.record_type = record_type;
      if (record_id) filters.record_id = record_id;
      if (!client && !record_id) fail('Say which record the documents belong to.');
      return store().find(UID.document, { filters, populate: ['file', 'uploaded_by'], sort: ['createdAt:desc'] });
    },

    /** Records an LPO and flags any mismatch with what the client accepted. */
    async recordLpo(crm, data) {
      const v = await versionFor(crm, data.version);
      if (v.state !== 'accepted') fail('Record the client\'s acceptance before adding the LPO.');
      const lineEnd = (v.lines || []).map((l) => l.end_date).filter(Boolean).sort().pop() || null;
      const discrepancies = [];
      if (data.value !== undefined && num(data.value) !== num(v.net_total)) {
        discrepancies.push({ field: 'value', lpo: num(data.value), proposal: num(v.net_total), message: `LPO value ${fmtM(data.value)} does not match the accepted ${fmtM(v.net_total)}` });
      }
      if (data.payment_terms_days !== undefined && data.payment_terms_days !== null && Number(data.payment_terms_days) !== Number(v.payment_terms_days)) {
        discrepancies.push({ field: 'payment_terms_days', lpo: Number(data.payment_terms_days), proposal: v.payment_terms_days, message: `LPO says ${data.payment_terms_days} days; proposal says ${v.payment_terms_days} days` });
      }
      if (data.valid_until && lineEnd && data.valid_until < lineEnd) {
        discrepancies.push({ field: 'valid_until', lpo: data.valid_until, proposal: lineEnd, message: `LPO expires ${data.valid_until}, before the work ends on ${lineEnd}` });
      }
      const project = await store().first(UID.project, { filters: { version: { documentId: v.documentId } } });
      const lpo = await store().create(UID.lpo, {
        client: v.proposal.client.documentId, version: v.documentId, project: project?.documentId || null,
        number: data.number || null, issued_on: data.issued_on || today(), value: money(data.value ?? v.net_total),
        valid_until: data.valid_until || null, payment_terms_days: data.payment_terms_days ?? null,
        verification: discrepancies.length ? 'mismatch' : 'verified', discrepancies, resolution: 'none',
        attachment: data.file || null, uploaded_by: crm.profileId,
      });
      if (v.proposal.opportunity) await pipeline().advance(crm, v.proposal.opportunity.documentId, 13, 'LPO received');
      await notify().toRole('finance', {
        event: 'lpo.received', title: `LPO ${data.number || ''} received · ${v.proposal.client.company_name}`,
        body: discrepancies.length ? `${discrepancies.length} mismatch to resolve.` : 'Matches the accepted proposal. Billing can start.',
        link: `/crm/proposals/${v.proposal.documentId}`,
      }, crm.profileId);
      await audit().log(crm, 'lpo.record', UID.lpo, lpo.documentId, null, { number: data.number, discrepancies });
      return { lpo: { id: lpo.documentId, verification: lpo.verification }, discrepancies };
    },

    async resolveLpo(crm, id, { resolution, note }) {
      const lpo = await store().must(UID.lpo, id, { populate: ['client', 'version'] }, 'LPO');
      await access().assertClient(crm, lpo.client?.documentId);
      const patch = { resolution };
      if (resolution === 'accept_lpo_terms') {
        patch.verification = 'verified';
        if (lpo.payment_terms_days !== null && lpo.payment_terms_days !== undefined) {
          // the accepted version is frozen; the agreed terms are recorded on the LPO and contract
          patch.discrepancies = [...(lpo.discrepancies || []), { field: 'resolution', message: `Accepted LPO terms (${lpo.payment_terms_days} days)`, note: note || null }];
        }
      } else if (resolution === 'amend_requested') {
        patch.verification = 'mismatch';
      } else if (resolution === 'exception') {
        await approvals().request(crm, { trigger_type: 'lpo_exception', detail: `Continue with LPO ${lpo.number || ''} despite mismatch`, subject_type: 'lpo', subject_id: id });
      } else fail('Unknown resolution.');
      await store().update(UID.lpo, id, patch);
      await audit().log(crm, 'lpo.resolve', UID.lpo, id, { verification: lpo.verification }, patch);
      return { ok: true, verification: patch.verification || lpo.verification };
    },

    async onLpoExceptionDecision(crm, lpoId, decision) {
      if (decision === 'approved') await store().update(UID.lpo, lpoId, { verification: 'exception_approved' });
      return { lpo: lpoId, decision };
    },

    async createContract(crm, data) {
      const v = await versionFor(crm, data.version);
      let ref = data.reference;
      if (!ref) {
        let n = (await store().count(UID.contract, {})) + 1;
        do { ref = `VG-C-${String(n).padStart(4, '0')}`; n += 1; } while (await store().count(UID.contract, { reference: ref }));
      }
      const c = await store().create(UID.contract, {
        client: v.proposal.client.documentId, version: v.documentId, reference: ref,
        title: data.title || v.proposal.title || v.proposal.reference,
        effective_date: data.effective_date || today(), expiry_date: data.expiry_date || addDays(null, 365),
        renewal_date: data.renewal_date || null, payment_terms_days: data.payment_terms_days ?? v.payment_terms_days,
        value: money(data.value ?? v.net_total), state: data.state || 'draft', attachment: data.file || null,
      });
      if (['signed', 'active'].includes(c.state) && v.proposal.opportunity) await pipeline().advance(crm, v.proposal.opportunity.documentId, 13, 'Contract signed');
      await audit().log(crm, 'contract.create', UID.contract, c.documentId, null, { reference: ref });
      return { contract: { id: c.documentId, reference: ref } };
    },

    async updateContract(crm, id, data) {
      const c = await store().must(UID.contract, id, { populate: ['client', 'version'] }, 'Contract');
      await access().assertClient(crm, c.client?.documentId);
      const patch = {};
      ['state', 'effective_date', 'expiry_date', 'renewal_date', 'title'].forEach((k) => { if (data[k] !== undefined) patch[k] = data[k]; });
      if (data.file) patch.attachment = data.file;
      await store().update(UID.contract, id, patch);
      await audit().log(crm, 'contract.update', UID.contract, id, { state: c.state }, patch);
      return { ok: true };
    },

    async addAmendment(crm, contractId, data) {
      const c = await store().must(UID.contract, contractId, { populate: ['client'] }, 'Contract');
      await access().assertClient(crm, c.client?.documentId);
      const a = await store().create(UID.amendment, { contract: contractId, description: data.description, value_impact: money(data.value_impact || 0), state: 'pending' });
      await approvals().request(crm, { trigger_type: 'contract_variation', detail: `Contract ${c.reference}: ${data.description}`, subject_type: 'contract_amendment', subject_id: a.documentId });
      return { amendment: { id: a.documentId } };
    },

    nowIso,
  };
};
