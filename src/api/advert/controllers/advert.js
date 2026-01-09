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
},
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
 * Get a single advert by ID
 */
async findOne(ctx) {
  try {
    const { id } = ctx.params;
    
    console.log('🔍 Fetching single advert:', id);
    
    // Get advert with full details - REMOVED workflow_history and comments due to schema issues
    const advert = await strapi.entityService.findOne('api::advert.advert', id, {
      populate: {
        vgams_user: {
          fields: ['id', 'name', 'email', 'role']
        },
        client: {
          fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'address']
        },
        product: {
          fields: ['id', 'product_name', 'description', 'circulation'],
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
        // Temporarily removed due to schema issues:
        // workflow_history: {
        //   fields: ['id', 'action', 'previous_status', 'new_status', 'performed_by', 'timestamp', 'notes'],
        //   sort: 'timestamp:desc'
        // },
        // comments: {
        //   fields: ['id', 'comment_text', 'comment_type', 'author', 'created_at'],
        //   sort: 'created_at:desc'
        // }
      }
    });
    
    if (!advert) {
      console.error('❌ Advert not found:', id);
      return ctx.notFound('Advert not found');
    }
    
    // Transform the advert data - REMOVED workflow_history and comments
    const transformedAdvert = {
      id: advert.id,
      reference_number: advert.reference_number,
      advert_title: advert.advert_title,
      client: advert.client ? {
        id: advert.client.id,
        company_name: advert.client.company_name,
        contact_person: advert.client.contact_person,
        email: advert.client.email,
        phone: advert.client.phone,
        address: advert.client.address
      } : null,
      product: advert.product ? {
        id: advert.product.id,
        product_name: advert.product.product_name,
        description: advert.product.description,
        circulation: advert.product.circulation,
        // Get category information from populated category relation
        category: advert.product.category ? {
          id: advert.product.category.id,
          name: advert.product.category.category_name,
          type: advert.product.category.category_type, // This is where category_type comes from
          description: advert.product.category.description
        } : null
      } : null,
      rate_card: advert.rate_card ? {
        id: advert.rate_card.id,
        name: advert.rate_card.name,
        size_dimension: advert.rate_card.size_dimension,
        ad_type: advert.rate_card.ad_type,
        price_fc: advert.rate_card.price_fc,
        price_bw: advert.rate_card.price_bw,
        surcharge_percentage: advert.rate_card.surcharge_percentage
      } : null,
      ad_size: advert.ad_size,
      ad_type: advert.ad_type,
      frequency: advert.frequency,
      start_date: advert.start_date,
      end_date: advert.end_date,
      base_price: advert.base_price,
      surcharge: advert.surcharge,
      discount: advert.discount || 0,
      total_amount: advert.total_amount,
      payment_method: advert.payment_method,
      special_instructions: advert.special_instructions,
      status: advert.status,
      attachments: advert.attachments ? advert.attachments.map(file => ({
        id: file.id,
        name: file.name,
        url: file.url,
        mime: file.mime,
        size: file.size,
        uploadedAt: file.createdAt
      })) : [],
      // Temporarily removed:
      // workflow_history: advert.workflow_history || [],
      // comments: advert.comments ? advert.comments.map(comment => ({
      //   id: comment.id,
      //   text: comment.comment_text,
      //   type: comment.comment_type,
      //   author: comment.author,
      //   createdAt: comment.created_at
      // })) : [],
      createdAt: advert.createdAt,
      updatedAt: advert.updatedAt,
      publishedAt: advert.publishedAt,
      vgams_user: advert.vgams_user ? {
        id: advert.vgams_user.id,
        name: advert.vgams_user.name,
        email: advert.vgams_user.email,
        role: advert.vgams_user.role
      } : null
    };
    
    console.log('✅ Advert fetched successfully:', {
      id: transformedAdvert.id,
      reference: transformedAdvert.reference_number,
      title: transformedAdvert.advert_title,
      status: transformedAdvert.status,
      files: transformedAdvert.attachments.length,
      productCategory: transformedAdvert.product?.category?.type || 'No category'
    });
    
    return {
      success: true,
      data: transformedAdvert
    };
    
  } catch (err) {
    console.error('❌ Error fetching advert:', err.message);
    console.error('❌ Error stack:', err.stack);
    return ctx.internalServerError(`Failed to fetch advert: ${err.message}`);
  }
}
  
  ,
  
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
  },
async getDateRangeAdverts(ctx) {
  try {
    const { query } = ctx;
    
    console.log('📅 Date range query received:', query);
    
    // Get date range from query parameters
    const startDate = query.startDate ? new Date(query.startDate) : new Date();
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    
    // Set time to start and end of day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    // Validate date range
    if (startDate > endDate) {
      return ctx.badRequest('Start date must be before end date');
    }
    
    console.log('📅 Fetching adverts for date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    // Build filter object - CORRECTED SYNTAX
    const filters = {
      createdAt: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString()
      }
    };
    
    // Add optional filters with correct syntax
    if (query.userId) {
      filters.vgams_user = {
        id: parseInt(query.userId)
      };
    }
    
    if (query.status) {
      filters.status = query.status;
    }
    
    if (query.clientId) {
      filters.client = {
        id: parseInt(query.clientId)
      };
    }
    
    if (query.productId) {
      filters.product = {
        id: parseInt(query.productId)
      };
    }
    
    console.log('🔍 Filters applied:', JSON.stringify(filters, null, 2));
    
    // Get adverts for date range - USING CORRECT POPULATE SYNTAX
    const dateRangeAdverts = await strapi.entityService.findMany('api::advert.advert', {
      filters: filters,
      populate: {
        vgams_user: {
          fields: ['id', 'name', 'email', 'role']
        },
        client: {
          fields: ['id', 'company_name', 'contact_person', 'email', 'phone']
        },
        product: {
          fields: ['id', 'product_name', 'description']
        },
        rate_card: {
          fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw']
        },
        attachments: true
      },
      sort: query.sort || 'createdAt:desc',
      limit: query.limit || 1000,
      start: query.start || 0
    });
    
    // Transform data to include user info clearly
    const transformedAdverts = dateRangeAdverts.map(advert => ({
      id: advert.id,
      reference_number: advert.reference_number,
      advert_title: advert.advert_title,
      client: advert.client ? {
        id: advert.client.id,
        company_name: advert.client.company_name,
        contact_person: advert.client.contact_person,
        email: advert.client.email,
        phone: advert.client.phone
      } : null,
      product: advert.product ? {
        id: advert.product.id,
        product_name: advert.product.product_name,
        description: advert.product.description
      } : null,
      rate_card: advert.rate_card ? {
        id: advert.rate_card.id,
        name: advert.rate_card.name,
        ad_type: advert.rate_card.ad_type,
        price_fc: advert.rate_card.price_fc,
        price_bw: advert.rate_card.price_bw
      } : null,
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
      special_instructions: advert.special_instructions,
      status: advert.status,
      attachments: advert.attachments,
      createdAt: advert.createdAt,
      updatedAt: advert.updatedAt,
      createdByUser: advert.vgams_user ? {
        id: advert.vgams_user.id,
        name: advert.vgams_user.name,
        email: advert.vgams_user.email,
        role: advert.vgams_user.role
      } : null
    }));
    
    // Calculate statistics
    const totalAmount = transformedAdverts.reduce((sum, advert) => sum + (parseFloat(advert.total_amount) || 0), 0);
    const totalDiscount = transformedAdverts.reduce((sum, advert) => sum + (parseFloat(advert.discount) || 0), 0);
    
    // Get unique users
    const uniqueUsers = new Map();
    transformedAdverts.forEach(advert => {
      if (advert.createdByUser) {
        if (!uniqueUsers.has(advert.createdByUser.id)) {
          uniqueUsers.set(advert.createdByUser.id, advert.createdByUser);
        }
      }
    });
    
    const users = Array.from(uniqueUsers.values());
    
    console.log('✅ Found adverts:', transformedAdverts.length);
    
    return {
      success: true,
      data: transformedAdverts,
      count: transformedAdverts.length,
      statistics: {
        totalAmount,
        totalDiscount,
        averageAmount: transformedAdverts.length > 0 ? totalAmount / transformedAdverts.length : 0,
        uniqueUsers: users.length
      },
      dateRange: {
        start: startDate,
        end: endDate
      },
      users: users
    };
    
  } catch (err) {
    console.error('❌ Error fetching date range adverts:', err.message);
    console.error('❌ Error details:', err.details);
    return ctx.internalServerError(`Failed to fetch adverts: ${err.message}`);
  }
},

async getTransactions(ctx) {
    try {
      const { query } = ctx;
      const { startDate, endDate } = query;
      
      console.log('📊 getTransactions called with query:', query);
      
      // Set date range (using createdAt)
      const startDateObj = startDate ? new Date(startDate) : new Date();
      const endDateObj = endDate ? new Date(endDate) : new Date();
      
      // Set time to start and end of day
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj.setHours(23, 59, 59, 999);
      
      console.log('📅 Date range for query:', {
        start: startDateObj.toISOString(),
        end: endDateObj.toISOString()
      });

      // Build filter object - BASED ON YOUR SUCCESSFUL ENDPOINT
      // Your successful endpoint doesn't filter by isActive, isPaid, isCanceled
      const filters = {
        createdAt: {
          $gte: startDateObj.toISOString(),
          $lte: endDateObj.toISOString()
        }
        // REMOVED the boolean filters since they're excluding your data
        // If you want specific filters, adjust based on what you actually want
      };

      // OPTIONAL: If you want to filter by specific statuses
      if (query.status) {
        filters.status = query.status;
      }

      console.log('🔍 Filters being applied:', JSON.stringify(filters, null, 2));

      // Get transactions - USING SAME SYNTAX AS YOUR WORKING METHOD
      const transactions = await strapi.entityService.findMany('api::advert.advert', {
        filters: filters,
        populate: {
          client: {
            fields: ['id', 'company_name', 'contact_person', 'email', 'phone']
          },
          product: {
            fields: ['id', 'name', 'description']
          },
          rate_card: {
            fields: ['id', 'name', 'price_fc', 'price_bw']
          },
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          },
          invoice: {
            populate: {
              payments: true
            }
          },
          workflow_history: {
            populate: {
              vgams_users: {
                fields: ['id', 'name', 'email', 'role']
              }
            }
          },
          comments: true,
          created_by_clerk: {
            fields: ['id', 'username', 'email']
          },
          reviewed_by_editor: {
            fields: ['id', 'username', 'email']
          },
          approved_by_manager: {
            fields: ['id', 'username', 'email']
          },
          attachments: true
        },
        sort: 'createdAt:desc', // Changed to desc to match your working endpoint
        limit: query.limit || 1000,
        start: query.start || 0
      });

      console.log(`✅ Found ${transactions.length} transactions`);

      // Transform data to match your working endpoint's structure
      const transformedTransactions = transactions.map(transaction => ({
        id: transaction.id,
        reference_number: transaction.reference_number,
        advert_title: transaction.advert_title,
        // Client info
        client: transaction.client ? {
          id: transaction.client.id,
          company_name: transaction.client.company_name,
          contact_person: transaction.client.contact_person,
          email: transaction.client.email,
          phone: transaction.client.phone
        } : null,
        // Product info - NOTE: Your working endpoint uses product_name, not name
        product: transaction.product ? {
          id: transaction.product.id,
          product_name: transaction.product.name, // Adjust based on your schema
          description: transaction.product.description
        } : null,
        // Rate card info
        rate_card: transaction.rate_card ? {
          id: transaction.rate_card.id,
          ad_type: transaction.rate_card.ad_type,
          price_fc: transaction.rate_card.price_fc,
          price_bw: transaction.rate_card.price_bw
        } : null,
        // Advert details
        ad_size: transaction.ad_size,
        ad_type: transaction.ad_type,
        frequency: transaction.frequency,
        start_date: transaction.start_date,
        end_date: transaction.end_date,
        // MONETARY FIELDS
        base_price: transaction.base_price,
        surcharge: transaction.surcharge,
        discount: transaction.discount,
        total_amount: transaction.total_amount,
        // Payment info
        payment_method: transaction.payment_method,
        special_instructions: transaction.special_instructions,
        // Status fields
        status: transaction.status,
        isActive: transaction.isActive,
        isPaid: transaction.isPaid,
        isScheduled: transaction.isScheduled,
        hasRun: transaction.hasRun,
        isClosed: transaction.isClosed,
        isApproved: transaction.isApproved,
        isCanceled: transaction.isCanceled,
        // User info
        createdByUser: transaction.vgams_user ? {
          id: transaction.vgams_user.id,
          name: transaction.vgams_user.name,
          email: transaction.vgams_user.email,
          role: transaction.vgams_user.role
        } : null,
        // Invoice info
        invoice: transaction.invoice,
        // Other relations
        workflow_history: transaction.workflow_history,
        comments: transaction.comments,
        attachments: transaction.attachments,
        // Timestamps
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt
      }));

      // Calculate statistics - matching your working endpoint
      const totalAmount = transformedTransactions.reduce((sum, t) => sum + (parseFloat(t.total_amount) || 0), 0);
      const totalDiscount = transformedTransactions.reduce((sum, t) => sum + (parseFloat(t.discount) || 0), 0);
      
      // Get unique users
      const uniqueUsers = new Map();
      transformedTransactions.forEach(transaction => {
        if (transaction.createdByUser) {
          if (!uniqueUsers.has(transaction.createdByUser.id)) {
            uniqueUsers.set(transaction.createdByUser.id, transaction.createdByUser);
          }
        }
      });
      
      const users = Array.from(uniqueUsers.values());

      // Return the data in same format as your working endpoint
      return {
        success: true,
        data: transformedTransactions,
        count: transformedTransactions.length,
        statistics: {
          totalAmount: totalAmount,
          totalDiscount: totalDiscount,
          averageAmount: transformedTransactions.length > 0 ? totalAmount / transformedTransactions.length : 0,
          uniqueUsers: users.length,
          // Additional monetary stats
          totalBasePrice: transformedTransactions.reduce((sum, t) => sum + (parseFloat(t.base_price) || 0), 0),
          totalSurcharge: transformedTransactions.reduce((sum, t) => sum + (parseFloat(t.surcharge) || 0), 0)
        },
        dateRange: {
          start: startDateObj,
          end: endDateObj
        },
        users: users
      };
      
    } catch (err) {
      console.error('❌ Error in getTransactions:', err.message);
      console.error('❌ Error details:', err);
      return ctx.internalServerError(`Failed to fetch transactions: ${err.message}`);
    }
  }
}));
