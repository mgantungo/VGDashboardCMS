'use strict';

/**
 * Demo data for a DEV or STAGING copy of the CMS only.
 * Creates sample sales persons, clients, adverts (for the ownership backfill),
 * CRM teams, a sample catalogue and logins. It refuses to run when
 * NODE_ENV=production or when the CMS already holds more than 50 clients.
 *
 *   node scripts/crm-demo-seed.js            (run with Strapi stopped)
 *   node scripts/crm-demo-seed.js --force    (skip the client-count guard)
 */
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const PEOPLE = [
  ['Grace Nakato', 'grace@demo.vg', 'Corporate Sales · Kampala', 'salesperson', 'Print'],
  ['Sarah Achieng', 'sarah@demo.vg', 'Corporate Sales · Kampala', 'salesperson', 'Radio'],
  ['Moses Tumwine', 'moses@demo.vg', 'Corporate Sales · Kampala', 'salesperson', 'Print'],
  ['Ivan Mukasa', 'ivan@demo.vg', 'Corporate Sales · Kampala', 'salesperson', 'Print'],
  ['Patricia Aber', 'patricia@demo.vg', 'Corporate Sales · Kampala', 'salesperson', 'Print'],
  ['Daniel Okello', 'daniel@demo.vg', 'Digital', 'salesperson', 'Digital'],
  ['Joan Akello', 'joan@demo.vg', 'TV', 'salesperson', 'TV'],
];
const STAFF = [
  ['Martha Kiiza', 'martha@demo.vg', 'supervisor', 'Corporate Sales · Kampala'],
  ['Joseph Mugisha', 'joseph@demo.vg', 'senior_manager', null],
  ['Ruth Finance', 'finance@demo.vg', 'finance', null],
  ['Brian Ssali', 'brian@demo.vg', 'project_manager', null],
];
const CLIENTS = [
  ['Rwenzori Dairy Co.', 'Agnes Atim', 'Grace Nakato', 'credit_30'],
  ['Lakeside Telecom', 'James Okiror', 'Grace Nakato', 'credit_30'],
  ['Pearl Agro Ltd', 'Rose Namutebi', 'Grace Nakato', 'cash'],
  ['Mbale Cement Works', 'Paul Wafula', 'Grace Nakato', 'credit_15'],
  ['Bwindi Lodges', 'Esther Ninsiima', 'Sarah Achieng', 'cash'],
  ['Masaka Coffee Union', 'Peter Ssekandi', 'Sarah Achieng', 'cash'],
  ['Tororo Motors', 'Ali Wabwire', 'Moses Tumwine', 'credit_30'],
  ['Kabale Hardware', 'Grace Tumusiime', 'Moses Tumwine', 'cash'],
  ['Mukono Water Co.', 'Robert Ssempala', 'Moses Tumwine', 'cash'],
  ['Hoima Oil Services', 'Allan Byaruhanga', 'Moses Tumwine', 'credit_30'],
  ['Kampala City Pharmacy', 'Hellen Nabirye', 'Ivan Mukasa', 'cash'],
  ['Nakasongola Ranch', 'Simon Ochola', 'Patricia Aber', 'cash'],
];

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production.');
  const app = await createStrapi(await compileStrapi()).load();
  const D = (uid) => app.documents(uid);
  const count = await D('api::client.client').count({});
  if (count > 50 && !process.argv.includes('--force')) throw new Error(`This CMS already has ${count} clients. Use --force on a staging copy only.`);

  await app.service('api::crm-core.crm-config').seed({ sampleCatalogue: true });
  const bu = async (name) => (await D('api::crm-business-unit.crm-business-unit').findFirst({ filters: { name } }))?.documentId;

  const sp = {};
  for (const [name, email] of PEOPLE) {
    sp[name] = (await D('api::vgams-sales-person.vgams-sales-person').findFirst({ filters: { email } }))
      || await D('api::vgams-sales-person.vgams-sales-person').create({ data: { name, email, isActive: true } });
  }
  const clients = {};
  for (const [company, contact, , terms] of CLIENTS) {
    clients[company] = (await D('api::client.client').findFirst({ filters: { company_name: company } }))
      || await D('api::client.client').create({ data: { company_name: company, contact_person: contact, phone: '0700000000', payment_terms: terms, is_active: true } });
  }
  // adverts give the ownership backfill something to learn from
  if (app.contentTypes['api::advert.advert']) {
    for (const [company, , seller] of CLIENTS) {
      const n = company === 'Rwenzori Dairy Co.' ? 3 : 1;
      for (let i = 0; i < n; i += 1) {
        await D('api::advert.advert').create({ data: { client: clients[company].documentId, vgams_sales_persons: [sp[seller].documentId] } });
      }
    }
    await D('api::advert.advert').create({ data: { client: clients['Rwenzori Dairy Co.'].documentId, vgams_sales_persons: [sp['Daniel Okello'].documentId] } });
  }

  const teams = {};
  for (const [name, unit] of [['Corporate Sales · Kampala', 'Print'], ['Digital', 'Digital'], ['TV', 'TV']]) {
    teams[name] = (await D('api::crm-team.crm-team').findFirst({ filters: { name } }))
      || await D('api::crm-team.crm-team').create({ data: { name, business_unit: await bu(unit), is_active: true } });
  }

  // logins (password: Passw0rd!) and CRM profiles
  const up = app.plugin('users-permissions');
  const role = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'authenticated' } });
  const makeUser = async (name, email) => {
    const existing = await app.db.query('plugin::users-permissions.user').findOne({ where: { email } });
    if (existing) return existing;
    return up.service('user').add({ username: email.split('@')[0], email, password: 'Passw0rd!', provider: 'local', confirmed: true, blocked: false, role: role.id });
  };
  const profile = async (user, data) => {
    const P = D('api::crm-profile.crm-profile');
    const existing = await P.findFirst({ filters: { user: { id: user.id } } });
    return existing ? P.update({ documentId: existing.documentId, data }) : P.create({ data: { user: user.documentId, ...data } });
  };
  const admin = await makeUser('CRM Admin', 'admin@demo.vg');
  await profile(admin, { display_name: 'CRM Admin', crm_role: 'admin' });
  for (const [name, email, team, crmRole, unit] of PEOPLE) {
    const u = await makeUser(name, email);
    await profile(u, { display_name: name, crm_role: crmRole, sales_person: sp[name].documentId, team: teams[team].documentId, business_unit: await bu(unit), monthly_target: '250000000' });
  }
  for (const [name, email, crmRole, team] of STAFF) {
    const u = await makeUser(name, email);
    const p = await profile(u, { display_name: name, crm_role: crmRole, team: team ? teams[team].documentId : null });
    if (crmRole === 'supervisor') await D('api::crm-team.crm-team').update({ documentId: teams[team].documentId, data: { supervisor: p.documentId } });
  }
  console.log('Demo data ready. Logins: admin@, grace@, martha@, joseph@, finance@, brian@ (all @demo.vg), password Passw0rd!');
  await app.destroy();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); });
