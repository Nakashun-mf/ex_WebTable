// Core DOM utilities shared across all modules.

import { TOAST_TIMEOUT_MS } from './config.js';

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
  document.body.appendChild(el);

  // Shared remove: cleans up both the element and the keyboard listener.
  const onKey = e => { if (e.key === 'Escape') remove(); };
  const remove = () => {
    if (el.isConnected) el.remove();
    document.removeEventListener('keydown', onKey);
  };

  el.addEventListener('click', remove);
  document.addEventListener('keydown', onKey);
  setTimeout(remove, TOAST_TIMEOUT_MS);
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

/** Returns the cached body-rows array when available, falling back to a live query. */
export function getCachedBodyRows(table) {
  return table._wteBodyRowsCache ?? getBodyRows(table);
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

/** Clones a cell and strips UI chrome elements, returning plain text. */
export function cleanCell(cell) {
  const c = cell.cloneNode(true);
  c.querySelectorAll('.wte-arrow, .wte-btn, .wte-spc, .wte-th-controls, .wte-col-resizer, .wte-filter-btn').forEach(n => n.remove());
  return c.textContent.trim();
}

/**
 * Positions a popup element (already in the DOM) at (x, y), clamped to the
 * viewport. Hides off-screen first so measurement doesn't cause a flash.
 */
export function positionPopup(el, x, y) {
  el.style.visibility = 'hidden';
  el.style.left = '-9999px';
  el.style.top  = '-9999px';
  requestAnimationFrame(() => {
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    el.style.left = `${Math.max(8, Math.min(x, vw - pw - 8))}px`;
    el.style.top  = `${Math.max(8, Math.min(y, vh - ph - 8))}px`;
    el.style.visibility = '';
  });
}

/**
 * Registers a document-level click listener that calls onClose when a click
 * lands outside el. Deferred by one tick so the opening click doesn't
 * immediately trigger it. Self-removes on first outside click.
 */
export function addOutsideClickListener(el, onClose) {
  const handler = e => {
    if (!el.contains(e.target)) {
      onClose();
      document.removeEventListener('click', handler, { capture: true });
    }
  };
  setTimeout(() => document.addEventListener('click', handler, { capture: true }), 0);
}
