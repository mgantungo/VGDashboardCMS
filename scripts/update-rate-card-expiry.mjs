/**
 * One-time script: bulk-update expiry_date on all rate-card entries.
 *
 * Usage (run from your Strapi project root, e.g. /path/to/vgams-backend):
 *   node update-rate-card-expiry.mjs
 *
 * Change TARGET_EXPIRY_DATE and WHERE_CLAUSE below before running.
 */

import { createStrapi, compileStrapi } from '@strapi/strapi';

// ---- Configure ----
const TARGET_EXPIRY_DATE = '2026-12-31'; // format: YYYY-MM-DD

// Leave as {} to update every entry. Example filter (only blank expiry dates):
// const WHERE_CLAUSE = { expiry_date: null };
const WHERE_CLAUSE = {};
// --------------------

async function run() {
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error'; // keep console output clean

  try {
    const result = await app.db.query('api::rate-card.rate-card').updateMany({
      where: WHERE_CLAUSE,
      data: {
        expiry_date: TARGET_EXPIRY_DATE,
      },
    });

    console.log(`✅ Updated ${result.count} rate card entries to expiry_date = ${TARGET_EXPIRY_DATE}`);
  } catch (err) {
    console.error('❌ Update failed:', err);
    process.exitCode = 1;
  } finally {
    await app.destroy();
  }
}

run();
