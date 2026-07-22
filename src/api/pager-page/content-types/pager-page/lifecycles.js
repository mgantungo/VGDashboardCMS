'use strict';

const { extractIncomingAdvertIds, extractRelationId } = require('../../../_pager-helpers/pager-utils');

/**
 * Resolves the publication id a page belongs to — either from the incoming
 * data (on create) or by looking up the existing row (on update).
 */
async function resolvePublicationId(data, where) {
  const fromData = extractRelationId(data.publication);
  if (fromData !== null) return fromData;

  if (where?.id) {
    const existing = await strapi.entityService.findOne('api::pager-page.pager-page', where.id, {
      populate: { publication: true },
    });
    return existing?.publication?.id ?? null;
  }
  return null;
}

/**
 * Throws if any incoming advert id is already assigned to a *different*
 * page within the same publication.
 */
async function assertAdvertsNotDuplicatedInPublication(publicationId, incomingAdvertIds, currentPageId) {
  if (!publicationId || !incomingAdvertIds || incomingAdvertIds.length === 0) return;

  const siblingPages = await strapi.entityService.findMany('api::pager-page.pager-page', {
    filters: { publication: publicationId },
    populate: { adverts: true },
  });

  for (const page of siblingPages) {
    if (currentPageId && page.id === currentPageId) continue;
    const pageAdvertIds = (page.adverts || []).map((a) => a.id);
    const clash = incomingAdvertIds.find((id) => pageAdvertIds.includes(id));
    if (clash) {
      throw new Error(
        `Advert ${clash} is already assigned to page ${page.page_number} in this publication`
      );
    }
  }
}

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    const publicationId = await resolvePublicationId(data, null);
    if (!publicationId) {
      throw new Error('publication is required for a pager page');
    }

    const publication = await strapi.entityService.findOne('api::pager-publication.pager-publication', publicationId);
    if (data.page_number < 1 || data.page_number > publication.total_pages) {
      throw new Error(`page_number must be between 1 and ${publication.total_pages} for this publication`);
    }

    // Lock page 1 to "Cover Page".
    if (data.page_number === 1) {
      data.is_cover = true;
      data.section = 'Cover Page';
    }

    // Lock the last page's section to "Back Cover Page".
    if (data.page_number === publication.total_pages) {
      data.is_back_cover = true;
      data.section = 'Back Cover Page';
    }

    const incomingAdvertIds = extractIncomingAdvertIds(data);
    await assertAdvertsNotDuplicatedInPublication(publicationId, incomingAdvertIds, null);
  },

  async beforeUpdate(event) {
    const { data, where } = event.params;

    const existing = await strapi.entityService.findOne('api::pager-page.pager-page', where.id, {
      populate: { publication: true },
    });
    if (!existing) return;

    // Cover / back cover sections are locked — block any attempt to change them.
    if (existing.is_cover && data.section && data.section !== 'Cover Page') {
      throw new Error('The cover page section cannot be changed');
    }
    if (existing.is_back_cover && data.section && data.section !== 'Back Cover Page') {
      throw new Error('The back cover page section cannot be changed');
    }

    const publicationId = existing.publication?.id;
    const incomingAdvertIds = extractIncomingAdvertIds(data);
    await assertAdvertsNotDuplicatedInPublication(publicationId, incomingAdvertIds, existing.id);
  },
};
