'use strict';

/**
 * Design House Controller - Strapi 5 Entity Service Version
 * Using proper camelCase field names from schema
 */

module.exports = {
  
  /**
   * Get adverts ready for design work
   * GET /api/design-house/active-adverts
   */
  async getActiveAdverts(ctx) {
    try {
      console.log('🎨 Design House: Fetching active adverts for design work');
      
      // Get query parameters for date range
      const { startDate, endDate, debug } = ctx.query;
      
      // Parse dates or use today as default
      const now = new Date();
      let dateRangeStart, dateRangeEnd;
      
      if (startDate) {
        dateRangeStart = new Date(startDate);
        dateRangeStart.setHours(0, 0, 0, 0);
      } else {
        dateRangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      }
      
      if (endDate) {
        dateRangeEnd = new Date(endDate);
        dateRangeEnd.setHours(23, 59, 59, 999);
      } else {
        dateRangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      }
      
      const dateFormattedStart = dateRangeStart.toISOString().split('T')[0];
      const dateFormattedEnd = dateRangeEnd.toISOString().split('T')[0];
      
      console.log('📅 Query date range:', dateFormattedStart, 'to', dateFormattedEnd);
      
      // First, let's debug what adverts exist
      if (debug) {
        console.log('🔍 DEBUG MODE: Checking all adverts...');
        const allAdverts = await strapi.entityService.findMany('api::advert.advert', {
          fields: ['id', 'reference_number', 'advert_title', 'start_date', 'end_date'],
          populate: {
            client: { fields: ['company_name'] }
          },
          limit: 10
        });
        
        console.log('📊 First 10 adverts:', allAdverts);
        
        // Check specific fields
        const testAdvert = await strapi.entityService.findOne('api::advert.advert', allAdverts[0]?.id || 1, {
          fields: ['isActive', 'isPaid', 'isClosed', 'isCanceled', 'isApproved']
        });
        console.log('🔍 Field check for first advert:', testAdvert);
      }
      
      // Build filters using camelCase field names from schema
      const filters = {
        isPaid: true,
        isClosed: false,
        isActive: true,
        isCanceled: false,
        $and: [
          {
            start_date: { 
              $lte: dateFormattedEnd
            }
          },
          {
            end_date: { 
              $gte: dateFormattedStart 
            }
          }
        ]
      };
      
      console.log('🔍 Entity Service filters:', JSON.stringify(filters, null, 2));
      
      // Query using Strapi Entity Service
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        fields: [
          'id',
          'reference_number',
          'advert_title',
          'frequency',
          'ad_size',
          'ad_type',
          'start_date',
          'end_date',
          'base_price',
          'surcharge',
          'discount',
          'total_amount',
          'payment_method',
          'special_instructions',
          'status',
          'isActive',
          'isPaid',
          'isClosed',
          'isCanceled',
          'isApproved',
          'hasRun',
          'isScheduled',
          'createdAt',
          'updatedAt'
        ],
        populate: {
          client: {
            fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'address']
          },
          product: {
            fields: ['id', 'product_name', 'description'],
            populate: {
              category: {
                fields: ['id', 'category_name', 'category_type', 'description']
              }
            }
          },
          rate_card: {
            fields: ['id', 'price_fc', 'price_bw', 'ad_type', 'size_dimension', 'duration', 'time_slot', 'currency']
          },
          attachments: true,
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          },
          comments: {
            populate: {
              user: {
                fields: ['username', 'email']
              }
            }
          }
        },
        sort: { start_date: 'asc' },
        limit: -1
      });
      
      console.log(`✅ Found ${adverts.length} adverts ready for design work`);
      
      // Log each advert for debugging
      if (adverts.length > 0) {
        adverts.forEach((advert, index) => {
          console.log(`${index + 1}. ${advert.reference_number}:`, {
            title: advert.advert_title,
            client: advert.client?.company_name,
            dates: `${advert.start_date} to ${advert.end_date}`,
            isPaid: advert.isPaid,
            isActive: advert.isActive,
            isClosed: advert.isClosed,
            isCanceled: advert.isCanceled,
            isApproved: advert.isApproved,
            attachments: (advert.attachments || []).length
          });
        });
      } else {
        console.log('⚠️ No adverts found. Checking if any adverts exist...');
        const allCount = await strapi.entityService.findMany('api::advert.advert', {
          fields: ['id'],
          limit: 1
        });
        console.log(`📊 Total adverts in system: ${allCount.length}`);
      }
      
      // Calculate statistics
      const stats = {
        total: adverts.length,
        by_category: {},
        by_product: {},
        by_status: {},
        total_value: 0,
        with_designs: 0,
        without_designs: 0,
        urgent: 0,
        new_today: 0,
        within_date_range: 0
      };
      
      const threeDaysFromNow = new Date(now);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      
      const todayDateOnly = now.toISOString().split('T')[0];
      
      adverts.forEach(advert => {
        stats.total_value += parseFloat(advert.total_amount) || 0;
        
        // By category
        const categoryName = advert.product?.category?.category_name || 'Uncategorized';
        stats.by_category[categoryName] = (stats.by_category[categoryName] || 0) + 1;
        
        // By product
        const productName = advert.product?.product_name || 'Unknown';
        stats.by_product[productName] = (stats.by_product[productName] || 0) + 1;
        
        // By design status
        const designStatus = advert.isApproved ? 'completed' : 'pending';
        stats.by_status[designStatus] = (stats.by_status[designStatus] || 0) + 1;
        
        // With/without design uploads
        const hasAttachments = (advert.attachments || []).length > 0;
        if (hasAttachments) {
          stats.with_designs++;
        } else {
          stats.without_designs++;
        }
        
        // Urgent (ending within 3 days)
        const endDate = new Date(advert.end_date);
        if (endDate <= threeDaysFromNow) {
          stats.urgent++;
        }
        
        // New today (starting today) - only if no custom date range was provided
        if (!startDate && !endDate) {
          const startDateOnly = advert.start_date ? advert.start_date.split('T')[0] : '';
          if (startDateOnly === todayDateOnly) {
            stats.new_today++;
          }
        }
        
        stats.within_date_range++;
      });
      
      return ctx.send({
        success: true,
        message: `Found ${adverts.length} adverts ready for design work`,
        count: adverts.length,
        data: adverts,
        statistics: stats,
        filters_applied: {
          isPaid: true,
          isClosed: false,
          isActive: true,
          isCanceled: false,
          date_range: {
            startDate: dateFormattedStart,
            endDate: dateFormattedEnd,
            startDateTime: dateRangeStart.toISOString(),
            endDateTime: dateRangeEnd.toISOString()
          },
          custom_date_range: !!(startDate || endDate)
        },
        timestamp: now.toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error fetching active adverts:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to fetch active adverts',
        error: error.message,
        query: ctx.query
      });
    }
  },
  
  /**
   * Get adverts for a specific date range
   * GET /api/design-house/date-range-adverts
   */
  async getDateRangeAdverts(ctx) {
    try {
      console.log('📅 Design House: Fetching adverts by date range');
      
      const { startDate, endDate } = ctx.query;
      
      if (!startDate || !endDate) {
        return ctx.badRequest({
          success: false,
          message: 'Both startDate and endDate query parameters are required',
          example: '/api/design-house/date-range-adverts?startDate=2026-01-01&endDate=2026-01-31'
        });
      }
      
      const filters = {
        isPaid: true,
        isClosed: false,
        isActive: true,
        isCanceled: false,
        $and: [
          { start_date: { $lte: endDate } },
          { end_date: { $gte: startDate } }
        ]
      };
      
      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        fields: [
          'id',
          'reference_number',
          'advert_title',
          'start_date',
          'end_date',
          'total_amount',
          'isActive',
          'isPaid',
          'isClosed',
          'isCanceled',
          'isApproved'
        ],
        populate: {
          client: {
            fields: ['company_name']
          }
        },
        sort: { start_date: 'asc' },
        limit: -1
      });
      
      let totalValue = 0;
      adverts.forEach(advert => {
        totalValue += parseFloat(advert.total_amount) || 0;
      });
      
      return ctx.send({
        success: true,
        message: `Found ${adverts.length} adverts for date range ${startDate} to ${endDate}`,
        count: adverts.length,
        data: adverts,
        date_range: { startDate, endDate },
        statistics: {
          total_adverts: adverts.length,
          total_value: totalValue,
          pending_designs: adverts.filter(a => !a.isApproved).length,
          completed_designs: adverts.filter(a => a.isApproved).length,
          with_attachments: adverts.filter(a => (a.attachments || []).length > 0).length,
          without_attachments: adverts.filter(a => (a.attachments || []).length === 0).length
        }
      });
      
    } catch (error) {
      console.error('❌ Error fetching date range adverts:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to fetch adverts by date range',
        error: error.message
      });
    }
  },
  
  /**
   * Get specific advert details for design work
   * GET /api/design-house/adverts/:id
   */
  async getAdvertDetails(ctx) {
    try {
      const { id } = ctx.params;
      
      if (!id) {
        return ctx.badRequest({
          success: false,
          message: 'Advert ID is required'
        });
      }
      
      console.log(`🎨 Fetching advert details for ID: ${id}`);
      
      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields: [
          'id',
          'reference_number',
          'advert_title',
          'frequency',
          'ad_size',
          'ad_type',
          'start_date',
          'end_date',
          'base_price',
          'surcharge',
          'discount',
          'total_amount',
          'payment_method',
          'special_instructions',
          'status',
          'isActive',
          'isPaid',
          'isClosed',
          'isCanceled',
          'isApproved',
          'hasRun',
          'isScheduled',
          'createdAt',
          'updatedAt'
        ],
        populate: {
          client: {
            fields: ['id', 'company_name', 'contact_person', 'email', 'phone', 'address']
          },
          product: {
            fields: ['id', 'product_name', 'description'],
            populate: {
              category: {
                fields: ['id', 'category_name', 'category_type', 'description']
              }
            }
          },
          rate_card: {
            fields: ['id', 'ad_type', 'size_dimension', 'price_fc', 'price_bw', 'duration', 'time_slot', 'currency']
          },
          attachments: true,
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          },
          comments: {
            populate: {
              user: {
                fields: ['username', 'email']
              }
            },
            sort: { createdAt: 'desc' }
          }
        }
      });
      
      if (!advert) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      console.log(`✅ Advert details retrieved: ${advert.reference_number}`);
      
      return ctx.send({
        success: true,
        data: advert
      });
      
    } catch (error) {
      console.error('❌ Error fetching advert details:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to fetch advert details',
        error: error.message
      });
    }
  },
  
  /**
   * Get all design files (attachments) for an advert
   * GET /api/design-house/adverts/:id/files
   */
  async getDesignFiles(ctx) {
    try {
      const { id } = ctx.params;
      
      if (!id) {
        return ctx.badRequest({
          success: false,
          message: 'Advert ID is required'
        });
      }
      
      console.log(`📁 Fetching design files for advert ID: ${id}`);
      
      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields: ['id', 'reference_number', 'advert_title'],
        populate: {
          attachments: true
        }
      });
      
      if (!advert) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      const attachments = advert.attachments || [];
      
      console.log(`✅ Found ${attachments.length} files for ${advert.reference_number}`);
      
      // Organize files by type
      const filesByType = {
        images: [],
        documents: [],
        videos: [],
        designs: [],
        other: []
      };
      
      let totalSize = 0;
      
      attachments.forEach(file => {
        totalSize += file.size || 0;
        
        const ext = (file.ext || '').toLowerCase();
        const mime = (file.mime || '').toLowerCase();
        
        if (mime.startsWith('image/')) {
          filesByType.images.push(file);
        } else if (ext === '.psd' || ext === '.ai' || ext === '.sketch' || ext === '.fig' || ext === '.xd') {
          filesByType.designs.push(file);
        } else if (mime.startsWith('video/')) {
          filesByType.videos.push(file);
        } else if (mime.startsWith('application/')) {
          filesByType.documents.push(file);
        } else {
          filesByType.other.push(file);
        }
      });
      
      return ctx.send({
        success: true,
        advert: {
          id: advert.id,
          reference_number: advert.reference_number,
          advert_title: advert.advert_title
        },
        files: attachments,
        filesByType: filesByType,
        statistics: {
          total: attachments.length,
          totalSize: totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
          images: filesByType.images.length,
          documents: filesByType.documents.length,
          videos: filesByType.videos.length,
          designs: filesByType.designs.length,
          other: filesByType.other.length
        }
      });
      
    } catch (error) {
      console.error('❌ Error fetching design files:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to fetch design files',
        error: error.message
      });
    }
  },
  
  /**
   * Upload design files to an advert
   * POST /api/design-house/adverts/:id/upload
   * Content-Type: multipart/form-data
   */
  async uploadDesignFiles(ctx) {
    try {
      const { id } = ctx.params;
      
      if (!id) {
        return ctx.badRequest({
          success: false,
          message: 'Advert ID is required'
        });
      }
      
      // Check if advert exists and meets criteria
      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields: ['id', 'reference_number', 'isPaid', 'isClosed', 'isCanceled', 'isActive']
      });
      
      if (!advert) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      // Verify advert meets design upload criteria
      if (!advert.isPaid) {
        return ctx.badRequest({
          success: false,
          message: 'Cannot upload designs for unpaid adverts'
        });
      }
      
      if (advert.isClosed) {
        return ctx.badRequest({
          success: false,
          message: 'Cannot upload designs for closed/completed adverts'
        });
      }
      
      if (advert.isCanceled) {
        return ctx.badRequest({
          success: false,
          message: 'Cannot upload designs for canceled adverts'
        });
      }
      
      if (!advert.isActive) {
        return ctx.badRequest({
          success: false,
          message: 'Cannot upload designs for inactive adverts'
        });
      }
      
      console.log(`📤 Uploading design files for advert #${id} - ${advert.reference_number}`);
      
      // Get files from request
      const files = ctx.request.files;
      
      if (!files || Object.keys(files).length === 0) {
        return ctx.badRequest({
          success: false,
          message: 'No files provided for upload'
        });
      }
      
      // Upload files using Strapi's upload service
      const uploadedFiles = [];
      const errors = [];
      
      for (const fileKey in files) {
        const file = files[fileKey];
        
        try {
          const uploadResult = await strapi.plugins.upload.services.upload.upload({
            data: {
              refId: id,
              ref: 'api::advert.advert',
              field: 'attachments'
            },
            files: file
          });
          
          uploadedFiles.push(...uploadResult);
          console.log(`✅ Uploaded: ${file.name}`);
          
        } catch (uploadError) {
          console.error(`❌ Error uploading file ${file.name}:`, uploadError);
          errors.push({
            filename: file.name,
            error: uploadError.message
          });
        }
      }
      
      console.log(`✅ Successfully uploaded ${uploadedFiles.length} file(s)`);
      
      return ctx.send({
        success: true,
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        advert_id: id,
        reference_number: advert.reference_number,
        files: uploadedFiles,
        errors: errors.length > 0 ? errors : undefined
      });
      
    } catch (error) {
      console.error('❌ Error uploading design files:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to upload design files',
        error: error.message
      });
    }
  },
  
  /**
   * Mark design work as complete
   * POST /api/design-house/adverts/:id/complete
   */
  async markDesignComplete(ctx) {
    try {
      const { id } = ctx.params;
      const { notes, designerEmail } = ctx.request.body;
      
      if (!id) {
        return ctx.badRequest({
          success: false,
          message: 'Advert ID is required'
        });
      }
      
      console.log(`✅ Marking design complete for advert #${id}`);
      
      // Find the advert
      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields: ['id', 'reference_number', 'advert_title', 'isPaid', 'isClosed', 'isApproved']
      });
      
      if (!advert) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      if (advert.isClosed) {
        return ctx.badRequest({
          success: false,
          message: 'Advert is already closed/completed'
        });
      }
      
      // Look up designer by email if provided
      let designerUserId = null;
      if (designerEmail) {
        console.log('🔍 Looking up designer by email:', designerEmail);
        try {
          const users = await strapi.entityService.findMany('api::vgams-user.vgams-user', {
            filters: { email: designerEmail },
            fields: ['id', 'name', 'email'],
            limit: 1
          });
          
          if (users && users.length > 0) {
            designerUserId = users[0].id;
            console.log('✅ Found designer:', { id: designerUserId, email: users[0].email });
          } else {
            console.warn('⚠️ Designer not found with email:', designerEmail);
          }
        } catch (err) {
          console.error('❌ Error looking up designer:', err);
        }
      }
      
      // Update advert - mark design work as completed/approved
      const updatedAdvert = await strapi.entityService.update('api::advert.advert', id, {
        data: {
          isApproved: true  // Design work has been approved/completed
        }
      });
      
      // Optionally create a comment/log entry
      if (notes) {
        try {
          await strapi.entityService.create('api::comment.comment', {
            data: {
              content: `Design work completed. ${notes}`,
              advert: id,
              user: designerUserId
            }
          });
          console.log('✅ Comment created for design completion');
        } catch (commentError) {
          console.error('❌ Error creating comment:', commentError);
        }
      }
      
      console.log(`✅ Design marked complete for ${advert.reference_number}`);
      
      return ctx.send({
        success: true,
        message: 'Design work marked as complete',
        advert_id: id,
        reference_number: advert.reference_number,
        advert_title: advert.advert_title,
        isApproved: true
      });
      
    } catch (error) {
      console.error('❌ Error marking design complete:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to mark design complete',
        error: error.message
      });
    }
  },
  
  /**
   * Get design statistics
   * GET /api/design-house/stats
   */
  async getDesignStats(ctx) {
    try {
      console.log('📊 Fetching design house statistics');
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      const todayFormattedStart = todayStart.toISOString().split('T')[0];
      const todayFormattedEnd = todayEnd.toISOString().split('T')[0];
      
      // Active projects (matching all criteria)
      const activeAdverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid: true,
          isClosed: false,
          isActive: true,
          isCanceled: false,
          $and: [
            { start_date: { $lte: todayFormattedEnd } },
            { end_date: { $gte: todayFormattedStart } }
          ]
        },
        fields: ['id']
      });
      
      // Ready to upload (not yet approved/started design work)
      const readyToUpload = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid: true,
          isClosed: false,
          isActive: true,
          isCanceled: false,
          isApproved: false,
          $and: [
            { start_date: { $lte: todayFormattedEnd } },
            { end_date: { $gte: todayFormattedStart } }
          ]
        },
        fields: ['id']
      });
      
      // Completed designs (isApproved = true)
      const completedDesigns = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid: true,
          isApproved: true,
          $and: [
            { start_date: { $lte: todayFormattedEnd } },
            { end_date: { $gte: todayFormattedStart } }
          ]
        },
        fields: ['id']
      });
      
      // Count total files - first get all adverts with attachments
      const advertsWithFiles = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid: true,
          isClosed: false,
          isActive: true,
          isCanceled: false
        },
        populate: {
          attachments: {
            fields: ['id']
          }
        },
        limit: -1
      });
      
      let totalFiles = 0;
      advertsWithFiles.forEach(advert => {
        totalFiles += (advert.attachments || []).length;
      });
      
      const stats = {
        activeProjects: activeAdverts.length,
        readyToUpload: readyToUpload.length,
        completedDesigns: completedDesigns.length,
        totalFiles: totalFiles,
        lastUpdated: new Date().toISOString()
      };
      
      console.log('✅ Design statistics:', stats);
      
      return ctx.send({
        success: true,
        statistics: stats
      });
      
    } catch (error) {
      console.error('❌ Error fetching design stats:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to fetch design statistics',
        error: error.message
      });
    }
  },
  
  /**
   * Debug endpoint to check field names and data
   * GET /api/design-house/debug-fields
   */
  async debugFields(ctx) {
    try {
      console.log('🔍 Debugging advert fields and data');
      
      // Get a few adverts to inspect
      const sampleAdverts = await strapi.entityService.findMany('api::advert.advert', {
        fields: [
          'id',
          'reference_number',
          'isActive',
          'isPaid',
          'isClosed',
          'isCanceled',
          'isApproved',
          'start_date',
          'end_date'
        ],
        limit: 5
      });
      
      // Get schema information
      const contentTypeService = strapi.plugin('content-type-builder').service('content-types');
      const advertSchema = await contentTypeService.findContentType('api::advert.advert');
      
      // Extract boolean fields from schema
      const booleanFields = [];
      if (advertSchema && advertSchema.attributes) {
        Object.entries(advertSchema.attributes).forEach(([fieldName, fieldConfig]) => {
          if (fieldConfig.type === 'boolean') {
            booleanFields.push({
              field: fieldName,
              type: fieldConfig.type,
              default: fieldConfig.default
            });
          }
        });
      }
      
      return ctx.send({
        success: true,
        message: 'Debug information',
        schema: {
          booleanFields: booleanFields,
          totalFields: Object.keys(advertSchema?.attributes || {}).length
        },
        sampleData: sampleAdverts,
        rawDataCheck: sampleAdverts.map(ad => ({
          id: ad.id,
          ref: ad.reference_number,
          isPaid: ad.isPaid,
          isPaidType: typeof ad.isPaid,
          isActive: ad.isActive,
          isActiveType: typeof ad.isActive
        }))
      });
      
    } catch (error) {
      console.error('❌ Error in debug endpoint:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Debug failed',
        error: error.message
      });
    }
  }
};
