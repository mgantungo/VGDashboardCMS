'use strict';

const {
  buildPublicationCode,
  assertValidPageCount,
} = require('../../../_pager-helpers/pager-utils');

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    if (!data.masthead || !data.publication_date) {
      throw new Error('masthead and publication_date are required to initialize a publication');
    }

    // Validate 24-minimum / divisible-by-4 rule up front.
    assertValidPageCount(data.total_pages);

    // Compute the next sequence number for this masthead + date.
    const existing = await strapi.entityService.findMany('api::pager-publication.pager-publication', {
      filters: {
        masthead: data.masthead,
        publication_date: data.publication_date,
      },
      sort: { sequence: 'desc' },
      limit: 1,
    });

    const nextSequence = existing.length > 0 ? existing[0].sequence + 1 : 1;
    data.sequence = nextSequence;
    data.publication_code = buildPublicationCode(data.masthead, data.publication_date, nextSequence);
  },

  // Page auto-generation moved to the controller's create() action — it has
  // the created row (and its id) directly in hand, rather than depending on
  // the shape of the lifecycle event's `result`.

  async beforeUpdate(event) {
    const { data, where } = event.params;

    // total_pages must only ever change through the dedicated increase-pages
    // action, which recomputes this value itself and appends pages — never
    // allow a raw PUT to silently change it and leave pages out of sync.
    if (data.total_pages !== undefined) {
      const current = await strapi.entityService.findOne('api::pager-publication.pager-publication', where.id);
      if (current && data.total_pages !== current.total_pages) {
        throw new Error('total_pages cannot be edited directly — use the increase-pages action');
      }
    }
  },
};
