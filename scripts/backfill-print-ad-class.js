// scripts/backfill-print-ad-class.js
//
// Workflow re-order, Phase 0. Sets Display / Classified on every existing
// print advert that has no class yet — no manual step (decision 1 Nov 2026):
//   classified  when the rate card's ad_type contains "classified"
//               or its size_dimension contains "per word"
//   display     otherwise (including adverts with no rate card)
// Non-print adverts are left without a class.
//
// Writes an audit CSV (logs/print-ad-class-backfill-<timestamp>.csv) of every
// value set and the rule that set it, for correction later in Field Correction.
//
//   node scripts/backfill-print-ad-class.js            # dry run (default)
//   node scripts/backfill-print-ad-class.js --apply    # write
'use strict';

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');
const { classifyFromRateCard } = require('../src/api/_vgams-helpers/vgams-workflow');

const APPLY = process.argv.includes('--apply');

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  let app;
  try {
    app = await createStrapi({
      // JS project: config lives at the project root. A TypeScript build
      // would put it in ./dist instead — use that if it exists.
      appDir: process.cwd(),
      distDir: fs.existsSync(path.join(process.cwd(), 'dist', 'config')) ? path.join(process.cwd(), 'dist') : process.cwd(),
      autoReload: false,
      serveAdminPanel: false,
    }).load();

    const adverts = await app.db.query('api::advert.advert').findMany({
      where: { print_ad_class: { $null: true } },
      select: ['id', 'reference_number', 'advert_title', 'ad_size'],
      populate: {
        product: { select: ['id', 'product_name'], populate: { category: { select: ['category_type'] } } },
        rate_card: { select: ['id', 'ad_type', 'size_dimension'] },
      },
      limit: 100000,
    });

    const rows = [];
    for (const a of adverts) {
      if (a.product?.category?.category_type !== 'print') continue;
      const fromRate = classifyFromRateCard(a.rate_card);
      rows.push({
        id: a.id,
        reference: a.reference_number,
        title: a.advert_title,
        product: a.product?.product_name || '',
        rateCardId: a.rate_card?.id || '',
        rateAdType: a.rate_card?.ad_type || '',
        rateSize: a.rate_card?.size_dimension || '',
        printAdClass: fromRate || 'display',
        rule: fromRate === 'classified' ? 'rate card: classified / per word'
          : fromRate === 'display' ? 'rate card: not classified'
          : 'no rate card → display',
      });
    }

    const summary = rows.reduce((acc, r) => { acc[r.printAdClass] = (acc[r.printAdClass] || 0) + 1; return acc; }, {});
    console.log(`\nAdverts with no class: ${adverts.length}; print among them: ${rows.length}`);
    console.table(summary);
    console.log(`No rate card (defaulted to display): ${rows.filter(r => !r.rateCardId).length}`);

    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const csvPath = path.join(logsDir, `print-ad-class-backfill-${APPLY ? 'applied' : 'dryrun'}-${stamp}.csv`);
    const header = ['id', 'reference', 'title', 'product', 'rateCardId', 'rateAdType', 'rateSize', 'printAdClass', 'rule'];
    fs.writeFileSync(csvPath, [header.join(','), ...rows.map(r => header.map(h => csvCell(r[h])).join(','))].join('\n'));
    console.log(`Audit CSV: ${csvPath}`);

    if (!APPLY) {
      console.log('\nDry run — nothing written. Re-run with --apply to write.\n');
      return;
    }

    let done = 0;
    for (const r of rows) {
      await app.db.query('api::advert.advert').update({ where: { id: r.id }, data: { print_ad_class: r.printAdClass } });
      done += 1;
      if (done % 200 === 0) console.log(`  … ${done}/${rows.length}`);
    }
    console.log(`\n✅ Set print_ad_class on ${done} advert(s).\n`);
  } catch (err) {
    console.error('❌ backfill-print-ad-class failed:', err);
    process.exitCode = 1;
  } finally {
    if (app) await app.destroy();
  }
}

main();