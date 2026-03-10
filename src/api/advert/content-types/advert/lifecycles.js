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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Basic-auth header value */
function authHeader() {
  return 'Basic ' + Buffer.from(`${BC_USERNAME}:${BC_PASSWORD}`).toString('base64');
}

/** Enhanced fetch wrapper — logs complete request/response details */
async function bcFetch(url, body, stepName = 'API Call') {
  const requestBody = JSON.stringify(body, null, 2);
  
  // Log the complete request
  strapi.log.info(`[BC Lifecycle] 🔵 ${stepName} - REQUEST TO: ${url}`);
  strapi.log.info(`[BC Lifecycle] 🔵 ${stepName} - REQUEST HEADERS:`, {
    'Content-Type': 'application/json',
    'Authorization': 'Basic [HIDDEN]'
  });
  strapi.log.info(`[BC Lifecycle] 🔵 ${stepName} - REQUEST BODY:`, requestBody);

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

    // Log response status and headers
    strapi.log.info(`[BC Lifecycle] 🟢 ${stepName} - RESPONSE STATUS: ${res.status} ${res.statusText} (${responseTime}ms)`);
    strapi.log.info(`[BC Lifecycle] 🟢 ${stepName} - RESPONSE HEADERS:`, Object.fromEntries(res.headers.entries()));

    if (!res.ok) {
      // Log error response body
      strapi.log.error(`[BC Lifecycle] 🔴 ${stepName} - ERROR RESPONSE BODY:`, text);
      throw new Error(`BC HTTP ${res.status} @ ${url} — ${text}`);
    }

    // Log successful response body
    strapi.log.info(`[BC Lifecycle] 🟢 ${stepName} - RESPONSE BODY:`, text);

    try {
      return JSON.parse(text);
    } catch {
      return { rawResponse: text.trim() };
    }
  } catch (error) {
    // Log any network or other errors
    strapi.log.error(`[BC Lifecycle] 🔴 ${stepName} - FETCH ERROR:`, error.message);
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
 */
async function createSalesOrder(advert) {
  const client       = advert.client             || {};
  const salesPersons = advert.vgams_sales_persons || [];

  // Use the first sales person's BC code
  const salespersonCode = salesPersons.length > 0
    ? (salesPersons[0].bc_code || '')
    : '';

  // Log the complete advert data being used for mapping
  strapi.log.info('[BC Lifecycle] 📋 Source advert data for Sales Order:', JSON.stringify({
    advert_id: advert.id,
    advert_title: advert.advert_title,
    client: {
      id: client.id,
      bc_no: client.bc_no,
      company_name: client.company_name
    },
    start_date: advert.start_date,
    sales_person: {
      id: salesPersons[0]?.id,
      bc_code: salesPersons[0]?.bc_code,
      name: salesPersons[0]?.name
    },
    office_location: advert.office_location,
    cost_stream: advert.cost_stream,
    revenue_stream: advert.revenue_stream,
    client_reference_no: advert.client_reference_no,
    market_sector: advert.market_sector,
    section_commission: advert.section_commission
  }, null, 2));

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

  const response = await bcFetch(`${BC_BASE_URL}/salesOrders`, payload, 'Create Sales Order');

  return response;
}

// ─── Step 2: Create Sales Order Line ─────────────────────────────────────────
/**
 * Maps advert data to the BC CreateSalesOrderLine payload and POSTs it.
 */
async function createSalesOrderLine(advert, salesOrderNumber) {
  const rateCard     = advert.rate_card || {};
  const numberOfDays = countDates(advert.publishing_dates);

  // Log the publishing_dates to see what's being counted
  strapi.log.info('[BC Lifecycle] 📋 Publishing dates for line item:', {
    raw_publishing_dates: advert.publishing_dates,
    counted_days: numberOfDays,
    date_array: Array.isArray(advert.publishing_dates) ? advert.publishing_dates : 
                (typeof advert.publishing_dates === 'string' ? JSON.parse(advert.publishing_dates) : null)
  });

  // Log the complete rate card data
  strapi.log.info('[BC Lifecycle] 📋 Rate card data for line item:', {
    rate_card_id: rateCard.id,
    bc_resource_code: rateCard.bc_resource_code,
    rate_card_name: rateCard.name
  });

  const resourceNo = rateCard.bc_resource_code || '';

  if (!resourceNo) {
    strapi.log.warn(
      `[BC Lifecycle] ⚠️ rate_card.bc_resource_code is empty for advert ${advert.id}. ` +
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
  
  const response = await bcFetch(url, payload, 'Create Sales Order Line');

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
   */
  async afterCreate(event) {
    const { result } = event;

    // Log the initial creation data
    strapi.log.info('[BC Lifecycle] 🆕 New advert created with data:', JSON.stringify(result, null, 2));

    // ── Guard: skip if BC is not configured ────────────────────────────────
    if (!BC_BASE_URL || !BC_USERNAME || !BC_PASSWORD) {
      strapi.log.warn('[BC Lifecycle] ⚠️ BC credentials not configured — skipping BC sync.');
      return;
    }

    try {
      strapi.log.info(`[BC Lifecycle] 🚀 Advert created (id: ${result.id}). Starting BC sync…`);

      // ── 1. Re-fetch with all required relations ──────────────────────────
      strapi.log.info(`[BC Lifecycle] 🔍 Fetching advert ${result.id} with relations...`);
      
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
        strapi.log.error(`[BC Lifecycle] ❌ Could not re-fetch advert ${result.id} — aborting.`);
        return;
      }

      // Log the complete fetched data with relations
      strapi.log.info('[BC Lifecycle] 📦 Complete fetched advert data:', JSON.stringify({
        id: advert.id,
        reference_number: advert.reference_number,
        bc_reference_number: advert.bc_reference_number,
        advert_title: advert.advert_title,
        client: advert.client ? {
          id: advert.client.id,
          bc_no: advert.client.bc_no,
          company_name: advert.client.company_name,
          email: advert.client.email
        } : null,
        rate_card: advert.rate_card ? {
          id: advert.rate_card.id,
          bc_resource_code: advert.rate_card.bc_resource_code,
          name: advert.rate_card.name,
          rate: advert.rate_card.rate
        } : null,
        vgams_sales_persons: advert.vgams_sales_persons?.map(sp => ({
          id: sp.id,
          bc_code: sp.bc_code,
          name: sp.name,
          email: sp.email
        })),
        ad_size: advert.ad_size,
        ad_type: advert.ad_type,
        frequency: advert.frequency,
        start_date: advert.start_date,
        end_date: advert.end_date,
        base_price: advert.base_price,
        surcharge: advert.surcharge,
        discount: advert.discount,
        total_amount: advert.total_amount,
        payment_method: advert.payment_method,
        publishing_dates: advert.publishing_dates,
        office_location: advert.office_location,
        client_reference_no: advert.client_reference_no,
        contact_person: advert.contact_person,
        contact_number: advert.contact_number,
        contact_email: advert.contact_email,
        market_sector: advert.market_sector,
        section_commission: advert.section_commission,
        cost_stream: advert.cost_stream,
        revenue_stream: advert.revenue_stream,
        bc_share_success: advert.bc_share_success,
        status: advert.status
      }, null, 2));

      // ── 2. Create BC Sales Order ─────────────────────────────────────────
      strapi.log.info(`[BC Lifecycle] 📤 Step 1/3: Creating BC Sales Order...`);
      const salesOrderResponse = await createSalesOrder(advert);
      const salesOrderNumber = salesOrderResponse.number || 
                               salesOrderResponse.orderNumber || 
                               salesOrderResponse.no || 
                               salesOrderResponse.No || 
                               null;

      strapi.log.info(`[BC Lifecycle] ✅ Step 1/3 Complete - Sales Order: ${salesOrderNumber}`);
      strapi.log.info('[BC Lifecycle] 📥 Full Sales Order Response:', JSON.stringify(salesOrderResponse, null, 2));

      if (!salesOrderNumber) {
        throw new Error(
          `BC Sales Order created but no order number found in response: ${JSON.stringify(salesOrderResponse)}`
        );
      }

      // ── 3. Create BC Sales Order Line ────────────────────────────────────
      strapi.log.info(`[BC Lifecycle] 📤 Step 2/3: Creating Sales Order Line for Order: ${salesOrderNumber}...`);
      const lineResponse = await createSalesOrderLine(advert, salesOrderNumber);
      
      strapi.log.info(`[BC Lifecycle] ✅ Step 2/3 Complete - Sales Order Line created`);
      strapi.log.info('[BC Lifecycle] 📥 Full Sales Order Line Response:', JSON.stringify(lineResponse, null, 2));

      // ── 4. Save BC order number and set bc_share_success to true ─────────
      strapi.log.info(`[BC Lifecycle] 📤 Step 3/3: Updating Strapi advert with BC reference...`);
      
      const updateData = { 
        bc_reference_number: salesOrderNumber,
        bc_share_success: true
      };
      
      strapi.log.info('[BC Lifecycle] 📝 Update data:', JSON.stringify(updateData, null, 2));
      
      const updatedAdvert = await strapi.entityService.update('api::advert.advert', result.id, {
        data: updateData,
      });

      strapi.log.info(`[BC Lifecycle] ✅ Step 3/3 Complete - Advert updated successfully`);
      strapi.log.info(`[BC Lifecycle] 🎉 BC sync completed successfully for advert ${result.id}`);
      strapi.log.info('[BC Lifecycle] 📋 Final advert state:', JSON.stringify({
        id: updatedAdvert.id,
        bc_reference_number: updatedAdvert.bc_reference_number,
        bc_share_success: updatedAdvert.bc_share_success
      }, null, 2));

    } catch (error) {
      // Never rethrow — BC errors must not affect the Strapi record
      strapi.log.error('[BC Lifecycle] ❌ BC sync failed:', error.message || error);
      strapi.log.error('[BC Lifecycle] ❌ Error stack:', error.stack);
      
      // Optionally set bc_share_success to false on failure
      try {
        await strapi.entityService.update('api::advert.advert', result.id, {
          data: { bc_share_success: false }
        });
        strapi.log.info('[BC Lifecycle] 📝 Set bc_share_success to false due to failure');
      } catch (updateError) {
        strapi.log.error('[BC Lifecycle] ❌ Failed to update bc_share_success:', updateError.message);
      }
    }
  },
};
