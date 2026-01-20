'use strict';

/**
 * Daily Advert Schedule
 * 
 */

module.exports = {
  // Custom schedule advert method
async scheduleAdvert(ctx) {
  try {
    strapi.log.info('=== START SCHEDULE ADVERT REQUEST ===');
    
    // For multipart/form-data requests in Strapi, we need to use a different approach
    // Strapi doesn't automatically parse multipart in custom controllers
    
    let advertId, runDate, runTime, isPublished = false;
    let mediaFiles = null;
    
    // Check content type
    const contentType = ctx.request.header['content-type'] || '';
    const isMultipart = contentType.includes('multipart/form-data');
    strapi.log.info('Content-Type:', contentType);
    strapi.log.info('Is multipart:', isMultipart);
    
    if (isMultipart) {
      try {
        // For multipart requests, we need to parse them manually
        // Strapi provides a utility for this
        const parsed = await strapi.utils.multipart.parseMultipartData(ctx);
        strapi.log.info('Parsed multipart data successfully');
        
        // Extract data from parsed object
        const { data, files } = parsed;
        strapi.log.info('Parsed data keys:', Object.keys(data || {}));
        strapi.log.info('Parsed files keys:', Object.keys(files || {}));
        
        // Get form fields
        advertId = data?.advertId;
        runDate = data?.runDate;
        runTime = data?.runTime;
        isPublished = data?.isPublished === 'true' || data?.isPublished === true;
        
        // Get files
        if (files && files.mediaFiles) {
          mediaFiles = files.mediaFiles;
          strapi.log.info('Found mediaFiles in parsed data');
        } else if (files && files.files) {
          mediaFiles = files.files;
          strapi.log.info('Found files in parsed data');
        }
        
      } catch (parseError) {
        strapi.log.error('Error parsing multipart data:', parseError);
        
        // Fallback: try to get data from raw body if parse fails
        try {
          const rawBody = ctx.request.body;
          strapi.log.info('Raw body type:', typeof rawBody);
          strapi.log.info('Raw body keys:', Object.keys(rawBody || {}));
          
          if (rawBody && typeof rawBody === 'object') {
            advertId = rawBody.advertId;
            runDate = rawBody.runDate;
            runTime = rawBody.runTime;
            isPublished = rawBody.isPublished || false;
            
            // Check for files in request
            if (ctx.request.files) {
              mediaFiles = ctx.request.files;
            }
          }
        } catch (fallbackError) {
          strapi.log.error('Fallback parse also failed:', fallbackError);
        }
      }
    } else {
      // For non-multipart requests (JSON)
      const body = ctx.request.body;
      strapi.log.info('Non-multipart request body:', JSON.stringify(body, null, 2));
      
      advertId = body.advertId;
      runDate = body.runDate;
      runTime = body.runTime;
      mediaFiles = body.mediaFiles;
      isPublished = body.isPublished || false;
    }
    
    // Log extracted data
    strapi.log.info('=== EXTRACTED DATA ===');
    strapi.log.info('advertId:', advertId);
    strapi.log.info('runDate:', runDate);
    strapi.log.info('runTime:', runTime);
    strapi.log.info('isPublished:', isPublished);
    strapi.log.info('mediaFiles type:', typeof mediaFiles);
    strapi.log.info('mediaFiles is array:', Array.isArray(mediaFiles));
    
    if (mediaFiles) {
      if (Array.isArray(mediaFiles)) {
        strapi.log.info(`Number of media files: ${mediaFiles.length}`);
        mediaFiles.forEach((file, index) => {
          if (file && typeof file === 'object') {
            strapi.log.info(`File ${index} info:`, {
              name: file.name || 'unnamed',
              size: file.size || 'unknown',
              type: file.type || 'unknown',
              path: file.path || 'no path'
            });
          }
        });
      } else if (mediaFiles && typeof mediaFiles === 'object') {
        strapi.log.info('Single file info:', {
          name: mediaFiles.name || 'unnamed',
          size: mediaFiles.size || 'unknown',
          type: mediaFiles.type || 'unknown',
          path: mediaFiles.path || 'no path'
        });
      }
    }
    
    // Rest of the controller continues...
    // Validate required fields
    if (!advertId || !runDate) {
      strapi.log.error('Missing required fields:', { advertId, runDate });
      return ctx.badRequest('advertId and runDate are required');
    }

    // Validate advertId is a number
    const advertIdNum = parseInt(advertId);
    if (isNaN(advertIdNum)) {
      strapi.log.error('Invalid advertId:', advertId);
      return ctx.badRequest('advertId must be a valid number');
    }

    // Check if advert exists
    strapi.log.info('Fetching advert with ID:', advertIdNum);
    const advert = await strapi.entityService.findOne('api::advert.advert', advertIdNum, {
      populate: ['advert_daily_schedules', 'client'],
    });

    if (!advert) {
      strapi.log.error('Advert not found:', advertIdNum);
      return ctx.notFound('Advert not found');
    }

    strapi.log.info('Advert found:', advert.reference_number || advert.id);

    // Check if advert is approved
    if (!advert.isApproved) {
      strapi.log.error('Advert not approved:', advert.reference_number || advert.id);
      return ctx.badRequest('Advert must be approved before scheduling');
    }

    // Parse runDate to ensure proper format
    const parsedRunDate = new Date(runDate);
    if (isNaN(parsedRunDate.getTime())) {
      strapi.log.error('Invalid runDate format:', runDate);
      return ctx.badRequest('Invalid runDate format. Use YYYY-MM-DD');
    }

    // Format date to YYYY-MM-DD for Strapi
    const formattedDate = parsedRunDate.toISOString().split('T')[0];
    strapi.log.info('Formatted run date:', formattedDate);

    // Validate and format runTime as JSON array
    let runTimeData = null;
    if (runTime) {
      try {
        // If runTime is a string, try to parse it as JSON
        if (typeof runTime === 'string') {
          try {
            const parsed = JSON.parse(runTime);
            if (Array.isArray(parsed)) {
              runTimeData = JSON.stringify(parsed);
            } else {
              runTimeData = JSON.stringify([runTime]);
            }
          } catch (e) {
            runTimeData = JSON.stringify([runTime]);
          }
        } else if (Array.isArray(runTime)) {
          runTimeData = JSON.stringify(runTime);
        }
        strapi.log.info('Processed runTimeData:', runTimeData);
      } catch (error) {
        strapi.log.error('Error processing runTime:', error);
      }
    }

    // Handle media files upload if provided
    let uploadedMediaIds = [];
    
    if (mediaFiles) {
      try {
        // Convert to array if it's a single file
        const filesArray = Array.isArray(mediaFiles) ? mediaFiles : [mediaFiles];
        strapi.log.info(`Processing ${filesArray.length} file(s)`);
        
        for (let i = 0; i < filesArray.length; i++) {
          const file = filesArray[i];
          
          if (!file || typeof file !== 'object') {
            strapi.log.warn(`File ${i} is not a valid object, skipping`);
            continue;
          }
          
          try {
            strapi.log.info(`[${i + 1}/${filesArray.length}] Uploading file: ${file.name || 'unnamed'}`);
            
            // Upload the file
            const uploadedFile = await strapi.plugins['upload'].services.upload.upload({
              data: {
                fileInfo: {
                  name: file.name || `schedule_media_${Date.now()}`,
                  alternativeText: `Media for advert ${advertId} schedule`,
                  caption: `Scheduled for ${formattedDate}`,
                }
              },
              files: file,
            });
            
            if (uploadedFile && uploadedFile.length > 0) {
              const fileId = uploadedFile[0].id;
              uploadedMediaIds.push(fileId);
              strapi.log.info(`✅ File uploaded with ID: ${fileId}`);
            }
          } catch (fileError) {
            strapi.log.error(`Error uploading file:`, fileError);
          }
        }
      } catch (uploadError) {
        strapi.log.error('Media upload process error:', uploadError);
      }
    }
    
    strapi.log.info(`Total uploaded files: ${uploadedMediaIds.length}`);

    // Check for existing schedules
    const existingSchedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
      filters: {
        run_date: formattedDate,
        adverts: {
          id: advertIdNum,
        },
      },
      populate: ['adverts'],
    });

    if (existingSchedules.length > 0) {
      return ctx.badRequest(`Advert is already scheduled for ${formattedDate}`);
    }

    // Prepare schedule data
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

    // Add media relation if we have uploaded files
    if (uploadedMediaIds.length > 0) {
      scheduleData.data.media = {
        connect: uploadedMediaIds
      };
    }

    // Create the schedule
    const schedule = await strapi.entityService.create('api::advert-daily-schedule.advert-daily-schedule', scheduleData);

    // Update advert's isScheduled status
    await strapi.entityService.update('api::advert.advert', advertIdNum, {
      data: {
        isScheduled: true,
      },
    });

    // Create workflow log (with error handling)
    try {
      await strapi.entityService.create('api::workflow-log.workflow-log', {
        data: {
          action: 'scheduled',
          description: `Advert scheduled for ${formattedDate}`,
          advert: advertIdNum,
          metadata: {
            scheduleId: schedule.id,
            runDate: formattedDate,
            uploadedFiles: uploadedMediaIds.length
          },
        },
      });
    } catch (logError) {
      strapi.log.error('Workflow log error (non-fatal):', logError);
    }

    // Populate the response
    const populatedSchedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
      populate: {
        adverts: {
          populate: ['client', 'product'],
        },
        media: true,
      },
    });

    return ctx.send({
      success: true,
      message: `Advert scheduled successfully for ${formattedDate}`,
      data: {
        schedule: populatedSchedule,
        uploadedFiles: uploadedMediaIds.length,
      },
    });

  } catch (error) {
    strapi.log.error('Schedule advert error:', error);
    return ctx.internalServerError('Failed to schedule advert');
  } finally {
    strapi.log.info('=== END SCHEDULE ADVERT REQUEST ===');
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
        run_time: schedule.run_time ? JSON.parse(schedule.run_time) : null,
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
        run_time: schedule.run_time ? JSON.parse(schedule.run_time) : null,
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
          run_time: schedule.run_time ? JSON.parse(schedule.run_time) : null,
        },
      });

    } catch (error) {
      strapi.log.error('Toggle publish status error:', error);
      return ctx.internalServerError('Failed to toggle publish status', error);
    }
  },

  // Update schedule (modify run_time, date, or media)
  async updateSchedule(ctx) {
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
          run_time: updatedSchedule.run_time ? JSON.parse(updatedSchedule.run_time) : null,
        },
      });

    } catch (error) {
      strapi.log.error('Update schedule error:', error);
      return ctx.internalServerError('Failed to update schedule', error);
    }
  },

};
