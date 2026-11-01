// scripts/seed-ad-size-presets.js
//
// Creates the starting list of print size presets Copy Desk picks from.
// They are shared by every masthead (no product set). Columns and height are
// left empty because they depend on each masthead's page size — fill them in
// the Strapi admin (Content Manager › Ad Size Preset). To give one masthead a
// different "Half page vertical", add a preset with the same name and set its
// Product; it then replaces the shared one for that masthead.
//
// Presets that already exist (same name, no product) are left untouched.
//
//   node scripts/seed-ad-size-presets.js            # dry run (default)
//   node scripts/seed-ad-size-presets.js --apply    # write
//
// Run from the project root (where package.json is). Reads the same .env as Strapi.
'use strict';

const fs = require('fs');
const path = require('path');
const { createStrapi } = require('@strapi/strapi');

const APPLY = process.argv.includes('--apply');

const PRESETS = [
  { name: 'Full page',             orientation: 'any',        page_fraction: 1,     sort_order: 10 },
  { name: 'Half page horizontal',  orientation: 'horizontal', page_fraction: 0.5,   sort_order: 20 },
  { name: 'Half page vertical',    orientation: 'vertical',   page_fraction: 0.5,   sort_order: 30 },
  { name: 'Quarter page',          orientation: 'any',        page_fraction: 0.25,  sort_order: 40 },
  { name: 'Eighth page',           orientation: 'any',        page_fraction: 0.125, sort_order: 50 },
  { name: 'Strip (bottom)',        orientation: 'horizontal', page_fraction: null,  sort_order: 60 },
];

async function main() {
  let app;
  try {
    app = await createStrapi({
      appDir: process.cwd(),
      distDir: fs.existsSync(path.join(process.cwd(), 'dist', 'config')) ? path.join(process.cwd(), 'dist') : process.cwd(),
      autoReload: false,
      serveAdminPanel: false,
    }).load();

    const existing = await app.db.query('api::ad-size-preset.ad-size-preset').findMany({
      where: { product: { id: { $null: true } } },
      select: ['id', 'name'],
      limit: 1000,
    });
    const have = new Set(existing.map(p => String(p.name).toLowerCase()));
    const toCreate = PRESETS.filter(p => !have.has(p.name.toLowerCase()));

    console.log(`\nShared presets already present: ${existing.length}`);
    console.table(PRESETS.map(p => ({ name: p.name, orientation: p.orientation, page_fraction: p.page_fraction ?? '—', action: have.has(p.name.toLowerCase()) ? 'exists' : 'create' })));

    if (!APPLY) {
      console.log('\nDry run — nothing written. Re-run with --apply to write.\n');
      return;
    }
    for (const p of toCreate) {
      await app.db.query('api::ad-size-preset.ad-size-preset').create({
        data: { ...p, applies_to: 'display', is_active: true, columns: null, height_cm: null },
      });
    }
    console.log(`\n✅ Created ${toCreate.length} preset(s). Fill in columns and height in the admin panel.\n`);
  } catch (err) {
    console.error('❌ seed-ad-size-presets failed:', err);
    process.exitCode = 1;
  } finally {
    if (app) await app.destroy();
  }
}

main();
