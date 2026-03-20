// src/api/advert/controllers/advert.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::advert.advert', ({ strapi }) => ({

  // ── CREATE  (POST /adverts) ───────────────────────────────────────────────
  async create(ctx) {
    try {
      let data = ctx.request.body?.data;
      const files = ctx.request.files;

      console.log('🔍 Creating advert with VGAMS user');
      console.log('📦 Request body:', ctx.request.body);
      console.log('📦 Parsed data:', data);
      console.log('📎 Uploaded files:', files ? Object.keys(files) : 'No files');

      if (typeof data === 'string') {
        try { data = JSON.parse(data); }
        catch { return ctx.badRequest('Invalid data format'); }
      }

      if (!data && ctx.request.body?.data) data = ctx.request.body.data;
      if (!data) data = ctx.request.body;

      console.log('📦 Final parsed data:', data);

      // ── Auth ─────────────────────────────────────────────────────────────
      const vgamsUserId = data.vgamsUserId;
      if (!vgamsUserId) return ctx.badRequest('User identification required. Please log in.');

      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { id: vgamsUserId, isActive: true }
      });
      if (!vgamsUser) return ctx.unauthorized('Invalid user or account is inactive.');
      console.log('✅ VGAMS user verified:', { id: vgamsUser.id, name: vgamsUser.name, role: vgamsUser.role });

      // ── Client ────────────────────────────────────────────────────────────
      const clientId = data.clientId ? parseInt(data.clientId) : null;
      if (!clientId) return ctx.badRequest('A valid client must be selected from the dropdown.');

      const existingClient = await strapi.db.query('api::client.client').findOne({ where: { id: clientId } });
      if (!existingClient) return ctx.badRequest('Selected client does not exist.');
      console.log('✅ Client verified:', { id: existingClient.id, name: existingClient.company_name });

      // ── Revenue & Cost stream codes ───────────────────────────────────────
      let revenueStreamCode = null;
      let costStreamCode    = null;

      if (data.product) {
        const product = await strapi.entityService.findOne(
          'api::product.product', parseInt(data.product),
          { populate: { revenue_stream: { fields: ['code'] }, cost_stream: { fields: ['code'] } } }
        );
        if (product) {
          revenueStreamCode = product.revenue_stream?.code || null;
          costStreamCode    = product.cost_stream?.code    || null;
          console.log('✅ Revenue stream:', revenueStreamCode, '| Cost stream:', costStreamCode);
        }
      }

      // ── Reference number ──────────────────────────────────────────────────
      const now    = new Date();
      const pad    = (n, w = 2) => String(n).padStart(w, '0');
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayCount = await strapi.entityService.count('api::advert.advert', {
        filters: { createdAt: { $gte: todayStart.toISOString() } }
      });
      const referenceNumber = `ADV-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(todayCount + 1, 3)}`;
      console.log('📝 Generated reference:', referenceNumber, '| Counter:', todayCount + 1);

      // ── Publishing dates: merge datesList + startDate + endDate, dedupe, sort asc ──
      const rawDates = Array.isArray(data.publishingDates)
        ? data.publishingDates
        : (Array.isArray(data.datesList) ? data.datesList : []);
      const datesSet = new Set([
        ...rawDates,
        ...(data.startDate ? [data.startDate] : []),
        ...(data.endDate   ? [data.endDate]   : [])
      ].filter(Boolean));
      const publishingDates = [...datesSet].sort();
      console.log('📅 Publishing dates:', publishingDates);

      // ── Create Advert ──────────────────────────────────────────────────────
      const advert = await strapi.entityService.create('api::advert.advert', {
        data: {
          advert_title:        data.advertTitle,
          reference_number:    referenceNumber,
          client:              clientId,
          product:             data.product  ? parseInt(data.product)  : null,
          rate_card:           data.rateCard ? parseInt(data.rateCard) : null,
          vgams_user:          parseInt(vgamsUserId),
          vgams_sales_persons: data.salesAgentId ? { connect: [parseInt(data.salesAgentId)] } : undefined,
          revenue_stream:      revenueStreamCode,
          cost_stream:         costStreamCode,
          office_location:     data.officeLocation    || null,
          client_reference_no: data.referenceDocument || null,
          ad_size:             data.adSize     || '',
          ad_type:             data.adType     || 'full_color',
          frequency:           parseInt(data.frequency) || 1,
          publish_onweb:       Boolean(data.publishOnWeb),
          start_date:          data.startDate,
          end_date:            data.endDate   || null,
          base_price:          parseFloat(data.basePrice)   || 0,
          surcharge:           parseFloat(data.surcharge)   || 0,
          discount:            parseFloat(data.discount)    || 0,
          total_amount:        parseFloat(data.totalAmount) || 0,
          payment_method:      data.paymentMethod,
          special_instructions: data.specialInstructions || '',
          contact_person:      data.contactPerson || null,
          contact_number:      data.contactNumber || data.phone || null,
          contact_email:       data.contactEmail  || data.email || null,
          market_sector:       data.marketSector  || null,
          section_commission: 'ADV',
          status:              data.status || 'draft',
          publishing_dates:    publishingDates,
        }
      });
      console.log('✅ Advert created – ID:', advert.id);

      // ── File uploads ──────────────────────────────────────────────────────
      if (files && Object.keys(files).length > 0) {
        try {
          const uploaded = await strapi.plugins['upload'].services.upload.upload({
            data:  { refId: advert.id, ref: 'api::advert.advert', field: 'attachments' },
            files: Object.values(files)
          });
          if (uploaded?.length > 0) {
            await strapi.entityService.update('api::advert.advert', advert.id, {
              data: { attachments: { set: uploaded.map(f => f.id) } }
            });
          }
          console.log('✅ Files uploaded:', uploaded.length);
        } catch (uploadError) {
          console.error('❌ File upload failed (advert still created):', uploadError.message);
        }
      }

      // ── Sync with Business Central ────────────────────────────────────────
      let bcSyncResult = { success: false, bcReference: null, error: null };
      
      // Get the BC sync service
      const bcSyncService = strapi.service('api::advert.bc-sync');
      
      if (bcSyncService.isConfigured()) {
        console.log('🔄 Starting BC sync for advert:', advert.id);
        bcSyncResult = await bcSyncService.syncAdvert(advert.id);
        
        if (bcSyncResult.success) {
          console.log('✅ BC sync successful. Reference:', bcSyncResult.bcReference);
        } else {
          console.log('❌ BC sync failed:', bcSyncResult.error);
        }
      } else {
        console.log('⚠️ BC not configured, skipping sync');
        const configStatus = bcSyncService.getConfigStatus();
        console.log('BC Config Status:', configStatus);
      }

      // ── Fetch final advert with all data ──────────────────────────────────
      const full = await strapi.entityService.findOne('api::advert.advert', advert.id, {
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email', 'bc_code'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'bc_no'] },
          product:             { fields: ['id', 'product_name', 'product_id'] },
          rate_card:           { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw', 'full_color_no', 'black_color_no', 'base_unit_of_measure'] },
          attachments:         true
        }
      });

      console.log('📋 Created advert summary:', {
        id: full.id, 
        reference: full.reference_number, 
        bc_reference: full.bc_reference_number,
        bc_sync_success: full.bc_share_success,
        title: full.advert_title,
        client: full.client?.company_name, 
        status: full.status
      });

      // ── Return response with BC reference ─────────────────────────────────
      const responseData = {
        id: full.id,
        reference: full.reference_number,
        bc_reference: full.bc_reference_number,
        bc_sync_success: full.bc_share_success,
        advertTitle: full.advert_title,
        clientName: full.client?.company_name,
        status: full.status
      };

      // Determine message based on sync status
      let message;
      if (data.status === 'draft') {
        message = bcSyncResult.success 
          ? 'Draft saved and synced with Business Central' 
          : (bcSyncService.isConfigured() ? 'Draft saved but BC sync failed' : 'Draft saved (BC not configured)');
      } else {
        message = bcSyncResult.success 
          ? 'Advert submitted and synced with Business Central' 
          : (bcSyncService.isConfigured() ? 'Advert submitted but BC sync failed' : 'Advert submitted (BC not configured)');
      }

      return {
        success: true,
        data: responseData,
        message: message,
        bcSync: bcSyncResult
      };

    } catch (err) {
      console.error('❌ Error creating advert:', err.message, err.stack);
      return ctx.internalServerError(`Failed to create advert: ${err.message}`);
    }
  },

  // ── RETRY BC SYNC (POST /adverts/:id/retry-bc-sync) ───────────────────────
  async retryBcSync(ctx) {
    try {
      const { id } = ctx.params;
      const { vgamsUserId } = ctx.request.body;

      console.log('🔄 Retrying BC sync for advert:', id);

      // Verify user has permission
      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        populate: ['vgams_user']
      });

      if (!advert) {
        return ctx.notFound('Advert not found');
      }

      if (advert.vgams_user?.id !== parseInt(vgamsUserId)) {
        return ctx.forbidden('You can only retry sync for your own adverts');
      }

      // Retry BC sync
      const bcSyncService = strapi.service('api::advert.bc-sync');
      const result = await bcSyncService.retrySync(id);

      if (result.success) {
        return {
          success: true,
          message: 'BC sync retry successful',
          data: {
            bc_reference: result.bcReference,
            bc_sync_success: true
          }
        };
      } else {
        return ctx.internalServerError(`BC sync retry failed: ${result.error}`);
      }

    } catch (err) {
      console.error('❌ Error retrying BC sync:', err.message);
      return ctx.internalServerError(`Failed to retry BC sync: ${err.message}`);
    }
  },

  // ── FIND MY ADVERTS  (POST /adverts/my-adverts) ───────────────────────────
  async findMyAdverts(ctx) {
    try {
      const body        = ctx.request.body || {};
      const vgamsUserId = body.vgamsUserId || body.data?.vgamsUserId || ctx.query.vgamsUserId;
      if (!vgamsUserId) return ctx.badRequest('User ID required');

      console.log('🔍 Finding adverts for VGAMS user:', vgamsUserId);

      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { id: vgamsUserId, isActive: true }
      });
      if (!vgamsUser) return ctx.unauthorized('User not found or inactive');

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
        data:    adverts.map(advert => this.transformAdvert(advert)),
        count:   adverts.length,
        user: { id: vgamsUser.id, name: vgamsUser.name, email: vgamsUser.email, role: vgamsUser.role }
      };

    } catch (err) {
      console.error('❌ Error fetching adverts:', err.message);
      return ctx.internalServerError('Failed to fetch adverts');
    }
  },

  // ── FIND ONE  (GET /adverts/:id) ──────────────────────────────────────────
  async findOne(ctx) {
    try {
      const { id } = ctx.params;
      console.log('🔍 Fetching single advert:', id);

      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'address', 'bc_no'] },
          product: {
            fields: ['id', 'product_name', 'product_id', 'description', 'circulation'],
            populate: { category: { fields: ['id', 'category_name', 'category_type', 'description'] } }
          },
          rate_card:   { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw', 'surcharge_percentage'] },
          attachments: true
        }
      });

      if (!advert) {
        console.error('❌ Advert not found:', id);
        return ctx.notFound('Advert not found');
      }

      const result = {
        ...this.transformAdvert(advert),
        publishedAt: advert.publishedAt,
        vgams_user:          advert.vgams_user,
        vgams_sales_persons: advert.vgams_sales_persons
      };

      console.log('✅ Advert fetched:', {
        id: result.id, reference: result.reference, title: result.advertTitle,
        status: result.status
      });

      return { success: true, data: result };

    } catch (err) {
      console.error('❌ Error fetching advert:', err.message, err.stack);
      return ctx.internalServerError(`Failed to fetch advert: ${err.message}`);
    }
  },

  // ── UPDATE  (PUT /adverts/:id) ────────────────────────────────────────────
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      const vgamsUserId = data.vgamsUserId || ctx.headers['x-vgams-user-id'];
      if (!vgamsUserId) return ctx.badRequest('User identification required');

      const existingAdvert = await strapi.entityService.findOne('api::advert.advert', id, {
        populate: ['vgams_user']
      });
      if (!existingAdvert)                                           return ctx.notFound('Advert not found');
      if (existingAdvert.vgams_user?.id !== parseInt(vgamsUserId))  return ctx.forbidden('You can only update your own adverts');
      if (existingAdvert.status !== 'draft')                        return ctx.badRequest('Only draft adverts can be updated');

      const allowedFields = [
        'advert_title', 'ad_size', 'ad_type', 'frequency',
        'start_date', 'end_date', 'special_instructions', 'publish_onweb',
        'office_location', 'client_reference_no',
        'contact_person', 'contact_number', 'contact_email',
        'market_sector'
      ];
      const updateData = {};
      allowedFields.forEach(field => { if (data[field] !== undefined) updateData[field] = data[field]; });

      // Rebuild publishing_dates if dates are provided
      if (data.publishingDates !== undefined || data.datesList !== undefined ||
          data.startDate !== undefined || data.endDate !== undefined) {
        const rawDates = Array.isArray(data.publishingDates)
          ? data.publishingDates
          : (Array.isArray(data.datesList) ? data.datesList : []);
        const datesSet = new Set([
          ...rawDates,
          ...(data.startDate ? [data.startDate] : []),
          ...(data.endDate   ? [data.endDate]   : [])
        ].filter(Boolean));
        updateData.publishing_dates = [...datesSet].sort();
        console.log('📅 Updated publishing_dates:', updateData.publishing_dates);
      }

      const updated = await strapi.entityService.update('api::advert.advert', id, {
        data: updateData,
        populate: ['product', 'rate_card', 'client', 'vgams_user', 'vgams_sales_persons']
      });

      return { success: true, data: updated, message: 'Advert updated successfully' };

    } catch (err) {
      console.error('❌ Error updating advert:', err.message);
      return ctx.internalServerError('Failed to update advert');
    }
  },

  // ── Helper: Transform advert to camelCase ─────────────────────────────────
  transformAdvert(a) {
    const normaliseAttachment = (f) => {
      if (!f) return null;
      return {
        id: f.id,
        name: f.name,
        mime: f.mime,
        size: f.size,
        url: f.url || null,
        thumbnailUrl: f.formats?.thumbnail?.url || null,
        uploadedAt: f.createdAt
      };
    };

    return {
      id: a.id,
      reference: a.reference_number,
      bcReference: a.bc_reference_number,
      advertTitle: a.advert_title,
      adSize: a.ad_size,
      adType: a.ad_type,
      frequency: a.frequency,
      publishOnWeb: a.publish_onweb,
      startDate: a.start_date,
      endDate: a.end_date,
      publishingDates: Array.isArray(a.publishing_dates) ? a.publishing_dates : [],
      basePrice: a.base_price,
      surcharge: a.surcharge,
      discount: a.discount || 0,
      totalAmount: a.total_amount,
      paymentMethod: a.payment_method,
      specialInstructions: a.special_instructions,
      status: a.status,
      revenueStream: a.revenue_stream || null,
      costStream: a.cost_stream || null,
      officeLocation: a.office_location || null,
      clientRefNo: a.client_reference_no || null,
      contactPerson: a.contact_person || null,
      contactNumber: a.contact_number || null,
      contactEmail: a.contact_email || null,
      marketSector: a.market_sector || null,
      isActive: a.isActive,
      isPaid: a.isPaid,
      isScheduled: a.isScheduled,
      isApproved: a.isApproved,
      isCanceled: a.isCanceled,
      hasRun: a.hasRun,
      isClosed: a.isClosed,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      createdBy: a.vgams_user ? { id: a.vgams_user.id, name: a.vgams_user.name, email: a.vgams_user.email, role: a.vgams_user.role } : null,
      salesAgents: (a.vgams_sales_persons || []).map(s => ({ id: s.id, name: s.name, email: s.email })),
      client: a.client ? {
        id: a.client.id,
        name: a.client.company_name,
        contactPerson: a.client.contact_person || null,
        email: a.client.email || null,
        phone: a.client.phone || null,
        address: a.client.address || null,
        bcNo: a.client.bc_no || null
      } : null,
      clientName: a.client?.company_name || null,
      product: a.product ? {
        id: a.product.id,
        name: a.product.product_name,
        productId: a.product.product_id || null,
        description: a.product.description || null,
        circulation: a.product.circulation || null,
        category: a.product.category ? {
          id: a.product.category.id,
          name: a.product.category.category_name,
          type: a.product.category.category_type,
          description: a.product.category.description || null
        } : null
      } : null,
      rateCard: a.rate_card ? {
        id: a.rate_card.id,
        adType: a.rate_card.ad_type,
        sizeDimension: a.rate_card.size_dimension,
        priceFc: a.rate_card.price_fc,
        priceBw: a.rate_card.price_bw,
        surchargePercentage: a.rate_card.surcharge_percentage || null
      } : null,
      attachments: (Array.isArray(a.attachments) ? a.attachments : []).filter(Boolean).map(normaliseAttachment)
    };
  }
}));
