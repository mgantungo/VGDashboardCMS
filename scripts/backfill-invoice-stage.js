// scripts/backfill-invoice-stage.js
//
// Workflow re-order, Phase 0. Adverts that already have an invoice record
// (e.g. from the BC payment monitor) are marked invoice_stage = 'invoiced'
// so they never show up in the Invoicing Officer's queue. Everything else
// keeps the schema default ('not_ready'); the queue computes 'ready' live.
//
//   node scripts/backfill-invoice-stage.js            # dry run (default)
//   node scripts/backfill-invoice-stage.js --apply    # write
'use strict';

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');

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

    const invoices = await app.db.query('api::invoice.invoice').findMany({
      select: ['id', 'invoice_number', 'createdAt'],
      populate: { advert: { select: ['id', 'invoice_stage'] } },
      limit: 100000,
    });

    const targets = invoices
      .filter(inv => inv.advert && inv.advert.invoice_stage !== 'invoiced')
      .map(inv => ({ advertId: inv.advert.id, invoiceId: inv.id, invoicedAt: inv.createdAt }));

    // Also null stages left by rows created before the column existed
    const nullStage = await app.db.query('api::advert.advert').count({ where: { invoice_stage: { $null: true } } });

    console.log(`\nInvoices: ${invoices.length}; adverts to mark invoiced: ${targets.length}`);
    console.log(`Adverts with no invoice_stage (will be set to not_ready): ${nullStage}`);

    if (!APPLY) {
      console.log('\nDry run — nothing written. Re-run with --apply to write.\n');
      return;
    }

    for (const t of targets) {
      await app.db.query('api::advert.advert').update({
        where: { id: t.advertId },
        data: { invoice_stage: 'invoiced', invoiced_at: t.invoicedAt, invoice: t.invoiceId },
      });
    }
    if (nullStage > 0) {
      await app.db.query('api::advert.advert').updateMany({
        where: { invoice_stage: { $null: true } },
        data: { invoice_stage: 'not_ready' },
      });
    }
    console.log(`\n✅ Marked ${targets.length} advert(s) invoiced; ${nullStage} set to not_ready.\n`);
  } catch (err) {
    console.error('❌ backfill-invoice-stage failed:', err);
    process.exitCode = 1;
  } finally {
    if (app) await app.destroy();
  }
}

main();