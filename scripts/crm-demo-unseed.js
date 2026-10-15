'use strict';

/**
 * Removes the data created by scripts/crm-demo-seed.js — and nothing else.
 *
 *   node scripts/crm-demo-unseed.js            dry run: lists what would be removed (default)
 *   node scripts/crm-demo-unseed.js --confirm  actually removes it
 *
 * Run with Strapi STOPPED and after a database backup.
 *
 * How demo data is recognised (all conditions must hold, so real records are never touched):
 *   - sales persons and logins: email ends with @demo.vg
 *   - clients: one of the 12 demo company names, phone 0700000000, and NOT linked to any
 *     advert of a real (non-demo) sales person or to any existing CMS invoice
 *   - adverts: linked to a demo-named client AND only to demo sales persons
 *   - CRM records: everything that hangs off a demo client, demo sales person or demo login
 *   - teams / sample products / sample provider: only if nothing real uses them
 * CRM configuration (stages, approval rules, commission policy, lookups, settings) is kept.
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const CONFIRM = process.argv.includes('--confirm');
const DEMO_DOMAIN = '@demo.vg';
const DEMO_CLIENTS = [
  'Rwenzori Dairy Co.', 'Lakeside Telecom', 'Pearl Agro Ltd', 'Mbale Cement Works', 'Bwindi Lodges',
  'Masaka Coffee Union', 'Tororo Motors', 'Kabale Hardware', 'Mukono Water Co.', 'Hoima Oil Services',
  'Kampala City Pharmacy', 'Nakasongola Ranch',
];
const DEMO_TEAMS = ['Corporate Sales · Kampala', 'Digital', 'TV'];
const SAMPLE_PRODUCT_CODES = ['RAD-60-120', 'TV-30-40', 'PRT-FP-6', 'DIG-HP-2W', 'OUT-BB-12M', 'EVT-SPN', 'COU-BUNDLE'];
const SAMPLE_PROVIDER = 'Sample outdoor provider';

const U = (n) => `api::crm-${n}.crm-${n}`;
const CLIENT = 'api::client.client';
const SP = 'api::vgams-sales-person.vgams-sales-person';
const USER = 'plugin::users-permissions.user';
const ADVERT = 'api::advert.advert';
const CMS_INVOICE = 'api::invoice.invoice';

async function main() {
  const app = await createStrapi(await compileStrapi()).load();
  const q = (uid) => app.db.query(uid);
  const has = (uid) => Boolean(app.contentTypes[uid]);
  const plan = [];
  const ids = (rows) => rows.map((r) => r.id);
  const docIds = (rows) => rows.map((r) => r.documentId);
  const IN = (list) => ({ $in: list.length ? list : [-1] });
  const DIN = (list) => ({ $in: list.length ? list : ['__none__'] });
  const note = (what, rows) => { plan.push({ what, count: rows.length }); return rows; };

  // ---------- 1. find demo identities ----------
  const sps = await q(SP).findMany({ where: { email: { $endsWith: DEMO_DOMAIN } }, select: ['id', 'documentId', 'name', 'email'] });
  const users = await q(USER).findMany({ where: { email: { $endsWith: DEMO_DOMAIN } }, select: ['id', 'documentId', 'email'] });
  const spDocs = docIds(sps);

  const candidates = await q(CLIENT).findMany({ where: { company_name: { $in: DEMO_CLIENTS }, phone: '0700000000' }, select: ['id', 'documentId', 'company_name'] });
  const clients = [];
  const kept = [];
  for (const c of candidates) {
    let realAdvert = 0;
    if (has(ADVERT)) {
      const ads = await q(ADVERT).findMany({ where: { client: { id: c.id } }, populate: { vgams_sales_persons: { select: ['id', 'documentId'] } } });
      realAdvert = ads.filter((a) => (a.vgams_sales_persons || []).some((s) => !spDocs.includes(s.documentId)) || !(a.vgams_sales_persons || []).length).length;
    }
    const invoices = has(CMS_INVOICE) ? await q(CMS_INVOICE).count({ where: { client: { id: c.id } } }) : 0;
    if (realAdvert || invoices) kept.push(`${c.company_name} (has ${realAdvert} real adverts, ${invoices} CMS invoices — kept)`);
    else clients.push(c);
  }
  const clientDocs = docIds(clients);

  // demo adverts on ANY demo-named client, including ones kept because they also have real adverts
  const adverts = has(ADVERT) ? (await q(ADVERT).findMany({
    where: { client: { documentId: DIN(docIds(candidates)) } },
    populate: { vgams_sales_persons: { select: ['id', 'documentId'] } },
  })).filter((a) => (a.vgams_sales_persons || []).length && a.vgams_sales_persons.every((s) => spDocs.includes(s.documentId))) : [];

  const profiles = await q(U('profile')).findMany({
    where: { $or: [{ user: { id: IN(ids(users)) } }, { sales_person: { documentId: DIN(spDocs) } }] }, select: ['id', 'documentId'],
  });
  const profileDocs = docIds(profiles);

  // ---------- 2. CRM records hanging off demo data ----------
  const byClient = { client: { documentId: DIN(clientDocs) } };
  const proposals = await q(U('proposal')).findMany({ where: byClient, select: ['id', 'documentId'] });
  const versions = await q(U('proposal-version')).findMany({ where: { proposal: { documentId: DIN(docIds(proposals)) } }, select: ['id', 'documentId'] });
  const lines = await q(U('proposal-line')).findMany({ where: { version: { documentId: DIN(docIds(versions)) } }, select: ['id', 'documentId'] });
  const opps = await q(U('opportunity')).findMany({ where: byClient, select: ['id', 'documentId'] });
  const projects = await q(U('project')).findMany({ where: byClient, select: ['id', 'documentId'] });
  const workstreams = await q(U('workstream')).findMany({ where: { project: { documentId: DIN(docIds(projects)) } }, select: ['id', 'documentId'] });
  const invoices = await q(U('invoice')).findMany({ where: byClient, select: ['id', 'documentId'] });
  const entries = await q(U('commission-entry')).findMany({
    where: { $or: [byClient, { sales_person: { documentId: DIN(spDocs) } }] }, select: ['id', 'documentId'],
  });
  const wsWhere = { workstream: { documentId: DIN(docIds(workstreams)) } };
  const projWhere = { project: { documentId: DIN(docIds(projects)) } };

  // children first, parents last
  const steps = [
    ['commission disputes', U('commission-dispute'), { entry: { documentId: DIN(docIds(entries)) } }],
    ['commission entries', U('commission-entry'), { id: IN(ids(entries)) }],
    ['payments', U('payment'), { invoice: { documentId: DIN(docIds(invoices)) } }],
    ['CRM invoices', U('invoice'), { id: IN(ids(invoices)) }],
    ['billing items', U('billing-item'), projWhere],
    ['milestones', U('milestone'), wsWhere],
    ['tasks', U('task'), projWhere],
    ['cost entries', U('cost-entry'), wsWhere],
    ['recurring rules', U('recurring-rule'), wsWhere],
    ['procurement orders', U('procurement-order'), wsWhere],
    ['change requests', U('change-request'), projWhere],
    ['baselines', U('baseline'), projWhere],
    ['project contacts', U('project-contact'), projWhere],
    ['workstreams', U('workstream'), { id: IN(ids(workstreams)) }],
    ['LPOs', U('lpo'), byClient],
    ['contract amendments', U('contract-amendment'), { contract: { client: { documentId: DIN(clientDocs) } } }],
    ['contracts', U('contract'), byClient],
    ['projects', U('project'), { id: IN(ids(projects)) }],
    ['approval requests', U('approval-request'), { $or: [{ version: { documentId: DIN(docIds(versions)) } }, { requested_by: { documentId: DIN(profileDocs) } }] }],
    ['line contributors', U('line-contributor'), { $or: [{ line: { documentId: DIN(docIds(lines)) } }, { sales_person: { documentId: DIN(spDocs) } }] }],
    ['proposal lines', U('proposal-line'), { id: IN(ids(lines)) }],
    ['proposal versions', U('proposal-version'), { id: IN(ids(versions)) }],
    ['proposals', U('proposal'), { id: IN(ids(proposals)) }],
    ['stage history', U('stage-history'), { opportunity: { documentId: DIN(docIds(opps)) } }],
    ['opportunity contributors', U('opportunity-contributor'), { $or: [{ opportunity: { documentId: DIN(docIds(opps)) } }, { sales_person: { documentId: DIN(spDocs) } }] }],
    ['interactions', U('interaction'), { $or: [byClient, { sales_person: { documentId: DIN(spDocs) } }] }],
    ['opportunities', U('opportunity'), { id: IN(ids(opps)) }],
    ['contacts', U('contact'), byClient],
    ['client assignments', U('client-assignment'), { $or: [byClient, { sales_person: { documentId: DIN(spDocs) } }] }],
    ['client profiles', U('client-profile'), byClient],
    ['documents', U('document'), byClient],
    ['notifications', U('notification'), { recipient: { documentId: DIN(profileDocs) } }],
    ['targets', U('target'), { $or: [{ profile: { documentId: DIN(profileDocs) } }, { sales_person: { documentId: DIN(spDocs) } }] }],
  ];
  const work = [];
  for (const [what, uid, where] of steps) {
    const rows = await q(uid).findMany({ where, select: ['id'] });
    note(what, rows);
    work.push([uid, rows]);
  }

  // teams: only if every member is a demo profile
  const teamRows = await q(U('team')).findMany({ where: { name: { $in: DEMO_TEAMS } }, populate: { members: { select: ['id', 'documentId'] } } });
  const teams = teamRows.filter((t) => (t.members || []).every((m) => profileDocs.includes(m.documentId)));
  note('teams', teams);
  // sample catalogue: only if no remaining (non-demo) proposal line uses it
  const products = [];
  for (const p of await q(U('product')).findMany({ where: { code: { $in: SAMPLE_PRODUCT_CODES } }, select: ['id', 'documentId', 'code'] })) {
    const used = await q(U('proposal-line')).count({ where: { product: { id: p.id }, id: { $notIn: ids(lines).length ? ids(lines) : [-1] } } });
    if (!used) products.push(p);
  }
  note('sample products', products);
  const providers = await q(U('provider')).findMany({ where: { name: SAMPLE_PROVIDER }, select: ['id'] });
  note('sample provider', providers);

  note('CRM profiles (demo logins)', profiles);
  note('adverts (demo only)', adverts);
  note('clients (demo only)', clients);
  note('sales persons (@demo.vg)', sps);
  note('logins (@demo.vg)', users);

  // ---------- 3. report ----------
  console.log(CONFIRM ? '\nRemoving demo data:' : '\nDRY RUN — nothing is removed. Re-run with --confirm to remove:');
  plan.filter((p) => p.count).forEach((p) => console.log(`  ${String(p.count).padStart(5)}  ${p.what}`));
  if (kept.length) { console.log('\nKept because real data is attached:'); kept.forEach((k) => console.log(`  - ${k}`)); }
  if (!plan.some((p) => p.count)) console.log('  No demo data found.');

  // ---------- 4. remove ----------
  if (CONFIRM) {
    for (const [uid, rows] of work) if (rows.length) await q(uid).deleteMany({ where: { id: IN(ids(rows)) } });
    for (const [uid, rows] of [[U('team'), teams], [U('product'), products], [U('provider'), providers], [U('profile'), profiles]]) {
      if (rows.length) await q(uid).deleteMany({ where: { id: IN(ids(rows)) } });
    }
    // existing collections: one record at a time through the Document Service, so link tables are cleaned too
    for (const [uid, rows] of [[ADVERT, adverts], [CLIENT, clients], [SP, sps]]) {
      for (const r of rows) await app.documents(uid).delete({ documentId: r.documentId });
    }
    for (const u of users) await q(USER).delete({ where: { id: u.id } });
    console.log('\nDone. CRM configuration (stages, approval rules, commission policy, lookups) was kept.');
  }
  await app.destroy();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
