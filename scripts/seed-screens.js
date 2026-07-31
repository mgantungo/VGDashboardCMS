/**
 * Seeds the "Screen" + "Broadcast Source" collections for the two
 * billboards below. Idempotent — safe to re-run; it skips any screen
 * whose slug already exists instead of duplicating it.
 *
 * Usage (from your Strapi project root, with Strapi already running):
 *
 *   STRAPI_URL=http://localhost:1337 \
 *   STRAPI_API_TOKEN=xxxxx \
 *   node scripts/seed-screens.js
 *
 * STRAPI_API_TOKEN needs create permission on both collections.
 * Generate one in the admin: Settings → API Tokens → Create new API Token
 * (Token type: Full access, or Custom with create on screen + broadcast-source).
 */

const STRAPI_URL = 'http://localhost:1337';
//const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;
const STRAPI_API_TOKEN = '4e4bf47ecf04a3375c7db71eb55a62cc096691b998b8b58ea714340586245d5f95958ec23d56e251db4c673eeac6cd11646189c87ca04a7d91d9bc36056df15d4ffb980620db1cacabef1ccbf72da141c5f6dd838b63f7892b63b0c5ba9159d86b4d15c97df9860274e174ca0ee6b4a314454b663f4cabed8d359c842af07849';

if (!STRAPI_API_TOKEN) {
  console.error('Missing STRAPI_API_TOKEN env var. See the comment at the top of this file.');
  process.exit(1);
}

// Screen dimensions are stored as { width, height } in the schema —
// converting from the H×W the user gave us for each physical panel.
const SCREENS = [
  {
    name: 'Wandegeya',
    slug: 'wandegeya',
    width: 840,   // W
    height: 1080, // H — portrait panel
    pollInterval: 300,
    staleAfter: 60,
    offlineAfter: 300,
    location: 'Wandegeya',
    initialSource: {
      title: 'Wandegeya Live Feed',
      type: 'youtube',
      value: 'QP4TOkJkVLs', // placeholder — replace with the real video ID
      isActive: true,
      order: 1,
    },
  },
  {
    name: 'Church House',
    slug: 'church-house',
    width: 1080,  // W
    height: 840,  // H — landscape panel
    pollInterval: 300,
    staleAfter: 60,
    offlineAfter: 300,
    location: 'Church House',
    initialSource: {
      title: 'Church House Live Feed',
      type: 'youtube',
      value: 'QP4TOkJkVLs', // placeholder — replace with the real video ID
      isActive: true,
      order: 1,
    },
  },
];

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${STRAPI_API_TOKEN}`,
};

async function findScreenBySlug(slug) {
  const res = await fetch(
    `${STRAPI_URL}/api/screens?filters[slug][$eq]=${encodeURIComponent(slug)}`,
    { headers }
  );
  if (!res.ok) throw new Error(`GET /api/screens failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data?.[0] || null;
}

async function createScreen(screen) {
  const { initialSource, ...data } = screen;
  const res = await fetch(`${STRAPI_URL}/api/screens`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
  if (!res.ok) throw new Error(`POST /api/screens failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data;
}

async function createBroadcastSource(screenDocumentId, source) {
  const res = await fetch(`${STRAPI_URL}/api/broadcast-sources`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      data: { ...source, screen: screenDocumentId },
    }),
  });
  if (!res.ok) {
    throw new Error(`POST /api/broadcast-sources failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).data;
}

async function seed() {
  for (const screen of SCREENS) {
    const existing = await findScreenBySlug(screen.slug);

    if (existing) {
      console.log(`↷ Skipping "${screen.slug}" — already exists (documentId: ${existing.documentId})`);
      continue;
    }

    const created = await createScreen(screen);
    console.log(`✓ Created screen "${screen.slug}" (${screen.width}×${screen.height})`);

    const source = await createBroadcastSource(created.documentId, screen.initialSource);
    console.log(`  ↳ Added active broadcast source "${source.title}" (${source.type}: ${source.value})`);
  }

  console.log('\nDone. Visit /screen/wandegeya and /screen/church-house once your Nuxt app is running.');
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
