/**
 * scripts/upload-bukedde-rates/update-bukedde-rate-cards.js
 *
 * Populates the `rate-card` (api::rate-card.rate-card) collection in Strapi
 * with Bukedde and Bukedde Ku Wiikendi rate card data.
 *
 * Matches each rate card row to its parent Product via `product_name`:
 *   - "bukedde"             -> Product.product_name === "bukedde"
 *   - "bukedde_ku_wiikendi" -> Product.product_name === "bukedde ku wiikendi"
 *
 * Usage:
 *   node scripts/populate-bukedde-rate-cards.js                     # live run (creates only)
 *   node scripts/populate-bukedde-rate-cards.js --dry-run           # preview only, no writes
 *   node scripts/populate-bukedde-rate-cards.js --skip-existing     # skip rows that already exist
 *   node scripts/populate-bukedde-rate-cards.js --update-existing   # update rows that already exist
 *                                                                    instead of skipping (e.g. to backfill
 *                                                                    full_color_no/black_color_no on rows
 *                                                                    created before those fields existed)
 *   node scripts/populate-bukedde-rate-cards.js --update-existing --dry-run   # preview updates only
 *
 * --skip-existing and --update-existing are mutually exclusive; if both are passed,
 * --update-existing wins.
 *
 * Requires Node 18+ (uses global fetch). If you see "require is not defined",
 * rename this file to populate-bukedde-rate-cards.cjs and re-run.
 *
 * Before running, edit STRAPI_URL below if it's not running on localhost:1337.
 */

const fs = require('fs');
const path = require('path');

// ---- Edit this before running if needed ----
// Using 127.0.0.1 instead of localhost avoids a common Node/undici issue where
// fetch resolves "localhost" to ::1 (IPv6) and gets ECONNREFUSED if Strapi is
// only listening on IPv4 — even though curl against the same URL works fine.
const STRAPI_URL = 'http://127.0.0.1:1337';
// ----------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const UPDATE_EXISTING = process.argv.includes('--update-existing');
const SKIP_EXISTING = process.argv.includes('--skip-existing') && !UPDATE_EXISTING;

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

function formatCodes(row) {
  const fc = row.full_color_no || '—';
  const bw = row.black_color_no || '—';
  return `[FC: ${fc} | BW: ${bw}]`;
}

let productListCache = null;

async function fetchAllProducts() {
  if (productListCache) return productListCache;

  const url = `${STRAPI_URL}/api/products`;
  const res = await fetch(url, { headers: jsonHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch products list: ${res.status} ${res.statusText} - ${body}`);
  }
  const json = await res.json();

  // This instance's /api/products returns a raw array, not the standard
  // Strapi { data: [...], meta: {...} } wrapper (likely a custom controller).
  // Support both shapes just in case that changes later.
  productListCache = Array.isArray(json) ? json : (json.data || []);
  return productListCache;
}

async function findProductByName(productName) {
  const products = await fetchAllProducts();
  const target = productName.trim().toLowerCase();

  const matches = products.filter(
    (p) => (p.product_name || '').trim().toLowerCase() === target
  );

  if (matches.length === 0) {
    console.log(`    (debug) no product with product_name matching "${productName}" among ${products.length} products fetched.`);
    return null;
  }

  if (matches.length > 1) {
    console.warn(`    (warning) multiple products matched "${productName}", using the first one (id: ${matches[0].id})`);
  }

  return matches[0];
}

function findMatchingRateCard(product, { ad_type, size_dimension }) {
  const existing = product.rate_cards || [];
  const normalize = (s) => (s || '').trim().toLowerCase();
  return (
    existing.find(
      (rc) =>
        normalize(rc.ad_type) === normalize(ad_type) &&
        normalize(rc.size_dimension) === normalize(size_dimension)
    ) || null
  );
}

async function createRateCard(productId, row) {
  const payload = {
    data: {
      product: { connect: [productId] },
      ...buildRateCardData(row),
    },
  };

  if (DRY_RUN) {
    console.log(`  [dry-run] would create: ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''} ${formatCodes(row)}`);
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

function buildRateCardData(row) {
  return {
    ad_type: row.ad_type,
    size_dimension: row.size_dimension || null,
    price_fc: row.price_fc,
    price_bw: row.price_bw,
    currency: row.currency || 'UGX',
    base_unit_of_measure: row.base_unit_of_measure || 'ADS',
    effective_date: row.effective_date,
    expiry_date: row.expiry_date,
    surcharge_percentage: row.surcharge_percentage ?? 0,
    full_color_no: row.full_color_no ?? null,
    black_color_no: row.black_color_no ?? null,
  };
}

async function updateRateCard(documentId, row) {
  if (DRY_RUN) {
    console.log(`  [dry-run] would update: ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''} ${formatCodes(row)}`);
    return { dryRun: true };
  }

  const res = await fetch(`${STRAPI_URL}/api/rate-cards/${documentId}`, {
    method: 'PUT',
    headers: jsonHeaders(),
    body: JSON.stringify({ data: buildRateCardData(row) }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Update failed for "${row.ad_type}": ${res.status} ${res.statusText} - ${errBody}`);
  }

  return { dryRun: false };
}

async function verifyRateCardBelongsToProduct(documentId, expectedProductId) {
  const url = `${STRAPI_URL}/api/rate-cards/${documentId}?populate=product`;
  const res = await fetch(url, { headers: jsonHeaders() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to verify rate-card ${documentId}: ${res.status} ${res.statusText} - ${body}`);
  }
  const json = await res.json();
  // Handle either raw record or { data: {...} } wrapper shape.
  const record = json && json.data ? json.data : json;
  const actualProductId = record?.product?.id;
  return actualProductId === expectedProductId;
}

function checkForDuplicateCodes(data) {
  const codeMap = new Map(); // code -> [{masthead, ad_type, size_dimension}]

  for (const [mastheadKey, mastheadInfo] of Object.entries(data)) {
    for (const row of mastheadInfo.rates || []) {
      for (const [field, code] of [['full_color_no', row.full_color_no], ['black_color_no', row.black_color_no]]) {
        if (!code) continue;
        const label = `${mastheadKey} / ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''} [${field}]`;
        if (!codeMap.has(code)) codeMap.set(code, []);
        codeMap.get(code).push(label);
      }
    }
  }

  const duplicates = [...codeMap.entries()].filter(([, labels]) => {
    // Same code reused for genuinely different ad_types is suspicious;
    // reused across mastheads for the *same* ad_type is expected (shared BC item).
    const distinctAdTypes = new Set(labels.map((l) => l.split(' / ')[1].split(' [')[0]));
    return distinctAdTypes.size > 1;
  });

  if (duplicates.length > 0) {
    console.warn('\n⚠ Warning: the following BC codes are assigned to more than one distinct ad_type — double-check the mapping:');
    for (const [code, labels] of duplicates) {
      console.warn(`  ${code}:`);
      labels.forEach((l) => console.warn(`    - ${l}`));
    }
    console.warn('');
  }
}

async function run() {
  console.log(`Using STRAPI_URL: ${STRAPI_URL}`);

  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Data file not found: ${DATA_FILE}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);

  checkForDuplicateCodes(data);

  const summary = { created: 0, updated: 0, skipped: 0, failed: 0, total: 0 };

  for (const [mastheadKey, mastheadInfo] of Object.entries(data)) {
    const productName = PRODUCT_NAME_MAP[mastheadKey];
    if (!productName) {
      console.warn(`No product_name mapping for "${mastheadKey}", skipping section.`);
      continue;
    }

    console.log(`\n=== ${mastheadInfo.masthead} (product_name: "${productName}") ===`);

    let product;
    try {
      product = await findProductByName(productName);
    } catch (err) {
      console.error(`  ERROR looking up product: ${formatError(err)}`);
      continue;
    }

    if (!product) {
      console.error(`  Product "${productName}" not found in Strapi. Create it first, then re-run.`);
      continue;
    }

    console.log(`  Found product id: ${product.id} (${(product.rate_cards || []).length} existing rate cards)`);

    const rows = mastheadInfo.rates || [];
    for (const row of rows) {
      summary.total += 1;
      try {
        const match = findMatchingRateCard(product, {
          ad_type: row.ad_type,
          size_dimension: row.size_dimension,
        });

        if (match) {
          if (UPDATE_EXISTING) {
            const belongsToProduct = await verifyRateCardBelongsToProduct(match.documentId, product.id);
            if (!belongsToProduct) {
              console.error(`  [fail] "${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''}" matched documentId ${match.documentId} but it does NOT belong to product ${product.id} (${productName}) — refusing to update. This likely means another product has a rate card with the same ad_type/size_dimension.`);
              summary.failed += 1;
              continue;
            }

            const result = await updateRateCard(match.documentId, row);
            if (!result.dryRun) {
              console.log(`  [updated] ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''} ${formatCodes(row)}`);
              summary.updated += 1;
            }
            continue;
          }

          if (SKIP_EXISTING) {
            console.log(`  [skip] already exists: ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''}`);
            summary.skipped += 1;
            continue;
          }

          console.warn(`  [warning] "${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''}" already exists — creating anyway will duplicate it. Use --skip-existing or --update-existing.`);
        }

        const result = await createRateCard(product.id, row);
        if (!result.dryRun) {
          console.log(`  [ok] created: ${row.ad_type}${row.size_dimension ? ` (${row.size_dimension})` : ''} ${formatCodes(row)}`);
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
  console.log(`Updated:       ${summary.updated}${DRY_RUN ? ' (dry-run, nothing written)' : ''}`);
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
