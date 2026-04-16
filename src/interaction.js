// Row interaction — click-to-select, Shift/Ctrl multi-select, double-click highlight.

import { getBodyRows, isTransformed } from './utils.js';

export function setupTableInteraction(table) {
  if (table._wteInteractionSetup) return;
  table._wteInteractionSetup = true;

  // Click → row selection (single / Shift-range / Ctrl-toggle)
  table.addEventListener('click', e => {
    if (!isTransformed(table)) return;
    if (e.target.classList.contains('wte-btn')) return;
    const row = e.target.closest('tbody tr');
    if (!row || row.hidden) return;

    if (e.shiftKey && table._wteLastClickedRow) {
      rangeSelect(table, row);
    } else if (e.ctrlKey || e.metaKey) {
      row.classList.toggle('wte-selected');
      table._wteLastClickedRow = row;
    } else {
      clearSelection(table);
      row.classList.add('wte-selected');
      table._wteLastClickedRow = row;
    }
  });

  // Double-click → toggle highlight
  table.addEventListener('dblclick', e => {
    if (!isTransformed(table)) return;
    if (e.target.classList.contains('wte-btn')) return;
    const row = e.target.closest('tbody tr');
    if (!row || row.hidden) return;
    row.classList.toggle('wte-highlight');
  });
}

export function clearSelection(table) {
  table.querySelectorAll('tbody tr.wte-selected').forEach(r => r.classList.remove('wte-selected'));
}

export function rangeSelect(table, targetRow) {
  const rows     = getBodyRows(table).filter(r => !r.hidden);
  const startIdx = rows.indexOf(table._wteLastClickedRow);
  const endIdx   = rows.indexOf(targetRow);
  if (startIdx === -1 || endIdx === -1) return;
  clearSelection(table);
  const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  rows.slice(from, to + 1).forEach(r => r.classList.add('wte-selected'));
}
