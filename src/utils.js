// Core DOM utilities shared across all modules.

export function findTable(el) {
  if (!el) return null;
  return el.tagName === 'TABLE' ? el : el.closest('table');
}

export function notify(text) {
  // Remove any existing toasts before showing a new one
  document.querySelectorAll('.wte-toast').forEach(t => t.remove());

  const el = document.createElement('div');
  el.className = 'wte-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.textContent = text;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  setTimeout(() => { if (el.isConnected) el.remove(); }, 3500);
}

/**
 * Ensures the table has <thead> / <tbody>.
 * Handles three cases:
 *   1. Already has <thead>  → no-op
 *   2. Has <tbody> only     → promotes first row (th or td) to <thead>
 *   3. Raw <tr> children    → same promotion
 *
 * Also handles all-<td> tables: the first row becomes the header row
 * regardless of whether its cells are <th> or <td>.
 */
export function ensureStructure(table) {
  if (table.tHead) return; // already structured

  // Collect every row in document order before we move anything
  const allRows = Array.from(table.querySelectorAll(':scope > tr, :scope > tbody > tr'));
  if (!allRows.length) return;

  // Remove all existing tbody elements directly — avoids the row-index
  // arithmetic that could cause an infinite loop when a tbody is empty.
  Array.from(table.tBodies).forEach(tb => tb.remove());

  const thead = table.createTHead();
  thead.appendChild(allRows[0]);

  const tbody = table.createTBody();
  allRows.slice(1).forEach(r => tbody.appendChild(r));
}

/** Returns header cells from <thead> row 0, whether they are <th> or <td>. */
export function getHeaderCells(table) {
  const row = table.tHead?.rows[0];
  if (!row) return [];
  return Array.from(row.cells); // cells = th + td
}

/** Returns all body rows across every <tbody>. */
export function getBodyRows(table) {
  return Array.from(table.tBodies).flatMap(tb => Array.from(tb.rows));
}

export function isTransformed(table) {
  return table.classList.contains('wte-rich') || table.classList.contains('wte-tree');
}

export function saveSnapshot(table) {
  if (table._wteSnapNode === undefined) {
    // Store a deep clone of the table as a DOM node instead of an innerHTML
    // string. This avoids parsing untrusted HTML on restore and keeps large
    // HTML out of data-* attributes.
    table._wteSnapNode = table.cloneNode(true);
  }
}
