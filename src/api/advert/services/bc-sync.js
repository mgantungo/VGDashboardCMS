// src/api/advert/services/bc-sync.js
'use strict';

const BC_BASE_URL = process.env.EXTERNAL_API_BC_BASE_URL || '';
const BC_USERNAME = process.env.EXTERNAL_API_USERNAME || '';
const BC_PASSWORD = process.env.EXTERNAL_API_PASSWORD || '';

/**
 * Business Central Sync Service
 * Handles all BC integration logic for adverts
 */
module.exports = ({ strapi }) => ({
  /**
   * Check if BC is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!(BC_BASE_URL && BC_USERNAME && BC_PASSWORD);
  },

  /**
   * Get BC configuration status
   * @returns {Object}
   */
  getConfigStatus() {
    return {
      configured: this.isConfigured(),
      baseUrl: BC_BASE_URL ? '✅ Set' : '❌ Missing',
      username: BC_USERNAME ? '✅ Set' : '❌ Missing',
      password: BC_PASSWORD ? '✅ Set' : '❌ Missing'
    };
  },

  /**
   * Get auth header for BC API calls
   * @returns {string}
   */
  getAuthHeader() {
    return 'Basic ' + Buffer.from(`${BC_USERNAME}:${BC_PASSWORD}`).toString('base64');
  },

  /**
   * Make BC API call with logging
   * @param {string} url - Full URL to call
   * @param {Object} body - Request body
   * @param {string} stepName - Name of the step for logging
   * @returns {Promise<Object>}
   */
  async bcFetch(url, body, stepName = 'API Call') {
    const requestBody = JSON.stringify(body, null, 2);
    
    console.log('\n');
    console.log('🔵 ===================================================');
    console.log(`🔵 ${stepName} - REQUEST`);
    console.log('🔵 ===================================================');
    console.log(`🔵 ENDPOINT: POST ${url}`);
    console.log('🔵 ---------------------------------------------------');
    console.log(requestBody);
    console.log('🔵 ===================================================\n');

    const startTime = Date.now();
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.getAuthHeader(),
        },
        body: JSON.stringify(body),
      });

      const responseTime = Date.now() - startTime;
      const text = await res.text();

      console.log('\n');
      console.log('🟢 ===================================================');
      console.log(`🟢 ${stepName} - RESPONSE (${responseTime}ms)`);
      console.log('🟢 ===================================================');
      console.log(`🟢 STATUS: ${res.status} ${res.statusText}`);
      console.log('🟢 RESPONSE BODY:');
      console.log('🟢 ---------------------------------------------------');
      
      try {
        const jsonResponse = JSON.parse(text);
        console.log(JSON.stringify(jsonResponse, null, 2));
      } catch {
        console.log(text);
      }
      
      console.log('🟢 ===================================================\n');

      if (!res.ok) {
        throw new Error(`BC HTTP ${res.status} @ ${url} — ${text.substring(0, 500)}`);
      }

      try {
        return JSON.parse(text);
      } catch {
        return { rawResponse: text.trim() };
      }
    } catch (error) {
      console.log('\n');
      console.log('🔴 ===================================================');
      console.log(`🔴 ${stepName} - ERROR`);
      console.log('🔴 ===================================================');
      console.log('🔴 ERROR:', error.message);
      console.log('🔴 ===================================================\n');
      throw error;
    }
  },

  /**
   * Count publishing dates from various formats
   * @param {Array|string} publishingDates - Publishing dates in array or JSON string
   * @returns {number}
   */
  countDates(publishingDates) {
    if (!publishingDates) return 0;
    if (Array.isArray(publishingDates)) return publishingDates.length;
    try {
      const parsed = JSON.parse(publishingDates);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  },

  /**
   * Create Sales Order in BC
   * @param {Object} advert - Full advert object with relations
   * @returns {Promise<Object>} BC response
   */
  async createSalesOrder(advert) {
    const client = advert.client || {};
    const salesPersons = advert.vgams_sales_persons || [];

    // Log source data for mapping
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

    const response = await this.bcFetch(`${BC_BASE_URL}/salesOrders`, payload, 'STEP 1: Create Sales Order');
    
    // Log extracted order number
    const orderNumber = response.number || response.orderNumber || response.no || response.No || null;
    console.log('\n');
    console.log('📌 ===================================================');
    console.log('📌 STEP 1 - Extracted Order Number from Response');
    console.log('📌 ===================================================');
    console.log('📌 ORDER NUMBER:', orderNumber || 'NOT FOUND');
    console.log('📌 ===================================================\n');
    
    return response;
  },

  /**
   * Create Sales Order Line in BC
   * @param {Object} advert - Full advert object with relations
   * @param {string} salesOrderNumber - BC sales order number
   * @returns {Promise<Object>} BC response
   */
  async createSalesOrderLine(advert, salesOrderNumber) {
    const rateCard = advert.rate_card || {};
    const numberOfDays = this.countDates(advert.publishing_dates);
    const adType = advert.ad_type || 'full_color';

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
        `[BC Service] Resource number is empty for advert ${advert.id}. ` +
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
        `[BC Service] base_unit_of_measure is empty for advert ${advert.id}. ` +
        `BC will likely reject this request.`
      );
    }

    const payload = {
      lineNo:                  advert.id,
      type:                    'Resource',
      no:                      resourceNo,
      description2:            advert.ad_size     || '',
      unitOfMeasureCode:       unitOfMeasure,
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

    const response = await this.bcFetch(url, payload, 'STEP 2: Create Sales Order Line');
    return response;
  },

  /**
   * Sync an advert with Business Central
   * @param {number|string} advertId - Strapi advert ID
   * @returns {Promise<Object>} { success, bcReference, error }
   */
  async syncAdvert(advertId) {
    console.log('\n');
    console.log('🚀 ===================================================');
    console.log('🚀 BC SYNC STARTED');
    console.log('🚀 ===================================================');
    console.log('🚀 Advert ID:', advertId);
    console.log('🚀 ===================================================\n');

    // Check configuration
    if (!this.isConfigured()) {
      console.log('\n');
      console.log('⚠️ ===================================================');
      console.log('⚠️ BC CREDENTIALS NOT CONFIGURED');
      console.log('⚠️ ===================================================');
      const configStatus = this.getConfigStatus();
      console.log('⚠️ BC_BASE_URL:', configStatus.baseUrl);
      console.log('⚠️ BC_USERNAME:', configStatus.username);
      console.log('⚠️ BC_PASSWORD:', configStatus.password);
      console.log('⚠️ ===================================================\n');
      
      strapi.log.warn('[BC Service] BC credentials not configured — skipping BC sync.');
      return {
        success: false,
        bcReference: null,
        error: 'BC not configured'
      };
    }

    try {
      // Fetch advert with all required relations
      console.log('\n');
      console.log('🔍 ===================================================');
      console.log('🔍 FETCHING ADVERT WITH RELATIONS');
      console.log('🔍 ===================================================');
      console.log('🔍 Advert ID:', advertId);
      console.log('🔍 Populating: client, rate_card, vgams_sales_persons');
      console.log('🔍 ===================================================\n');
      
      const advert = await strapi.entityService.findOne(
        'api::advert.advert',
        advertId,
        {
          populate: {
            client: true,
            rate_card: true,
            vgams_sales_persons: true,
          },
        }
      );

      if (!advert) {
        throw new Error(`Advert ${advertId} not found`);
      }

      // Log fetched data
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
      console.log('📦 ===================================================\n');

      // Step 1: Create Sales Order
      console.log('\n');
      console.log('📤 ===================================================');
      console.log('📤 STEP 1/3: CREATING BC SALES ORDER');
      console.log('📤 ===================================================\n');
      
      const salesOrderResponse = await this.createSalesOrder(advert);
      
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
      console.log('✅ ===================================================\n');

      if (!salesOrderNumber) {
        throw new Error(
          `BC Sales Order created but no order number found in response: ${JSON.stringify(salesOrderResponse)}`
        );
      }

      // Step 2: Create Sales Order Line
      console.log('\n');
      console.log('📤 ===================================================');
      console.log('📤 STEP 2/3: CREATING SALES ORDER LINE');
      console.log('📤 ===================================================');
      console.log(`📤 Sales Order Number: ${salesOrderNumber}`);
      console.log('📤 ===================================================\n');
      
      await this.createSalesOrderLine(advert, salesOrderNumber);
      
      console.log('\n');
      console.log('✅ ===================================================');
      console.log('✅ STEP 2/3 COMPLETE');
      console.log('✅ ===================================================\n');

      // Step 3: Update advert with BC reference
      console.log('\n');
      console.log('📤 ===================================================');
      console.log('📤 STEP 3/3: UPDATING STRAPI ADVERT');
      console.log('📤 ===================================================');
      
      const updateData = { 
        bc_reference_number: salesOrderNumber,
        bc_share_success: true
      };
      
      console.log('📤 Update Data:', JSON.stringify(updateData, null, 2));
      console.log('📤 ===================================================\n');
      
      await strapi.entityService.update('api::advert.advert', advertId, {
        data: updateData,
      });

      console.log('\n');
      console.log('🎉 ===================================================');
      console.log('🎉 BC SYNC COMPLETED SUCCESSFULLY');
      console.log('🎉 ===================================================');
      console.log('🎉 Advert ID:', advertId);
      console.log('🎉 BC Reference:', salesOrderNumber);
      console.log('🎉 bc_share_success: true');
      console.log('🎉 ===================================================\n');

      return {
        success: true,
        bcReference: salesOrderNumber,
        error: null
      };

    } catch (error) {
      console.log('\n');
      console.log('❌ ===================================================');
      console.log('❌ BC SYNC FAILED');
      console.log('❌ ===================================================');
      console.log('❌ Error:', error.message);
      console.log('❌ Stack:', error.stack);
      console.log('❌ ===================================================\n');
      
      strapi.log.error('[BC Service] ✗ BC sync failed:', error.message || error);
      
      // Mark as failed in Strapi
      try {
        await strapi.entityService.update('api::advert.advert', advertId, {
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
        
        strapi.log.error('[BC Service] ✗ Failed to update bc_share_success:', updateError.message);
      }

      return {
        success: false,
        bcReference: null,
        error: error.message
      };
    }
  },

  /**
   * Retry failed BC sync for an advert
   * @param {number|string} advertId - Strapi advert ID
   * @returns {Promise<Object>} { success, bcReference, error }
   */
  async retrySync(advertId) {
    console.log(`[BC Service] Retrying BC sync for advert ${advertId}`);
    
    // Clear previous BC reference and reset sync flag
    await strapi.entityService.update('api::advert.advert', advertId, {
      data: { 
        bc_reference_number: null,
        bc_share_success: false
      }
    });
    
    // Attempt sync again
    return await this.syncAdvert(advertId);
  }
});
