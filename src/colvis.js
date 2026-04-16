// Column visibility — show/hide columns and the visibility management panel.

import { getHeaderCells, getBodyRows, getCachedBodyRows, notify } from './utils.js';
import { shiftIndex } from './remap.js';

/** Returns the column index of a header cell (data-col if available, else DOM position). */
export function getThColIdx(table, thEl) {
  if (thEl.dataset.col !== undefined) return parseInt(thEl.dataset.col);
  return getHeaderCells(table).indexOf(thEl);
}

/** Returns the display label for column colIdx (strips UI chrome). */
export function getColLabel(table, colIdx) {
  const th = getHeaderCells(table)[colIdx];
  if (!th) return `列 ${colIdx + 1}`;
  const clone = th.cloneNode(true);
  clone.querySelectorAll('.wte-th-controls, .wte-col-resizer').forEach(n => n.remove());
  return clone.textContent.trim() || `列 ${colIdx + 1}`;
}

/**
 * Applies the current _wteHiddenCols set to the DOM:
 * toggles .wte-col-hidden on every cell, and display:none on <col> elements.
 */
export function applyColVisibility(table) {
  const hidden = table._wteHiddenCols || new Set();
  const allRows = [
    ...(table.tHead ? Array.from(table.tHead.rows) : []),
    ...getCachedBodyRows(table)
  ];
  allRows.forEach(row => {
    Array.from(row.cells).forEach((cell, i) => {
      cell.classList.toggle('wte-col-hidden', hidden.has(i));
    });
  });
  if (table._wteCols) {
    table._wteCols.forEach((col, i) => {
      col.style.display = hidden.has(i) ? 'none' : '';
    });
  }
}

export function hideColumn(table, colIdx) {
  if (!table._wteHiddenCols) table._wteHiddenCols = new Set();
  const totalCols   = getHeaderCells(table).length;
  const hiddenCount = table._wteHiddenCols.size;
  if (hiddenCount >= totalCols - 1) {
    notify('最低1列は表示が必要です。');
    return;
  }
  if (table._wteLvColIdx !== undefined && colIdx === table._wteLvColIdx) {
    notify('ツリーのレベル列は非表示にできません。');
    return;
  }
  table._wteHiddenCols.add(colIdx);
  applyColVisibility(table);
}

export function showColumn(table, colIdx) {
  if (!table._wteHiddenCols) return;
  table._wteHiddenCols.delete(colIdx);
  applyColVisibility(table);
}

export function remapHiddenCols(table, fromIdx, toIdx) {
  if (!table._wteHiddenCols || table._wteHiddenCols.size === 0) return;
  const newHidden = new Set();
  for (const idx of table._wteHiddenCols) newHidden.add(shiftIndex(idx, fromIdx, toIdx));
  table._wteHiddenCols = newHidden;
}

export function hideColVisibilityPanel() {
  document.getElementById('wte-col-vis-panel')?.remove();
}

export function showColVisibilityPanel(table, clientX, clientY) {
  hideColVisibilityPanel();

  const headers = getHeaderCells(table);
  if (!headers.length) return;

  const panel = document.createElement('div');
  panel.id        = 'wte-col-vis-panel';
  panel.className = 'wte-col-vis-panel';

  const title = document.createElement('div');
  title.className   = 'wte-col-vis-title';
  title.textContent = '列の表示 / 非表示';
  panel.appendChild(title);

  const list = document.createElement('div');
  list.className = 'wte-col-vis-list';

  const updateDisabledStates = () => {
    const hiddenCount = table._wteHiddenCols?.size ?? 0;
    const totalCols   = headers.length;
    list.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
      if (table._wteLvColIdx !== undefined && i === table._wteLvColIdx) return;
      cb.disabled = cb.checked && hiddenCount >= totalCols - 1;
    });
  };

  headers.forEach((_, i) => {
    const isHidden   = table._wteHiddenCols?.has(i) ?? false;
    const isLevelCol = table._wteLvColIdx !== undefined && i === table._wteLvColIdx;

    const label = document.createElement('label');
    label.className = 'wte-col-vis-item' + (isLevelCol ? ' wte-col-vis-locked' : '');
    if (isLevelCol) label.title = 'ツリーのレベル列は変更できません';

    const cb     = document.createElement('input');
    cb.type      = 'checkbox';
    cb.checked   = !isHidden;
    cb.disabled  = isLevelCol;

    cb.addEventListener('change', () => {
      if (cb.checked) {
        showColumn(table, i);
      } else {
        hideColumn(table, i);
      }
      updateDisabledStates();
    });

    label.append(cb, '\u00a0' + getColLabel(table, i));
    list.appendChild(label);
  });

  updateDisabledStates(); // Set correct initial disabled state before rendering
  panel.appendChild(list);
  document.body.appendChild(panel);

  // Position (viewport-aware, appears off-screen first for measurement)
  panel.style.visibility = 'hidden';
  panel.style.left = '-9999px';
  panel.style.top  = '-9999px';

  requestAnimationFrame(() => {
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const x  = Math.max(8, Math.min(clientX, vw - pw - 8));
    const y  = Math.max(8, Math.min(clientY, vh - ph - 8));
    panel.style.left       = `${x}px`;
    panel.style.top        = `${y}px`;
    panel.style.visibility = '';
  });

  // Close on outside click (deferred so the opening click doesn't immediately close it)
  const onOutsideClick = e => {
    if (!panel.contains(e.target)) {
      hideColVisibilityPanel();
      document.removeEventListener('click', onOutsideClick, { capture: true });
    }
  };
  setTimeout(() => document.addEventListener('click', onOutsideClick, { capture: true }), 0);
}

/** Returns an array of column indices that are currently visible. */
export function getVisibleColIndices(table) {
  const hidden  = table._wteHiddenCols || new Set();
  const headers = getHeaderCells(table);
  return Array.from({ length: headers.length }, (_, i) => i).filter(i => !hidden.has(i));
}
