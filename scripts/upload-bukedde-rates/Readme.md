
scripts/
├── populate-bukedde-rate-cards.js
└── data/
    └── bukedde-rate-cards.json

# from project root, with Strapi running
node scripts/populate-bukedde-rate-cards.js --dry-run       # preview, no writes
node scripts/populate-bukedde-rate-cards.js                 # actually create the records
node scripts/populate-bukedde-rate-cards.js --skip-existing # re-runnable without duplicates

Before running: open populate-bukedde-rate-cards.js and check the STRAPI_URL constant near the top — it defaults to http://localhost:1337, edit it if your Strapi runs elsewhere.

What it does: looks up the bukedde and bukedde ku wiikendi products by product_name, then creates one rate-card entry per row in the JSON file, linked to the right product via { connect: [productId] }.

One thing to flag: since there's no auth token, this only works if find (on product) and create (on rate-card) are open to the public role in Strapi's permissions settings. If you get 403 errors, that's the fix.
