'use strict';

/**
 * Design House Controller
 * 
 * Handles all design house operations for adverts ready for design work
 * 
 * Filtering Criteria:
 * - isPaid: true (payment received)
 * - isClosed: false (not completed)
 * - isActive: true (advert is active)
 * - isCanceled: false (not canceled)
 * - Date range: adverts active between startDate and endDate (inclusive)
 * 
 * Design Status:
 * - isApproved: false (pending design work)
 * - isApproved: true (design approved/completed)
 */

module.exports = {
  
  /**
   * Get adverts ready for design work
   * POST /api/design-house/active-adverts
   * 
   * Body Parameters:
   * - startDate (optional): Start date in YYYY-MM-DD format (defaults to today)
   * - endDate (optional): End date in YYYY-MM-DD format (defaults to today)
   * 
   * Returns adverts matching all criteria:
   * - isPaid = true
   * - isClosed = false
   * - isActive = true
   * - isCanceled = false
   * - Adverts active between startDate and endDate (inclusive)
   */
  async getActiveAdverts(ctx) {
    try {
      console.log('🎨 Design House: Fetching active adverts for design work');
      
      // Get date parameters from request body
      const { startDate, endDate } = ctx.request.body || {};
      
      // Get current date
      const now = new Date();
      const todayFormatted = now.toISOString().split('T')[0]; // "2026-01-10"
      
      // Use provided dates or default to today
      let queryStartDate = startDate || todayFormatted;
      let queryEndDate = endDate || todayFormatted;
      
      // Validate date formats (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      
      if (!dateRegex.test(queryStartDate)) {
        return ctx.badRequest({
          success: false,
          message: 'Invalid startDate format. Expected YYYY-MM-DD',
          example: '2026-01-10'
        });
      }
      
      if (!dateRegex.test(queryEndDate)) {
        return ctx.badRequest({
          success: false,
          message: 'Invalid endDate format. Expected YYYY-MM-DD',
          example: '2026-01-10'
        });
      }
      
      // Validate date logic
      const startDateObj = new Date(queryStartDate);
      const endDateObj = new Date(queryEndDate);
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return ctx.badRequest({
          success: false,
          message: 'Invalid date values provided'
        });
      }
      
      if (startDateObj > endDateObj) {
        return ctx.badRequest({
          success: false,
          message: 'startDate cannot be after endDate',
          provided: {
            startDate: queryStartDate,
            endDate: queryEndDate
          }
        });
      }
      
      console.log('📅 Date range parameters:', {
        requestedStartDate: startDate || '(default: today)',
        requestedEndDate: endDate || '(default: today)',
        queryStartDate,
        queryEndDate,
        usingDefaults: !startDate && !endDate,
        today: todayFormatted
      });
      
      // Build exact filters as specified
      // Logic: Find adverts where the advert's run period overlaps with the query period
      // - Advert starts on or before queryEndDate (start_date <= queryEndDate)
      // - Advert ends on or after queryStartDate (end_date >= queryStartDate)
      const filters = {
        isPaid: true,           // Must be paid
        isClosed: false,        // Must not be completed/closed
        isActive: true,         // Must be active
        isCanceled: false,      // Must not be canceled
        start_date: {
          $lte: queryEndDate    // Advert starts on or before query end date
        },
        end_date: {
          $gte: queryStartDate  // Advert ends on or after query start date
        }
      };
      
      console.log('🔍 Query filters:', JSON.stringify(filters, null, 2));
      
      // Query adverts with all relations populated
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
          'isPaid',
          'isActive',
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
            fields: ['id', 'product_name'],
            populate: {
              category: {
                fields: ['id', 'category_name', 'category_type', 'description']
              }
            }
          },
          rate_card: {
            fields: ['id', 'price_fc', 'price_bw']
          },
          attachments: {
            fields: ['id', 'name', 'url', 'size', 'mime', 'ext', 'createdAt', 'updatedAt']
          },
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          }
        },
        sort: 'start_date:asc',  // Sort by start date (earliest first)
        limit: -1  // Get all matching records
      });
      
      console.log(`✅ Found ${adverts.length} adverts ready for design work`);
      
      // Log each advert for debugging
      adverts.forEach((advert, index) => {
        console.log(`${index + 1}. ${advert.reference_number}:`, {
          title: advert.advert_title,
          client: advert.client?.company_name,
          startDate: advert.start_date,
          endDate: advert.end_date,
          isPaid: advert.isPaid,
          isClosed: advert.isClosed,
          isActive: advert.isActive,
          isCanceled: advert.isCanceled,
          isApproved: advert.isApproved,
          attachments: (advert.attachments || []).length
        });
      });
      
      // Calculate detailed statistics
      const stats = {
        total: adverts.length,
        by_category: {},
        by_product: {},
        by_status: {},
        total_value: 0,
        with_designs: 0,
        without_designs: 0,
        urgent: 0,  // Adverts ending within 3 days from query end date
        new_in_range: 0  // Adverts starting within query range
      };
      
      const threeDaysFromQueryEnd = new Date(endDateObj);
      threeDaysFromQueryEnd.setDate(threeDaysFromQueryEnd.getDate() + 3);
      
      adverts.forEach(advert => {
        // Total value
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
        
        // Urgent (ending within 3 days of query end date)
        const endDate = new Date(advert.end_date);
        if (endDate <= threeDaysFromQueryEnd) {
          stats.urgent++;
        }
        
        // New in range (starting within query range)
        const startDate = new Date(advert.start_date);
        if (startDate >= startDateObj && startDate <= endDateObj) {
          stats.new_in_range++;
        }
      });
      
      // Return successful response
      return ctx.send({
        success: true,
        message: `Found ${adverts.length} adverts ready for design work`,
        count: adverts.length,
        data: adverts,
        statistics: stats,
        query_parameters: {
          startDate: queryStartDate,
          endDate: queryEndDate,
          date_range_days: Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1
        },
        filters_applied: {
          isPaid: true,
          isClosed: false,
          isActive: true,
          isCanceled: false,
          date_range: {
            query_start: queryStartDate,
            query_end: queryEndDate,
            logic: 'Adverts where start_date <= queryEndDate AND end_date >= queryStartDate'
          }
        },
        timestamp: now.toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error fetching active adverts:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to fetch active adverts',
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
            fields: ['id', 'ad_type', 'ad_size', 'price_fc', 'price_bw', 'description']
          },
          attachments: {
            fields: ['id', 'name', 'url', 'size', 'mime', 'ext', 'createdAt', 'updatedAt']
          },
          vgams_user: {
            fields: ['id', 'name', 'email', 'role']
          }
        }
      });
      
      if (!advert) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      console.log(`✅ Found advert: ${advert.reference_number}`);
      
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
   * Upload design files for an advert
   * POST /api/design-house/adverts/:id/upload
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
      
      console.log(`📤 Uploading design files for advert #${id}`);
      
      // Verify advert exists and is eligible for design work
      const advert = await strapi.entityService.findOne('api::advert.advert', id, {
        fields: ['id', 'reference_number', 'isPaid', 'isClosed', 'isActive', 'isCanceled']
      });
      
      if (!advert) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      if (!advert.isPaid) {
        return ctx.badRequest({
          success: false,
          message: 'Advert must be paid before uploading design files'
        });
      }
      
      if (advert.isClosed) {
        return ctx.badRequest({
          success: false,
          message: 'Advert is closed and cannot accept new design files'
        });
      }
      
      if (!advert.isActive) {
        return ctx.badRequest({
          success: false,
          message: 'Advert is not active'
        });
      }
      
      if (advert.isCanceled) {
        return ctx.badRequest({
          success: false,
          message: 'Advert is canceled and cannot accept design files'
        });
      }
      
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
   * POST /api/design-house/stats
   * 
   * Body Parameters:
   * - startDate (optional): Start date in YYYY-MM-DD format (defaults to today)
   * - endDate (optional): End date in YYYY-MM-DD format (defaults to today)
   */
  async getDesignStats(ctx) {
    try {
      console.log('📊 Fetching design house statistics');
      
      // Get date parameters from request body
      const { startDate, endDate } = ctx.request.body || {};
      
      const now = new Date();
      const todayFormatted = now.toISOString().split('T')[0];
      
      // Use provided dates or default to today
      const queryStartDate = startDate || todayFormatted;
      const queryEndDate = endDate || todayFormatted;
      
      console.log('📅 Stats date range:', {
        startDate: queryStartDate,
        endDate: queryEndDate
      });
      
      // Active projects (matching all criteria)
      const activeAdverts = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid: true,
          isClosed: false,
          isActive: true,
          isCanceled: false,
          start_date: { $lte: queryEndDate },
          end_date: { $gte: queryStartDate }
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
          start_date: { $lte: queryEndDate },
          end_date: { $gte: queryStartDate }
        },
        fields: ['id']
      });
      
      // Completed designs (isApproved = true)
      const completedDesigns = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid: true,
          isApproved: true,
          start_date: { $lte: queryEndDate },
          end_date: { $gte: queryStartDate }
        },
        fields: ['id']
      });
      
      // Count total files
      const advertsWithFiles = await strapi.entityService.findMany('api::advert.advert', {
        filters: {
          isPaid: true,
          isClosed: false,
          isActive: true,
          isCanceled: false,
          start_date: { $lte: queryEndDate },
          end_date: { $gte: queryStartDate }
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
        dateRange: {
          startDate: queryStartDate,
          endDate: queryEndDate
        },
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
  }
};
