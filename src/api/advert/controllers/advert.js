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
    const files = ctx.request.files; // Get uploaded files
    
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
    
    // If data is undefined, check if body.data exists
    if (!data && ctx.request.body?.data) {
      data = ctx.request.body.data;
    }
    
    // If still no data, use the whole body (for JSON requests)
    if (!data) {
      data = ctx.request.body;
    }
    
    console.log('📦 Final parsed data:', data);
    
    // Get VGAMS user ID from request body
    const vgamsUserId = data.vgamsUserId;
    
    if (!vgamsUserId) {
      console.error('❌ No VGAMS user ID provided');
      return ctx.badRequest('User identification required. Please log in.');
    }
    
    console.log('👤 VGAMS User ID from body:', vgamsUserId);
    
    // Verify VGAMS user exists
    const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
      where: { 
        id: vgamsUserId,
        isActive: true 
      }
    });
    
    if (!vgamsUser) {
      console.error('❌ VGAMS user not found or inactive:', vgamsUserId);
      return ctx.unauthorized('Invalid user or account is inactive.');
    }
    
    console.log('✅ VGAMS user verified:', {
      id: vgamsUser.id,
      name: vgamsUser.name,
      email: vgamsUser.email,
      role: vgamsUser.role
    });
    
    // Generate reference number in format YYYYMMDD[hourminuteseconds] with counter
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // Get count of adverts created today for counter
    const todayStart = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayAdvertsCount = await strapi.entityService.count('api::advert.advert', {
      filters: {
        createdAt: {
          $gte: todayStart.toISOString()
        }
      }
    });
    
    // Add incremental counter (001, 002, etc.)
    const counter = String(todayAdvertsCount + 1).padStart(3, '0');
    const referenceNumber = `ADV-${year}${month}${day}${hours}${minutes}${seconds}${counter}`;
    
    console.log('📝 Generated reference:', referenceNumber);
    console.log('📊 Today\'s advert count:', todayAdvertsCount);
    console.log('🔢 Counter:', counter);
    
    // Handle client - find or create
    let clientId = null;
    
    // Check if client exists by email
    const existingClient = await strapi.db.query('api::client.client').findOne({
      where: { email: data.email }
    });
    
    if (existingClient) {
      clientId = existingClient.id;
      console.log('✅ Using existing client:', clientId);
    } else {
      // Create new client
      const newClient = await strapi.entityService.create('api::client.client', {
        data: {
          company_name: data.clientName,
          contact_person: data.contactPerson || '',
          email: data.email,
          phone: data.phone,
          is_active: true
        }
      });
      clientId = newClient.id;
      console.log('✅ Created new client:', clientId, data.clientName);
    }
    
    // Prepare advert data for creation
    const advertData = {
      advert_title: data.advertTitle,
      reference_number: referenceNumber, // Set the generated reference
      client: clientId,
      product: data.product,
      rate_card: data.rateCard,
      ad_size: data.adSize,
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
      vgams_user: vgamsUserId
    };
    
    console.log('📊 Final advert data:', advertData);
    
    // Create the advert first
    const advert = await strapi.entityService.create('api::advert.advert', {
      data: advertData
    });
    
    console.log('✅ Advert created successfully! ID:', advert.id);
    
    // Handle file uploads if any
    if (files && Object.keys(files).length > 0) {
      try {
        console.log('📁 Processing file uploads...');
        
        // Get the upload service
        const uploadService = strapi.plugins['upload'].services.upload;
        
        // Upload files to Strapi Media Library
        const uploadedFiles = await uploadService.upload({
          data: {
            refId: advert.id,
            ref: 'api::advert.advert',
            field: 'attachments'
          },
          files: Object.values(files)
        });
        
        console.log('✅ Files uploaded successfully:', uploadedFiles.length, 'files');
        
        // Update advert with attachment IDs
        if (uploadedFiles && uploadedFiles.length > 0) {
          const attachmentIds = uploadedFiles.map(file => file.id);
          await strapi.entityService.update('api::advert.advert', advert.id, {
            data: {
              attachments: {
                set: attachmentIds
              }
            }
          });
        }
      } catch (uploadError) {
        console.error('❌ File upload failed:', uploadError.message);
        console.error('❌ Upload error stack:', uploadError.stack);
        // Don't fail the whole advert creation if file upload fails
      }
    }
    
    // Fetch the created advert with relations
    const fullAdvert = await strapi.entityService.findOne('api::advert.advert', advert.id, {
      populate: {
        vgams_user: true,
        client: true,
        product: true,
        rate_card: true,
        attachments: true
      }
    });
    
    console.log('📋 Created advert:', {
      id: fullAdvert.id,
      reference: fullAdvert.reference_number,
      title: fullAdvert.advert_title,
      client: fullAdvert.client?.company_name,
      createdBy: fullAdvert.vgams_user?.name,
      status: fullAdvert.status,
      attachmentsCount: fullAdvert.attachments?.length || 0
    });
    
    return {
      success: true,
      data: fullAdvert,
      message: data.status === 'draft' ? 'Draft saved successfully' : 'Advert submitted for review'
    };
    
  } catch (err) {
    console.error('❌ Error creating advert:', err.message);
    console.error('❌ Stack trace:', err.stack);
    return ctx.internalServerError(`Failed to create advert: ${err.message}`);
  }
},,
  async findMyAdverts(ctx) {
    try {
      const { data } = ctx.request.body || {};
      const vgamsUserId = data?.vgamsUserId || ctx.query.vgamsUserId;
      
      if (!vgamsUserId) {
        return ctx.badRequest('User ID required');
      }
      
      console.log('🔍 Finding adverts for VGAMS user:', vgamsUserId);
      
      // Verify user exists
      const vgamsUser = await strapi.db.query('api::vgams-user.vgams-user').findOne({
        where: { id: vgamsUserId, isActive: true }
      });
      
      if (!vgamsUser) {
        return ctx.unauthorized('User not found or inactive');
      }
      
      const { query } = ctx;
      
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          vgams_user: vgamsUserId
        },
        populate: {
          vgams_user: {
            fields: ['id', 'name', 'email']
          },
          client: {
            fields: ['id', 'client_name', 'email']
          },
          product: {
            fields: ['id', 'product_name']
          },
          rate_card: {
            fields: ['id', 'name']
          }
        },
        sort: query.sort || 'createdAt:desc',
        limit: query.limit || 50,
        start: query.start || 0
      });
      
      return {
        success: true,
        data: adverts,
        count: adverts.length
      };
      
    } catch (err) {
      console.error('Error fetching adverts:', err);
      return ctx.internalServerError('Failed to fetch adverts');
    }
  }
  ,
  
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
