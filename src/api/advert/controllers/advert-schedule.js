// src/api/advert/controllers/advert-schedule.js
'use strict';

// Standalone controller for schedule (run-date) advert queries - kept
// deliberately separate from advert.js's getDateRangeAdverts, which
// filters by createdAt (booking date) and is already depended on
// elsewhere. Isolating this newer, less-tested query path here means a
// bug in it can't touch that existing endpoint.
//
// Powers the "Run Date" filter mode and the Upcoming Bookings calendar on
// the clerk dashboard: adverts whose run window (start_date/end_date)
// overlaps a given range, regardless of when they were booked.
//
// normaliseAttachment/transformAdvert below are duplicated from advert.js
// rather than imported, so this file has zero dependency on - and zero
// risk of breaking - the existing controller. Trade-off: if the advert
// shape changes, both copies need updating.

/**
 * Normalise a raw Strapi attachment object into a clean, consistent shape.
 * URL paths are kept relative — the consuming client prepends its own base URL.
 */
const normaliseAttachment = (f) => {
  if (!f) return null;
  return {
    id:           f.id,
    name:         f.name,
    mime:         f.mime,
    size:         f.size,
    url:          f.url   || null,
    thumbnailUrl: f.formats?.thumbnail?.url || null,
    uploadedAt:   f.createdAt
  };
};

/**
 * Map a raw Strapi advert record (as returned by entityService) to the
 * camelCase shape consumed by every frontend client. Kept in lockstep with
 * transformAdvert in advert.js - see the file header note above.
 */
const transformAdvert = (a) => ({
  // ── Identity ───────────────────────────────────────────────────────────
  id:        a.id,
  reference: a.reference_number,
  bcReference: a.bc_reference_number,

  // ── Advert details ─────────────────────────────────────────────────────
  advertTitle:   a.advert_title,
  adSize:        a.ad_size,
  adType:        a.ad_type,
  frequency:     a.frequency,
  publishOnWeb:  a.publish_onweb,

  // ── Schedule ───────────────────────────────────────────────────────────
  startDate:      a.start_date,
  endDate:        a.end_date,
  publishingDates: Array.isArray(a.publishing_dates) ? a.publishing_dates : [],

  // ── Pricing ────────────────────────────────────────────────────────────
  basePrice:   a.base_price,
  surcharge:   a.surcharge,
  discount:    a.discount    || 0,
  totalAmount: a.total_amount,

  // ── Payment & workflow ─────────────────────────────────────────────────
  paymentMethod:       a.payment_method,
  specialInstructions: a.special_instructions,
  status:              a.status,

  // ── Denormalised strings (stored at create-time) ───────────────────────
  revenueStream:  a.revenue_stream      || null,
  costStream:     a.cost_stream         || null,
  officeLocation: a.office_location     || null,
  clientRefNo:    a.client_reference_no || null,
  contactPerson:  a.contact_person  || null,
  contactNumber:  a.contact_number  || null,
  contactEmail:   a.contact_email   || null,
  marketSector:   a.market_sector   || null,

  // ── Boolean flags ──────────────────────────────────────────────────────
  isActive:    a.isActive,
  isPaid:      a.isPaid,
  isScheduled: a.isScheduled,
  isApproved:  a.isApproved,
  isCanceled:  a.isCanceled,
  hasRun:      a.hasRun,
  isClosed:    a.isClosed,

  // ── Timestamps ─────────────────────────────────────────────────────────
  createdAt:  a.createdAt,
  updatedAt:  a.updatedAt,

  // ── Relations ──────────────────────────────────────────────────────────
  // The booking clerk / user who created this advert
  createdBy: a.vgams_user
    ? { id: a.vgams_user.id, name: a.vgams_user.name, email: a.vgams_user.email, role: a.vgams_user.role }
    : null,

  // Sales person(s) assigned
  salesAgents: (a.vgams_sales_persons || []).map(s => ({
    id: s.id, name: s.name, email: s.email
  })),

  // Client
  client: a.client
    ? {
        id:             a.client.id,
        name:           a.client.company_name,
        contactPerson:  a.client.contact_person || null,
        email:          a.client.email          || null,
        phone:          a.client.phone          || null,
        address:        a.client.address        || null,
        bcNo:           a.client.bc_no          || null
      }
    : null,

  // Convenience alias used in the table
  clientName: a.client?.company_name || null,

  // Product
  product: a.product
    ? {
        id:          a.product.id,
        name:        a.product.product_name,
        productId:   a.product.product_id   || null,
        description: a.product.description  || null,
        circulation: a.product.circulation  || null,
        category:    a.product.category
          ? {
              id:          a.product.category.id,
              name:        a.product.category.category_name,
              type:        a.product.category.category_type,
              description: a.product.category.description || null
            }
          : null
      }
    : null,

  // Rate card
  rateCard: a.rate_card
    ? {
        id:                 a.rate_card.id,
        adType:             a.rate_card.ad_type,
        sizeDimension:      a.rate_card.size_dimension,
        priceFc:            a.rate_card.price_fc,
        priceBw:            a.rate_card.price_bw,
        surchargePercentage: a.rate_card.surcharge_percentage || null
      }
    : null,

  // Attachments — null-safe, normalised, URLs remain relative
  attachments: (Array.isArray(a.attachments) ? a.attachments : [])
    .filter(Boolean)
    .map(normaliseAttachment)
});

module.exports = {
  // ── SCHEDULE RANGE ADVERTS  (GET /adverts-schedule-range) ────────────────
  // Filters by whether the advert's run window overlaps [startDate,
  // endDate] - not by createdAt. An advert matches if:
  //   - it starts on/before the range's end, AND
  //   - it either has an end_date on/after the range's start, or has no
  //     end_date at all and its start_date is on/after the range's start
  //     (a single-day booking with no explicit end).
  // start_date/end_date are plain date fields, so bounds are compared as
  // YYYY-MM-DD strings rather than full ISO timestamps.
  async getScheduleAdverts(ctx) {
    try {
      const { query } = ctx;
      console.log('📅 Schedule range query received:', query);

      const startDate = query.startDate ? new Date(query.startDate) : new Date();
      const endDate   = query.endDate   ? new Date(query.endDate)   : new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (startDate > endDate) return ctx.badRequest('Start date must be before end date');

      const startDateOnly = startDate.toISOString().slice(0, 10);
      const endDateOnly   = endDate.toISOString().slice(0, 10);

      console.log('📅 Fetching adverts for schedule range:', { startDateOnly, endDateOnly });

      const filters = {
        start_date: { $lte: endDateOnly },
        $or: [
          { end_date: { $gte: startDateOnly } },
          { end_date: { $null: true }, start_date: { $gte: startDateOnly } }
        ],
        ...(query.userId    && { vgams_user: { id: parseInt(query.userId) } }),
        ...(query.status    && { status: query.status }),
        ...(query.clientId  && { client:  { id: parseInt(query.clientId) } }),
        ...(query.productId && { product: { id: parseInt(query.productId) } })
      };

      console.log('🔍 Filters applied:', JSON.stringify(filters, null, 2));

      const adverts = await strapi.entityService.findMany('api::advert.advert', {
        filters,
        populate: {
          vgams_user:          { fields: ['id', 'name', 'email', 'role'] },
          vgams_sales_persons: { fields: ['id', 'name', 'email'] },
          client:              { fields: ['id', 'company_name', 'contact_person', 'email', 'phone'] },
          product:             { fields: ['id', 'product_name', 'product_id'] },
          rate_card:           { fields: ['id', 'size_dimension', 'ad_type', 'price_fc', 'price_bw'] },
          attachments:         true   // full media object so thumbnail formats are available
        },
        sort:  query.sort  || 'start_date:asc',
        limit: query.limit || 1000,
        start: query.start || 0
      });

      // ── Transform: produce clean camelCase output ─────────────────────────
      const data = adverts.map(transformAdvert);

      // ── Statistics ────────────────────────────────────────────────────────
      const totalAmount   = data.reduce((s, a) => s + (parseFloat(a.totalAmount) || 0), 0);
      const totalDiscount = data.reduce((s, a) => s + (parseFloat(a.discount)    || 0), 0);

      const uniqueUsers = Array.from(
        data.reduce((map, a) => {
          if (a.createdBy) map.set(a.createdBy.id, a.createdBy);
          return map;
        }, new Map()).values()
      );

      console.log('✅ Found adverts:', data.length);

      return {
        success:    true,
        data,
        count:      data.length,
        statistics: {
          totalAmount,
          totalDiscount,
          averageAmount: data.length > 0 ? totalAmount / data.length : 0,
          uniqueUsers:   uniqueUsers.length
        },
        dateRange: { start: startDate, end: endDate },
        users:     uniqueUsers
      };

    } catch (err) {
      console.error('❌ Error fetching schedule range adverts:', err.message, err.details);
      return ctx.internalServerError(`Failed to fetch adverts: ${err.message}`);
    }
  }
};
