// Column sorting for rich tables.

import { getHeaderCells, getBodyRows } from './utils.js';

export function sortBy(table, col) {
  const headers = getHeaderCells(table);
  const th = headers[col];
  if (!th) return;

  const current = th.dataset.dir;
  const next    = current === '' ? 'asc' : current === 'asc' ? 'desc' : '';

  // Reset all header indicators
  headers.forEach(h => {
    h.dataset.dir = '';
    const a = h.querySelector('.wte-arrow');
    if (a) a.textContent = '↕';
    h.setAttribute('aria-sort', 'none');
  });

  th.dataset.dir = next;
  const arrow = th.querySelector('.wte-arrow');
  if (arrow) arrow.textContent = next === 'asc' ? '↑' : next === 'desc' ? '↓' : '↕';

  const rows = getBodyRows(table);

  if (next === '') {
    // 3rd click → restore original row order saved at sort-start
    const originalOrder = table._wteOriginalOrder;
    if (originalOrder) {
      // Consolidate all body rows into a single tbody (removes multi-tbody fragmentation)
      const tbody = table.tBodies[0] ?? table.createTBody();
      originalOrder.forEach(r => tbody.appendChild(r));
      table._wteBodyRowsCache = [...originalOrder];
    }
    if (typeof table._wteApplyStripes === 'function') table._wteApplyStripes();
    return;
  }

  // Save original order once per sort session (before first sort)
  if (!table._wteOriginalOrder) {
    table._wteOriginalOrder = [...rows];
  }

  th.setAttribute('aria-sort', next === 'asc' ? 'ascending' : 'descending');

  rows.sort((a, b) => cmpCells(a.cells[col], b.cells[col], next === 'asc'));

  // Consolidate all body rows into tBodies[0] to handle multi-tbody tables
  const tbody = table.tBodies[0] ?? table.createTBody();
  rows.forEach(r => tbody.appendChild(r));
  // Keep cache in sync with new DOM order after sort.
  table._wteBodyRowsCache = rows;
  if (typeof table._wteApplyStripes === 'function') table._wteApplyStripes();
}

export function cmpCells(a, b, asc) {
  const av = a?.textContent.trim() ?? '';
  const bv = b?.textContent.trim() ?? '';
  const sign = asc ? 1 : -1;

  const an = parseNum(av), bn = parseNum(bv);
  if (an !== null && bn !== null) return sign * (an - bn);

  const ad = Date.parse(av), bd = Date.parse(bv);
  if (!isNaN(ad) && !isNaN(bd)) return sign * (ad - bd);

  return sign * av.localeCompare(bv, 'ja');
}

export function parseNum(s) {
  const n = parseFloat(s.replace(/[,，¥$€£%\s]/g, ''));
  return isNaN(n) ? null : n;
}
