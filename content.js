// WebTable Enhancer — content.js
// Injected into every page. Tracks the last right-clicked element and
// transforms the nearest <table> on command from the background worker.

'use strict';

let lastContextTarget = null;

document.addEventListener('contextmenu', e => {
  lastContextTarget = e.target;
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
  const el = document.createElement('div');
  el.className = 'wte-toast';
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

  // Wipe existing anonymous tbodies so we rebuild cleanly
  while (table.tBodies.length) table.deleteRow(table.tBodies[0].rows[0]?.rowIndex ?? -1);
  Array.from(table.tBodies).forEach(tb => table.removeChild(tb));

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
  ensureStructure(table);

  // Make header cells sortable (works for both <th> and <td> headers)
  getHeaderCells(table).forEach((cell, i) => {
    cell.classList.add('wte-th');
    cell.dataset.col = i;
    cell.dataset.dir = '';
    const arrow = Object.assign(document.createElement('span'), {
      className: 'wte-arrow',
      textContent: '↕'
    });
    cell.appendChild(arrow);
    cell.addEventListener('click', () => sortBy(table, i));
  });

  // Live search filter
  const refreshCount = () => {
    const rows = getBodyRows(table);
    const vis  = rows.filter(r => !r.hidden).length;
    counter.textContent = vis === rows.length
      ? `${rows.length} 件`
      : `${vis} / ${rows.length} 件`;
  };

  search.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    getBodyRows(table).forEach(r => {
      r.hidden = q !== '' && !r.textContent.toLowerCase().includes(q);
    });
    refreshCount();
  });

  refreshCount();
  notify('リッチ表示に変換しました ✓');
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
  });

  th.dataset.dir = next;
  const arrow = th.querySelector('.wte-arrow');
  if (arrow) arrow.textContent = next === 'asc' ? '↑' : next === 'desc' ? '↓' : '↕';

  if (next === '') return; // 3rd click → restore original order not implemented; just reset

  const rows = getBodyRows(table);
  rows.sort((a, b) => cmpCells(a.cells[col], b.cells[col], next === 'asc'));

  // Re-append in sorted order (preserves tbody association)
  const tbody = table.tBodies[0];
  if (tbody) rows.forEach(r => tbody.appendChild(r));
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

function transformToTree(table) {
  if (isTransformed(table)) {
    notify('すでに変換済みです。先に「元に戻す」を実行してください。');
    return;
  }

  saveSnapshot(table);
  ensureStructure(table);

  // Find the level column — searches both <th> and <td> header cells
  const headCells = getHeaderCells(table);
  const lvIdx = headCells.findIndex(c => LEVEL_RE.test(c.textContent.trim()));

  if (lvIdx === -1) {
    notify('レベル列が見つかりません。\nヘッダーに "Level" / "レベル" / "Lv" / "階層" 列が必要です。');
    return;
  }

  table.classList.add('wte-tree');

  const rows = getBodyRows(table);

  // Build node list — cells[lvIdx] works for both <th>/<td> body cells
  const nodes = rows.map(row => ({
    el:       row,
    level:    parseInt(row.cells[lvIdx]?.textContent.trim(), 10) || 1,
    children: [],
    parent:   null,
    open:     true
  }));

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

  // Inject toggle buttons and indentation
  nodes.forEach(node => {
    const cell = node.el.cells[0];
    if (!cell) return;

    const indentPx = 8 + (node.level - 1) * 20;
    cell.style.paddingLeft = `${indentPx}px`;

    if (node.children.length) {
      const btn = document.createElement('button');
      btn.className = 'wte-btn';
      btn.textContent = '−';
      btn.title = '折りたたむ';
      btn.addEventListener('click', e => { e.stopPropagation(); toggleNode(node, btn); });
      cell.insertBefore(btn, cell.firstChild);
    } else {
      // Leaf node — spacer keeps text alignment with parent rows
      const spc = document.createElement('span');
      spc.className = 'wte-spc';
      cell.insertBefore(spc, cell.firstChild);
    }
  });

  notify('ツリー表示に変換しました ✓');
}

function toggleNode(node, btn) {
  const closing = node.open;
  node.open = !closing;
  btn.textContent = closing ? '+' : '−';
  btn.title       = closing ? '展開する' : '折りたたむ';
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
  const wrap = table.closest('.wte-wrap');
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

  notify('元の表示に戻しました ✓');
}
