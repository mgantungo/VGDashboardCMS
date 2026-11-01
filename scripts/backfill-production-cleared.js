// scripts/backfill-production-cleared.js
//
// Workflow re-order, Phase 0. Marks existing bookings as cleared for
// production (Copy Desk + Design House), matching what the lifecycle now does
// for every new booking: all payment methods are cleared at booking.
//
//   node scripts/backfill-production-cleared.js            # dry run (default)
//   node scripts/backfill-production-cleared.js --apply    # write
//   node scripts/backfill-production-cleared.js --apply --all   # include adverts whose run dates are all past
//
// Run from the project root (where package.json is). Reads the same .env as Strapi.
'use strict';

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');

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
    const today = new Date().toISOString().split('T')[0];

    const adverts = await app.db.query('api::advert.advert').findMany({
      where: { isCanceled: false, $or: [{ production_cleared: false }, { production_cleared: { $null: true } }] },
      select: ['id', 'payment_method', 'publishing_dates', 'start_date', 'end_date', 'isPaid'],
      limit: 100000,
    });

    const candidates = adverts.filter(a => {
      if (ALL) return true;
      const dates = Array.isArray(a.publishing_dates) && a.publishing_dates.length ? a.publishing_dates : [a.end_date || a.start_date];
      return dates.some(d => d && d >= today);
    });

    const byMethod = candidates.reduce((acc, a) => {
      const k = a.payment_method || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    console.log(`\nAdverts not yet cleared: ${adverts.length}`);
    console.log(`To clear (${ALL ? 'all' : 'with a run date today or later'}): ${candidates.length}`);
    console.table(byMethod);

    if (!APPLY) {
      console.log('\nDry run — nothing written. Re-run with --apply to write.\n');
      return;
    }

    const now = new Date();
    let done = 0;
    for (const a of candidates) {
      await app.db.query('api::advert.advert').update({
        where: { id: a.id },
        data: { production_cleared: true, production_cleared_at: now, production_cleared_by: 'backfill' },
      });
      done += 1;
      if (done % 200 === 0) console.log(`  … ${done}/${candidates.length}`);
    }
    console.log(`\n✅ Cleared ${done} advert(s).\n`);
  } catch (err) {
    console.error('❌ backfill-production-cleared failed:', err);
    process.exitCode = 1;
  } finally {
    if (app) await app.destroy();
  }
}

main();