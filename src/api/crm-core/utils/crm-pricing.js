'use strict';

/**
 * Pure proposal pricing maths (blueprint 4.4):
 * line totals, package-discount allocation, contribution and margin.
 * Works in whole shillings so totals always add up exactly.
 */
const { num } = require('./crm-helpers');

const lineCost = (l) => num(l.internal_cost) + num(l.third_party_cost) + num(l.other_cost);

/**
 * @param {Array} lines   proposal lines (quantity, list_price, unit_price, line_discount, costs, allocated_discount)
 * @param {Object} opts   { packagePrice, method: 'selling_price'|'contribution'|'manual' }
 * @returns {{ lines: Array, totals: Object, warnings: string[] }}
 */
function computeTotals(lines, { packagePrice = null, method = 'selling_price' } = {}) {
  const warnings = [];
  const rows = lines.map((l) => {
    const qty = num(l.quantity) || 0;
    const list = Math.round(num(l.list_price) * qty);
    const selling = Math.max(0, Math.round(num(l.unit_price) * qty) - num(l.line_discount));
    return { ...l, _list: list, _selling: selling, _cost: lineCost(l) };
  });

  const listTotal = rows.reduce((a, r) => a + r._list, 0);
  const sellingTotal = rows.reduce((a, r) => a + r._selling, 0);
  const costTotal = rows.reduce((a, r) => a + r._cost, 0);

  let pkg = packagePrice === null || packagePrice === undefined || packagePrice === '' ? null : Math.round(num(packagePrice));
  if (pkg !== null && pkg > sellingTotal) {
    warnings.push('Package price is above the lines total; no package discount applied.');
    pkg = null;
  }
  const discount = pkg === null ? 0 : sellingTotal - pkg;

  // allocate the package discount across lines
  let alloc = rows.map(() => 0);
  if (discount > 0 && rows.length) {
    if (method === 'manual') {
      alloc = rows.map((r) => Math.round(num(r.allocated_discount)));
      const sum = alloc.reduce((a, b) => a + b, 0);
      if (sum !== discount) warnings.push(`Manual allocation adds up to ${sum}, but the package discount is ${discount}.`);
    } else {
      let weights = rows.map((r) => (method === 'contribution' ? Math.max(0, r._selling - r._cost) : r._selling));
      let wsum = weights.reduce((a, b) => a + b, 0);
      if (wsum <= 0) { weights = rows.map((r) => r._selling); wsum = weights.reduce((a, b) => a + b, 0) || 1; }
      let given = 0;
      alloc = weights.map((w, i) => {
        if (i === weights.length - 1) return discount - given;
        const a = Math.round((discount * w) / wsum);
        given += a;
        return a;
      });
      // never allocate more than a line's own selling price
      for (let i = 0; i < alloc.length; i += 1) {
        if (alloc[i] > rows[i]._selling) {
          const extra = alloc[i] - rows[i]._selling;
          alloc[i] = rows[i]._selling;
          const j = alloc.findIndex((a, k) => k !== i && rows[k]._selling - a >= extra);
          if (j >= 0) alloc[j] += extra;
        }
      }
    }
  }

  const outLines = rows.map((r, i) => {
    const net = r._selling - alloc[i];
    const contribution = net - r._cost;
    return {
      ...r,
      selling_price: r._selling,
      allocated_discount: alloc[i],
      net_price: net,
      line_cost: r._cost,
      contribution,
      margin: net > 0 ? Math.round((contribution / net) * 1000) / 10 : 0,
      below_cost: net < r._cost,
    };
  });
  outLines.forEach((l) => { delete l._list; delete l._selling; delete l._cost; });

  const netTotal = outLines.reduce((a, l) => a + l.net_price, 0);
  const contribution = netTotal - costTotal;
  const totals = {
    list_total: listTotal,
    selling_total: sellingTotal,
    discount_total: Math.max(0, listTotal - netTotal),
    net_total: netTotal,
    cost_total: costTotal,
    contribution_total: contribution,
    margin_pct: netTotal > 0 ? Math.round((contribution / netTotal) * 1000) / 10 : 0,
    discount_pct: listTotal > 0 ? Math.round(((listTotal - netTotal) / listTotal) * 1000) / 10 : 0,
    package_discount: discount,
  };
  if (outLines.some((l) => l.below_cost)) warnings.push('At least one line is now below its cost.');
  return { lines: outLines, totals, warnings };
}

/** Material differences between two versions, for the approver and the change summary. */
function compareVersions(a, b) {
  if (!a || !b) return null;
  const changes = [];
  const fields = [
    ['net_total', 'Client price'], ['discount_pct', 'Discount %'], ['margin_pct', 'Margin %'],
    ['payment_terms_days', 'Payment terms (days)'], ['valid_until', 'Valid until'], ['allocation_method', 'Discount allocation'],
  ];
  for (const [k, label] of fields) {
    const va = a[k] ?? null; const vb = b[k] ?? null;
    if (String(va) !== String(vb)) changes.push({ field: k, label, from: va, to: vb });
  }
  for (const k of ['terms', 'executive_summary', 'solution', 'requirements']) {
    if ((a[k] || '') !== (b[k] || '')) changes.push({ field: k, label: k.replace('_', ' '), from: 'changed', to: 'changed' });
  }
  const key = (l) => `${l.product?.id || l.product?.documentId || l.product || ''}|${l.description || ''}`;
  const la = new Map((a.lines || []).map((l) => [key(l), l]));
  const lb = new Map((b.lines || []).map((l) => [key(l), l]));
  const lineChanges = [];
  lb.forEach((l, k) => {
    if (!la.has(k)) lineChanges.push({ change: 'added', description: l.description, to: num(l.net_price) });
    else {
      const o = la.get(k);
      if (num(o.net_price) !== num(l.net_price) || num(o.quantity) !== num(l.quantity)) {
        lineChanges.push({ change: 'changed', description: l.description, from: num(o.net_price), to: num(l.net_price) });
      }
    }
  });
  la.forEach((l, k) => { if (!lb.has(k)) lineChanges.push({ change: 'removed', description: l.description, from: num(l.net_price) }); });
  return { changes, lines: lineChanges, scopeChanged: lineChanges.some((c) => c.change !== 'changed') };
}

module.exports = { computeTotals, compareVersions, lineCost };
