/**
 * One-time script: bulk-update expiry_date on all rate-card entries.
 *
 * Uses require() (CommonJS) to route through @strapi/strapi's CJS build,
 * avoiding the ERR_UNSUPPORTED_DIR_IMPORT (lodash/fp) bug that hits the
 * ESM build when using `import`.
 *
 * NOTE: this only works as plain CommonJS if your package.json does NOT
 * have "type": "module". If it does, either rename this file to .cjs
 * (Node then treats it as CommonJS regardless of package.json), or
 * remove "type": "module" from package.json.
 *
 * Usage (run from your Strapi project root):
 *   node scripts/update-rate-card-expiry.js
 */
 
const { createStrapi, compileStrapi } = require('@strapi/strapi');
 
// ---- Configure ----
const TARGET_EXPIRY_DATE = '2026-12-31'; // format: YYYY-MM-DD
 
// Leave as {} to update every entry. Example filter (only blank expiry dates):
// const WHERE_CLAUSE = { expiry_date: null };
const WHERE_CLAUSE = {};
// --------------------
 
async function run() {
  console.log('Starting Strapi...');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
 
  app.log.level = 'error'; // keep console output clean
 
  try {
    console.log(`Setting expiry date to: ${TARGET_EXPIRY_DATE}`);
 
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
 
