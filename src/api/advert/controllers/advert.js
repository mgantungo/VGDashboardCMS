// src/api/advert/controllers/advert.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::advert.advert', ({ strapi }) => ({

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE  (POST /adverts)
  // ─────────────────────────────────────────────────────────────────────────
  async create(ctx) {
    try {
      let data = ctx.request.body?.data;
      const files = ctx.request.files;

      console.log('🔍 Creating advert with VGAMS user');
      console.log('📦 Request body:', ctx.request.body);
      console.log('📦 Parsed data:', data);
      console.log('📎 Uploaded files:', files ? Object.keys(files) : 'No files');

      // If data arrives as a string (FormData), parse it
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (parseError) {
          console.error('❌ Failed to parse data:', parseError);
          return ctx.badRequest('Invalid data format');
        }
      }

      if (!data && ctx.request.body?.data) data = ctx.request.body.data;
      if (!data) data = ctx.request.body;

      console.log('📦 Final parsed data:', data);

      // ── Auth: VGAMS User ────────────────────────────────────────────────
      const vgamsUserId = data.vgamsUserId;
      if (!vgamsUserId) {
        console.error('❌ No VGAMS user ID provided');
        return ctx.badRequest('User identification required. Please log in.');
      }

      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { id: vgamsUserId, isActive: true }
      });
      if (!vgamsUser) {
        console.error('❌ VGAMS user not found or inactive:', vgamsUserId);
        return ctx.unauthorized('Invalid user or account is inactive.');
      }
      console.log('✅ VGAMS user verified:', {
        id: vgamsUser.id, name: vgamsUser.name, role: vgamsUser.role
      });

      // ── Client ───────────────────────────────────────────────────────────
      const clientId = data.clientId ? parseInt(data.clientId) : null;
      if (!clientId) {
        console.error('❌ No client ID provided');
        return ctx.badRequest('A valid client must be selected from the dropdown.');
      }

      const existingClient = await strapi.db.query('api::client.client').findOne({
        where: { id: clientId }
      });
      if (!existingClient) {
        console.error('❌ Client not found:', clientId);
        return ctx.badRequest('Selected client does not exist.');
      }
      console.log('✅ Client verified:', { id: existingClient.id, name: existingClient.company_name });

      // ── Revenue & Cost Stream codes (resolved from product, stored as strings) ──
      // Now that the schema has revenue_stream and cost_stream as plain string fields,
      // we look up the codes once at creation and store them directly on the advert.
      // No need to populate the product relation on every subsequent read.
      let revenueStreamCode = null;
      let costStreamCode    = null;

      if (data.product) {
        const product = await strapi.entityService.findOne(
          'api::product.product',
          parseInt(data.product),
          {
            populate: {
              revenue_stream: { fields: ['id', 'code', 'name'] },
              cost_stream:    { fields: ['id', 'code', 'name'] }
            }
          }
        );
        if (product) {
          revenueStreamCode = product.revenue_stream?.code || null;
          costStreamCode    = product.cost_stream?.code    || null;
          console.log('✅ Revenue stream:', revenueStreamCode, '| Cost stream:', costStreamCode);
        } else {
          console.warn('⚠️ Product not found:', data.product);
        }
      }

      // ── Reference Number ────────────────────────────────────────────────
      const now     = new Date();
      const year    = now.getFullYear();
      const month   = String(now.getMonth() + 1).padStart(2, '0');
      const day     = String(now.getDate()).padStart(2, '0');
      const hours   = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');

      const todayStart = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayAdvertsCount = await strapi.entityService.count('api::advert.advert', {
        filters: { createdAt: { $gte: todayStart.toISOString() } }
      });

      const counter         = String(todayAdvertsCount + 1).padStart(3, '0');
      const referenceNumber = `ADV-${year}${month}${day}${hours}${minutes}${seconds}${counter}`;

      console.log('📝 Generated reference:', referenceNumber);
      console.log('📊 Today\'s advert count:', todayAdvertsCount, '| Counter:', counter);

      // ── Sales Agent (manyToMany – Strapi v5 requires connect syntax) ────
      const salesAgentConnect = data.salesAgentId
        ? { connect: [parseInt(data.salesAgentId)] }
        : undefined;

      // ── Advert Data ─────────────────────────────────────────────────────
      const advertData = {
        advert_title:     data.advertTitle,
        reference_number: referenceNumber,

        // Relations
        client:              clientId,
        product:             data.product  ? parseInt(data.product)  : null,
        rate_card:           data.rateCard ? parseInt(data.rateCard) : null,
        vgams_user:          parseInt(vgamsUserId),
        vgams_sales_persons: salesAgentConnect,

        // Denormalised stream codes — stored directly so reads never need
        // to join through product → revenue_stream / cost_stream
        revenue_stream:    revenueStreamCode,
        cost_stream:       costStreamCode,

        // Location & client reference (previously encoded into specialInstructions)
        office_location:    data.officeLocation    || null,
        client_reference_no: data.referenceDocument || null,

        // Ad details
        ad_size:       data.adSize || '',
        ad_type:       data.adType || 'full_color',
        frequency:     parseInt(data.frequency) || 1,
        publish_onweb: Boolean(data.publishOnWeb),

        // Schedule
        start_date: data.startDate,
        end_date:   data.endDate || null,

        // Pricing
        base_price:   parseFloat(data.basePrice)   || 0,
        surcharge:    parseFloat(data.surcharge)   || 0,
        discount:     parseFloat(data.discount)    || 0,
        total_amount: parseFloat(data.totalAmount) || 0,

        // Payment & workflow
        payment_method:       data.paymentMethod,
        special_instructions: data.specialInstructions || '',
        status:               data.status || 'draft',
      };

      console.log('📊 Final advert data:', advertData);

      // ── Create ───────────────────────────────────────────────────────────
      const advert = await strapi.entityService.create('api::advert.advert', {
        data: advertData
      });
      console.log('✅ Advert created – ID:', advert.id);

      // ── File Uploads ─────────────────────────────────────────────────────
      if (files && Object.keys(files).length > 0) {
        try {
          console.log('📁 Processing file uploads...');
          const uploadService = strapi.plugins['upload'].services.upload;
          const uploadedFiles = await uploadService.upload({
            data:  { refId: advert.id, ref: 'api::advert.advert', field: 'attachments' },
            files: Object.values(files)
          });
          console.log('✅ Files uploaded:', uploadedFiles.length);

          if (uploadedFiles?.length > 0) {
            await strapi.entityService.update('api::advert.advert', advert.id, {
              data: { attachments: { set: uploadedFiles.map(f => f.id) } }
            });
          }
        } catch (uploadError) {
          console.error('❌ File upload failed (advert still created):', uploadError.message);
        }
      }

      // ── Fetch Full Advert ────────────────────────────────────────────────
      // revenue_stream and cost_stream are now plain string fields on the advert —
      // no need to populate through the product relation anymore.
      const fullAdvert = await strapi.entityService.findOne('api::advert.advert', advert.id, {
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'bc_no'] },
          product:             { fields: ['id', 'product_name', 'product_id'] },
          rate_card:           { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw'] },
          attachments:         true
        }
      });

      console.log('📋 Created advert summary:', {
        id:                 fullAdvert.id,
        reference:          fullAdvert.reference_number,
        title:              fullAdvert.advert_title,
        client:             fullAdvert.client?.company_name,
        createdBy:          fullAdvert.vgams_user?.name,
        status:             fullAdvert.status,
        revenue_stream:     fullAdvert.revenue_stream     ?? 'N/A',
        cost_stream:        fullAdvert.cost_stream        ?? 'N/A',
        office_location:    fullAdvert.office_location    ?? 'N/A',
        client_reference_no: fullAdvert.client_reference_no ?? 'N/A',
        attachments:        fullAdvert.attachments?.length || 0,
        publish_onweb:      fullAdvert.publish_onweb
      });

      return {
        success: true,
        data:    fullAdvert,
        message: data.status === 'draft'
          ? 'Draft saved successfully'
          : 'Advert submitted for review'
      };

    } catch (err) {
      console.error('❌ Error creating advert:', err.message);
      console.error('❌ Stack trace:', err.stack);
      return ctx.internalServerError(`Failed to create advert: ${err.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FIND MY ADVERTS  (POST /adverts/my-adverts)
  // ─────────────────────────────────────────────────────────────────────────
  async findMyAdverts(ctx) {
    try {
      const body        = ctx.request.body || {};
      const vgamsUserId = body.vgamsUserId
        || body.data?.vgamsUserId
        || ctx.query.vgamsUserId;

      if (!vgamsUserId) {
        return ctx.badRequest('User ID required');
      }

      console.log('🔍 Finding adverts for VGAMS user:', vgamsUserId);

      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { id: vgamsUserId, isActive: true }
      });
      if (!vgamsUser) {
        return ctx.unauthorized('User not found or inactive');
      }

      const { query } = ctx;

      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          vgams_user: parseInt(vgamsUserId),
          ...(query.status && { status: query.status })
        },
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone'] },
          product:             { fields: ['id', 'product_name', 'product_id'] },
          rate_card:           { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw'] }
        },
        sort:  query.sort  || 'createdAt:desc',
        limit: query.limit || 50,
        start: query.start || 0
      });

      return {
        success: true,
        data:    adverts,   // revenue_stream, cost_stream, office_location, client_reference_no
        count:   adverts.length,   // are plain fields — returned automatically
        user: {
          id:    vgamsUser.id,
          name:  vgamsUser.name,
          email: vgamsUser.email,
          role:  vgamsUser.role
        }
      };

    } catch (err) {
      console.error('❌ Error fetching adverts:', err.message);
      return ctx.internalServerError('Failed to fetch adverts');
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FIND ONE  (GET /adverts/:id)
  // ─────────────────────────────────────────────────────────────────────────
  async findOne(ctx) {
    try {
      const { id } = ctx.params;
      console.log('🔍 Fetching single advert:', id);

      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client: {
            fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'address', 'bc_no']
          },
          product: {
            fields: ['id', 'product_name', 'product_id', 'description', 'circulation'],
            populate: {
              category: {
                fields: ['id', 'category_name', 'category_type', 'description']
              }
            }
          },
          rate_card: {
            fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw', 'surcharge_percentage']
          },
          attachments: {
            fields: ['id', 'name', 'url', 'mime', 'size', 'createdAt']
          }
          // workflow_history and comments: re-enable once schema confirmed
          // workflow_history: { fields: [...], sort: 'timestamp:desc' },
          // comments: { fields: [...], sort: 'created_at:desc' }
        }
      });

      if (!advert) {
        console.error('❌ Advert not found:', id);
        return ctx.notFound('Advert not found');
      }

      const transformedAdvert = {
        id:               advert.id,
        reference_number: advert.reference_number,
        advert_title:     advert.advert_title,
        ad_size:          advert.ad_size,
        ad_type:          advert.ad_type,
        frequency:        advert.frequency,
        publish_onweb:    advert.publish_onweb,
        start_date:       advert.start_date,
        end_date:         advert.end_date,
        base_price:       advert.base_price,
        surcharge:        advert.surcharge,
        discount:         advert.discount || 0,
        total_amount:     advert.total_amount,
        payment_method:   advert.payment_method,
        special_instructions: advert.special_instructions,
        status:           advert.status,

        // New direct string fields
        revenue_stream:      advert.revenue_stream      || null,
        cost_stream:         advert.cost_stream         || null,
        office_location:     advert.office_location     || null,
        client_reference_no: advert.client_reference_no || null,

        // Boolean flags
        isActive:    advert.isActive,
        isPaid:      advert.isPaid,
        isScheduled: advert.isScheduled,
        isApproved:  advert.isApproved,
        isCanceled:  advert.isCanceled,
        hasRun:      advert.hasRun,
        isClosed:    advert.isClosed,

        createdAt:   advert.createdAt,
        updatedAt:   advert.updatedAt,
        publishedAt: advert.publishedAt,

        // Relations
        vgams_user: advert.vgams_user
          ? { id: advert.vgams_user.id, name: advert.vgams_user.name, email: advert.vgams_user.email, role: advert.vgams_user.role }
          : null,

        vgams_sales_persons: advert.vgams_sales_persons || [],

        client: advert.client
          ? { id: advert.client.id, company_name: advert.client.company_name, contact_person: advert.client.contact_person, email: advert.client.email, phone: advert.client.phone, address: advert.client.address, bc_no: advert.client.bc_no }
          : null,

        product: advert.product
          ? {
              id:           advert.product.id,
              product_name: advert.product.product_name,
              product_id:   advert.product.product_id,
              description:  advert.product.description,
              circulation:  advert.product.circulation,
              category: advert.product.category
                ? { id: advert.product.category.id, name: advert.product.category.category_name, type: advert.product.category.category_type, description: advert.product.category.description }
                : null
            }
          : null,

        rate_card: advert.rate_card
          ? { id: advert.rate_card.id, size_dimension: advert.rate_card.size_dimension, ad_type: advert.rate_card.ad_type, price_fc: advert.rate_card.price_fc, price_bw: advert.rate_card.price_bw, surcharge_percentage: advert.rate_card.surcharge_percentage }
          : null,

        attachments: (advert.attachments || []).map(f => ({
          id: f.id, name: f.name, url: f.url, mime: f.mime, size: f.size, uploadedAt: f.createdAt
        }))
      };

      console.log('✅ Advert fetched:', {
        id:              transformedAdvert.id,
        reference:       transformedAdvert.reference_number,
        title:           transformedAdvert.advert_title,
        status:          transformedAdvert.status,
        revenue_stream:  transformedAdvert.revenue_stream  ?? 'N/A',
        cost_stream:     transformedAdvert.cost_stream     ?? 'N/A',
        office_location: transformedAdvert.office_location ?? 'N/A',
        productCategory: transformedAdvert.product?.category?.type || 'No category'
      });

      return { success: true, data: transformedAdvert };

    } catch (err) {
      console.error('❌ Error fetching advert:', err.message);
      console.error('❌ Error stack:', err.stack);
      return ctx.internalServerError(`Failed to fetch advert: ${err.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE  (PUT /adverts/:id)
  // ─────────────────────────────────────────────────────────────────────────
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      const vgamsUserId = data.vgamsUserId || ctx.headers['x-vgams-user-id'];

      if (!vgamsUserId) {
        return ctx.badRequest('User identification required');
      }

      const existingAdvert = await strapi.entityService.findOne('api::advert.advert', id, {
        populate: ['vgams_user']
      });

      if (!existingAdvert) return ctx.notFound('Advert not found');

      if (existingAdvert.vgams_user?.id !== parseInt(vgamsUserId)) {
        return ctx.forbidden('You can only update your own adverts');
      }

      if (existingAdvert.status !== 'draft') {
        return ctx.badRequest('Only draft adverts can be updated');
      }

      const allowedFields = [
        'advert_title', 'ad_size', 'ad_type', 'frequency',
        'start_date', 'end_date', 'special_instructions', 'publish_onweb',
        'office_location', 'client_reference_no'
      ];

      const updateData = {};
      allowedFields.forEach(field => {
        if (data[field] !== undefined) updateData[field] = data[field];
      });

      const updatedAdvert = await strapi.entityService.update('api::advert.advert', id, {
        data:     updateData,
        populate: ['product', 'rate_card', 'client', 'vgams_user', 'vgams_sales_persons']
      });

      return { success: true, data: updatedAdvert, message: 'Advert updated successfully' };

    } catch (err) {
      console.error('❌ Error updating advert:', err.message);
      return ctx.internalServerError('Failed to update advert');
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DATE RANGE ADVERTS  (GET /adverts-by-date-range)
  // ─────────────────────────────────────────────────────────────────────────
  async getDateRangeAdverts(ctx) {
    try {
      const { query } = ctx;
      console.log('📅 Date range query received:', query);

      const startDate = query.startDate ? new Date(query.startDate) : new Date();
      const endDate   = query.endDate   ? new Date(query.endDate)   : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (startDate > endDate) {
        return ctx.badRequest('Start date must be before end date');
      }

      console.log('📅 Fetching adverts for date range:', {
        startDate: startDate.toISOString(),
        endDate:   endDate.toISOString()
      });

      const filters = {
        createdAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
        ...(query.userId    && { vgams_user: { id: parseInt(query.userId) } }),
        ...(query.status    && { status: query.status }),
        ...(query.clientId  && { client:  { id: parseInt(query.clientId) } }),
        ...(query.productId && { product: { id: parseInt(query.productId) } })
      };

      console.log('🔍 Filters applied:', JSON.stringify(filters, null, 2));

      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone'] },
          product:             { fields: ['id', 'product_name', 'product_id'] },
          rate_card:           { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw'] },
          attachments:         true
        },
        sort:  query.sort  || 'createdAt:desc',
        limit: query.limit || 1000,
        start: query.start || 0
      });

      const transformed = adverts.map(a => ({
        id:               a.id,
        reference_number: a.reference_number,
        advert_title:     a.advert_title,
        ad_size:          a.ad_size,
        ad_type:          a.ad_type,
        frequency:        a.frequency,
        publish_onweb:    a.publish_onweb,
        start_date:       a.start_date,
        end_date:         a.end_date,
        base_price:       a.base_price,
        surcharge:        a.surcharge,
        discount:         a.discount,
        total_amount:     a.total_amount,
        payment_method:   a.payment_method,
        special_instructions: a.special_instructions,
        status:           a.status,

        // Direct string fields — no join needed
        revenue_stream:      a.revenue_stream      || null,
        cost_stream:         a.cost_stream         || null,
        office_location:     a.office_location     || null,
        client_reference_no: a.client_reference_no || null,

        isActive:    a.isActive,
        isPaid:      a.isPaid,
        isCanceled:  a.isCanceled,
        createdAt:   a.createdAt,
        updatedAt:   a.updatedAt,

        client:              a.client    || null,
        product:             a.product   || null,
        rate_card:           a.rate_card || null,
        vgams_sales_persons: a.vgams_sales_persons || [],
        createdByUser:       a.vgams_user || null,
        attachments:         a.attachments
      }));

      const totalAmount   = transformed.reduce((s, a) => s + (parseFloat(a.total_amount) || 0), 0);
      const totalDiscount = transformed.reduce((s, a) => s + (parseFloat(a.discount)      || 0), 0);

      const uniqueUsers = Array.from(
        transformed.reduce((map, a) => {
          if (a.createdByUser) map.set(a.createdByUser.id, a.createdByUser);
          return map;
        }, new Map()).values()
      );

      console.log('✅ Found adverts:', transformed.length);

      return {
        success:    true,
        data:       transformed,
        count:      transformed.length,
        statistics: {
          totalAmount,
          totalDiscount,
          averageAmount: transformed.length > 0 ? totalAmount / transformed.length : 0,
          uniqueUsers:   uniqueUsers.length
        },
        dateRange: { start: startDate, end: endDate },
        users:     uniqueUsers
      };

    } catch (err) {
      console.error('❌ Error fetching date range adverts:', err.message);
      console.error('❌ Error details:', err.details);
      return ctx.internalServerError(`Failed to fetch adverts: ${err.message}`);
    }
  }

}));
