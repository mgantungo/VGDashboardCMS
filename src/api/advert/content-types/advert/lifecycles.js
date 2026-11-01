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
const BC_USERNAME = process.env.EXTERNAL_API_USERNAME || '';
const BC_PASSWORD = process.env.EXTERNAL_API_PASSWORD || '';

// lifecycles.js lives at src/advert/content-types/advert/
// bc-sync-monitor.js lives at src/advert/controllers/
const { upsertInvoiceFromBC, createPaymentFromBC } = require('../../controllers/bc-sync-monitor');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Basic-auth header value */
function authHeader() {
  return 'Basic ' + Buffer.from(`${BC_USERNAME}:${BC_PASSWORD}`).toString('base64');
}

/** Shared fetch wrapper — returns parsed JSON or throws with BC error detail */
async function bcFetch(url, body, stepName = 'API Call') {
  const requestBody = JSON.stringify(body, null, 2);
  
  // Log the complete request with clear delimiters
  console.log('\n');
  console.log('🔵 ===================================================');
  console.log(`🔵 ${stepName} - REQUEST`);
  console.log('🔵 ===================================================');
  console.log(`🔵 ENDPOINT: POST ${url}`);
  console.log('🔵 AUTHORIZATION: Basic Auth (credentials hidden)');
  console.log('🔵 CONTENT-TYPE: application/json');
  console.log('🔵 EXPECTED PAYLOAD FORMAT:');
  console.log('🔵 ---------------------------------------------------');
  console.log(requestBody);
  console.log('🔵 ===================================================\n');

  const startTime = Date.now();
  
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader(),
      },
      body: JSON.stringify(body),
    });

    const responseTime = Date.now() - startTime;
    const text = await res.text();

    // Log the complete response with clear delimiters
    console.log('\n');
    console.log('🟢 ===================================================');
    console.log(`🟢 ${stepName} - RESPONSE (${responseTime}ms)`);
    console.log('🟢 ===================================================');
    console.log(`🟢 STATUS: ${res.status} ${res.statusText}`);
    console.log('🟢 RESPONSE BODY:');
    console.log('🟢 ---------------------------------------------------');
    
    // Try to pretty print JSON response
    try {
      const jsonResponse = JSON.parse(text);
      console.log(JSON.stringify(jsonResponse, null, 2));
    } catch {
      console.log(text);
    }
    
    console.log('🟢 ===================================================\n');

    if (!res.ok) {
      throw new Error(`BC HTTP ${res.status} @ ${url} — ${text}`);
    }

    try {
      return JSON.parse(text);
    } catch {
      return { rawResponse: text.trim() };
    }
  } catch (error) {
    // Log any network or other errors
    console.log('\n');
    console.log('🔴 ===================================================');
    console.log(`🔴 ${stepName} - ERROR`);
    console.log('🔴 ===================================================');
    console.log('🔴 ERROR:', error.message);
    console.log('🔴 ===================================================\n');
    throw error;
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
 * Expected POST to: /salesOrders
 * Expected Payload Format:
 * {
 *   "sellToCustomerNo": "C04873",
 *   "orderDate": "2026-02-01",
 *   "salespersonCode": "419",
 *   "postingDescription": "40YRS OF NRM LIBERATION DAY SUPPLEMENT- LUKONGE COTTON CO.LTD",
 *   "locationCode": "HQTRS",
 *   "postingDate": "2026-02-01",
 *   "shortcutDimension1Code": "C16",
 *   "shortcutDimension2Code": "AD",
 *   "externalDocumentN0": "677279",
 *   "marketSector": "RET",
 *   "sectionCommCategory": "SUP"
 * }
 */

async function createSalesOrder(advert) {
  const client       = advert.client             || {};
  const salesPersons = advert.vgams_sales_persons || [];

  // ── Map advert.payment_method → BC paymentOptions code ─────────────────
  const paymentOptionsMap = {
    mobile_money: 'MobileMoney',
    bank_transfer: 'EFT'
  };
  const paymentOptions = paymentOptionsMap[advert.payment_method] || '';

  // Log source data being used for mapping
  console.log('\n');
  console.log('📋 ===================================================');
  console.log('📋 STEP 1: Create Sales Order - Source Data Mapping');
  console.log('📋 ===================================================');
  console.log('📋 MAPPING RULES:');
  console.log('📋   sellToCustomerNo        ← client.bc_no');
  console.log('📋   orderDate               ← advert.start_date');
  console.log('📋   salespersonCode         ← vgams_sales_persons[0].bc_code');
  console.log('📋   postingDescription      ← "<advert_title> - <client.company_name>"');
  console.log('📋   locationCode            ← advert.office_location');
  console.log('📋   postingDate             ← advert.start_date');
  console.log('📋   shortcutDimension1Code  ← advert.cost_stream');
  console.log('📋   shortcutDimension2Code  ← advert.revenue_stream');
  console.log('📋   externalDocumentN0      ← advert.client_reference_no');
  console.log('📋   marketSector            ← advert.market_sector');
  console.log('📋   sectionCommCategory     ← advert.section_commission');
  console.log('📋   paymentOptions          ← advert.payment_method (mobile_money→MobileMoney, bank_transfer→EFT, other→"")');
  console.log('📋 ---------------------------------------------------');
  console.log('📋 SOURCE VALUES:');
  console.log('📋   client.bc_no:', client.bc_no || '(empty)');
  console.log('📋   advert.start_date:', advert.start_date || '(empty)');
  console.log('📋   salesperson.bc_code:', salesPersons[0]?.bc_code || '(empty)');
  console.log('📋   advert.advert_title:', advert.advert_title || '(empty)');
  console.log('📋   client.company_name:', client.company_name || '(empty)');
  console.log('📋   advert.office_location:', advert.office_location || '(empty)');
  console.log('📋   advert.cost_stream:', advert.cost_stream || '(empty)');
  console.log('📋   advert.revenue_stream:', advert.revenue_stream || '(empty)');
  console.log('📋   advert.client_reference_no:', advert.client_reference_no || '(empty)');
  console.log('📋   advert.market_sector:', advert.market_sector || '(empty)');
  console.log('📋   advert.section_commission:', advert.section_commission || '(empty)');
  console.log('📋   advert.payment_method:', advert.payment_method || '(empty)', '→ paymentOptions:', paymentOptions || '(empty)');
  console.log('📋 ===================================================\n');

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
    advertBooking:          true,
    advertReferenceNo:      advert.reference_number,
    paymentOption:          paymentOptions
  };

  //picked from the above section
    //paymentOptions:         paymentOptions

  console.log('\n');
  console.log('📤 ===================================================');
  console.log('📤 STEP 1: POST to Create Sales Order');
  console.log('📤 ===================================================');
  console.log('📤 ENDPOINT: POST /salesOrders');
  console.log('📤 FULL URL:', `${BC_BASE_URL}/salesOrders`);
  console.log('📤 ---------------------------------------------------');
  console.log('📤 GENERATED PAYLOAD (mapped from source data):');
  console.log(JSON.stringify(payload, null, 2));
  console.log('📤 ===================================================\n');

  const response = await bcFetch(`${BC_BASE_URL}/salesOrders`, payload, 'STEP 1: Create Sales Order');
  
  // Log extracted order number
  const orderNumber = response.number || response.orderNumber || response.no || response.No || null;
  console.log('\n');
  console.log('📌 ===================================================');
  console.log('📌 STEP 1 - Extracted Order Number from Response');
  console.log('📌 ===================================================');
  console.log('📌 ORDER NUMBER:', orderNumber || 'NOT FOUND');
  console.log('📌 This will be used as: bc_reference_number');
  console.log('📌 ===================================================\n');
  
  return response;
}


/*
async function createSalesOrder(advert) {
  const client       = advert.client             || {};
  const salesPersons = advert.vgams_sales_persons || [];

  // Log source data being used for mapping
  console.log('\n');
  console.log('📋 ===================================================');
  console.log('📋 STEP 1: Create Sales Order - Source Data Mapping');
  console.log('📋 ===================================================');
  console.log('📋 MAPPING RULES:');
  console.log('📋   sellToCustomerNo        ← client.bc_no');
  console.log('📋   orderDate               ← advert.start_date');
  console.log('📋   salespersonCode         ← vgams_sales_persons[0].bc_code');
  console.log('📋   postingDescription      ← "<advert_title> - <client.company_name>"');
  console.log('📋   locationCode            ← advert.office_location');
  console.log('📋   postingDate             ← advert.start_date');
  console.log('📋   shortcutDimension1Code  ← advert.cost_stream');
  console.log('📋   shortcutDimension2Code  ← advert.revenue_stream');
  console.log('📋   externalDocumentN0      ← advert.client_reference_no');
  console.log('📋   marketSector            ← advert.market_sector');
  console.log('📋   sectionCommCategory     ← advert.section_commission');
  console.log('📋 ---------------------------------------------------');
  console.log('📋 SOURCE VALUES:');
  console.log('📋   client.bc_no:', client.bc_no || '(empty)');
  console.log('📋   advert.start_date:', advert.start_date || '(empty)');
  console.log('📋   salesperson.bc_code:', salesPersons[0]?.bc_code || '(empty)');
  console.log('📋   advert.advert_title:', advert.advert_title || '(empty)');
  console.log('📋   client.company_name:', client.company_name || '(empty)');
  console.log('📋   advert.office_location:', advert.office_location || '(empty)');
  console.log('📋   advert.cost_stream:', advert.cost_stream || '(empty)');
  console.log('📋   advert.revenue_stream:', advert.revenue_stream || '(empty)');
  console.log('📋   advert.client_reference_no:', advert.client_reference_no || '(empty)');
  console.log('📋   advert.market_sector:', advert.market_sector || '(empty)');
  console.log('📋   advert.section_commission:', advert.section_commission || '(empty)');
  console.log('📋 ===================================================\n');

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
    advertBooking:          true,
    advertReferenceNo:      advert.reference_number
  };

  console.log('\n');
  console.log('📤 ===================================================');
  console.log('📤 STEP 1: POST to Create Sales Order');
  console.log('📤 ===================================================');
  console.log('📤 ENDPOINT: POST /salesOrders');
  console.log('📤 FULL URL:', `${BC_BASE_URL}/salesOrders`);
  console.log('📤 ---------------------------------------------------');
  console.log('📤 GENERATED PAYLOAD (mapped from source data):');
  console.log(JSON.stringify(payload, null, 2));
  console.log('📤 ===================================================\n');

  const response = await bcFetch(`${BC_BASE_URL}/salesOrders`, payload, 'STEP 1: Create Sales Order');
  
  // Log extracted order number
  const orderNumber = response.number || response.orderNumber || response.no || response.No || null;
  console.log('\n');
  console.log('📌 ===================================================');
  console.log('📌 STEP 1 - Extracted Order Number from Response');
  console.log('📌 ===================================================');
  console.log('📌 ORDER NUMBER:', orderNumber || 'NOT FOUND');
  console.log('📌 This will be used as: bc_reference_number');
  console.log('📌 ===================================================\n');
  
  return response;
}
*/

// ─── Step 2: Create Sales Order Line ─────────────────────────────────────────
/**
 * Maps advert data to the BC CreateSalesOrderLine payload and POSTs it.
 * 
 * Expected POST to: /salesOrders('B-SO-216545N')/salesOrderLines
 * Expected Payload Format:
 * {
 *   "lineNo": 10000,
 *   "type": "Resource",
 *   "no": "AD0003",
 *   "description2": "Quarter page(16cm*3col)FC",
 *   "unitOfMeasureCode": "ADS",
 *   "quantity": 1,
 *   "unitPrice": 3150000,
 *   "lineDiscountPercentange": 20.63492
 * }
 * 
 * IMPORTANT: 
 *   - The 'no' field is populated based on advert.ad_type:
 *       • full_color  → rate_card.full_color_no
 *       • black_white → rate_card.black_color_no
 *   - The 'unitOfMeasureCode' field comes from rate_card.base_unit_of_measure
 */
async function createSalesOrderLine(advert, salesOrderNumber) {
  const rateCard     = advert.rate_card || {};
  const numberOfDays = countDates(advert.publishing_dates);
  const adType = advert.ad_type || 'full_color'; // Default to full_color if not set

  // Determine which resource code to use based on ad_type
  let resourceNo = '';
  if (adType === 'full_color') {
    resourceNo = rateCard.full_color_no || '';
  } else if (adType === 'black_white') {
    resourceNo = rateCard.black_color_no || '';
  }

  // Get unit of measure from rate card
  const unitOfMeasure = rateCard.base_unit_of_measure || '';

  // Log source data for line item
  console.log('\n');
  console.log('📋 ===================================================');
  console.log('📋 STEP 2: Create Sales Order Line - Source Data Mapping');
  console.log('📋 ===================================================');
  console.log('📋 MAPPING RULES:');
  console.log('📋   lineNo                  ← advert.id');
  console.log('📋   type                    ← "Resource" (fixed)');
  console.log('📋   no                      ← Based on advert.ad_type:');
  console.log('📋                              • full_color  → rate_card.full_color_no');
  console.log('📋                              • black_white → rate_card.black_color_no');
  console.log('📋   description2            ← advert.ad_size');
  console.log('📋   unitOfMeasureCode       ← rate_card.base_unit_of_measure');
  console.log('📋   quantity                ← count of publishing_dates');
  console.log('📋   unitPrice               ← advert.base_price');
  console.log('📋   lineDiscountPercentange ← advert.discount');
  console.log('📋 ---------------------------------------------------');
  console.log('📋 SOURCE VALUES:');
  console.log('📋   advert.id:', advert.id);
  console.log('📋   advert.ad_type:', adType);
  console.log('📋   rate_card.full_color_no:', rateCard.full_color_no || '(empty)');
  console.log('📋   rate_card.black_color_no:', rateCard.black_color_no || '(empty)');
  console.log('📋   SELECTED resourceNo:', resourceNo || '(empty - will cause BC error)');
  console.log('📋   rate_card.base_unit_of_measure:', unitOfMeasure || '(empty - will cause BC error)');
  console.log('📋   advert.ad_size:', advert.ad_size || '(empty)');
  console.log('📋   publishing_dates:', {
    raw: advert.publishing_dates,
    count: numberOfDays,
    type: typeof advert.publishing_dates,
    isArray: Array.isArray(advert.publishing_dates)
  });
  console.log('📋   advert.base_price:', advert.base_price);
  console.log('📋   advert.discount:', advert.discount);
  console.log('📋 ===================================================\n');

  if (!resourceNo) {
    console.log('\n');
    console.log('⚠️ ===================================================');
    console.log('⚠️ CRITICAL WARNING: Resource Number (no) is empty');
    console.log('⚠️ ===================================================');
    console.log('⚠️ This field maps to "no" in the payload');
    console.log('⚠️ BC will REJECT this request if empty');
    console.log('⚠️');
    console.log(`⚠️ Advert ad_type: ${adType}`);
    console.log(`⚠️ Expected field: ${adType === 'full_color' ? 'full_color_no' : 'black_color_no'} on rate card`);
    console.log('⚠️ Rate Card ID:', rateCard.id);
    console.log('⚠️ Please ensure the rate card has the correct value set');
    console.log('⚠️ ===================================================\n');
    
    strapi.log.warn(
      `[BC Lifecycle] Resource number is empty for advert ${advert.id}. ` +
      `ad_type: ${adType}, expected field: ${adType === 'full_color' ? 'full_color_no' : 'black_color_no'}. ` +
      `BC will likely reject this request.`
    );
  }

  if (!unitOfMeasure) {
    console.log('\n');
    console.log('⚠️ ===================================================');
    console.log('⚠️ CRITICAL WARNING: Unit of Measure is empty');
    console.log('⚠️ ===================================================');
    console.log('⚠️ This field maps to "unitOfMeasureCode" in the payload');
    console.log('⚠️ BC will REJECT this request if empty');
    console.log('⚠️');
    console.log('⚠️ Expected field: base_unit_of_measure on rate card');
    console.log('⚠️ Rate Card ID:', rateCard.id);
    console.log('⚠️ Please ensure the rate card has base_unit_of_measure set');
    console.log('⚠️ ===================================================\n');
    
    strapi.log.warn(
      `[BC Lifecycle] base_unit_of_measure is empty for advert ${advert.id}. ` +
      `BC will likely reject this request.`
    );
  }

  const payload = {
    lineNo:                  advert.id,         // Strapi advert ID as BC line number
    type:                    'Resource',
    no:                      resourceNo,
    description2:            advert.ad_size     || '',
    unitOfMeasureCode:       unitOfMeasure,     // From rate_card.base_unit_of_measure
    quantity:                numberOfDays,
    unitPrice:               advert.base_price  ?? 0,
    lineDiscountPercentange: advert.discount     ?? 0,
  };

  const url = `${BC_BASE_URL}/salesOrders('${encodeURIComponent(salesOrderNumber)}')/salesOrderLines`;
  
  console.log('\n');
  console.log('📤 ===================================================');
  console.log('📤 STEP 2: POST to Create Sales Order Line');
  console.log('📤 ===================================================');
  console.log('📤 ENDPOINT: POST /salesOrders(\'{salesOrderNumber}\')/salesOrderLines');
  console.log('📤 FULL URL:', url);
  console.log('📤 ---------------------------------------------------');
  console.log('📤 GENERATED PAYLOAD (mapped from source data):');
  console.log(JSON.stringify(payload, null, 2));
  console.log('📤 ===================================================\n');

  const response = await bcFetch(url, payload, 'STEP 2: Create Sales Order Line');

  return response;
}

// ─── Auto-paid payment methods ─────────────────────────────────────────────────
// Methods that are settled at the point of booking, so isPaid can be set
// automatically rather than waiting on a manual finance confirmation.
const AUTO_PAID_METHODS = ['mobile_money', 'bank_transfer'];

// ─── Workflow re-order helpers (production clearance + print ad class) ────────
const {
  CLEARED_METHODS,
  classifyFromRateCard,
  normaliseAdClass,
  relationId,
} = require('../../../_vgams-helpers/vgams-workflow');

// ─── Lifecycle Hook ───────────────────────────────────────────────────────────
module.exports = {
  /**
   * beforeCreate
   *
   * If the advert is being booked with a payment method that is settled
   * up front (mobile_money, bank_transfer), auto-set isPaid = true before
   * the record is written. Other payment methods (cash, credit, pdc) are
   * left untouched — isPaid keeps its schema default (false) unless the
   * caller explicitly sends a value.
   */
  async beforeCreate(event) {
    const { data } = event.params;

    if (AUTO_PAID_METHODS.includes(data.payment_method)) {
      data.isPaid = true;

      console.log('\n');
      console.log('💰 ===================================================');
      console.log('💰 AUTO-SETTING isPaid = true');
      console.log('💰 ===================================================');
      console.log('💰 payment_method:', data.payment_method);
      console.log('💰 ===================================================\n');
    }

    // ── Workflow re-order: production clearance ─────────────────────────────
    // Every booking is cleared for Copy Desk and Design House at booking,
    // whatever the payment method (decision 1 Nov 2026 — financial controls
    // run before the clerk books). isPaid above is untouched, so Finance
    // still sees unpaid credit / cash / PDC as outstanding.
    // (Not guarded on "unset": Strapi has already applied the schema default
    // production_cleared=false to `data` by the time this hook runs.)
    if (CLEARED_METHODS.includes(data.payment_method)) {
      data.production_cleared    = true;
      data.production_cleared_at = new Date();
      data.production_cleared_by = 'auto_payment_method';
    }

    // ── Workflow re-order: Display vs Classified ────────────────────────────
    // Only print adverts carry a class. If the booking form sent one, keep it
    // (normalised); if not, derive it from the rate card with the same rule
    // the frontend has always used. Non-print adverts never keep a class.
    try {
      const productId = relationId(data.product);
      let isPrint = false;
      if (productId) {
        const product = await strapi.db.query('api::product.product').findOne({
          where:    { id: productId },
          populate: { category: true },
        });
        isPrint = product?.category?.category_type === 'print';
      }

      if (!isPrint) {
        if (productId) data.print_ad_class = null;
      } else {
        const given = normaliseAdClass(data.print_ad_class);
        if (given) {
          data.print_ad_class = given;
        } else {
          const rateCardId = relationId(data.rate_card);
          const rateCard = rateCardId
            ? await strapi.db.query('api::rate-card.rate-card').findOne({ where: { id: rateCardId } })
            : null;
          data.print_ad_class = classifyFromRateCard(rateCard) || 'display';
        }
      }
    } catch (classErr) {
      // Never block a booking over the class — the backfill script can fill it later.
      console.warn('⚠️ print_ad_class could not be derived at create:', classErr.message);
    }
  },

  /**
   * afterCreate
   *
   * Flow:
   *   1. Re-fetch advert with client, rate_card, and vgams_sales_persons populated.
   *   2. POST /salesOrders              → get BC sales order number.
   *   3. POST /salesOrders(N)/salesOrderLines  → attach the line.
   *   4. Write BC order number back to advert.bc_reference_number.
   *   5. Set bc_share_success to true to indicate successful BC sync.
   */
  async afterCreate(event) {
    const { result } = event;

    // Log the initial creation data
    console.log('\n');
    console.log('🚀 ===================================================');
    console.log('🚀 NEW ADVERT CREATED - STARTING BC SYNC');
    console.log('🚀 ===================================================');
    console.log('🚀 Advert ID:', result.id);
    console.log('🚀 Reference Number:', result.reference_number);
    console.log('🚀 Title:', result.advert_title);
    console.log('🚀 Ad Type:', result.ad_type);
    console.log('🚀 Status:', result.status);
    console.log('🚀 ===================================================\n');

    // ── Guard: skip if BC is not configured ────────────────────────────────
    if (!BC_BASE_URL || !BC_USERNAME || !BC_PASSWORD) {
      console.log('\n');
      console.log('⚠️ ===================================================');
      console.log('⚠️ BC CREDENTIALS NOT CONFIGURED');
      console.log('⚠️ ===================================================');
      console.log('⚠️ BC_BASE_URL:', BC_BASE_URL ? '✅ Set' : '❌ Missing');
      console.log('⚠️ BC_USERNAME:', BC_USERNAME ? '✅ Set' : '❌ Missing');
      console.log('⚠️ BC_PASSWORD:', BC_PASSWORD ? '✅ Set' : '❌ Missing');
      console.log('⚠️ ===================================================\n');
      
      strapi.log.warn('[BC Lifecycle] BC credentials not configured — skipping BC sync.');
      return;
    }

    try {
      console.log('\n');
      console.log('🔍 ===================================================');
      console.log('🔍 FETCHING ADVERT WITH RELATIONS');
      console.log('🔍 ===================================================');
      console.log('🔍 Advert ID:', result.id);
      console.log('🔍 Populating: client, rate_card, vgams_sales_persons');
      console.log('🔍 ===================================================\n');

      // ── 1. Re-fetch with all required relations ──────────────────────────
      const advert = await strapi.entityService.findOne(
        'api::advert.advert',
        result.id,
        {
          populate: {
            client:              true,
            rate_card:           true,
            vgams_sales_persons: true,
            vgams_user:          true,
          },
        }
      );

      if (!advert) {
        console.log('\n');
        console.log('❌ ===================================================');
        console.log('❌ COULD NOT RE-FETCH ADVERT');
        console.log('❌ ===================================================');
        console.log('❌ Advert ID:', result.id);
        console.log('❌ ===================================================\n');
        
        strapi.log.error(`[BC Lifecycle] Could not re-fetch advert ${result.id} — aborting.`);
        return;
      }

      // Log the complete fetched data with relations
      console.log('\n');
      console.log('📦 ===================================================');
      console.log('📦 COMPLETE FETCHED ADVERT DATA');
      console.log('📦 ===================================================');
      console.log('📦 ID:', advert.id);
      console.log('📦 Reference Number:', advert.reference_number);
      console.log('📦 Title:', advert.advert_title);
      console.log('📦 Ad Type:', advert.ad_type);
      console.log('📦 ---------------------------------------------------');
      console.log('📦 CLIENT DATA:');
      console.log(JSON.stringify(advert.client, null, 2));
      console.log('📦 ---------------------------------------------------');
      console.log('📦 RATE CARD DATA:');
      console.log(JSON.stringify(advert.rate_card, null, 2));
      console.log('📦 ---------------------------------------------------');
      console.log('📦 SALES PERSONS DATA:');
      console.log(JSON.stringify(advert.vgams_sales_persons, null, 2));
      console.log('📦 ---------------------------------------------------');
      console.log('📦 OTHER FIELDS:');
      console.log('📦   ad_size:', advert.ad_size);
      console.log('📦   start_date:', advert.start_date);
      console.log('📦   end_date:', advert.end_date);
      console.log('📦   base_price:', advert.base_price);
      console.log('📦   discount:', advert.discount);
      console.log('📦   publishing_dates:', advert.publishing_dates);
      console.log('📦 ===================================================\n');

      // ── 2. Create BC Sales Order ─────────────────────────────────────────
      console.log('\n');
      console.log('📤 ===================================================');
      console.log('📤 STEP 1/3: CREATING BC SALES ORDER');
      console.log('📤 ===================================================');
      console.log('📤 Expected Endpoint: POST /salesOrders');
      console.log('📤 ===================================================\n');
      
      const salesOrderResponse = await createSalesOrder(advert);
      
      const salesOrderNumber = salesOrderResponse.number || 
                               salesOrderResponse.orderNumber || 
                               salesOrderResponse.no || 
                               salesOrderResponse.No || 
                               null;

      console.log('\n');
      console.log('✅ ===================================================');
      console.log('✅ STEP 1/3 COMPLETE');
      console.log('✅ ===================================================');
      console.log('✅ Sales Order Number:', salesOrderNumber);
      console.log('✅ This will be saved as bc_reference_number');
      console.log('✅ ===================================================\n');

      if (!salesOrderNumber) {
        throw new Error(
          `BC Sales Order created but no order number found in response: ${JSON.stringify(salesOrderResponse)}`
        );
      }

      // ── 3. Create BC Sales Order Line ────────────────────────────────────
      console.log('\n');
      console.log('📤 ===================================================');
      console.log('📤 STEP 2/3: CREATING SALES ORDER LINE');
      console.log('📤 ===================================================');
      console.log(`📤 Expected Endpoint: POST /salesOrders('${salesOrderNumber}')/salesOrderLines`);
      console.log('📤 ===================================================\n');
      
      const lineResponse = await createSalesOrderLine(advert, salesOrderNumber);
      
      console.log('\n');
      console.log('✅ ===================================================');
      console.log('✅ STEP 2/3 COMPLETE');
      console.log('✅ ===================================================');
      console.log('✅ Sales Order Line created successfully');
      console.log('✅ ===================================================\n');

      // ── 4. Save BC order number and set bc_share_success to true ─────────
      console.log('\n');
      console.log('📤 ===================================================');
      console.log('📤 STEP 3/3: UPDATING STRAPI ADVERT');
      console.log('📤 ===================================================');
      
      const updateData = { 
        bc_reference_number: salesOrderNumber,
        bc_share_success: true
      };

      // ── Auto-paid methods: do what a real BC payment confirmation would
      // do (see bc-sync-monitor.js's updatePaymentStatus), not just flip
      // isPaid. Reuses the exact same helpers that path uses, so this can't
      // silently drift from what a genuine confirmation produces. Only
      // fires here because the BC sales order above just succeeded -
      // salesOrderNumber is real at this point, nothing is fabricated
      // against a sync that failed.
      //
      // No real BC invoice payload exists yet at booking time (that's a
      // separate BC entity from the sales order created above) - passing
      // null lets both helpers fall back to advert.total_amount / today's
      // date / a BC-{salesOrderNumber} invoice number, same fallback
      // behavior they already have for a missing invoiceData.
      if (AUTO_PAID_METHODS.includes(advert.payment_method)) {
        try {
          const advertForSettlement = { ...advert, bc_reference_number: salesOrderNumber };
          const autoInvoiceRecord = await upsertInvoiceFromBC(advertForSettlement, null);
          // isClosed forced true (not read from real data, since there is
          // none yet) — the only place that matters is createPaymentFromBC's
          // cash-specific gate, which never applies here since paymentMethod
          // is always mobile_money/bank_transfer in this call site.
          const autoPaymentRecord = await createPaymentFromBC(
            advertForSettlement, null, autoInvoiceRecord, advert.payment_method, true
          );

          updateData.paid_at   = new Date();
          updateData.isActive  = true;
          if (advert.status === 'draft') {
            updateData.status = 'published';
          }

          console.log('\n');
          console.log('💰 ===================================================');
          console.log('💰 AUTO-SETTLEMENT (mobile_money/bank_transfer)');
          console.log('💰 ===================================================');
          console.log('💰 Invoice:', autoInvoiceRecord?.invoice_number);
          console.log('💰 Payment ID:', autoPaymentRecord?.id);
          console.log('💰 status → published:', advert.status === 'draft');
          console.log('💰 ===================================================\n');
        } catch (settleError) {
          // Non-blocking — the bc_reference_number/bc_share_success write
          // below still has to happen regardless of whether settlement
          // succeeded. Same convention as the workflow-log writes
          // elsewhere in this codebase: log it, don't abort the primary
          // operation over a secondary one.
          strapi.log.error('[BC Lifecycle] Auto-settlement (invoice/payment/publish) failed:', settleError.message);
          console.log('\n');
          console.log('⚠️ ===================================================');
          console.log('⚠️ AUTO-SETTLEMENT FAILED — bc_reference_number/bc_share_success still saved');
          console.log('⚠️ ===================================================');
          console.log('⚠️ Error:', settleError.message);
          console.log('⚠️ ===================================================\n');
        }
      }
      
      console.log('📤 Update Data:', JSON.stringify(updateData, null, 2));
      console.log('📤 ===================================================\n');
      
      const updatedAdvert = await strapi.entityService.update('api::advert.advert', result.id, {
        data: updateData,
      });

      console.log('\n');
      console.log('✅ ===================================================');
      console.log('✅ STEP 3/3 COMPLETE');
      console.log('✅ ===================================================');
      console.log('✅ Updated Advert:');
      console.log('✅   ID:', updatedAdvert.id);
      console.log('✅   bc_reference_number:', updatedAdvert.bc_reference_number);
      console.log('✅   bc_share_success:', updatedAdvert.bc_share_success);
      console.log('✅ ===================================================\n');

      console.log('\n');
      console.log('🎉 ===================================================');
      console.log('🎉 BC SYNC COMPLETED SUCCESSFULLY');
      console.log('🎉 ===================================================');
      console.log('🎉 Advert ID:', result.id);
      console.log('🎉 BC Reference:', salesOrderNumber);
      console.log('🎉 bc_share_success: true');
      console.log('🎉 ===================================================\n');

    } catch (error) {
      console.log('\n');
      console.log('❌ ===================================================');
      console.log('❌ BC SYNC FAILED');
      console.log('❌ ===================================================');
      console.log('❌ Error:', error.message);
      console.log('❌ Stack:', error.stack);
      console.log('❌ ===================================================\n');
      
      strapi.log.error('[BC Lifecycle] ✗ BC sync failed:', error.message || error);
      
      // Set bc_share_success to false on failure
      try {
        await strapi.entityService.update('api::advert.advert', result.id, {
          data: { bc_share_success: false }
        });
        console.log('\n');
        console.log('📝 ===================================================');
        console.log('📝 Set bc_share_success to false due to failure');
        console.log('📝 ===================================================\n');
      } catch (updateError) {
        console.log('\n');
        console.log('❌ ===================================================');
        console.log('❌ Failed to update bc_share_success');
        console.log('❌ ===================================================');
        console.log('❌ Error:', updateError.message);
        console.log('❌ ===================================================\n');
        
        strapi.log.error('[BC Lifecycle] ✗ Failed to update bc_share_success:', updateError.message);
      }
    }
  },
};