// src/api/advert/controllers/advert.js
'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::advert.advert', ({ strapi }) => ({
  /**
   * Override default create to use VGAMS users relation
   */
  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      
      console.log('🔍 Creating advert for VGAMS user');
      console.log('📦 Request data:', data);
      console.log('📋 Headers:', ctx.headers);
      
      // Get VGAMS user ID from request
      const vgamsUserId = data.vgamsUserId || ctx.headers['x-vgams-user-id'];
      
      if (!vgamsUserId) {
        console.error('❌ No VGAMS user ID provided');
        return ctx.badRequest('User identification required. Please log in.');
      }
      
      console.log('👤 VGAMS User ID:', vgamsUserId);
      
      // Verify VGAMS user exists and is active
      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { 
          id: vgamsUserId,
          isActive: true 
        },
        select: ['id', 'name', 'email', 'role']
      });
      
      if (!vgamsUser) {
        console.error('❌ VGAMS user not found or inactive:', vgamsUserId);
        return ctx.unauthorized('Invalid user or account is inactive. Please log in again.');
      }
      
      console.log('✅ VGAMS user verified:', {
        id: vgamsUser.id,
        name: vgamsUser.name,
        email: vgamsUser.email,
        role: vgamsUser.role
      });
      
      // Generate reference number
      const year = new Date().getFullYear();
      const lastAdvert = await strapi.entityService.findMany('api::advert.advert', {
        sort: { id: 'desc' },
        limit: 1
      });
      
      const lastId = lastAdvert.length > 0 ? lastAdvert[0].id : 0;
      const referenceNumber = `ADV-${year}-${lastId + 1}`;
      
      console.log('📝 Generated reference:', referenceNumber);
      
      // Transform camelCase to snake_case for Strapi and handle client creation
      // First check if client exists or needs to be created
      let clientId = data.clientId; // If client ID is provided directly
      
      if (!clientId) {
        // Try to find existing client by email
        const existingClient = await strapi.db.query('api::client.client').findOne({
          where: { email: data.email }
        });
        
        if (existingClient) {
          clientId = existingClient.id;
          console.log('✅ Found existing client:', existingClient.id);
        } else {
          // Create new client
          const newClient = await strapi.entityService.create('api::client.client', {
            data: {
              client_name: data.clientName,
              contact_person: data.contactPerson || '',
              email: data.email,
              phone: data.phone,
              status: 'active'
            }
          });
          clientId = newClient.id;
          console.log('✅ Created new client:', newClient.id);
        }
      }
      
      const transformedData = {
        advert_title: data.advertTitle,
        client: clientId, // Use client relation
        product: data.product,
        rate_card: data.rateCard,
        ad_size: data.adSize || '',
        ad_type: data.adType || 'full_color',
        frequency: parseInt(data.frequency) || 1,
        start_date: data.startDate,
        end_date: data.endDate || null,
        base_price: parseFloat(data.basePrice) || 0,
        surcharge: parseFloat(data.surcharge) || 0,
        total_amount: parseFloat(data.totalAmount) || 0,
        payment_method: data.paymentMethod,
        special_instructions: data.specialInstructions || '',
        status: data.status || 'draft',
        vgams_user: vgamsUserId, // Use vgams_user relation instead of separate fields
        // Keep these for backward compatibility if needed, but relation is better
        vgams_user_id: vgamsUserId
      };
      
      console.log('📊 Data to save:', transformedData);
      
      // Create advert with relations
      const advert = await strapi.entityService.create('api::advert.advert', {
        data: transformedData,
        populate: {
          product: {
            fields: ['id', 'product_name', 'description']
          },
          rate_card: {
            fields: ['id', 'name', 'price_fc', 'price_bw']
          },
          client: {
            fields: ['id', 'client_name', 'contact_person', 'email', 'phone']
          },
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          }
        }
      });
      
      console.log('✅ Advert created successfully');
      console.log('📋 Advert details:', {
        id: advert.id,
        reference: advert.reference_number,
        title: advert.advert_title,
        client: advert.client?.client_name,
        vgams_user: advert.vgams_user?.name
      });
      
      return { 
        success: true,
        data: advert,
        message: 'Advert created successfully'
      };
      
    } catch (err) {
      console.error('❌ Error creating advert:', err.message);
      console.error('❌ Stack trace:', err.stack);
      return ctx.internalServerError('Failed to create advert: ' + err.message);
    }
  },
  
  /**
   * Get adverts by VGAMS user using relation
   */
  async findByVgamsUser(ctx) {
    try {
      const vgamsUserId = ctx.headers['x-vgams-user-id'] || ctx.query.vgamsUserId;
      
      if (!vgamsUserId) {
        return ctx.badRequest('VGAMS user ID required');
      }
      
      const { query } = ctx;
      
      // Verify user exists
      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { 
          id: vgamsUserId,
          isActive: true 
        }
      });
      
      if (!vgamsUser) {
        return ctx.unauthorized('Invalid user or account is inactive.');
      }
      
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          vgams_user: vgamsUserId
        },
        populate: {
          product: {
            fields: ['id', 'product_name', 'description']
          },
          rate_card: {
            fields: ['id', 'name', 'price_fc', 'price_bw']
          },
          client: {
            fields: ['id', 'client_name', 'contact_person', 'email', 'phone']
          },
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          }
        },
        sort: query.sort || 'createdAt:desc',
        limit: query.limit || 50,
        start: query.start || 0
      });
      
      return { 
        success: true,
        data: adverts,
        count: adverts.length,
        user: {
          id: vgamsUser.id,
          name: vgamsUser.name,
          email: vgamsUser.email,
          role: vgamsUser.role
        }
      };
      
    } catch (err) {
      console.error('Error fetching adverts:', err);
      return ctx.internalServerError('Failed to fetch adverts');
    }
  },
  
  /**
   * Get a single advert with full details
   */
  async findOne(ctx) {
    try {
      const { id } = ctx.params;
      const vgamsUserId = ctx.headers['x-vgams-user-id'] || ctx.query.vgamsUserId;
      
      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        populate: {
          product: {
            fields: ['id', 'product_name', 'description', 'circulation']
          },
          rate_card: {
            fields: ['id', 'name', 'price_fc', 'price_bw', 'surcharge_percentage']
          },
          client: {
            fields: ['id', 'client_name', 'contact_person', 'email', 'phone', 'address']
          },
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          },
          attachments: {
            fields: ['id', 'name', 'url', 'mime', 'size']
          },
          workflow_history: {
            fields: ['id', 'action', 'previous_status', 'new_status', 'performed_by', 'timestamp', 'notes'],
            sort: 'timestamp:desc'
          },
          comments: {
            fields: ['id', 'comment_text', 'comment_type', 'author', 'created_at'],
            sort: 'created_at:desc'
          }
        }
      });
      
      if (!advert) {
        return ctx.notFound('Advert not found');
      }
      
      // Check if user has permission to view this advert
      // Allow if user created it or has admin/manager role
      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { id: vgamsUserId }
      });
      
      const canView = advert.vgams_user?.id === parseInt(vgamsUserId) || 
                     vgamsUser?.role === 'administrator' || 
                     vgamsUser?.role === 'advertising_manager';
      
      if (!canView) {
        return ctx.forbidden('You do not have permission to view this advert');
      }
      
      return { 
        success: true,
        data: advert
      };
      
    } catch (err) {
      console.error('Error fetching advert:', err);
      return ctx.internalServerError('Failed to fetch advert');
    }
  },
  
  /**
   * Update advert (only if draft and created by same user)
   */
  async update(ctx) {
    try {
      const { id } = ctx.params;
      const { data } = ctx.request.body;
      const vgamsUserId = data.vgamsUserId || ctx.headers['x-vgams-user-id'];
      
      if (!vgamsUserId) {
        return ctx.badRequest('User identification required');
      }
      
      // Get existing advert
      const existingAdvert = await strapi.entityService.findOne('api::advert.advert', id, {
        populate: ['vgams_user']
      });
      
      if (!existingAdvert) {
        return ctx.notFound('Advert not found');
      }
      
      // Check permissions
      if (existingAdvert.vgams_user?.id !== parseInt(vgamsUserId)) {
        return ctx.forbidden('You can only update your own adverts');
      }
      
      if (existingAdvert.status !== 'draft') {
        return ctx.badRequest('Only draft adverts can be updated');
      }
      
      // Prepare update data
      const updateData = {};
      
      // Only update allowed fields
      const allowedFields = [
        'advert_title', 'ad_size', 'ad_type', 'frequency',
        'start_date', 'end_date', 'special_instructions'
      ];
      
      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          // Convert camelCase to snake_case
          const snakeField = field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          updateData[field] = data[snakeField] || data[field];
        }
      });
      
      // Update advert
      const updatedAdvert = await strapi.entityService.update('api::advert.advert', id, {
        data: updateData,
        populate: ['product', 'rate_card', 'client', 'vgams_user']
      });
      
      return { 
        success: true,
        data: updatedAdvert,
        message: 'Advert updated successfully'
      };
      
    } catch (err) {
      console.error('Error updating advert:', err);
      return ctx.internalServerError('Failed to update advert');
    }
  }
}));
