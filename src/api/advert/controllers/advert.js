// src/api/advert/controllers/advert.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::advert.advert', ({ strapi }) => ({
  /**
   * Override default create to use VGAMS users relation
   */
  async create(ctx) {
    try {
      let data = ctx.request.body?.data;
      const files = ctx.request.files;

      console.log('🔍 Creating advert with VGAMS user');
      console.log('📦 Request body:', ctx.request.body);
      console.log('📦 Parsed data:', data);
      console.log('📎 Uploaded files:', files ? Object.keys(files) : 'No files');

      // If data is a string (from FormData), parse it
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

      // ── Auth: VGAMS User ──────────────────────────────────────────────────────
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
      console.log('✅ VGAMS user verified:', { id: vgamsUser.id, name: vgamsUser.name, role: vgamsUser.role });

      // ── Client (required – new-client creation is blocked) ───────────────────
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
      console.log('✅ Client verified:', { id: existingClient.id });

      // ── Revenue & Cost Streams (resolved from the product) ───────────────────
      let revenueStream = null;
      let costStream   = null;

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
          revenueStream = product.revenue_stream || null;
          costStream    = product.cost_stream    || null;
          console.log('✅ Revenue stream:', revenueStream?.code, '| Cost stream:', costStream?.code);
        } else {
          console.warn('⚠️ Product not found:', data.product);
        }
      }

      // ── Reference Number ─────────────────────────────────────────────────────
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

      // ── Sales Agent (manyToMany → connect syntax) ────────────────────────────
      const salesAgentConnect = data.salesAgentId
        ? { connect: [parseInt(data.salesAgentId)] }
        : undefined;

      // ── Advert Data Object ────────────────────────────────────────────────────
      const advertData = {
        advert_title:      data.advertTitle,
        reference_number:  referenceNumber,

        // Relations
        client:            clientId,
        product:           data.product    ? parseInt(data.product)   : null,
        rate_card:         data.rateCard   ? parseInt(data.rateCard)  : null,
        vgams_user:        parseInt(vgamsUserId),
        vgams_sales_persons: salesAgentConnect,   // manyToMany – connect[]

        // Ad details
        ad_size:           data.adSize    || '',
        ad_type:           data.adType    || 'full_color',
        frequency:         parseInt(data.frequency) || 1,
        publish_onweb:     Boolean(data.publishOnWeb),

        // Schedule
        start_date: data.startDate,
        end_date:   data.endDate  || null,

        // Pricing  (base × frequency × dateCount; discount & surcharge applied)
        base_price:   parseFloat(data.basePrice)   || 0,
        surcharge:    parseFloat(data.surcharge)   || 0,
        discount:     parseFloat(data.discount)    || 0,
        total_amount: parseFloat(data.totalAmount) || 0,

        // Payment & workflow
        payment_method:       data.paymentMethod,
        special_instructions: data.specialInstructions || '',
        status: data.status || 'draft',
      };

      console.log('📊 Final advert data:', advertData);

      // ── Create Advert ─────────────────────────────────────────────────────────
      const advert = await strapi.entityService.create('api::advert.advert', {
        data: advertData
      });
      console.log('✅ Advert created – ID:', advert.id);

      // ── File Uploads ──────────────────────────────────────────────────────────
      if (files && Object.keys(files).length > 0) {
        try {
          console.log('📁 Processing file uploads...');
          const uploadService   = strapi.plugins['upload'].services.upload;
          const uploadedFiles   = await uploadService.upload({
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

      // ── Fetch Full Advert (with all relations including streams) ───────────────
      const fullAdvert = await strapi.entityService.findOne('api::advert.advert', advert.id, {
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'bc_no'] },
          product: {
            fields: ['id', 'product_name', 'product_id'],
            populate: {
              revenue_stream: { fields: ['id', 'code', 'name'] },
              cost_stream:    { fields: ['id', 'code', 'name'] }
            }
          },
          rate_card:   { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw'] },
          attachments: true
        }
      });

      console.log('📋 Created advert summary:', {
        id:             fullAdvert.id,
        reference:      fullAdvert.reference_number,
        title:          fullAdvert.advert_title,
        client:         fullAdvert.client?.company_name,
        createdBy:      fullAdvert.vgams_user?.name,
        status:         fullAdvert.status,
        revenue_stream: fullAdvert.product?.revenue_stream?.code ?? 'N/A',
        cost_stream:    fullAdvert.product?.cost_stream?.code    ?? 'N/A',
        attachments:    fullAdvert.attachments?.length || 0,
        publish_onweb:  fullAdvert.publish_onweb
      });

      return {
        success: true,
        data: {
          ...fullAdvert,
          // Revenue & cost streams surfaced at the top level for BI / reporting
          revenue_stream: fullAdvert.product?.revenue_stream || null,
          cost_stream:    fullAdvert.product?.cost_stream    || null,
        },
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

  // ─────────────────────────────────────────────────────────────────────────────
  async findMyAdverts(ctx) {
    try {
      const { data } = ctx.request.body || {};
      const vgamsUserId = data?.vgamsUserId || ctx.query.vgamsUserId;

      if (!vgamsUserId) return ctx.badRequest('User ID required');

      console.log('🔍 Finding adverts for VGAMS user:', vgamsUserId);

      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { id: vgamsUserId, isActive: true }
      });
      if (!vgamsUser) return ctx.unauthorized('User not found or inactive');

      const { query } = ctx;
      const filters = {
        vgams_user: { id: parseInt(vgamsUserId) },
        ...(query.status && { status: query.status })
      };

      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        populate: {
          client:  { fields: ['id', 'company_name'] },
          product: {
            fields: ['id', 'product_name'],
            populate: {
              revenue_stream: { fields: ['id', 'code', 'name'] },
              cost_stream:    { fields: ['id', 'code', 'name'] }
            }
          },
          rate_card:           { fields: ['id', 'size_dimension', 'ad_type'] },
          vgams_sales_persons: { fields: ['id', 'name'] }
        },
        sort:  query.sort  || 'createdAt:desc',
        limit: query.limit || 100,
        start: query.start || 0
      });

      return { success: true, data: adverts, count: adverts.length };

    } catch (err) {
      console.error('❌ Error finding adverts:', err.message);
      return ctx.internalServerError(`Failed to find adverts: ${err.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  async findOne(ctx) {
    try {
      const { id } = ctx.params;

      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'bc_no'] },
          product: {
            fields: ['id', 'product_name', 'product_id'],
            populate: {
              revenue_stream: { fields: ['id', 'code', 'name'] },
              cost_stream:    { fields: ['id', 'code', 'name'] }
            }
          },
          rate_card:   { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw'] },
          attachments: true
        }
      });

      if (!advert) return ctx.notFound('Advert not found');

      return {
        success: true,
        data: {
          ...advert,
          revenue_stream: advert.product?.revenue_stream || null,
          cost_stream:    advert.product?.cost_stream    || null,
        }
      };

    } catch (err) {
      console.error('❌ Error fetching advert:', err.message);
      return ctx.internalServerError(`Failed to fetch advert: ${err.message}`);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      const vgamsUserId = data.vgamsUserId || ctx.headers['x-vgams-user-id'];

      if (!vgamsUserId) return ctx.badRequest('User identification required');

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
        'start_date', 'end_date', 'special_instructions', 'publish_onweb'
      ];

      const updateData = {};
      allowedFields.forEach(field => {
        if (data[field] !== undefined) updateData[field] = data[field];
      });

      const updatedAdvert = await strapi.entityService.update('api::advert.advert', id, {
        data: updateData,
        populate: ['product', 'rate_card', 'client', 'vgams_user', 'vgams_sales_persons']
      });

      return { success: true, data: updatedAdvert, message: 'Advert updated successfully' };

    } catch (err) {
      console.error('Error updating advert:', err);
      return ctx.internalServerError('Failed to update advert');
    }
  },

  // ─────────────────────────────────────────────────────────────────────────────
  async getDateRangeAdverts(ctx) {
    try {
      const { query } = ctx;

      const startDate = query.startDate ? new Date(query.startDate) : new Date();
      const endDate   = query.endDate   ? new Date(query.endDate)   : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (startDate > endDate) return ctx.badRequest('Start date must be before end date');

      const filters = {
        createdAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() },
        ...(query.userId   && { vgams_user: { id: parseInt(query.userId) } }),
        ...(query.status   && { status: query.status }),
        ...(query.clientId && { client: { id: parseInt(query.clientId) } }),
        ...(query.productId && { product: { id: parseInt(query.productId) } })
      };

      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone'] },
          product: {
            fields: ['id', 'product_name'],
            populate: {
              revenue_stream: { fields: ['id', 'code', 'name'] },
              cost_stream:    { fields: ['id', 'code', 'name'] }
            }
          },
          rate_card:   { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw'] },
          attachments: true
        },
        sort:  query.sort  || 'createdAt:desc',
        limit: query.limit || 1000,
        start: query.start || 0
      });

      const transformed = adverts.map(a => ({
        ...a,
        revenue_stream: a.product?.revenue_stream || null,
        cost_stream:    a.product?.cost_stream    || null,
        createdByUser:  a.vgams_user || null
      }));

      const totalAmount   = transformed.reduce((s, a) => s + (parseFloat(a.total_amount) || 0), 0);
      const totalDiscount = transformed.reduce((s, a) => s + (parseFloat(a.discount) || 0), 0);

      return {
        success:    true,
        data:       transformed,
        count:      transformed.length,
        statistics: {
          totalAmount,
          totalDiscount,
          averageAmount: transformed.length > 0 ? totalAmount / transformed.length : 0
        },
        dateRange: { start: startDate, end: endDate }
      };

    } catch (err) {
      console.error('❌ Error fetching date range adverts:', err.message);
      return ctx.internalServerError(`Failed to fetch adverts: ${err.message}`);
    }
  }
}));
