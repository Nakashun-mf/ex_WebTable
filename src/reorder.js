// Column reorder via drag-and-drop.

import { getHeaderCells, getBodyRows } from './utils.js';
import { shiftIndex, remapColFilters } from './remap.js';
import { remapHiddenCols } from './colvis.js';

export function addColReorderHandles(table) {
  const headers = getHeaderCells(table);
  if (headers.length < 2) return;

  headers.forEach(th => {
    th.setAttribute('draggable', 'true');

    th.addEventListener('dragstart', e => {
      table._wteDragColIdx = parseInt(th.dataset.col);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', th.dataset.col);
      th.classList.add('wte-col-dragging');
    });

    th.addEventListener('dragend', () => {
      th.classList.remove('wte-col-dragging');
      getHeaderCells(table).forEach(h => h.classList.remove('wte-col-drag-over'));
      table._wteDragColIdx = undefined;
    });

    th.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    th.addEventListener('dragenter', e => {
      e.preventDefault();
      const toIdx = parseInt(th.dataset.col);
      if (table._wteDragColIdx !== undefined && table._wteDragColIdx !== toIdx) {
        getHeaderCells(table).forEach(h => h.classList.remove('wte-col-drag-over'));
        th.classList.add('wte-col-drag-over');
      }
    });

    th.addEventListener('dragleave', () => {
      th.classList.remove('wte-col-drag-over');
    });

    th.addEventListener('drop', e => {
      e.preventDefault();
      th.classList.remove('wte-col-drag-over');
      const fromIdx = table._wteDragColIdx;
      const toIdx   = parseInt(th.dataset.col);
      if (fromIdx === undefined || fromIdx === toIdx) return;
      reorderColumn(table, fromIdx, toIdx);
    });
  });
}

export function reorderColumn(table, fromIdx, toIdx) {
  // Move the cell at fromIdx to toIdx in every row
  const allRows = [
    ...(table.tHead ? Array.from(table.tHead.rows) : []),
    ...getBodyRows(table)
  ];
  allRows.forEach(row => {
    const cells = Array.from(row.cells);
    const cell  = cells[fromIdx];
    const ref   = cells[toIdx];
    if (!cell || !ref) return;
    if (fromIdx < toIdx) ref.after(cell);
    else                 ref.before(cell);
  });

  // Sync colgroup col elements
  if (table._wteCols) {
    const col    = table._wteCols[fromIdx];
    const refCol = table._wteCols[toIdx];
    if (col && refCol) {
      if (fromIdx < toIdx) refCol.after(col);
      else                 refCol.before(col);
    }
    const newCols = [...table._wteCols];
    newCols.splice(fromIdx, 1);
    newCols.splice(toIdx, 0, col);
    table._wteCols = newCols;
  }

  // Re-index dataset.col on all header cells
  getHeaderCells(table).forEach((th, i) => { th.dataset.col = i; });

  // Remap column filter keys to match new column positions
  remapColFilters(table, fromIdx, toIdx);

  // Remap hidden column indices
  remapHiddenCols(table, fromIdx, toIdx);

  // Remap Level column index (tree view)
  if (table._wteLvColIdx !== undefined) {
    table._wteLvColIdx = shiftIndex(table._wteLvColIdx, fromIdx, toIdx);
  }
}
