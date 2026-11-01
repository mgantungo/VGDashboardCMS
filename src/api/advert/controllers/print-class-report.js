'use strict';

/**
 * Display vs Classified report (print only)
 *
 *   POST /reports/print-class/summary
 *   POST /reports/print-class/list
 *
 * Body (both):
 *   startDate     YYYY-MM-DD (required)
 *   endDate       YYYY-MM-DD (required)
 *   basis         'booked' (createdAt in range, default) | 'run' (a publishing date in range)
 *   productId     optional — one masthead/product
 *   paymentMethod optional — cash | credit | pdc | bank_transfer | mobile_money
 *   printAdClass  optional on /list — display | classified | unclassified
 *
 * Amounts:
 *   basis 'booked' → the advert's full total_amount
 *   basis 'run'    → total_amount split evenly across its publishing dates,
 *                    counting only the dates inside the range
 */

const { isISODate, reply } = require('../../_vgams-helpers/vgams-workflow');

const CLASSES = ['display', 'classified', 'unclassified'];
const METHODS = ['credit', 'cash', 'pdc', 'bank_transfer', 'mobile_money'];

function bodyOf(ctx) {
  const raw = ctx.request.body || {};
  return (raw.data && typeof raw.data === 'object') ? raw.data : raw;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** "4 × 20", "4x20", "4 col x 20cm" → 80 column-cm, else null */
function columnCm(adSize) {
  const m = String(adSize || '').match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/);
  return m ? round2(Number(m[1]) * Number(m[2])) : null;
}

/** The booking form writes "Word Count: N" into the instructions for classifieds */
function wordCount(instructions) {
  const m = String(instructions || '').match(/word\s*count\s*:\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

function emptyBucket() {
  return { bookings: 0, runs: 0, amount: 0, columnCm: 0, words: 0 };
}

async function loadAdverts(strapi, body) {
  const { startDate, endDate, basis = 'booked', productId, paymentMethod } = body;

  const filters = {
    isCanceled: false,
    product: { category: { category_type: 'print' } },
  };
  if (productId) filters.product.id = Number(productId);
  if (paymentMethod && METHODS.includes(paymentMethod)) filters.payment_method = paymentMethod;

  if (basis === 'run') {
    // publishing_dates is JSON and can't be filtered in SQL; start_date is the
    // earliest booked date, so it is a safe pre-filter for "could run by endDate".
    filters.start_date = { $lte: endDate };
  } else {
    filters.createdAt = {
      $gte: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
      $lte: new Date(`${endDate}T23:59:59.999Z`).toISOString(),
    };
  }

  const adverts = await strapi.entityService.findMany('api::advert.advert', {
    filters,
    fields: [
      'id', 'reference_number', 'bc_reference_number', 'advert_title', 'ad_size', 'ad_type',
      'start_date', 'end_date', 'publishing_dates', 'total_amount', 'payment_method',
      'print_ad_class', 'special_instructions', 'isPaid', 'invoice_stage', 'createdAt',
    ],
    populate: {
      client:  { fields: ['id', 'company_name'] },
      product: { fields: ['id', 'product_name'] },
      vgams_user: { fields: ['id', 'name'] },
    },
    sort: { createdAt: 'desc' },
    limit: -1,
  });

  return adverts.map(a => {
    const dates = Array.isArray(a.publishing_dates) && a.publishing_dates.length > 0
      ? a.publishing_dates
      : [a.start_date].filter(Boolean);
    const inRange = basis === 'run'
      ? dates.filter(d => d >= startDate && d <= endDate)
      : dates;
    const total = Number(a.total_amount) || 0;
    const amount = basis === 'run'
      ? (dates.length > 0 ? total * (inRange.length / dates.length) : 0)
      : total;
    return {
      id: a.id,
      reference: a.reference_number,
      bcReference: a.bc_reference_number || '',
      advertTitle: a.advert_title,
      clientName: a.client?.company_name || '—',
      productId: a.product?.id || null,
      productName: a.product?.product_name || '—',
      bookedBy: a.vgams_user?.name || '',
      printAdClass: a.print_ad_class || 'unclassified',
      paymentMethod: a.payment_method || 'unknown',
      adSize: a.ad_size,
      adType: a.ad_type,
      columnCm: columnCm(a.ad_size),
      words: wordCount(a.special_instructions),
      publishingDates: dates,
      runsInRange: inRange.length,
      totalAmount: round2(total),
      amount: round2(amount),
      isPaid: !!a.isPaid,
      invoiceStage: a.invoice_stage || 'not_ready',
      createdAt: a.createdAt,
    };
  }).filter(row => basis !== 'run' || row.runsInRange > 0);
}

function validate(ctx, body) {
  if (!isISODate(body.startDate) || !isISODate(body.endDate)) {
    reply(ctx, 400, { success: false, message: 'startDate and endDate are required (YYYY-MM-DD)' });
    return false;
  }
  if (body.startDate > body.endDate) {
    reply(ctx, 400, { success: false, message: 'startDate must be on or before endDate' });
    return false;
  }
  if (body.basis && !['booked', 'run'].includes(body.basis)) {
    reply(ctx, 400, { success: false, message: "basis must be 'booked' or 'run'" });
    return false;
  }
  return true;
}

module.exports = {

  async summary(ctx) {
    try {
      const body = bodyOf(ctx);
      if (!validate(ctx, body)) return;
      const rows = await loadAdverts(strapi, body);

      const classes = Object.fromEntries(CLASSES.map(c => [c, emptyBucket()]));
      const byProduct = new Map();
      const byMethod = new Map();

      for (const r of rows) {
        const add = (bucket) => {
          bucket.bookings += 1;
          bucket.runs += r.runsInRange;
          bucket.amount += r.amount;
          if (r.columnCm && r.printAdClass === 'display') bucket.columnCm += r.columnCm * r.runsInRange;
          if (r.words && r.printAdClass === 'classified') bucket.words += r.words;
        };
        add(classes[r.printAdClass] || classes.unclassified);

        if (!byProduct.has(r.productId)) {
          byProduct.set(r.productId, {
            productId: r.productId, productName: r.productName,
            ...Object.fromEntries(CLASSES.map(c => [c, emptyBucket()])),
            total: 0,
          });
        }
        const p = byProduct.get(r.productId);
        add(p[r.printAdClass] || p.unclassified);
        p.total += r.amount;

        if (!byMethod.has(r.paymentMethod)) {
          byMethod.set(r.paymentMethod, {
            paymentMethod: r.paymentMethod,
            ...Object.fromEntries(CLASSES.map(c => [c, emptyBucket()])),
            total: 0,
          });
        }
        const m = byMethod.get(r.paymentMethod);
        add(m[r.printAdClass] || m.unclassified);
        m.total += r.amount;
      }

      const roundBucket = b => ({ ...b, amount: round2(b.amount), columnCm: round2(b.columnCm) });
      const roundRow = row => ({
        ...row,
        ...Object.fromEntries(CLASSES.map(c => [c, roundBucket(row[c])])),
        total: round2(row.total),
      });

      const grandTotal = round2(rows.reduce((s, r) => s + r.amount, 0));
      const share = c => (grandTotal > 0 ? round2((classes[c].amount / grandTotal) * 100) : 0);

      return ctx.send({
        success: true,
        filters: {
          startDate: body.startDate, endDate: body.endDate,
          basis: body.basis || 'booked',
          productId: body.productId || null,
          paymentMethod: body.paymentMethod || null,
        },
        classes: Object.fromEntries(CLASSES.map(c => [c, { ...roundBucket(classes[c]), sharePct: share(c) }])),
        byProduct: [...byProduct.values()].map(roundRow).sort((a, b) => b.total - a.total),
        byPaymentMethod: [...byMethod.values()].map(roundRow).sort((a, b) => b.total - a.total),
        totals: { bookings: rows.length, amount: grandTotal },
      });
    } catch (error) {
      console.error('❌ print-class-report.summary:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },

  async list(ctx) {
    try {
      const body = bodyOf(ctx);
      if (!validate(ctx, body)) return;
      let rows = await loadAdverts(strapi, body);
      if (body.printAdClass && CLASSES.includes(body.printAdClass)) {
        rows = rows.filter(r => r.printAdClass === body.printAdClass);
      }
      return ctx.send({ success: true, count: rows.length, data: rows });
    } catch (error) {
      console.error('❌ print-class-report.list:', error);
      return ctx.internalServerError({ success: false, message: error.message });
    }
  },
};
