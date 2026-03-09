// src/api/advert/content-types/advert/lifecycles.js
'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Business Central Config — set in your .env:
//
//   BC_BASE_URL   = http://devtest.newvision.co.ug:7069/BC180NUA/api/newvision/adverts/v1.0
//   BC_USERNAME   = your_bc_username
//   BC_PASSWORD   = your_bc_password
// ─────────────────────────────────────────────────────────────────────────────
const BC_BASE_URL = process.env.EXTERNAL_API_BC_BASE_URL || '';
const BC_USERNAME = process.env.BC_USERNAME || '';
const BC_PASSWORD = process.env.BC_PASSWORD || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Basic-auth header value */
function authHeader() {
  return 'Basic ' + Buffer.from(`${BC_USERNAME}:${BC_PASSWORD}`).toString('base64');
}

/** Shared fetch wrapper — returns parsed JSON or throws with BC error detail */
async function bcFetch(url, body) {
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': authHeader(),
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`BC HTTP ${res.status} @ ${url} — ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { rawResponse: text.trim() };
  }
}

/** Count publishing_dates — accepts array or JSON string */
function countDates(publishingDates) {
  if (!publishingDates) return 0;
  if (Array.isArray(publishingDates)) return publishingDates.length;
  try {
    const parsed = JSON.parse(publishingDates);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

// ─── Step 1: Create Sales Order ───────────────────────────────────────────────
/**
 * Maps advert data to the BC CreateSalesOrder payload and POSTs it.
 * Returns the BC sales order number (e.g. "B-SO-216545N").
 *
 * Field mapping:
 *   sellToCustomerNo        ← client.bc_no
 *   orderDate               ← advert.start_date
 *   postingDate             ← advert.start_date
 *   salespersonCode         ← vgams_sales_persons[0].bc_code
 *   postingDescription      ← "<advert_title> - <client.company_name>"
 *   locationCode            ← advert.office_location
 *   shortcutDimension1Code  ← advert.cost_stream
 *   shortcutDimension2Code  ← advert.revenue_stream
 *   externalDocumentN0      ← advert.client_reference_no
 *   marketSector            ← advert.market_sector
 *   sectionCommCategory     ← advert.section_commission
 */
async function createSalesOrder(advert) {
  const client       = advert.client             || {};
  const salesPersons = advert.vgams_sales_persons || [];

  // Use the first sales person's BC code
  const salespersonCode = salesPersons.length > 0
    ? (salesPersons[0].bc_code || '')
    : '';

  const payload = {
    sellToCustomerNo:       client.bc_no                  || '',
    orderDate:              advert.start_date              || null,
    salespersonCode:        salespersonCode,
    postingDescription:     `${advert.advert_title || ''} - ${client.company_name || ''}`.trim(),
    locationCode:           advert.office_location         || '',
    postingDate:            advert.start_date              || null,
    shortcutDimension1Code: advert.cost_stream            || '',
    shortcutDimension2Code: advert.revenue_stream         || '',
    externalDocumentN0:     advert.client_reference_no    || '',
    marketSector:           advert.market_sector          || '',
    sectionCommCategory:    advert.section_commission     || '',
  };

  strapi.log.info('[BC Lifecycle] Creating Sales Order:', JSON.stringify(payload, null, 2));

  const response = await bcFetch(`${BC_BASE_URL}/salesOrders`, payload);

  strapi.log.info('[BC Lifecycle] Sales Order response:', JSON.stringify(response, null, 2));

  // BC typically returns the order number in the `number` field
  const orderNumber =
    response.number      ||
    response.orderNumber ||
    response.no          ||
    response.No          ||
    null;

  if (!orderNumber) {
    throw new Error(
      `BC Sales Order created but no order number found in response: ${JSON.stringify(response)}`
    );
  }

  return orderNumber;
}

// ─── Step 2: Create Sales Order Line ─────────────────────────────────────────
/**
 * Maps advert data to the BC CreateSalesOrderLine payload and POSTs it.
 *
 * Field mapping:
 *   lineNo                  ← advert.id  (Strapi record ID used as BC line identifier)
 *   type                    ← always "Resource"
 *   no                      ← rate_card.bc_resource_code
 *                              (BC Resource No. e.g. "AD0003" — stored on the rate card)
 *   description2            ← advert.ad_size
 *   unitOfMeasureCode       ← always "ADS"
 *   quantity                ← count of publishing_dates array (number of days)
 *   unitPrice               ← advert.base_price
 *   lineDiscountPercentange ← advert.discount (already stored as a percentage)
 */
async function createSalesOrderLine(advert, salesOrderNumber) {
  const rateCard     = advert.rate_card || {};
  const numberOfDays = countDates(advert.publishing_dates);

  // bc_resource_code is the BC Resource No. on the rate card (e.g. "AD0003").
  // Add a `bc_resource_code` string field to your rate-card content-type if not present.
  const resourceNo = rateCard.bc_resource_code || '';

  if (!resourceNo) {
    strapi.log.warn(
      `[BC Lifecycle] rate_card.bc_resource_code is empty for advert ${advert.id}. ` +
      `The BC line "no" field will be blank — BC may reject this.`
    );
  }

  const payload = {
    lineNo:                  advert.id,         // Strapi advert ID as BC line number
    type:                    'Resource',
    no:                      resourceNo,
    description2:            advert.ad_size     || '',
    unitOfMeasureCode:       'ADS',             // always fixed
    quantity:                numberOfDays,
    unitPrice:               advert.base_price  ?? 0,
    lineDiscountPercentange: advert.discount     ?? 0,
  };

  const url = `${BC_BASE_URL}/salesOrders('${encodeURIComponent(salesOrderNumber)}')/salesOrderLines`;

  strapi.log.info(`[BC Lifecycle] Creating Sales Order Line at: ${url}`);
  strapi.log.info('[BC Lifecycle] Sales Order Line payload:', JSON.stringify(payload, null, 2));

  const response = await bcFetch(url, payload);

  strapi.log.info('[BC Lifecycle] Sales Order Line response:', JSON.stringify(response, null, 2));

  return response;
}

// ─── Lifecycle Hook ───────────────────────────────────────────────────────────
module.exports = {
  /**
   * afterCreate
   *
   * Flow:
   *   1. Re-fetch advert with client, rate_card, and vgams_sales_persons populated.
   *   2. POST /salesOrders              → get BC sales order number.
   *   3. POST /salesOrders(N)/salesOrderLines  → attach the line.
   *   4. Write BC order number back to advert.bc_reference_number.
   *   5. Set bc_share_success to true to indicate successful BC sync.
   *
   * Errors are caught and logged but never rethrown — a BC failure must
   * not roll back or prevent the Strapi record from being saved.
   */
  async afterCreate(event) {
    const { result } = event;

    // ── Guard: skip if BC is not configured ────────────────────────────────
    if (!BC_BASE_URL || !BC_USERNAME || !BC_PASSWORD) {
      strapi.log.warn('[BC Lifecycle] BC credentials not configured — skipping BC sync.');
      return;
    }

    try {
      strapi.log.info(`[BC Lifecycle] Advert created (id: ${result.id}). Starting BC sync…`);

      // ── 1. Re-fetch with all required relations ──────────────────────────
      const advert = await strapi.entityService.findOne(
        'api::advert.advert',
        result.id,
        {
          populate: {
            client:              true,
            rate_card:           true,
            vgams_sales_persons: true,
          },
        }
      );

      if (!advert) {
        strapi.log.error(`[BC Lifecycle] Could not re-fetch advert ${result.id} — aborting.`);
        return;
      }

      // ── 2. Create BC Sales Order ─────────────────────────────────────────
      const salesOrderNumber = await createSalesOrder(advert);
      strapi.log.info(`[BC Lifecycle] ✓ Sales Order: ${salesOrderNumber}`);

      // ── 3. Create BC Sales Order Line ────────────────────────────────────
      await createSalesOrderLine(advert, salesOrderNumber);
      strapi.log.info(`[BC Lifecycle] ✓ Sales Order Line created`);

      // ── 4. Save BC order number and set bc_share_success to true ─────────
      await strapi.entityService.update('api::advert.advert', result.id, {
        data: { 
          bc_reference_number: salesOrderNumber,
          bc_share_success: true
        },
      });

      strapi.log.info(`[BC Lifecycle] ✓ bc_reference_number saved: ${salesOrderNumber}`);
      strapi.log.info(`[BC Lifecycle] ✓ bc_share_success set to true`);

    } catch (error) {
      // Never rethrow — BC errors must not affect the Strapi record
      strapi.log.error('[BC Lifecycle] ✗ BC sync failed:', error.message || error);
      
      // Optionally, you could set bc_share_success to false on failure
      // Uncomment the lines below if you want to explicitly mark failures
      /*
      try {
        await strapi.entityService.update('api::advert.advert', result.id, {
          data: { bc_share_success: false }
        });
      } catch (updateError) {
        strapi.log.error('[BC Lifecycle] ✗ Failed to update bc_share_success:', updateError.message);
      }
      */
    }
  },
};
