'use strict';

/**
 * Daily Advert Schedule
 * 
 */

// Safely parse run_time — Strapi v5 may return JSON fields already parsed
function parseRunTime(val) {
  if (!val) return null;
  if (Array.isArray(val) || typeof val === 'object') return val;
  try { return JSON.parse(val); } catch (e) { return [val]; }
}

module.exports = {
  // Custom schedule advert method
async scheduleAdvert(ctx) {
  try {
    strapi.log.info('=== START SCHEDULE ADVERT REQUEST ===');
    
    // Check content type
    const contentType = ctx.request.header['content-type'] || '';
    strapi.log.info('Content-Type:', contentType);
    
    let advertId, runDate, runTime, isPublished = false;
    let mediaFiles = null;
    let existingAttachmentIds = [];
    
    // For multipart requests in Strapi v5
    if (contentType.includes('multipart/form-data')) {
      try {
        strapi.log.info('Handling multipart request...');
        
        // In Strapi v5, we need to handle multipart differently
        // The request should already be parsed by the middleware
        const body = ctx.request.body || {};
        const files = ctx.request.files || {};
        
        strapi.log.info('Request body keys:', Object.keys(body));
        strapi.log.info('Request files keys:', Object.keys(files));
        
        // Extract data from body
        advertId = body.advertId;
        runDate = body.runDate;
        runTime = body.runTime;
        isPublished = body.isPublished === 'true' || body.isPublished === true;
        try {
          existingAttachmentIds = body.existingAttachmentIds
            ? JSON.parse(body.existingAttachmentIds)
            : [];
        } catch (e) { existingAttachmentIds = []; }
        
        // Get files
        if (files.mediaFiles) {
          mediaFiles = files.mediaFiles;
          strapi.log.info('Found mediaFiles in request');
        } else if (files.files) {
          mediaFiles = files.files;
          strapi.log.info('Found files in request');
        } else if (Object.keys(files).length > 0) {
          // Get first file field
          const fileKeys = Object.keys(files);
          mediaFiles = files[fileKeys[0]];
          strapi.log.info(`Found files in ${fileKeys[0]} field`);
        }
        
      } catch (error) {
        strapi.log.error('Error handling multipart:', error);
        // Try direct access as fallback
        const rawBody = ctx.request.body;
        advertId = rawBody?.advertId;
        runDate = rawBody?.runDate;
        runTime = rawBody?.runTime;
        isPublished = rawBody?.isPublished === 'true' || rawBody?.isPublished === true;
        
        if (ctx.request.files) {
          mediaFiles = ctx.request.files;
        }
      }
    } else {
      // JSON request
      const body = ctx.request.body || {};
      strapi.log.info('JSON request body:', body);
      
      advertId = body.advertId;
      runDate = body.runDate;
      runTime = body.runTime;
      mediaFiles = body.mediaFiles;
      isPublished = body.isPublished || false;
      existingAttachmentIds = Array.isArray(body.existingAttachmentIds)
        ? body.existingAttachmentIds
        : [];
    }
    
    strapi.log.info('Extracted data - advertId:', advertId, 'runDate:', runDate);
    
    // Validate required fields
    if (!advertId || !runDate) {
      return ctx.badRequest('advertId and runDate are required');
    }

    const advertIdNum = parseInt(advertId);
    if (isNaN(advertIdNum)) {
      return ctx.badRequest('advertId must be a valid number');
    }

    // Check advert exists
    const advert = await strapi.entityService.findOne('api::advert.advert', advertIdNum, {
      populate: ['advert_daily_schedules', 'client'],
    });

    if (!advert) {
      return ctx.notFound('Advert not found');
    }

    if (!advert.isApproved) {
      return ctx.badRequest('Advert must be approved before scheduling');
    }

    // Format date
    const parsedRunDate = new Date(runDate);
    if (isNaN(parsedRunDate.getTime())) {
      return ctx.badRequest('Invalid runDate format');
    }
    const formattedDate = parsedRunDate.toISOString().split('T')[0];

    // Process runTime
    let runTimeData = null;
    if (runTime) {
      try {
        if (typeof runTime === 'string') {
          try {
            const parsed = JSON.parse(runTime);
            runTimeData = Array.isArray(parsed) ? JSON.stringify(parsed) : JSON.stringify([runTime]);
          } catch (e) {
            runTimeData = JSON.stringify([runTime]);
          }
        } else if (Array.isArray(runTime)) {
          runTimeData = JSON.stringify(runTime);
        }
      } catch (error) {
        strapi.log.error('Error processing runTime:', error);
      }
    }

    // Create schedule
    const scheduleData = {
      data: {
        run_date: formattedDate,
        run_time: runTimeData,
        is_published: isPublished,
        adverts: {
          connect: [advertIdNum],
        },
      },
    };

    strapi.log.info('Creating schedule...');
    const schedule = await strapi.entityService.create('api::advert-daily-schedule.advert-daily-schedule', scheduleData);
    strapi.log.info('Schedule created with ID:', schedule.id);

    // Handle file uploads
    let uploadedMediaIds = [];
    
    if (mediaFiles) {
      try {
        // Convert to array
        const filesArray = Array.isArray(mediaFiles) ? mediaFiles : [mediaFiles];
        strapi.log.info(`Uploading ${filesArray.length} file(s)...`);
        
        const uploadService = strapi.plugins['upload'].services.upload;
        
        // Upload files
        for (let i = 0; i < filesArray.length; i++) {
          const file = filesArray[i];
          
          try {
            strapi.log.info(`Uploading file ${i + 1}: ${file.name || 'unnamed'}`);
            
            // Upload file
            const uploadedFile = await uploadService.upload({
              data: {},
              files: file,
            });
            
            if (uploadedFile && uploadedFile.length > 0) {
              const fileId = uploadedFile[0].id;
              uploadedMediaIds.push(fileId);
              strapi.log.info(`File uploaded with ID: ${fileId}`);
            }
          } catch (fileError) {
            strapi.log.error(`File upload error:`, fileError);
          }
        }
        
        // Connect media to schedule
        if (uploadedMediaIds.length > 0) {
          strapi.log.info(`Connecting ${uploadedMediaIds.length} files to schedule...`);
          
          // Update schedule with media connection
          await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
            data: {
              media: uploadedMediaIds // Simple array format
            }
          });
          
          strapi.log.info('Schedule updated with media');
        }
        
      } catch (uploadError) {
        strapi.log.error('Upload process error:', uploadError);
      }
    }

    // Connect existing CMS attachment IDs to schedule media
    if (Array.isArray(existingAttachmentIds) && existingAttachmentIds.length > 0) {
      try {
        const existingIds = existingAttachmentIds.map(id => parseInt(id)).filter(id => !isNaN(id));
        if (existingIds.length > 0) {
          const allMediaIds = [...uploadedMediaIds, ...existingIds];
          await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
            data: { media: allMediaIds }
          });
          strapi.log.info(`Linked ${existingIds.length} existing attachment(s) to schedule`);
        }
      } catch (linkError) {
        strapi.log.error('Error linking existing attachments:', linkError);
      }
    }

    // Update advert
    await strapi.entityService.update('api::advert.advert', advertIdNum, {
      data: { isScheduled: true },
    });

    // Create workflow log (simplified to avoid errors)
    try {
      await strapi.entityService.create('api::workflow-log.workflow-log', {
        data: {
          action: 'scheduled',
          description: `Scheduled for ${formattedDate}`,
          advert: advertIdNum,
        },
      });
    } catch (logError) {
      // Silently ignore workflow log errors for now
    }

    // Get populated schedule
    const populatedSchedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
      populate: {
        adverts: {
          populate: ['client', 'product'],
        },
        media: true,
      },
    });

    strapi.log.info('=== COMPLETE ===');
    strapi.log.info('Schedule media count:', populatedSchedule.media?.length || 0);

    return ctx.send({
      success: true,
      message: `Advert scheduled successfully for ${formattedDate}`,
      data: {
        schedule: populatedSchedule,
        scheduleId: schedule.id,
        uploadedFiles: uploadedMediaIds.length,
      },
    });

  } catch (error) {
    strapi.log.error('Schedule error:', error);
    return ctx.internalServerError('Failed to schedule advert');
  }
},

  // Get schedules by advert ID
  async getAdvertSchedules(ctx) {
    try {
      const { advertId } = ctx.params;
      
      if (!advertId) {
        return ctx.badRequest('advertId is required');
      }

      const advertIdNum = parseInt(advertId);
      if (isNaN(advertIdNum)) {
        return ctx.badRequest('advertId must be a valid number');
      }

      const schedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
        filters: {
          adverts: {
            id: advertIdNum,
          },
        },
        populate: {
          media: true,
          adverts: {
            populate: ['client', 'product'],
          },
        },
        sort: { run_date: 'asc' },
      });

      // Parse run_time JSON for each schedule
      const formattedSchedules = schedules.map(schedule => ({
        ...schedule,
        run_time: schedule.run_time ? parseRunTime(schedule.run_time) : null,
      }));

      return ctx.send({
        success: true,
        data: formattedSchedules,
        count: formattedSchedules.length,
      });

    } catch (error) {
      strapi.log.error('Get advert schedules error:', error);
      return ctx.internalServerError('Failed to get advert schedules', error);
    }
  },

  // Get schedules by date range
  async getSchedulesByDateRange(ctx) {
    try {
      const { startDate, endDate, platform, clientId } = ctx.query;
      
      if (!startDate || !endDate) {
        return ctx.badRequest('startDate and endDate are required');
      }

      // Validate date formats
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return ctx.badRequest('Invalid date format. Use YYYY-MM-DD');
      }

      if (start > end) {
        return ctx.badRequest('startDate must be before or equal to endDate');
      }

      const filters = {
        run_date: {
          $gte: startDate,
          $lte: endDate,
        },
      };

      // Add platform filter if provided
      if (platform) {
        filters.adverts = {
          ...filters.adverts,
          platform: platform,
        };
      }

      // Add client filter if provided
      if (clientId) {
        const clientIdNum = parseInt(clientId);
        if (!isNaN(clientIdNum)) {
          filters.adverts = {
            ...filters.adverts,
            client: clientIdNum,
          };
        }
      }

      const schedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
        filters,
        populate: {
          media: true,
          adverts: {
            populate: ['client', 'product', 'rate_card'],
          },
        },
        sort: { run_date: 'asc', run_time: 'asc' },
      });

      // Parse run_time JSON and format response
      const formattedSchedules = schedules.map(schedule => ({
        id: schedule.id,
        run_date: schedule.run_date,
        run_time: schedule.run_time ? parseRunTime(schedule.run_time) : null,
        is_published: schedule.is_published,
        media: schedule.media,
        adverts: schedule.adverts.map(advert => ({
          id: advert.id,
          reference_number: advert.reference_number,
          advert_title: advert.advert_title,
          ad_size: advert.ad_size,
          ad_type: advert.ad_type,
          platform: advert.platform,
          client: advert.client,
          product: advert.product,
          rate_card: advert.rate_card,
          special_instructions: advert.special_instructions,
        })),
        created_at: schedule.createdAt,
        updated_at: schedule.updatedAt,
      }));

      return ctx.send({
        success: true,
        data: formattedSchedules,
        count: formattedSchedules.length,
        dateRange: {
          startDate,
          endDate,
        },
      });

    } catch (error) {
      strapi.log.error('Get schedules by date range error:', error);
      return ctx.internalServerError('Failed to get schedules by date range', error);
    }
  },

  // Unschedule an advert from a specific date
  async unscheduleAdvert(ctx) {
    try {
      const { scheduleId } = ctx.params;
      
      if (!scheduleId) {
        return ctx.badRequest('scheduleId is required');
      }

      const scheduleIdNum = parseInt(scheduleId);
      if (isNaN(scheduleIdNum)) {
        return ctx.badRequest('scheduleId must be a valid number');
      }

      // Get the schedule first to check which adverts are connected
      const schedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum, {
        populate: ['adverts'],
      });

      if (!schedule) {
        return ctx.notFound('Schedule not found');
      }

      // Store advert IDs for updating
      const advertIds = schedule.adverts.map(advert => advert.id);

      // Remove the schedule
      await strapi.entityService.delete('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum);

      // Check if any adverts still have schedules and update their isScheduled status
      for (const advertId of advertIds) {
        const advertSchedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
          filters: {
            adverts: {
              id: advertId,
            },
          },
        });

        // Update advert's isScheduled status
        await strapi.entityService.update('api::advert.advert', advertId, {
          data: {
            isScheduled: advertSchedules.length > 0,
          },
        });

        // Create workflow log for unscheduling
        try {
          await strapi.entityService.create('api::workflow-log.workflow-log', {
            data: {
              action: 'unscheduled',
              description: `Advert unscheduled from ${schedule.run_date}`,
              advert: advertId,
              user: ctx.state.user?.id || null,
              metadata: {
                scheduleId: scheduleIdNum,
                runDate: schedule.run_date,
              },
            },
          });
        } catch (logError) {
          strapi.log.error('Failed to create workflow log:', logError);
        }
      }

      return ctx.send({
        success: true,
        message: 'Schedule removed successfully',
        data: {
          scheduleId: scheduleIdNum,
          runDate: schedule.run_date,
          affectedAdverts: advertIds,
        },
      });

    } catch (error) {
      strapi.log.error('Unschedule advert error:', error);
      return ctx.internalServerError('Failed to unschedule advert', error);
    }
  },

  // Publish/unpublish a schedule
  async togglePublishStatus(ctx) {
    try {
      const { scheduleId } = ctx.params;
      const { isPublished } = ctx.request.body;
      
      if (!scheduleId || typeof isPublished !== 'boolean') {
        return ctx.badRequest('scheduleId and isPublished (boolean) are required');
      }

      const scheduleIdNum = parseInt(scheduleId);
      if (isNaN(scheduleIdNum)) {
        return ctx.badRequest('scheduleId must be a valid number');
      }

      // Guard: a page / slot number must be assigned before a schedule can be published.
      if (isPublished) {
        const existing = await strapi.entityService.findOne(
          'api::advert-daily-schedule.advert-daily-schedule',
          scheduleIdNum
        );
        if (!existing) return ctx.notFound('Schedule not found');
        if (!existing.page || existing.page < 1) {
          return ctx.badRequest('A page / slot number must be assigned before publishing this schedule.');
        }
      }

      const schedule = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum, {
        data: {
          is_published: isPublished,
        },
      });

      // Create workflow log for publish status change
      try {
        await strapi.entityService.create('api::workflow-log.workflow-log', {
          data: {
            action: isPublished ? 'published_schedule' : 'unpublished_schedule',
            description: `Schedule ${isPublished ? 'published' : 'unpublished'} for ${schedule.run_date}`,
            advert: schedule.adverts?.[0]?.id || null,
            user: ctx.state.user?.id || null,
            metadata: {
              scheduleId: scheduleIdNum,
              runDate: schedule.run_date,
              isPublished,
            },
          },
        });
      } catch (logError) {
        strapi.log.error('Failed to create workflow log:', logError);
      }

      return ctx.send({
        success: true,
        message: `Schedule ${isPublished ? 'published' : 'unpublished'} successfully`,
        data: {
          ...schedule,
          run_time: schedule.run_time ? parseRunTime(schedule.run_time) : null,
        },
      });

    } catch (error) {
      strapi.log.error('Toggle publish status error:', error);
      return ctx.internalServerError('Failed to toggle publish status', error);
    }
  },

  // Update schedule (modify run_time, date, or media)
  async updateScheduleRun(ctx) {
    try {
      const { scheduleId } = ctx.params;
      const { runDate, runTime, mediaFiles, isPublished, advertId } = ctx.request.body;
      
      if (!scheduleId) {
        return ctx.badRequest('scheduleId is required');
      }

      const scheduleIdNum = parseInt(scheduleId);
      if (isNaN(scheduleIdNum)) {
        return ctx.badRequest('scheduleId must be a valid number');
      }

      // Check if schedule exists
      const existingSchedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum, {
        populate: ['adverts'],
      });

      if (!existingSchedule) {
        return ctx.notFound('Schedule not found');
      }

      const updateData = {};

      // Update run_date if provided
      if (runDate) {
        const parsedRunDate = new Date(runDate);
        if (isNaN(parsedRunDate.getTime())) {
          return ctx.badRequest('Invalid runDate format. Use YYYY-MM-DD');
        }
        updateData.run_date = parsedRunDate.toISOString().split('T')[0];
      }

      // Update run_time if provided
      if (runTime !== undefined) {
        let runTimeData = null;
        
        if (runTime === null || runTime === '') {
          runTimeData = null;
        } else if (Array.isArray(runTime)) {
          const validTimes = runTime.filter(time => 
            typeof time === 'string' && time.trim().length > 0
          );
          runTimeData = validTimes.length > 0 ? JSON.stringify(validTimes) : null;
        } else if (typeof runTime === 'string') {
          try {
            const parsed = JSON.parse(runTime);
            if (Array.isArray(parsed)) {
              const validTimes = parsed.filter(time => 
                typeof time === 'string' && time.trim().length > 0
              );
              runTimeData = validTimes.length > 0 ? JSON.stringify(validTimes) : null;
            } else if (parsed.trim().length > 0) {
              runTimeData = JSON.stringify([parsed.trim()]);
            }
          } catch (e) {
            if (runTime.trim().length > 0) {
              runTimeData = JSON.stringify([runTime.trim()]);
            }
          }
        }
        
        updateData.run_time = runTimeData;
      }

      // Update is_published if provided
      if (isPublished !== undefined) {
        updateData.is_published = isPublished;
      }

      // Update advert relation if provided
      if (advertId) {
        const advertIdNum = parseInt(advertId);
        if (!isNaN(advertIdNum)) {
          updateData.adverts = {
            set: [advertIdNum], // Replace existing relations with new one
          };
        }
      }

      // Update schedule
      const updatedSchedule = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum, {
        data: updateData,
      });

      // Create workflow log for update
      try {
        await strapi.entityService.create('api::workflow-log.workflow-log', {
          data: {
            action: 'updated_schedule',
            description: `Schedule updated for ${updatedSchedule.run_date}`,
            advert: updatedSchedule.adverts?.[0]?.id || existingSchedule.adverts?.[0]?.id || null,
            user: ctx.state.user?.id || null,
            metadata: {
              scheduleId: scheduleIdNum,
              changes: Object.keys(updateData),
            },
          },
        });
      } catch (logError) {
        strapi.log.error('Failed to create workflow log:', logError);
      }

      return ctx.send({
        success: true,
        message: 'Schedule updated successfully',
        data: {
          ...updatedSchedule,
          run_time: updatedSchedule.run_time ? parseRunTime(updatedSchedule.run_time) : null,
        },
      });

    } catch (error) {
      strapi.log.error('Update schedule error:', error);
      return ctx.internalServerError('Failed to update schedule', error);
    }
  },
  // Get advert daily schedules with full details
async getFullSchedules(ctx) {
  try {
    const { startDate, endDate, page, isPublished, clientId } = ctx.query;
    
    // Build filters
    const filters = {};
    
    // Date range filter
    if (startDate && endDate) {
      filters.run_date = {
        $gte: startDate,
        $lte: endDate,
      };
    } else if (startDate) {
      filters.run_date = {
        $gte: startDate,
      };
    } else if (endDate) {
      filters.run_date = {
        $lte: endDate,
      };
    }
    
    // Published status filter
    if (isPublished !== undefined) {
      filters.is_published = isPublished === 'true';
    }
    
    // Client filter
    if (clientId) {
      const clientIdNum = parseInt(clientId);
      if (!isNaN(clientIdNum)) {
        filters.adverts = {
          ...filters.adverts,
          client: clientIdNum,
        };
      }
    }
    
    // Get schedules with all required relations.
    // NOTE: Do NOT use a `fields` restriction on adverts in Strapi v5 — it suppresses
    // nested populate results (the client relation returns empty).
    // Use populate: true on client to guarantee contact_person / email / phone come through.
    const schedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
      filters,
      populate: {
        media: true,
        adverts: {
          populate: {
            client:  true,
            product: true,
          },
        },
      },
      sort: { run_date: 'asc', page: 'asc' },
    });
    
    // Format the response
    const formattedSchedules = schedules.map(schedule => {
      const advert = schedule.adverts?.[0] || {};
      const client = advert.client           || {};

      // Contact details live on the client record.
      // Fall back to advert-level fields for older records that stored them directly.
      const contactPerson = client.contact_person || advert.contact_person || null;
      const email         = client.email          || advert.email          || null;
      const phone         = client.phone          || advert.phone          || null;
      
      return {
        schedule_id:  schedule.id,
        run_date:     schedule.run_date,
        run_time:     schedule.run_time ? parseRunTime(schedule.run_time) : null,
        is_published: schedule.is_published,
        page:  schedule.page || 0,
        media: schedule.media || [],
        
        // Advert data
        advert_id:            advert.id,
        advert_title:         advert.advert_title,
        start_date:           advert.start_date,
        end_date:             advert.end_date,
        frequency:            advert.frequency,
        ad_size:              advert.ad_size,
        ad_type:              advert.ad_type,
        special_instructions: advert.special_instructions,
        
        // Client / contact data
        client_id:      client.id,
        company_name:   client.company_name || advert.clientName || null,
        contact_person: contactPerson,
        email:          email,
        phone:          phone,
        
        created_at: schedule.createdAt,
        updated_at: schedule.updatedAt,
      };
    });
    
    return ctx.send({
      success: true,
      data: formattedSchedules,
      count: formattedSchedules.length,
      pagination: {
        page: parseInt(page) || 1,
        pageSize: formattedSchedules.length,
        total: formattedSchedules.length
      }
    });
    
  } catch (error) {
    strapi.log.error('Get full schedules error:', error);
    return ctx.internalServerError('Failed to get schedules');
  }
},

// Update page for a schedule
async updateSchedulePage(ctx) {
  try {
    const { scheduleId } = ctx.params;
    const { page } = ctx.request.body;
    
    if (!scheduleId) {
      return ctx.badRequest('scheduleId is required');
    }
    
    if (page === undefined || page === null) {
      return ctx.badRequest('page is required');
    }
    
    const scheduleIdNum = parseInt(scheduleId);
    if (isNaN(scheduleIdNum)) {
      return ctx.badRequest('scheduleId must be a valid number');
    }
    
    // Validate page is a number
    const pageNum = parseInt(page);
    if (isNaN(pageNum)) {
      return ctx.badRequest('page must be a valid number');
    }
    
    // Check if schedule exists
    const existingSchedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum);
    
    if (!existingSchedule) {
      return ctx.notFound('Schedule not found');
    }
    
    // Update the page
    const updatedSchedule = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum, {
      data: {
        page: pageNum,
      },
    });
    
    // Create workflow log
    try {
      const advert = await strapi.entityService.findOne('api::advert.advert', updatedSchedule.adverts?.[0]?.id || null);
      
      await strapi.entityService.create('api::workflow-log.workflow-log', {
        data: {
          action: 'updated_schedule_page',
          description: `Page updated to ${pageNum} for schedule on ${updatedSchedule.run_date}`,
          advert: advert?.id || null,
          user: ctx.state.user?.id || null,
          metadata: {
            scheduleId: scheduleIdNum,
            runDate: updatedSchedule.run_date,
            oldPage: existingSchedule.page || 0,
            newPage: pageNum,
          },
        },
      });
    } catch (logError) {
      strapi.log.error('Failed to create workflow log:', logError);
    }
    
    return ctx.send({
      success: true,
      message: 'Schedule page updated successfully',
      data: {
        schedule_id: updatedSchedule.id,
        run_date: updatedSchedule.run_date,
        old_page: existingSchedule.page || 0,
        new_page: pageNum,
      },
    });
    
  } catch (error) {
    strapi.log.error('Update schedule page error:', error);
    return ctx.internalServerError('Failed to update schedule page');
  }
},

// Bulk update pages for multiple schedules
async bulkUpdatePages(ctx) {
  try {
    const { updates } = ctx.request.body;
    
    if (!updates || !Array.isArray(updates)) {
      return ctx.badRequest('updates array is required');
    }
    
    const results = [];
    const errors = [];
    
    // Process each update
    for (const update of updates) {
      const { scheduleId, page } = update;
      
      if (!scheduleId || page === undefined) {
        errors.push({ scheduleId, error: 'Missing scheduleId or page' });
        continue;
      }
      
      const scheduleIdNum = parseInt(scheduleId);
      const pageNum = parseInt(page);
      
      if (isNaN(scheduleIdNum) || isNaN(pageNum)) {
        errors.push({ scheduleId, error: 'Invalid scheduleId or page value' });
        continue;
      }
      
      try {
        // Check if schedule exists
        const existingSchedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum);
        
        if (!existingSchedule) {
          errors.push({ scheduleId, error: 'Schedule not found' });
          continue;
        }
        
        // Update the page
        const updatedSchedule = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', scheduleIdNum, {
          data: {
            page: pageNum,
          },
        });
        
        results.push({
          scheduleId,
          success: true,
          old_page: existingSchedule.page || 0,
          new_page: pageNum,
          run_date: updatedSchedule.run_date,
        });
        
      } catch (error) {
        errors.push({
          scheduleId,
          error: error.message || 'Update failed',
        });
      }
    }
    
    return ctx.send({
      success: true,
      message: 'Bulk update completed',
      data: {
        total: updates.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
    
  } catch (error) {
    strapi.log.error('Bulk update pages error:', error);
    return ctx.internalServerError('Failed to bulk update pages');
  }
},

// Update run_date and/or run_time for a schedule
async updateSchedule(ctx) {
  try {
    const { scheduleId } = ctx.params;
    const { runDate, runTime } = ctx.request.body || {};

    if (!scheduleId) return ctx.badRequest('scheduleId is required');
    const id = parseInt(scheduleId);
    if (isNaN(id)) return ctx.badRequest('scheduleId must be a valid number');

    const existing = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', id);
    if (!existing) return ctx.notFound('Schedule not found');

    const updateData = {};

    if (runDate) {
      const parsed = new Date(runDate);
      if (isNaN(parsed.getTime())) return ctx.badRequest('Invalid runDate format');
      updateData.run_date = parsed.toISOString().split('T')[0];
    }

    if (runTime !== undefined) {
      if (Array.isArray(runTime)) {
        updateData.run_time = JSON.stringify(runTime);
      } else if (typeof runTime === 'string') {
        updateData.run_time = JSON.stringify([runTime]);
      } else {
        updateData.run_time = null;
      }
    }

    if (Object.keys(updateData).length === 0) return ctx.badRequest('Nothing to update');

    const updated = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', id, {
      data: updateData,
    });

    return ctx.send({
      success: true,
      message: 'Schedule updated',
      data: {
        schedule_id: updated.id,
        run_date: updated.run_date,
        run_time: parseRunTime(updated.run_time),
      },
    });
  } catch (error) {
    strapi.log.error('Update schedule error:', error);
    return ctx.internalServerError('Failed to update schedule');
  }
},


};
