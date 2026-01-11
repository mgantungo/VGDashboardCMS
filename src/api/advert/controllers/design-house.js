'use strict';

/**
 * Design House Controller with Raw Database Queries
 * 
 * Handles all design house operations for adverts ready for design work
 * Using raw SQL queries to bypass Strapi ORM issues
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
      const { startDate, endDate } = ctx.query;
      
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
      
      // Use raw SQL query
      const knex = strapi.db.connection;
      
      // Build query with all criteria
      const query = knex('adverts as a')
        .select(
          'a.id',
          'a.reference_number',
          'a.advert_title',
          'a.frequency',
          'a.ad_size',
          'a.ad_type',
          'a.start_date',
          'a.end_date',
          'a.base_price',
          'a.surcharge',
          'a.discount',
          'a.total_amount',
          'a.payment_method',
          'a.special_instructions',
          'a.status',
          'a.is_active',
          'a.is_paid',
          'a.is_closed',
          'a.is_canceled',
          'a.is_approved',
          'a.has_run',
          'a.is_scheduled',
          'a.created_at',
          'a.updated_at',
          // Client fields
          'c.id as client_id',
          'c.company_name',
          'c.contact_person',
          'c.email as client_email',
          'c.phone as client_phone',
          'c.address as client_address',
          // Product fields
          'p.id as product_id',
          'p.product_name',
          'p.description as product_description',
          // Category fields
          'pc.id as category_id',
          'pc.category_name',
          'pc.category_type',
          'pc.description as category_description',
          // Rate card fields
          'rc.id as rate_card_id',
          'rc.price_fc',
          'rc.price_bw',
          'rc.ad_type as rate_card_ad_type',
          'rc.size_dimension',
          'rc.duration',
          'rc.time_slot',
          'rc.currency',
          'rc.effective_date',
          'rc.expiry_date',
          // VGAMS user fields
          'vu.id as vgams_user_id',
          'vu.name as vgams_user_name',
          'vu.email as vgams_user_email',
          'vu.role as vgams_user_role'
        )
        .leftJoin('clients as c', 'a.client', 'c.id')
        .leftJoin('products as p', 'a.product', 'p.id')
        .leftJoin('product_categories as pc', 'p.category', 'pc.id')
        .leftJoin('rate_cards as rc', 'a.rate_card', 'rc.id')
        .leftJoin('vgams_users as vu', 'a.vgams_user', 'vu.id')
        .where({
          'a.is_paid': 1,
          'a.is_active': 1,
          'a.is_closed': 0,
          'a.is_canceled': 0
        })
        .where('a.end_date', '>=', dateFormattedStart)
        .where('a.start_date', '<=', dateFormattedEnd)
        .orderBy('a.start_date', 'asc');
      
      const rawAdverts = await query;
      
      console.log(`✅ Found ${rawAdverts.length} adverts ready for design work`);
      
      // Get attachments for each advert
      const advertsWithAttachments = await Promise.all(
        rawAdverts.map(async (advert) => {
          // Get attachments for this advert
          const attachments = await knex('files_related_morphs as frm')
            .select(
              'f.id',
              'f.name',
              'f.hash',
              'f.ext',
              'f.mime',
              'f.size',
              'f.url',
              'f.created_at',
              'f.updated_at'
            )
            .leftJoin('files as f', 'frm.file_id', 'f.id')
            .where({
              'frm.related_id': advert.id,
              'frm.related_type': 'api::advert.advert',
              'frm.field': 'attachments'
            })
            .orderBy('f.created_at', 'asc');
          
          // Convert snake_case to camelCase for consistent response
          return {
            id: advert.id,
            reference_number: advert.reference_number,
            advert_title: advert.advert_title,
            frequency: advert.frequency,
            ad_size: advert.ad_size,
            ad_type: advert.ad_type,
            start_date: advert.start_date,
            end_date: advert.end_date,
            base_price: advert.base_price,
            surcharge: advert.surcharge,
            discount: advert.discount,
            total_amount: advert.total_amount,
            payment_method: advert.payment_method,
            special_instructions: advert.special_instructions,
            status: advert.status,
            isActive: advert.is_active === 1,
            isPaid: advert.is_paid === 1,
            isClosed: advert.is_closed === 1,
            isCanceled: advert.is_canceled === 1,
            isApproved: advert.is_approved === 1,
            hasRun: advert.has_run === 1,
            isScheduled: advert.is_scheduled === 1,
            createdAt: advert.created_at,
            updatedAt: advert.updated_at,
            client: advert.client_id ? {
              id: advert.client_id,
              company_name: advert.company_name,
              contact_person: advert.contact_person,
              email: advert.client_email,
              phone: advert.client_phone,
              address: advert.client_address
            } : null,
            product: advert.product_id ? {
              id: advert.product_id,
              product_name: advert.product_name,
              description: advert.product_description,
              category: advert.category_id ? {
                id: advert.category_id,
                category_name: advert.category_name,
                category_type: advert.category_type,
                description: advert.category_description
              } : null
            } : null,
            rate_card: advert.rate_card_id ? {
              id: advert.rate_card_id,
              price_fc: advert.price_fc,
              price_bw: advert.price_bw,
              ad_type: advert.rate_card_ad_type,
              size_dimension: advert.size_dimension,
              duration: advert.duration,
              time_slot: advert.time_slot,
              currency: advert.currency,
              effective_date: advert.effective_date,
              expiry_date: advert.expiry_date
            } : null,
            vgams_user: advert.vgams_user_id ? {
              id: advert.vgams_user_id,
              name: advert.vgams_user_name,
              email: advert.vgams_user_email,
              role: advert.vgams_user_role
            } : null,
            attachments: attachments.map(file => ({
              id: file.id,
              name: file.name,
              url: file.url,
              size: file.size,
              mime: file.mime,
              ext: file.ext,
              createdAt: file.created_at,
              updatedAt: file.updated_at
            }))
          };
        })
      );
      
      // Calculate statistics
      const stats = {
        total: advertsWithAttachments.length,
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
      
      advertsWithAttachments.forEach(advert => {
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
        message: `Found ${advertsWithAttachments.length} adverts ready for design work`,
        count: advertsWithAttachments.length,
        data: advertsWithAttachments,
        statistics: stats,
        filters_applied: {
          isPaid: true,
          isClosed: false,
          isActive: true,
          isCanceled: false,
          date_range: {
            startDate: dateFormattedStart,
            endDate: dateFormattedEnd
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
      
      const knex = strapi.db.connection;
      
      const rawAdverts = await knex('adverts as a')
        .select(
          'a.id',
          'a.reference_number',
          'a.advert_title',
          'a.start_date',
          'a.end_date',
          'a.total_amount',
          'a.is_active',
          'a.is_paid',
          'a.is_closed',
          'a.is_canceled',
          'a.is_approved',
          'c.company_name'
        )
        .leftJoin('clients as c', 'a.client', 'c.id')
        .where({
          'a.is_paid': 1,
          'a.is_active': 1,
          'a.is_closed': 0,
          'a.is_canceled': 0
        })
        .where('a.end_date', '>=', startDate)
        .where('a.start_date', '<=', endDate)
        .orderBy('a.start_date', 'asc');
      
      const adverts = rawAdverts.map(advert => ({
        id: advert.id,
        reference_number: advert.reference_number,
        advert_title: advert.advert_title,
        start_date: advert.start_date,
        end_date: advert.end_date,
        total_amount: advert.total_amount,
        isActive: advert.is_active === 1,
        isPaid: advert.is_paid === 1,
        isClosed: advert.is_closed === 1,
        isCanceled: advert.is_canceled === 1,
        isApproved: advert.is_approved === 1,
        client: advert.company_name ? { company_name: advert.company_name } : null
      }));
      
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
          completed_designs: adverts.filter(a => a.isApproved).length
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
      
      const knex = strapi.db.connection;
      
      // Get advert basic info
      const advertRaw = await knex('adverts as a')
        .select(
          'a.*',
          'c.company_name',
          'c.contact_person',
          'c.email as client_email',
          'c.phone as client_phone',
          'c.address as client_address',
          'p.product_name',
          'p.description as product_description',
          'pc.category_name',
          'pc.category_type',
          'pc.description as category_description',
          'vu.name as vgams_user_name',
          'vu.email as vgams_user_email',
          'vu.role as vgams_user_role'
        )
        .leftJoin('clients as c', 'a.client', 'c.id')
        .leftJoin('products as p', 'a.product', 'p.id')
        .leftJoin('product_categories as pc', 'p.category', 'pc.id')
        .leftJoin('vgams_users as vu', 'a.vgams_user', 'vu.id')
        .where('a.id', id)
        .first();
      
      if (!advertRaw) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      // Get attachments
      const attachments = await knex('files_related_morphs as frm')
        .select('f.*')
        .leftJoin('files as f', 'frm.file_id', 'f.id')
        .where({
          'frm.related_id': id,
          'frm.related_type': 'api::advert.advert',
          'frm.field': 'attachments'
        })
        .orderBy('f.created_at', 'asc');
      
      // Get comments
      const commentsRaw = await knex('comments as cm')
        .select(
          'cm.id',
          'cm.content',
          'cm.created_at',
          'cm.updated_at',
          'u.username',
          'u.email'
        )
        .leftJoin('admin_users as u', 'cm.created_by_id', 'u.id')
        .where('cm.advert', id)
        .orderBy('cm.created_at', 'desc');
      
      const comments = commentsRaw.map(comment => ({
        id: comment.id,
        content: comment.content,
        createdAt: comment.created_at,
        updatedAt: comment.updated_at,
        user: {
          username: comment.username,
          email: comment.email
        }
      }));
      
      // Format response
      const advert = {
        id: advertRaw.id,
        reference_number: advertRaw.reference_number,
        advert_title: advertRaw.advert_title,
        frequency: advertRaw.frequency,
        ad_size: advertRaw.ad_size,
        ad_type: advertRaw.ad_type,
        start_date: advertRaw.start_date,
        end_date: advertRaw.end_date,
        base_price: advertRaw.base_price,
        surcharge: advertRaw.surcharge,
        discount: advertRaw.discount,
        total_amount: advertRaw.total_amount,
        payment_method: advertRaw.payment_method,
        special_instructions: advertRaw.special_instructions,
        status: advertRaw.status,
        isActive: advertRaw.is_active === 1,
        isPaid: advertRaw.is_paid === 1,
        isClosed: advertRaw.is_closed === 1,
        isCanceled: advertRaw.is_canceled === 1,
        isApproved: advertRaw.is_approved === 1,
        hasRun: advertRaw.has_run === 1,
        isScheduled: advertRaw.is_scheduled === 1,
        createdAt: advertRaw.created_at,
        updatedAt: advertRaw.updated_at,
        client: advertRaw.company_name ? {
          id: advertRaw.client,
          company_name: advertRaw.company_name,
          contact_person: advertRaw.contact_person,
          email: advertRaw.client_email,
          phone: advertRaw.client_phone,
          address: advertRaw.client_address
        } : null,
        product: advertRaw.product ? {
          id: advertRaw.product,
          product_name: advertRaw.product_name,
          description: advertRaw.product_description,
          category: advertRaw.category_name ? {
            id: advertRaw.category,
            category_name: advertRaw.category_name,
            category_type: advertRaw.category_type,
            description: advertRaw.category_description
          } : null
        } : null,
        vgams_user: advertRaw.vgams_user ? {
          id: advertRaw.vgams_user,
          name: advertRaw.vgams_user_name,
          email: advertRaw.vgams_user_email,
          role: advertRaw.vgams_user_role
        } : null,
        attachments: attachments.map(file => ({
          id: file.id,
          name: file.name,
          url: file.url,
          size: file.size,
          mime: file.mime,
          ext: file.ext,
          createdAt: file.created_at,
          updatedAt: file.updated_at
        })),
        comments
      };
      
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
      
      const knex = strapi.db.connection;
      
      // Get advert basic info
      const advertRaw = await knex('adverts')
        .select('id', 'reference_number', 'advert_title')
        .where('id', id)
        .first();
      
      if (!advertRaw) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      // Get attachments
      const attachments = await knex('files_related_morphs as frm')
        .select(
          'f.id',
          'f.name',
          'f.hash',
          'f.ext',
          'f.mime',
          'f.size',
          'f.url',
          'f.created_at',
          'f.updated_at'
        )
        .leftJoin('files as f', 'frm.file_id', 'f.id')
        .where({
          'frm.related_id': id,
          'frm.related_type': 'api::advert.advert',
          'frm.field': 'attachments'
        })
        .orderBy('f.created_at', 'asc');
      
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
      
      const formattedAttachments = attachments.map(file => ({
        id: file.id,
        name: file.name,
        url: file.url,
        size: file.size,
        mime: file.mime,
        ext: file.ext,
        createdAt: file.created_at,
        updatedAt: file.updated_at
      }));
      
      return ctx.send({
        success: true,
        advert: {
          id: advertRaw.id,
          reference_number: advertRaw.reference_number,
          advert_title: advertRaw.advert_title
        },
        files: formattedAttachments,
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
   * 
   * Note: For file uploads, we'll use Strapi's upload service
   * since raw SQL for file uploads is complex
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
      
      const knex = strapi.db.connection;
      
      // Check if advert exists and meets criteria
      const advert = await knex('adverts')
        .select('id', 'reference_number', 'is_paid', 'is_closed', 'is_canceled', 'is_active')
        .where('id', id)
        .first();
      
      if (!advert) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      // Verify advert meets design upload criteria
      if (advert.is_paid !== 1) {
        return ctx.badRequest({
          success: false,
          message: 'Cannot upload designs for unpaid adverts'
        });
      }
      
      if (advert.is_closed === 1) {
        return ctx.badRequest({
          success: false,
          message: 'Cannot upload designs for closed/completed adverts'
        });
      }
      
      if (advert.is_canceled === 1) {
        return ctx.badRequest({
          success: false,
          message: 'Cannot upload designs for canceled adverts'
        });
      }
      
      if (advert.is_active !== 1) {
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
      
      // Use Strapi's upload service for file uploads
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
      
      const knex = strapi.db.connection;
      
      // Find the advert
      const advert = await knex('adverts')
        .select('id', 'reference_number', 'advert_title', 'is_paid', 'is_closed', 'is_approved')
        .where('id', id)
        .first();
      
      if (!advert) {
        return ctx.notFound({
          success: false,
          message: `Advert with ID ${id} not found`
        });
      }
      
      if (advert.is_closed === 1) {
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
          const designer = await knex('vgams_users')
            .select('id', 'name', 'email')
            .where('email', designerEmail)
            .first();
          
          if (designer) {
            designerUserId = designer.id;
            console.log('✅ Found designer:', { id: designerUserId, email: designer.email });
          }
        } catch (err) {
          console.error('❌ Error looking up designer:', err);
        }
      }
      
      // Update advert - mark design work as completed/approved
      await knex('adverts')
        .where('id', id)
        .update({
          is_approved: 1,
          updated_at: new Date()
        });
      
      // Optionally create a comment/log entry
      if (notes) {
        try {
          // First, get the current user ID if available
          let userId = designerUserId;
          if (!userId) {
            // Try to get a default user (like admin)
            const defaultUser = await knex('admin_users')
              .select('id')
              .where('username', 'admin')
              .first();
            userId = defaultUser ? defaultUser.id : null;
          }
          
          await knex('comments').insert({
            content: `Design work completed. ${notes}`,
            advert: id,
            created_by_id: userId,
            updated_by_id: userId,
            created_at: new Date(),
            updated_at: new Date()
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
        is_approved: true
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
      const todayStart = now.toISOString().split('T')[0];
      const todayEnd = now.toISOString().split('T')[0];
      
      const knex = strapi.db.connection;
      
      // Active projects (matching all criteria)
      const activeAdverts = await knex('adverts')
        .count('id as count')
        .where({
          is_paid: 1,
          is_closed: 0,
          is_active: 1,
          is_canceled: 0
        })
        .where('end_date', '>=', todayStart)
        .where('start_date', '<=', todayEnd)
        .first();
      
      // Ready to upload (not yet approved/started design work)
      const readyToUpload = await knex('adverts')
        .count('id as count')
        .where({
          is_paid: 1,
          is_closed: 0,
          is_active: 1,
          is_canceled: 0,
          is_approved: 0
        })
        .where('end_date', '>=', todayStart)
        .where('start_date', '<=', todayEnd)
        .first();
      
      // Completed designs (is_approved = true)
      const completedDesigns = await knex('adverts')
        .count('id as count')
        .where({
          is_paid: 1,
          is_approved: 1
        })
        .where('end_date', '>=', todayStart)
        .where('start_date', '<=', todayEnd)
        .first();
      
      // Count total files across all adverts
      const filesCount = await knex('files_related_morphs as frm')
        .count('frm.id as count')
        .leftJoin('adverts as a', function() {
          this.on('frm.related_id', '=', 'a.id')
            .andOn('frm.related_type', '=', knex.raw('?', ['api::advert.advert']))
            .andOn('frm.field', '=', knex.raw('?', ['attachments']))
        })
        .where({
          'a.is_paid': 1,
          'a.is_closed': 0,
          'a.is_active': 1,
          'a.is_canceled': 0
        })
        .first();
      
      const stats = {
        activeProjects: parseInt(activeAdverts?.count || 0),
        readyToUpload: parseInt(readyToUpload?.count || 0),
        completedDesigns: parseInt(completedDesigns?.count || 0),
        totalFiles: parseInt(filesCount?.count || 0),
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
   * Test endpoint - Get all adverts with raw SQL
   * GET /api/design-house/test-raw
   */
  async testRawQuery(ctx) {
    try {
      console.log('🔧 Testing raw SQL query');
      
      const knex = strapi.db.connection;
      
      // Simple test query
      const testResults = await knex('adverts')
        .select(
          'id',
          'reference_number',
          'advert_title',
          'start_date',
          'end_date',
          'is_paid',
          'is_active',
          'is_closed',
          'is_canceled'
        )
        .limit(10);
      
      console.log('📊 Test results:', testResults);
      
      return ctx.send({
        success: true,
        message: `Found ${testResults.length} adverts in test query`,
        data: testResults
      });
      
    } catch (error) {
      console.error('❌ Error in test query:', error);
      return ctx.internalServerError({
        success: false,
        message: 'Failed to test raw query',
        error: error.message
      });
    }
  }
};
