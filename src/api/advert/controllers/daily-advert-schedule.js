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
    
    // Get data from request
    let advertId, runDate, runTime, isPublished = false;
    let mediaFiles = null;
    
    // Check if this is a multipart request
    const isMultipart = ctx.is('multipart/form-data');
    strapi.log.info('Is multipart/form-data request:', isMultipart);
    
    if (isMultipart) {
      // For multipart requests, extract data from body
      const body = ctx.request.body;
      strapi.log.info('Multipart body keys:', Object.keys(body || {}));
      
      // Extract data from form body
      advertId = body?.advertId;
      runDate = body?.runDate;
      runTime = body?.runTime;
      isPublished = body?.isPublished === 'true' || body?.isPublished === true;
      
      // Get files from ctx.request.files (same as create method)
      const files = ctx.request.files;
      strapi.log.info('Request files keys:', Object.keys(files || {}));
      
      if (files) {
        // Try different possible field names
        if (files.mediaFiles) {
          mediaFiles = files.mediaFiles;
          strapi.log.info('Found files in "mediaFiles" field');
        } else if (files.files) {
          mediaFiles = files.files;
          strapi.log.info('Found files in "files" field');
        } else {
          // Check for any file field
          const fileKeys = Object.keys(files).filter(key => files[key]);
          if (fileKeys.length > 0) {
            mediaFiles = files[fileKeys[0]];
            strapi.log.info(`Found files in "${fileKeys[0]}" field`);
          }
        }
      }
    } else {
      // For JSON requests
      const body = ctx.request.body;
      strapi.log.info('Non-multipart request body:', JSON.stringify(body, null, 2));
      
      advertId = body.advertId;
      runDate = body.runDate;
      runTime = body.runTime;
      mediaFiles = body.mediaFiles;
      isPublished = body.isPublished || false;
    }
    
    // Log extracted data
    strapi.log.info('=== FINAL EXTRACTED DATA ===');
    strapi.log.info('advertId:', advertId);
    strapi.log.info('runDate:', runDate);
    strapi.log.info('runTime:', runTime);
    strapi.log.info('isPublished:', isPublished);
    strapi.log.info('Has mediaFiles:', !!mediaFiles);
    
    if (mediaFiles) {
      if (Array.isArray(mediaFiles)) {
        strapi.log.info(`Number of media files: ${mediaFiles.length}`);
        mediaFiles.forEach((file, index) => {
          strapi.log.info(`File ${index}:`, {
            name: file.name || 'unnamed',
            size: file.size || 'unknown',
            type: file.type || 'unknown'
          });
        });
      } else {
        strapi.log.info('Single file object:', {
          name: mediaFiles.name || 'unnamed',
          size: mediaFiles.size || 'unknown',
          type: mediaFiles.type || 'unknown'
        });
      }
    }
    
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
        // If runTime is already an array
        if (Array.isArray(runTime)) {
          runTimeData = JSON.stringify(runTime);
        } 
        // If runTime is a string, try to parse it as JSON or treat as single time
        else if (typeof runTime === 'string') {
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
        }
      } catch (error) {
        strapi.log.error('Error processing runTime:', error);
      }
    }

    // Handle media files upload if provided - FOLLOWING THE SAME PATTERN AS CREATE METHOD
    let uploadedMediaIds = [];
    
    strapi.log.info('=== STARTING FILE UPLOAD PROCESS ===');
    strapi.log.info('Has mediaFiles to process:', !!mediaFiles);
    
    if (mediaFiles) {
      try {
        // Convert to array if it's a single file (same as create method)
        const filesArray = Array.isArray(mediaFiles) ? mediaFiles : [mediaFiles];
        
        strapi.log.info(`Will process ${filesArray.length} file(s)`);
        
        // Upload files to Strapi Media Library (same pattern as create method)
        const uploadService = strapi.plugins['upload'].services.upload;
        
        // Upload all files at once (same as create method)
        const uploadedFiles = await uploadService.upload({
          data: {
            refId: null, // We'll set this after creating the schedule
            ref: 'api::advert-daily-schedule.advert-daily-schedule',
            field: 'media'
          },
          files: filesArray
        });
        
        if (uploadedFiles && uploadedFiles.length > 0) {
          uploadedMediaIds = uploadedFiles.map(file => file.id);
          strapi.log.info(`✅ Files uploaded successfully: ${uploadedFiles.length} files`);
          strapi.log.info('Uploaded file IDs:', uploadedMediaIds);
        }
      } catch (uploadError) {
        strapi.log.error('❌ File upload failed:', uploadError.message);
        strapi.log.error('Upload error stack:', uploadError.stack);
        // Don't fail the whole schedule creation if file upload fails
      }
    }

    // Check if schedule already exists for this date and advert
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
      strapi.log.error(`Advert already scheduled for ${formattedDate}`);
      return ctx.badRequest(`Advert ${advert.reference_number || advert.id} is already scheduled for ${formattedDate}`);
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
      strapi.log.info('Adding media to schedule:', uploadedMediaIds);
    }

    strapi.log.info('Schedule data to create:', JSON.stringify(scheduleData, null, 2));

    // Create the schedule
    const schedule = await strapi.entityService.create('api::advert-daily-schedule.advert-daily-schedule', scheduleData);
    strapi.log.info('Schedule created with ID:', schedule.id);
    
    // Update uploaded files with the schedule ID
    if (uploadedMediaIds.length > 0) {
      try {
        const uploadService = strapi.plugins['upload'].services.upload;
        // Update each file with the schedule ID
        for (const fileId of uploadedMediaIds) {
          await uploadService.updateFileInfo(fileId, {
            refId: schedule.id,
            ref: 'api::advert-daily-schedule.advert-daily-schedule',
            field: 'media'
          });
        }
        strapi.log.info('Updated file references with schedule ID:', schedule.id);
      } catch (updateError) {
        strapi.log.error('Error updating file references:', updateError);
      }
    }

    // Update advert's isScheduled status
    await strapi.entityService.update('api::advert.advert', advertIdNum, {
      data: {
        isScheduled: true,
      },
    });
    strapi.log.info('Updated advert isScheduled to true');

    // Create workflow log for scheduling
    try {
      await strapi.entityService.create('api::workflow-log.workflow-log', {
        data: {
          action: 'scheduled',
          description: `Advert scheduled to run on ${formattedDate}`,
          advert: advertIdNum,
          user: ctx.state.user?.id || null,
          metadata: {
            scheduleId: schedule.id,
            runDate: formattedDate,
            uploadedFiles: uploadedMediaIds.length
          },
        },
      });
      strapi.log.info('Workflow log created');
    } catch (logError) {
      strapi.log.error('Failed to create workflow log:', logError);
    }

    // Populate the response with related data
    const populatedSchedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
      populate: {
        adverts: {
          populate: ['client', 'product'],
        },
        media: true,
      },
    });

    strapi.log.info('=== SCHEDULE CREATION COMPLETE ===');
    strapi.log.info('Response schedule ID:', populatedSchedule.id);
    strapi.log.info('Response media count:', populatedSchedule.media?.length || 0);

    return ctx.send({
      success: true,
      message: `Advert ${advert.reference_number || advert.id} scheduled successfully for ${formattedDate}`,
      data: {
        schedule: populatedSchedule,
        advert: {
          id: advert.id,
          reference_number: advert.reference_number,
          advert_title: advert.advert_title,
          client: advert.client,
          isScheduled: true,
        },
        uploadedFiles: uploadedMediaIds.length,
      },
    });

  } catch (error) {
    strapi.log.error('❌ Schedule advert error:', error.message);
    strapi.log.error('Error stack:', error.stack);
    return ctx.internalServerError('Failed to schedule advert', { 
      error: error.message,
      details: error.stack 
    });
  } finally {
    strapi.log.info('=== END SCHEDULE ADVERT REQUEST ===\n');
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
