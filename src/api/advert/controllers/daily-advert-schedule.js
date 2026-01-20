'use strict';

/**
 * Daily Advert Schedule
 * 
 */

module.exports = {
  // Custom schedule advert method
  async scheduleAdvert(ctx) {
    try {
      const { advertId, runDate, runTime, mediaFiles, isPublished = false } = ctx.request.body;
      
      // Validate required fields
      if (!advertId || !runDate) {
        return ctx.badRequest('advertId and runDate are required');
      }

      // Check if advert exists
      const advert = await strapi.entityService.findOne('api::advert.advert', advertId, {
        populate: ['advert_daily_schedules'],
      });

      if (!advert) {
        return ctx.notFound('Advert not found');
      }

      // Check if advert is approved
      if (!advert.isApproved) {
        return ctx.badRequest('Advert must be approved before scheduling');
      }

      // Parse runDate to ensure proper format
      const parsedRunDate = new Date(runDate);
      if (isNaN(parsedRunDate.getTime())) {
        return ctx.badRequest('Invalid runDate format');
      }

      // Format date to YYYY-MM-DD for Strapi
      const formattedDate = parsedRunDate.toISOString().split('T')[0];

      // Prepare runTime data
      let runTimeData = null;
      if (runTime) {
        // Validate runTime format (expecting "HH:mm AM/PM" or similar)
        if (typeof runTime === 'string') {
          runTimeData = runTime;
        } else if (typeof runTime === 'object') {
          runTimeData = runTime;
        }
      }

      // Upload media files if provided
      let uploadedMediaIds = [];
      if (mediaFiles && mediaFiles.length > 0) {
        try {
          // Assuming mediaFiles is an array of base64 strings or file objects
          for (const mediaFile of mediaFiles) {
            const uploadResponse = await strapi.plugins['upload'].services.upload.upload({
              data: {},
              files: mediaFile,
            });
            uploadedMediaIds.push(uploadResponse[0].id);
          }
        } catch (uploadError) {
          strapi.log.error('Media upload error:', uploadError);
          // Continue without media if upload fails
        }
      }

      // Check if schedule already exists for this date and advert
      const existingSchedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
        filters: {
          run_date: formattedDate,
          adverts: {
            id: advertId,
          },
        },
        populate: ['adverts'],
      });

      if (existingSchedules.length > 0) {
        return ctx.badRequest(`Advert is already scheduled for ${formattedDate}`);
      }

      // Create the daily schedule entry
      const scheduleData = {
        data: {
          run_date: formattedDate,
          run_time: runTimeData,
          media: uploadedMediaIds,
          is_published: isPublished,
          adverts: [advertId], // Connect the advert
        },
      };

      // Create the schedule
      const schedule = await strapi.entityService.create('api::advert-daily-schedule.advert-daily-schedule', scheduleData);

      // Update advert's isScheduled status
      await strapi.entityService.update('api::advert.advert', advertId, {
        data: {
          isScheduled: true,
        },
      });

      // Populate the response
      const populatedSchedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', schedule.id, {
        populate: ['adverts', 'media'],
      });

      return ctx.send({
        success: true,
        message: 'Advert scheduled successfully',
        data: populatedSchedule,
      });

    } catch (error) {
      strapi.log.error('Schedule advert error:', error);
      return ctx.internalServerError('Failed to schedule advert', error);
    }
  },

  // Get schedules by advert ID
  async getAdvertSchedules(ctx) {
    try {
      const { advertId } = ctx.params;
      
      if (!advertId) {
        return ctx.badRequest('advertId is required');
      }

      const schedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
        filters: {
          adverts: {
            id: advertId,
          },
        },
        populate: ['media', 'adverts'],
        sort: { run_date: 'asc' },
      });

      return ctx.send({
        success: true,
        data: schedules,
      });

    } catch (error) {
      strapi.log.error('Get advert schedules error:', error);
      return ctx.internalServerError('Failed to get advert schedules', error);
    }
  },

  // Get schedules by date range
  async getSchedulesByDateRange(ctx) {
    try {
      const { startDate, endDate } = ctx.query;
      
      if (!startDate || !endDate) {
        return ctx.badRequest('startDate and endDate are required');
      }

      const filters = {
        run_date: {
          $gte: startDate,
          $lte: endDate,
        },
      };

      const schedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
        filters,
        populate: ['media', 'adverts', 'adverts.client'],
        sort: { run_date: 'asc' },
      });

      return ctx.send({
        success: true,
        data: schedules,
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

      // Get the schedule first to check which adverts are connected
      const schedule = await strapi.entityService.findOne('api::advert-daily-schedule.advert-daily-schedule', scheduleId, {
        populate: ['adverts'],
      });

      if (!schedule) {
        return ctx.notFound('Schedule not found');
      }

      // Remove the schedule
      await strapi.entityService.delete('api::advert-daily-schedule.advert-daily-schedule', scheduleId);

      // Check if any adverts still have schedules
      for (const advert of schedule.adverts) {
        const advertSchedules = await strapi.entityService.findMany('api::advert-daily-schedule.advert-daily-schedule', {
          filters: {
            adverts: {
              id: advert.id,
            },
          },
        });

        // Update advert's isScheduled status
        await strapi.entityService.update('api::advert.advert', advert.id, {
          data: {
            isScheduled: advertSchedules.length > 0,
          },
        });
      }

      return ctx.send({
        success: true,
        message: 'Advert unscheduled successfully',
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

      const schedule = await strapi.entityService.update('api::advert-daily-schedule.advert-daily-schedule', scheduleId, {
        data: {
          is_published: isPublished,
        },
      });

      return ctx.send({
        success: true,
        message: `Schedule ${isPublished ? 'published' : 'unpublished'} successfully`,
        data: schedule,
      });

    } catch (error) {
      strapi.log.error('Toggle publish status error:', error);
      return ctx.internalServerError('Failed to toggle publish status', error);
    }
  },  

};
