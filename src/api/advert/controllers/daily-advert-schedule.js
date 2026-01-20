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
    
    // Log headers
    const contentType = ctx.request.header['content-type'] || '';
    strapi.log.info('Content-Type:', contentType);
    
    let advertId, runDate, runTime, isPublished = false;
    let mediaFiles = null;
    
    // Parse request based on content type
    if (contentType.includes('multipart/form-data')) {
      try {
        strapi.log.info('Parsing multipart data...');
        const { data, files } = await strapi.utils.multipart.parseMultipartData(ctx);
        
        advertId = data?.advertId;
        runDate = data?.runDate;
        runTime = data?.runTime;
        isPublished = data?.isPublished === 'true' || data?.isPublished === true;
        
        if (files?.mediaFiles) {
          mediaFiles = files.mediaFiles;
          strapi.log.info(`Found ${Array.isArray(mediaFiles) ? mediaFiles.length : 1} file(s)`);
        }
      } catch (parseError) {
        strapi.log.error('Multipart parse error:', parseError);
        return ctx.badRequest('Failed to parse request data');
      }
    } else {
      // JSON request
      const body = ctx.request.body || {};
      advertId = body.advertId;
      runDate = body.runDate;
      runTime = body.runTime;
      mediaFiles = body.mediaFiles;
      isPublished = body.isPublished || false;
    }
    
    strapi.log.info('Extracted - advertId:', advertId, 'runDate:', runDate);
    
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

    // Check for existing schedules
    const existingSchedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
      filters: {
        run_date: formattedDate,
        adverts: {
          id: advertIdNum,
        },
      },
    });

    if (existingSchedules.length > 0) {
      return ctx.badRequest(`Advert already scheduled for ${formattedDate}`);
    }

    // *** CRITICAL CHANGE: Create schedule FIRST, then upload files with reference ***
    
    // Create schedule WITHOUT media first
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

    strapi.log.info('Creating schedule first...');
    const schedule = await strapi.entityService.create('api::advert-daily-schedule.advert-daily-schedule', scheduleData);
    strapi.log.info('Schedule created with ID:', schedule.id);

    // Handle file uploads AFTER schedule creation
    let uploadedMediaIds = [];
    
    if (mediaFiles) {
      try {
        // Convert to array
        const filesArray = Array.isArray(mediaFiles) ? mediaFiles : [mediaFiles];
        strapi.log.info(`Uploading ${filesArray.length} file(s) with schedule reference...`);
        
        const uploadService = strapi.plugins['upload'].services.upload;
        
        // Upload each file with proper schedule reference
        for (let i = 0; i < filesArray.length; i++) {
          const file = filesArray[i];
          
          try {
            // Upload file WITH schedule reference
            const uploadedFile = await uploadService.upload({
              data: {
                // This is CRITICAL: Set ref information during upload
                ref: 'api::advert-daily-schedule.advert-daily-schedule',
                refId: schedule.id,
                field: 'media',
                fileInfo: {
                  name: file.name || `schedule_${schedule.id}_${i}`,
                  alternativeText: `Media for schedule ${schedule.id}`,
                  caption: `Uploaded for schedule on ${formattedDate}`,
                }
              },
              files: file,
            });
            
            if (uploadedFile && uploadedFile.length > 0) {
              const fileId = uploadedFile[0].id;
              uploadedMediaIds.push(fileId);
              strapi.log.info(`✅ File uploaded and connected to schedule: ${fileId}`);
            }
          } catch (fileError) {
            strapi.log.error(`File upload error:`, fileError);
          }
        }
        
        // Update schedule with media connection
        if (uploadedMediaIds.length > 0) {
          strapi.log.info(`Updating schedule with ${uploadedMediaIds.length} media files...`);
          
          await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
            data: {
              media: {
                connect: uploadedMediaIds.map(id => ({ id }))
              }
            }
          });
          
          strapi.log.info('Schedule updated with media connection');
        }
        
      } catch (uploadError) {
        strapi.log.error('Upload process error:', uploadError);
      }
    }

    // Update advert
    await strapi.entityService.update('api::advert.advert', advertIdNum, {
      data: { isScheduled: true },
    });

    // Create workflow log
    try {
      await strapi.entityService.create('api::workflow-log.workflow-log', {
        data: {
          action: 'scheduled',
          description: `Advert scheduled for ${formattedDate}`,
          advert: advertIdNum,
          metadata: {
            scheduleId: schedule.id,
            runDate: formattedDate,
            mediaCount: uploadedMediaIds.length
          },
        },
      });
    } catch (logError) {
      strapi.log.error('Workflow log error:', logError);
    }

    // Get fully populated schedule
    const populatedSchedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
      populate: {
        adverts: {
          populate: ['client', 'product'],
        },
        media: {
          populate: '*' // Populate all media fields
        },
      },
    });

    strapi.log.info('=== COMPLETE ===');
    strapi.log.info('Final media count:', populatedSchedule.media?.length || 0);
    strapi.log.info('Media IDs:', populatedSchedule.media?.map(m => m.id) || []);

    return ctx.send({
      success: true,
      message: `Advert scheduled successfully for ${formattedDate}`,
      data: {
        schedule: populatedSchedule,
        scheduleId: schedule.id,
        uploadedFiles: uploadedMediaIds.length,
        mediaIds: uploadedMediaIds,
      },
    });

  } catch (error) {
    strapi.log.error('Schedule error:', error);
    strapi.log.error('Error stack:', error.stack);
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
