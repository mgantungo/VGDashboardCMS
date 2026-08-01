'use strict';

/**
 * Schedule Status
 * Single source of truth for "is this advert's booking fully scheduled".
 *
 * publishing_dates on the advert is what the client paid for (1 or many
 * dates). advert_daily_schedules is what has actually been attached to a
 * print/broadcast run. isScheduled must reflect the DIFFERENCE between the
 * two, not just "has at least one schedule" — a 4-date booking with 1 date
 * scheduled is still pending, not done.
 */

/**
 * @param {string[]} publishingDates - advert.publishing_dates
 * @param {string[]} scheduledDates  - run_date of every linked advert_daily_schedule
 * @returns {string[]} dates the advert is booked for but not yet attached to a schedule
 */
function computePendingDates(publishingDates = [], scheduledDates = []) {
  const scheduledSet = new Set(scheduledDates || []);
  return (Array.isArray(publishingDates) ? publishingDates : [])
    .filter(d => !!d && !scheduledSet.has(d))
    .sort();
}

module.exports = ({ strapi }) => ({
  computePendingDates,

  /**
   * Reads an advert's current publishing_dates + linked schedules, derives
   * the correct isScheduled value, and persists it only if it changed.
   * Call this after ANY operation that links/unlinks an advert to a schedule
   * (design-batch attach, legacy scheduleAdvert, unscheduleAdvert, etc.)
   * instead of writing isScheduled directly.
   */
  async recomputeAdvertScheduleStatus(advertId) {
    const advert = await strapi.entityService.findOne('api::advert.advert', advertId, {
      fields: ['id', 'publishing_dates', 'isScheduled'],
      populate: { advert_daily_schedules: { fields: ['id', 'run_date'] } },
    });

    if (!advert) return null;

    const publishingDates = Array.isArray(advert.publishing_dates) ? advert.publishing_dates : [];
    const scheduledDates = (advert.advert_daily_schedules || [])
      .map(s => s.run_date)
      .filter(Boolean);

    const pendingDates = computePendingDates(publishingDates, scheduledDates);

    // Legacy fallback: adverts created before publishing_dates existed have
    // an empty array here — don't strand them in the queue forever.
    const isScheduled = publishingDates.length > 0
      ? pendingDates.length === 0
      : scheduledDates.length > 0;

    if (isScheduled !== advert.isScheduled) {
      await strapi.entityService.update('api::advert.advert', advertId, {
        data: { isScheduled },
      });
    }

    return { isScheduled, pendingDates, scheduledDates };
  },

  /**
   * Same as above but for a batch of advert IDs (e.g. after attaching a
   * design-batch, which usually touches several adverts at once).
   */
  async recomputeMany(advertIds = []) {
    const results = {};
    for (const id of advertIds) {
      results[id] = await this.recomputeAdvertScheduleStatus(id);
    }
    return results;
  },
});
