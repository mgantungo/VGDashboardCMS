/**
 * scripts/populate-bukedde-rate-cards.js
 *
 * Populates the `rate-card` (api::rate-card.rate-card) collection in Strapi
 * with Bukedde and Bukedde Ku Wiikendi rate card data.
 *
 * Matches each rate card row to its parent Product via `product_name`:
 *   - "bukedde"             -> Product.product_name === "bukedde"
 *   - "bukedde_ku_wiikendi" -> Product.product_name === "bukedde ku wiikendi"
 *
 * Usage:
 *   node scripts/populate-bukedde-rate-cards.js                 # live run
 *   node scripts/populate-bukedde-rate-cards.js --dry-run       # preview only, no writes
 *   node scripts/populate-bukedde-rate-cards.js --skip-existing # skip rows that already exist
 *
 * Requires Node 18+ (uses global fetch). If you see "require is not defined",
 * rename this file to populate-bukedde-rate-cards.cjs and re-run.
 *
 * Before running, edit STRAPI_URL below if it's not running on localhost:1337.
 */

const fs = require('fs');
const path = require('path');

// ---- Edit this before running if needed ----
const STRAPI_URL = 'http://localhost:1337';
// ----------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EXISTING = process.argv.includes('--skip-existing');

const DATA_FILE = path.join(__dirname, 'data', 'bukedde-rate-cards.json');

// Maps the JSON top-level key -> the product_name value registered in Strapi
const PRODUCT_NAME_MAP = {
  bukedde: 'bukedde',
  bukedde_ku_wiikendi: 'bukedde ku wiikendi',
};

function formatError(err) {
  // Node's fetch wraps the real network error (ECONNREFUSED, ENOTFOUND, cert
  // errors, etc.) inside err.cause and just says "fetch failed" at the top level.
  const cause = err && err.cause ? ` | cause: ${err.cause.code || err.cause.message || err.cause}` : '';
  return `${err.message}${cause}`;
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json' };
}

async function tryFindProduct(productName, operator) {
  const url = `${STRAPI_URL}/api/products?filters[product_name][${operator}]=${encodeURIComponent(productName)}&fields[0]=product_name`;
  const res = await fetch(url, { headers: jsonHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Lookup failed (${operator}) for "${productName}": ${res.status} ${res.statusText} - ${body}`);
  }
  const json = await res.json();
  return { json, url };
}

async function findProductIdByName(productName) {
  // Try exact case-insensitive match first, then fall back to a looser
  // "contains" match in case $eqi is restricted or casing differs.
  let { json, url } = await tryFindProduct(productName, '$eqi');

  if (!json.data?.length) {
    ({ json, url } = await tryFindProduct(productName, '$containsi'));
  }

  if (!json.data?.length) {
    console.log(`    (debug) no match found. Last query: ${url}`);
    return null;
  }

  if (json.data.length > 1) {
    console.warn(`    (warning) multiple products matched "${productName}", using the first one (id: ${json.data[0].id})`);
  }

  return json.data[0].id;
}

async function rateCardExists({ productId, ad_type, size_dimension }) {
  const params = new URLSearchParams();
  params.set('filters[product][id][$eq]', productId);
  params.set('filters[ad_type][$eq]', ad_type);
  if (size_dimension) {
    params.set('filters[size_dimension][$eq]', size_dimension);
  }
  params.set('fields[0]', 'ad_type');

  const url = `${STRAPI_URL}/api/rate-cards?${params.toString()}`;
  const res = await fetch(url, { headers: jsonHeaders() });
  if (!res.ok) {
    throw new Error(`Failed to check existing rate card for "${ad_type}": ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return (json.data?.length || 0) > 0;
}

async function createRateCard(productId, row) {
  const payload = {
    data: {
      product: { connect: [productId] },
      ad_type: row.ad_type,
      size_dimension: row.size_dimension || null,
      price_fc: row.price_fc,
      price_bw: row.price_bw,
      currency: row.currency || 'UGX',
      base_unit_of_measure: row.base_unit_of_measure || 'ADS',
      effective_date: row.effective_date,
      expiry_date: row.expiry_date,
      surcharge_percentage: row.surcharge_percentage ?? 0,
    },
  };

  if (DRY_RUN) {
    console.log(`  [dry-run] would create: ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''}`);
    return { skipped: false, dryRun: true };
  }

  const res = await fetch(`${STRAPI_URL}/api/rate-cards`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Create failed for "${row.ad_type}": ${res.status} ${res.statusText} - ${errBody}`);
  }

  return { skipped: false, dryRun: false };
}

async function run() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Data file not found: ${DATA_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);

  const summary = { created: 0, skipped: 0, failed: 0, total: 0 };

  for (const [mastheadKey, mastheadInfo] of Object.entries(data)) {
    const productName = PRODUCT_NAME_MAP[mastheadKey];
    if (!productName) {
      console.warn(`No product_name mapping for "${mastheadKey}", skipping section.`);
      continue;
    }

    console.log(`\n=== ${mastheadInfo.masthead} (product_name: "${productName}") ===`);

    let productId;
    try {
      productId = await findProductIdByName(productName);
    } catch (err) {
      console.error(`  ERROR looking up product: ${formatError(err)}`);
      continue;
    }

    if (!productId) {
      console.error(`  Product "${productName}" not found in Strapi. Create it first, then re-run.`);
      continue;
    }

    console.log(`  Found product id: ${productId}`);

    const rows = mastheadInfo.rates || [];
    for (const row of rows) {
      summary.total += 1;
      try {
        if (SKIP_EXISTING && !DRY_RUN) {
          const exists = await rateCardExists({
            productId,
            ad_type: row.ad_type,
            size_dimension: row.size_dimension,
          });
          if (exists) {
            console.log(`  [skip] already exists: ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''}`);
            summary.skipped += 1;
            continue;
          }
        }

        const result = await createRateCard(productId, row);
        if (!result.dryRun) {
          console.log(`  [ok] created: ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''}`);
          summary.created += 1;
        }
      } catch (err) {
        console.error(`  [fail] ${row.ad_type}: ${formatError(err)}`);
        summary.failed += 1;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total rows:    ${summary.total}`);
  console.log(`Created:       ${summary.created}${DRY_RUN ? ' (dry-run, nothing written)' : ''}`);
  console.log(`Skipped:       ${summary.skipped}`);
  console.log(`Failed:        ${summary.failed}`);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
