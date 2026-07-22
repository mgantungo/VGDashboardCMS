'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers for the pager module (pager-publication + pager-page).
// Path resolves as ../../_pager-helpers/pager-utils from controllers/lifecycles
// inside src/api/pager-publication/** and src/api/pager-page/**.
// ─────────────────────────────────────────────────────────────────────────────

/** Zero-pad a sequence number, e.g. 1 -> "01" */
function padSequence(n) {
  return String(n).padStart(2, '0');
}

/** YYYYMMDD from a date string/Date */
function toCompactDate(dateInput) {
  const d = new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Builds the publication_code, e.g. NV_20260722-01 / BK_20260722-01
 */
function buildPublicationCode(masthead, publicationDate, sequence) {
  return `${masthead}_${toCompactDate(publicationDate)}-${padSequence(sequence)}`;
}

/**
 * Validates the page-count rule: minimum 24, must be divisible by 4.
 * Throws with a message suitable for a Strapi ValidationError.
 */
function assertValidPageCount(totalPages) {
  const n = Number(totalPages);
  if (!Number.isInteger(n)) {
    throw new Error('total_pages must be a whole number');
  }
  if (n < 24) {
    throw new Error('total_pages must be at least 24');
  }
  if (n % 4 !== 0) {
    throw new Error('total_pages must be divisible by 4');
  }
  return n;
}

/**
 * Validates an increment: additionalPages itself must keep the total
 * divisible by 4 (in practice this means additionalPages must itself
 * be a positive multiple of 4).
 */
function assertValidPageIncrement(additionalPages) {
  const n = Number(additionalPages);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('additionalPages must be a positive whole number');
  }
  if (n % 4 !== 0) {
    throw new Error('additionalPages must be a multiple of 4');
  }
  return n;
}

/**
 * Reader-spread layout order described by the user:
 *   left column:  page 1 -> N/2, top to bottom
 *   right column: N/2+1 -> N, bottom to top (so page N sits top-right,
 *                 mirroring page 1 at top-left)
 *
 * Returns { left: [...pages sorted 1..mid], right: [...pages sorted mid+1..N reversed] }
 * `pages` must already be plain page objects containing at least `page_number`.
 */
function buildReaderSpreadLayout(pages, totalPages) {
  const mid = totalPages / 2;
  const byNumber = new Map(pages.map((p) => [p.page_number, p]));

  const left = [];
  for (let n = 1; n <= mid; n++) {
    if (byNumber.has(n)) left.push(byNumber.get(n));
  }

  const right = [];
  for (let n = totalPages; n > mid; n--) {
    if (byNumber.has(n)) right.push(byNumber.get(n));
  }

  return { left, right, mid };
}

/**
 * TODO(felix): confirm the real "print advert" signal.
 * Placeholder eligibility check used by getAvailableAdverts — currently just
 * excludes cancelled/rejected adverts and requires an ad_size to be set.
 * Swap the body of this function once the actual field is confirmed
 * (e.g. advert.product?.category === 'print').
 */
function isPrintEligible(advert) {
  if (!advert) return false;
  if (advert.isCanceled) return false;
  if (advert.status === 'editor_rejected' || advert.status === 'manager_rejected') return false;
  return Boolean(advert.ad_size);
}

/**
 * Best-effort extraction of incoming advert ids from a Strapi v5 relation
 * payload, which may arrive as a plain array of ids/documentIds, or as
 * { set: [...] } / { connect: [...] }.
 */
function extractIncomingAdvertIds(data) {
  if (!data || !data.adverts) return null;
  const rel = data.adverts;

  if (Array.isArray(rel)) {
    return rel.map((item) => (typeof item === 'object' ? (item.id ?? item.documentId) : item));
  }
  if (rel.set) {
    return rel.set.map((item) => (typeof item === 'object' ? (item.id ?? item.documentId) : item));
  }
  if (rel.connect) {
    return rel.connect.map((item) => (typeof item === 'object' ? (item.id ?? item.documentId) : item));
  }
  return null;
}

module.exports = {
  padSequence,
  toCompactDate,
  buildPublicationCode,
  assertValidPageCount,
  assertValidPageIncrement,
  buildReaderSpreadLayout,
  isPrintEligible,
  extractIncomingAdvertIds,
};
