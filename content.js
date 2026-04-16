// WebTable Enhancer — content.js
// Injected into every page. Tracks the last right-clicked element and
// transforms the nearest <table> on command from the background worker.

'use strict';

let lastContextTarget = null;

document.addEventListener('contextmenu', e => {
  lastContextTarget = e.target;

  // Show custom in-page menu for already-converted tables
  const wrap  = e.target.closest('.wte-wrap');
  let ctxTable;
  if (wrap) {
    ctxTable = wrap.querySelector(':scope > .wte-rich, :scope > .wte-tree');
  } else {
    const t  = findTable(e.target);
    ctxTable = (t && isTransformed(t)) ? t : null;
  }
  if (ctxTable) {
    e.preventDefault();
    showMenu(e.clientX, e.clientY, ctxTable, e.target.closest('tbody tr') || null);
  }
});

chrome.runtime.onMessage.addListener(msg => {
  if (!['wte-rich', 'wte-tree', 'wte-reset'].includes(msg.action)) return;

  const table = findTable(lastContextTarget);
  if (!table) {
    notify('テーブルの上で右クリックしてください。');
    return;
  }

  if (msg.action === 'wte-rich')  transformToRich(table);
  if (msg.action === 'wte-tree')  transformToTree(table);
  if (msg.action === 'wte-reset') resetTable(table);
});

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function findTable(el) {
  if (!el) return null;
  return el.tagName === 'TABLE' ? el : el.closest('table');
}

function notify(text) {
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
function ensureStructure(table) {
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
function getHeaderCells(table) {
  const row = table.tHead?.rows[0];
  if (!row) return [];
  return Array.from(row.cells); // cells = th + td
}

/** Returns all body rows across every <tbody>. */
function getBodyRows(table) {
  return Array.from(table.tBodies).flatMap(tb => Array.from(tb.rows));
}

function isTransformed(table) {
  return table.classList.contains('wte-rich') || table.classList.contains('wte-tree');
}

function saveSnapshot(table) {
  if (table.dataset.wteSnap === undefined) {
    table.dataset.wteSnap  = table.innerHTML;
    table.dataset.wteStyle = table.getAttribute('style') ?? '';
  }
}

/* ─── Feature 1 : Rich Table ───────────────────────────────────────────── */

function transformToRich(table) {
  if (isTransformed(table)) {
    notify('すでに変換済みです。先に「元に戻す」を実行してください。');
    return;
  }

  saveSnapshot(table);

  // Wrap in container
  const wrap = document.createElement('div');
  wrap.className = 'wte-wrap';
  table.before(wrap);

  const toolbar = document.createElement('div');
  toolbar.className = 'wte-toolbar';

  const search = Object.assign(document.createElement('input'), {
    type: 'text',
    className: 'wte-search',
    placeholder: '🔍  テーブルを検索…'
  });
  const counter = Object.assign(document.createElement('span'), { className: 'wte-counter' });

  toolbar.append(search, counter);
  wrap.append(toolbar, table);

  table.classList.add('wte-rich');
  table._wteColFilters  = {};
  table._wteSearchQuery = '';
  ensureStructure(table);

  // Make header cells sortable with two-row layout (label + controls)
  getHeaderCells(table).forEach((cell, i) => {
    cell.classList.add('wte-th');
    cell.dataset.col = i;
    cell.dataset.dir = '';
    cell.setAttribute('tabindex', '0');
    cell.setAttribute('role', 'columnheader');
    cell.setAttribute('aria-sort', 'none');

    // Wrap existing text content in a label div
    const labelEl = document.createElement('div');
    labelEl.className = 'wte-th-label';
    while (cell.firstChild) labelEl.appendChild(cell.firstChild);

    // Controls row: sort arrow + filter button
    const controlsEl = document.createElement('div');
    controlsEl.className = 'wte-th-controls';

    const arrow = Object.assign(document.createElement('span'), {
      className: 'wte-arrow',
      ariaHidden: 'true',
      textContent: '↕'
    });

    const filterBtn = document.createElement('button');
    filterBtn.className = 'wte-filter-btn';
    filterBtn.textContent = '▼';
    filterBtn.title = '列フィルター';

    controlsEl.append(arrow, filterBtn);
    cell.append(labelEl, controlsEl);

    // Sort on cell click (filter button stops propagation so sort won't fire)
    cell.addEventListener('click', () => sortBy(table, parseInt(cell.dataset.col)));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sortBy(table, parseInt(cell.dataset.col));
      }
    });

    // Filter button opens column filter panel
    filterBtn.addEventListener('click', e => {
      e.stopPropagation();
      showColFilterPanel(table, parseInt(cell.dataset.col), cell);
    });
  });

  // Live search filter
  const applyStripes = () => {
    let n = 0;
    getBodyRows(table).forEach(r => {
      if (!r.hidden) n++;
      r.classList.toggle('wte-stripe', !r.hidden && n % 2 === 0);
    });
  };
  table._wteApplyStripes = applyStripes;

  const refreshCount = () => {
    const rows = getBodyRows(table);
    const vis  = rows.filter(r => !r.hidden).length;
    counter.textContent = vis === rows.length
      ? `${rows.length} 件`
      : `${vis} / ${rows.length} 件`;
  };
  table._wteRefreshCount = refreshCount;

  search.addEventListener('input', () => {
    table._wteSearchQuery = search.value;
    applyAllFilters(table);
  });

  refreshCount();
  applyStripes();
  setupTableInteraction(table);
  addColResizeHandles(table);
  addColReorderHandles(table);
  notify('リッチ表示に変換しました ✓');
}

/* ─── Combined filter application ─────────────────────────────────────── */

/** Apply global search + all active column filters together. */
function applyAllFilters(table) {
  const colFilters    = table._wteColFilters || {};
  const searchQ       = (table._wteSearchQuery || '').toLowerCase();
  const hasColFilters = Object.keys(colFilters).length > 0;

  getBodyRows(table).forEach(row => {
    let visible = true;

    // Global text search
    if (searchQ && !row.textContent.toLowerCase().includes(searchQ)) {
      visible = false;
    }

    // Column-level checkbox filters
    if (visible && hasColFilters) {
      for (const [idxStr, filter] of Object.entries(colFilters)) {
        const cell     = row.cells[parseInt(idxStr)];
        const cellText = cell?.textContent.trim() ?? '';
        if (filter.checkedValues && !filter.checkedValues.has(cellText)) {
          visible = false;
          break;
        }
      }
    }

    row.hidden = !visible;
  });

  if (typeof table._wteApplyStripes   === 'function') table._wteApplyStripes();
  if (typeof table._wteRefreshCount   === 'function') table._wteRefreshCount();
}

/* ─── Column filter panel ──────────────────────────────────────────────── */

function hideColFilterPanel() {
  document.getElementById('wte-col-filter-panel')?.remove();
}

function showColFilterPanel(table, colIdx, th) {
  // Toggle: clicking the same column's button again closes the panel
  const existing = document.getElementById('wte-col-filter-panel');
  if (existing) {
    const isSame = existing._wteColIdx === colIdx && existing._wteTable === table;
    hideColFilterPanel();
    if (isSame) return;
  }

  // Collect unique values from this column across all body rows
  const rows = getBodyRows(table);
  const uniqueValues = [...new Set(
    rows.map(r => r.cells[colIdx]?.textContent.trim() ?? '')
  )].sort((a, b) => a.localeCompare(b, 'ja'));

  // Current active values (default = all selected)
  const currentFilter = (table._wteColFilters || {})[colIdx];
  const activeValues  = currentFilter?.checkedValues
    ? new Set(currentFilter.checkedValues)
    : new Set(uniqueValues);

  // ── Build panel ────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id         = 'wte-col-filter-panel';
  panel.className  = 'wte-col-filter-panel';
  panel._wteTable  = table;
  panel._wteColIdx = colIdx;

  // Search input — filters the checkbox list (not table rows directly)
  const searchInput = document.createElement('input');
  searchInput.type        = 'text';
  searchInput.className   = 'wte-filter-search';
  searchInput.placeholder = '値を検索…';

  // Select-all / deselect-all row
  const selectRow     = document.createElement('div');
  selectRow.className = 'wte-filter-select-row';

  const selectAllBtn    = document.createElement('button');
  selectAllBtn.className = 'wte-filter-select-all';
  selectAllBtn.textContent = '全選択';

  const deselectAllBtn     = document.createElement('button');
  deselectAllBtn.className = 'wte-filter-select-all';
  deselectAllBtn.textContent = '全解除';

  selectRow.append(selectAllBtn, deselectAllBtn);

  // Scrollable checkbox list
  const listEl     = document.createElement('div');
  listEl.className = 'wte-filter-list';

  const renderList = (filterText = '') => {
    listEl.innerHTML = '';
    const q        = filterText.toLowerCase();
    const filtered = uniqueValues.filter(v => !q || v.toLowerCase().includes(q));
    filtered.forEach(val => {
      const label     = document.createElement('label');
      label.className = 'wte-filter-item';

      const cb   = document.createElement('input');
      cb.type    = 'checkbox';
      cb.value   = val;
      cb.checked = activeValues.has(val);
      cb.addEventListener('change', () => {
        if (cb.checked) activeValues.add(val);
        else            activeValues.delete(val);
      });

      label.append(cb, document.createTextNode('\u00a0' + (val === '' ? '(空)' : val)));
      listEl.appendChild(label);
    });
  };

  renderList();
  searchInput.addEventListener('input', () => renderList(searchInput.value));

  selectAllBtn.addEventListener('click', () => {
    uniqueValues.forEach(v => activeValues.add(v));
    renderList(searchInput.value);
  });
  deselectAllBtn.addEventListener('click', () => {
    activeValues.clear();
    renderList(searchInput.value);
  });

  // Button row: Clear + Apply
  const btnRow     = document.createElement('div');
  btnRow.className = 'wte-filter-btn-row';

  const clearBtn     = document.createElement('button');
  clearBtn.className = 'wte-filter-clear';
  clearBtn.textContent = 'クリア';

  const applyBtn     = document.createElement('button');
  applyBtn.className = 'wte-filter-apply';
  applyBtn.textContent = '適用';

  clearBtn.addEventListener('click', () => {
    if (!table._wteColFilters) table._wteColFilters = {};
    delete table._wteColFilters[colIdx];
    th.querySelector('.wte-filter-btn')?.classList.remove('wte-filter-active');
    applyAllFilters(table);
    hideColFilterPanel();
  });

  applyBtn.addEventListener('click', () => {
    if (!table._wteColFilters) table._wteColFilters = {};
    if (activeValues.size >= uniqueValues.length) {
      // All values selected = effectively no filter
      delete table._wteColFilters[colIdx];
      th.querySelector('.wte-filter-btn')?.classList.remove('wte-filter-active');
    } else {
      table._wteColFilters[colIdx] = { checkedValues: new Set(activeValues) };
      th.querySelector('.wte-filter-btn')?.classList.add('wte-filter-active');
    }
    applyAllFilters(table);
    hideColFilterPanel();
  });

  btnRow.append(clearBtn, applyBtn);
  panel.append(searchInput, selectRow, listEl, btnRow);
  document.body.appendChild(panel);

  // ── Position (fixed, viewport coords) ─────────────────────────────────
  const rect   = th.getBoundingClientRect();
  const vw     = window.innerWidth;
  const vh     = window.innerHeight;
  const panelW = 220;

  let left = rect.left;
  let top  = rect.bottom + 2;
  panel.style.left = `${left}px`;
  panel.style.top  = `${top}px`;

  // Adjust after layout is known
  requestAnimationFrame(() => {
    const panelH = panel.offsetHeight;
    if (left + panelW > vw - 8) left = vw - panelW - 8;
    if (top  + panelH > vh - 8) top  = rect.top - panelH - 2;
    panel.style.left = `${Math.max(8, left)}px`;
    panel.style.top  = `${Math.max(8, top)}px`;
  });

  // Close on outside click (defer by one tick so the opening click doesn't close it)
  const onOutsideClick = e => {
    if (!panel.contains(e.target)) {
      hideColFilterPanel();
      document.removeEventListener('click', onOutsideClick, { capture: true });
    }
  };
  setTimeout(() => document.addEventListener('click', onOutsideClick, { capture: true }), 0);
}

/* ─── Column filter index remapping after reorder ──────────────────────── */

/**
 * When a column is moved from fromIdx to toIdx, update the keys in
 * _wteColFilters so they match the new column positions.
 */
function remapColFilters(table, fromIdx, toIdx) {
  if (!table._wteColFilters || Object.keys(table._wteColFilters).length === 0) return;
  const newFilters = {};
  for (const [idxStr, filter] of Object.entries(table._wteColFilters)) {
    const idx = parseInt(idxStr);
    let newIdx = idx;
    if (idx === fromIdx) {
      newIdx = toIdx;
    } else if (fromIdx < toIdx && idx > fromIdx && idx <= toIdx) {
      newIdx = idx - 1;
    } else if (fromIdx > toIdx && idx >= toIdx && idx < fromIdx) {
      newIdx = idx + 1;
    }
    newFilters[newIdx] = filter;
  }
  table._wteColFilters = newFilters;
}

/* ─── Column Resize ────────────────────────────────────────────────────── */

function addColResizeHandles(table) {
  const headers = getHeaderCells(table);
  if (!headers.length) return;

  // Add handle elements immediately; set up colgroup after layout is computed
  headers.forEach(th => {
    const handle = document.createElement('div');
    handle.className = 'wte-col-resizer';
    th.appendChild(handle);
  });

  // Wait for layout so offsetWidth values are accurate
  requestAnimationFrame(() => {
    // Build colgroup with captured column widths
    let colgroup = table.querySelector(':scope > colgroup');
    if (!colgroup) {
      colgroup = document.createElement('colgroup');
      table.insertBefore(colgroup, table.firstChild);
    } else {
      colgroup.innerHTML = '';
    }
    const cols = headers.map(th => {
      const col = document.createElement('col');
      col.style.width = `${th.offsetWidth}px`;
      colgroup.appendChild(col);
      return col;
    });
    table._wteCols = cols;
    table.style.tableLayout = 'fixed';

    // Wire up drag events now that cols are ready
    headers.forEach((th, i) => {
      const handle = th.querySelector('.wte-col-resizer');
      if (!handle) return;

      handle.addEventListener('mousedown', e => {
        e.stopPropagation();
        e.preventDefault();
        const col = table._wteCols[i];
        if (!col) return;
        const startX = e.clientX;
        const startW = th.offsetWidth;
        handle.classList.add('wte-resizing');
        const prevCursor = document.body.style.cursor;
        const prevSelect = document.body.style.userSelect;
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = ev => {
          const newW = Math.max(40, startW + ev.clientX - startX);
          col.style.width = `${newW}px`;
        };
        const onUp = () => {
          handle.classList.remove('wte-resizing');
          document.body.style.cursor     = prevCursor;
          document.body.style.userSelect = prevSelect;
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      // Prevent resize handle click from triggering column sort
      handle.addEventListener('click', e => e.stopPropagation());
    });
  });
}

/* ─── Column Reorder ───────────────────────────────────────────────────── */

function addColReorderHandles(table) {
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

function reorderColumn(table, fromIdx, toIdx) {
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
}

function sortBy(table, col) {
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
  if (typeof table._wteApplyStripes === 'function') table._wteApplyStripes();
}

function cmpCells(a, b, asc) {
  const av = a?.textContent.trim() ?? '';
  const bv = b?.textContent.trim() ?? '';
  const sign = asc ? 1 : -1;

  const an = parseNum(av), bn = parseNum(bv);
  if (an !== null && bn !== null) return sign * (an - bn);

  const ad = Date.parse(av), bd = Date.parse(bv);
  if (!isNaN(ad) && !isNaN(bd)) return sign * (ad - bd);

  return sign * av.localeCompare(bv, 'ja');
}

function parseNum(s) {
  const n = parseFloat(s.replace(/[,，¥$€£%\s]/g, ''));
  return isNaN(n) ? null : n;
}

/* ─── Feature 2 : Tree Table ───────────────────────────────────────────── */

// Matches common level-column header names (th OR td)
const LEVEL_RE = /^(level|レベル|階層|lv\.?|depth|深さ)$/i;

/**
 * Returns the indent level encoded by leading underscores (or full-width
 * spaces / ideographic spaces) in `text`.
 * e.g.  "root"   → 1,  "_child" → 2,  "__grand" → 3
 */
function underscoreLevel(text) {
  const m = text.match(/^[_\u3000\u00a0 ]*/);
  return (m ? m[0].length : 0) + 1;
}

/** Strip leading indent characters from the first text node inside `cell`. */
function stripIndentPrefix(cell) {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode();
  if (node) node.textContent = node.textContent.replace(/^[_\u3000\u00a0 ]+/, '');
}

function transformToTree(table) {
  if (isTransformed(table)) {
    notify('すでに変換済みです。先に「元に戻す」を実行してください。');
    return;
  }

  saveSnapshot(table);
  ensureStructure(table);

  const headCells = getHeaderCells(table);
  const lvIdx     = headCells.findIndex(c => LEVEL_RE.test(c.textContent.trim()));
  const rows      = getBodyRows(table);

  let nodes;
  let indentMode = false;

  if (lvIdx !== -1) {
    // ── Level-column mode ──────────────────────────────────────────────
    nodes = rows.map(row => {
      const cellText = row.cells[lvIdx]?.textContent.trim() ?? '';
      const raw = parseInt(cellText, 10);
      // Use numeric value if valid (≥1). Otherwise fall back to
      // underscore-indent counting so values like "0", "_1", "__2" work.
      const level = (!isNaN(raw) && raw >= 1) ? raw : underscoreLevel(cellText);
      return { el: row, level, children: [], parent: null, open: true };
    });
  } else {
    // ── Underscore-indent mode  (e.g. "0", "_1", "__2") ───────────────
    const hasIndent = rows.some(
      row => /^[_\u3000\u00a0 ]+/.test(row.cells[0]?.textContent.trim() ?? '')
    );
    if (!hasIndent) {
      notify(
        'レベル列が見つかりません。\n' +
        'ヘッダーに "Level" / "レベル" / "Lv" / "階層" 列、\n' +
        'または先頭列の値を "_" で字下げしてください。'
      );
      return;
    }
    indentMode = true;
    nodes = rows.map(row => ({
      el:       row,
      level:    underscoreLevel(row.cells[0]?.textContent.trim() ?? ''),
      children: [],
      parent:   null,
      open:     true
    }));
  }

  table.classList.add('wte-tree');

  // Wrap in scrollable container
  const wrap = document.createElement('div');
  wrap.className = 'wte-tree-wrap';
  table.before(wrap);
  wrap.appendChild(table);

  // Stack-based O(n) parent-child linking
  const stack = [];
  nodes.forEach(node => {
    while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
    if (stack.length) {
      node.parent = stack[stack.length - 1];
      node.parent.children.push(node);
    }
    stack.push(node);
  });

  // Persist nodes for expand/collapse operations
  table._wteNodes = nodes;

  // Strip indent prefixes before injecting buttons (indent mode only)
  if (indentMode) {
    nodes.forEach(node => {
      const cell = node.el.cells[0];
      if (cell) stripIndentPrefix(cell);
    });
  }

  // Inject indentation and toggle button / leaf spacer
  nodes.forEach(node => {
    const cell = node.el.cells[0];
    if (!cell) return;

    // Apply indentation via CSS custom property (overrides !important padding)
    const indentPx = 8 + (node.level - 1) * 20;
    cell.style.setProperty('--wte-indent', `${indentPx}px`);

    if (node.children.length) {
      const btn = document.createElement('button');
      btn.className = 'wte-btn';
      btn.textContent = '−';
      btn.title = '折りたたむ';
      btn.setAttribute('aria-expanded', 'true');
      btn.addEventListener('click', e => { e.stopPropagation(); toggleNode(node, btn); });
      cell.insertBefore(btn, cell.firstChild);
    } else {
      // Leaf node — spacer keeps text aligned with toggle-button rows
      const spc = document.createElement('span');
      spc.className = 'wte-spc';
      cell.insertBefore(spc, cell.firstChild);
    }
  });

  setupTableInteraction(table);
  addColResizeHandles(table);
  addColReorderHandles(table);
  notify('ツリー表示に変換しました ✓');
}

/* ─── Tree Expand / Collapse ───────────────────────────────────────────── */

function expandAll(table) {
  const nodes = table._wteNodes;
  if (!nodes) return;
  nodes.forEach(node => {
    node.el.hidden = false;
    if (node.children.length) {
      node.open = true;
      const btn = node.el.cells[0]?.querySelector('.wte-btn');
      if (btn) { btn.textContent = '−'; btn.title = '折りたたむ'; btn.setAttribute('aria-expanded', 'true'); }
    }
  });
}

function collapseAll(table) {
  const nodes = table._wteNodes;
  if (!nodes) return;
  nodes.forEach(node => {
    if (node.parent) node.el.hidden = true;
    if (node.children.length) {
      node.open = false;
      const btn = node.el.cells[0]?.querySelector('.wte-btn');
      if (btn) { btn.textContent = '+'; btn.title = '展開する'; btn.setAttribute('aria-expanded', 'false'); }
    }
  });
}

function expandToLevel(table, maxLevel) {
  const nodes = table._wteNodes;
  if (!nodes) return;
  nodes.forEach(node => {
    node.el.hidden = node.level > maxLevel;
    if (node.children.length) {
      const open = node.level < maxLevel;
      node.open  = open;
      const btn  = node.el.cells[0]?.querySelector('.wte-btn');
      if (btn) {
        btn.textContent = open ? '−' : '+';
        btn.title       = open ? '折りたたむ' : '展開する';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    }
  });
}

function toggleNode(node, btn) {
  const closing = node.open;
  node.open = !closing;
  btn.textContent = closing ? '+' : '−';
  btn.title       = closing ? '展開する' : '折りたたむ';
  btn.setAttribute('aria-expanded', closing ? 'false' : 'true');
  applyVisibility(node.children, !closing);
}

/** Recursively show/hide descendants, respecting each node's open state. */
function applyVisibility(children, show) {
  children.forEach(c => {
    c.el.hidden = !show;
    // Recurse: only reveal grandchildren if this child was left open
    applyVisibility(c.children, show && c.open);
  });
}

/* ─── Reset ────────────────────────────────────────────────────────────── */

function resetTable(table) {
  if (table.dataset.wteSnap === undefined) {
    notify('このテーブルはまだ変換されていません。');
    return;
  }

  // Move table out of wrapper before destroying it
  const wrap = table.closest('.wte-wrap, .wte-tree-wrap');
  if (wrap) {
    wrap.before(table);
    wrap.remove();
  }

  // Restore original inner HTML and attributes
  table.innerHTML = table.dataset.wteSnap;
  const origStyle = table.dataset.wteStyle;
  if (origStyle) table.setAttribute('style', origStyle);
  else table.removeAttribute('style');

  table.classList.remove('wte-rich', 'wte-tree');
  delete table.dataset.wteSnap;
  delete table.dataset.wteStyle;
  delete table._wteOriginalOrder;
  delete table._wteApplyStripes;
  delete table._wteInteractionSetup;
  delete table._wteLastClickedRow;
  delete table._wteCols;
  delete table._wteNodes;
  delete table._wteColFilters;
  delete table._wteSearchQuery;
  delete table._wteRefreshCount;
  hideColFilterPanel();

  notify('元の表示に戻しました ✓');
}

/* ─── Custom Context Menu ───────────────────────────────────────────────── */

// Close menu on outside click / Escape / scroll
document.addEventListener('click', e => {
  const menu = document.getElementById('wte-ctx-menu');
  if (menu && !menu.hidden && !menu.contains(e.target)) hideMenu();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideMenu();
    hideColFilterPanel();
    // 変換済みテーブルの行選択をすべて解除
    document.querySelectorAll('.wte-rich, .wte-tree').forEach(t => clearSelection(t));
  }
});
window.addEventListener('scroll', () => { hideMenu(); hideColFilterPanel(); }, { passive: true, capture: true });

function getOrCreateMenu() {
  let menu = document.getElementById('wte-ctx-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id        = 'wte-ctx-menu';
    menu.className = 'wte-ctx-menu';
    menu.hidden    = true;
    document.body.appendChild(menu);
  }
  return menu;
}

function hideMenu() {
  const menu = document.getElementById('wte-ctx-menu');
  if (menu) menu.hidden = true;
}

function showMenu(clientX, clientY, table, row) {
  const selectedRows = getSelectedRows(table);

  // Determine which rows actions should apply to
  let targets;
  if (row) {
    targets = selectedRows.has(row) ? selectedRows : new Set([row]);
  } else {
    targets = selectedRows;
  }

  const hasTargets = targets.size > 0;
  const allHighlit = hasTargets && [...targets].every(r => r.classList.contains('wte-highlight'));
  const isRich     = table.classList.contains('wte-rich');

  const menu = getOrCreateMenu();
  menu.innerHTML = '';

  // ① Highlight
  menu.appendChild(makeMenuItem(
    allHighlit ? 'ハイライトを解除' : '行をハイライト',
    () => { targets.forEach(r => r.classList.toggle('wte-highlight', !allHighlit)); hideMenu(); },
    !hasTargets
  ));

  menu.appendChild(makeSep());

  // ② Copy
  menu.appendChild(makeMenuItem('選択した行をコピー', () => {
    copyRowsAsTSV([...targets], false, table); hideMenu();
  }, !hasTargets));
  menu.appendChild(makeMenuItem('ヘッダーと選択した行をコピー', () => {
    copyRowsAsTSV([...targets], true, table); hideMenu();
  }, !hasTargets));

  menu.appendChild(makeSep());

  // ③ Text-wrap mode toggle (both rich and tree)
  const isWrapMode = table.classList.contains('wte-wrap-mode');
  menu.appendChild(makeMenuItem(
    isWrapMode ? 'はみ出し表示にする（改行なし）' : '画面内に収める（改行あり）',
    () => {
      const enabling = !table.classList.contains('wte-wrap-mode');
      table.classList.toggle('wte-wrap-mode');
      // Expand wrapper to full width in wrap mode so table can fill it
      const wrapEl = table.closest('.wte-wrap, .wte-tree-wrap');
      if (wrapEl) wrapEl.style.width = enabling ? '100%' : '';
      hideMenu();
    }
  ));

  menu.appendChild(makeSep());

  // ④ Switch view
  menu.appendChild(makeMenuItem(
    isRich ? 'ツリー表示に変換' : 'リッチ表示に変換',
    () => {
      resetTable(table);
      if (isRich) transformToTree(table);
      else        transformToRich(table);
      hideMenu();
    }
  ));

  // ⑤ Tree expand / collapse (tree only)
  if (!isRich && table._wteNodes) {
    const maxLv = Math.max(...table._wteNodes.map(n => n.level));
    menu.appendChild(makeSep());
    menu.appendChild(makeMenuItem('全展開', () => { expandAll(table); hideMenu(); }));
    menu.appendChild(makeMenuItem('全折畳み', () => { collapseAll(table); hideMenu(); }));
    for (let lv = 1; lv < maxLv; lv++) {
      const level = lv;
      menu.appendChild(makeMenuItem(
        `レベル${level}まで展開`,
        () => { expandToLevel(table, level); hideMenu(); }
      ));
    }
  }

  menu.appendChild(makeSep());

  // Reset
  menu.appendChild(makeMenuItem('元に戻す', () => { resetTable(table); hideMenu(); }));

  // Measure off-screen then position
  menu.style.visibility = 'hidden';
  menu.style.left = '-9999px';
  menu.style.top  = '-9999px';
  menu.hidden = false;

  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x  = Math.max(8, Math.min(clientX, vw - mw - 8));
  const y  = Math.max(8, Math.min(clientY, vh - mh - 8));

  menu.style.left       = `${x}px`;
  menu.style.top        = `${y}px`;
  menu.style.visibility = '';
}

function makeMenuItem(label, onClick, disabled = false) {
  const el = document.createElement('div');
  el.className = disabled ? 'wte-ctx-item wte-ctx-disabled' : 'wte-ctx-item';
  el.textContent = label;
  if (!disabled) el.addEventListener('click', e => { e.stopPropagation(); onClick(); });
  return el;
}

function makeSep() {
  const el = document.createElement('div');
  el.className = 'wte-ctx-sep';
  return el;
}

function getSelectedRows(table) {
  return new Set(table.querySelectorAll('tbody tr.wte-selected'));
}

function copyRowsAsTSV(rows, includeHeader, table) {
  const visibleRows = rows.filter(r => !r.hidden);
  if (!visibleRows.length) { notify('コピーする行がありません。'); return; }

  const esc  = s => s.replace(/[\t\n]/g, ' ');
  const text = cell => {
    const c = cell.cloneNode(true);
    c.querySelectorAll('.wte-arrow, .wte-btn, .wte-spc, .wte-th-controls').forEach(n => n.remove());
    return esc(c.textContent.trim());
  };

  const lines = [];
  if (includeHeader) lines.push(getHeaderCells(table).map(text).join('\t'));
  visibleRows.forEach(r => lines.push(Array.from(r.cells).map(text).join('\t')));

  const tsvText = lines.join('\n');
  const count   = visibleRows.length;

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(tsvText)
      .then(() => notify(`${count} 行をコピーしました ✓`))
      .catch(() => fallbackCopy(tsvText, count));
  } else {
    fallbackCopy(tsvText, count);
  }
}

/** HTTP ページなど clipboard API が使えない環境向けフォールバック */
function fallbackCopy(text, rowCount) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    notify(ok ? `${rowCount} 行をコピーしました ✓` : 'コピーに失敗しました。');
  } catch {
    notify('コピーに失敗しました。');
  } finally {
    ta.remove();
  }
}

/* ─── Row Interaction (selection & highlight) ──────────────────────────── */

function setupTableInteraction(table) {
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

function clearSelection(table) {
  table.querySelectorAll('tbody tr.wte-selected').forEach(r => r.classList.remove('wte-selected'));
}

function rangeSelect(table, targetRow) {
  const rows     = getBodyRows(table).filter(r => !r.hidden);
  const startIdx = rows.indexOf(table._wteLastClickedRow);
  const endIdx   = rows.indexOf(targetRow);
  if (startIdx === -1 || endIdx === -1) return;
  clearSelection(table);
  const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  rows.slice(from, to + 1).forEach(r => r.classList.add('wte-selected'));
}
