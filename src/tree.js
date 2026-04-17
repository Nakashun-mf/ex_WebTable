// Tree table transformation — hierarchical expand/collapse view.

import {
  getHeaderCells, getBodyRows, ensureStructure,
  isTransformed, saveSnapshot, notify
} from './utils.js';
import { addColResizeHandles } from './resize.js';
import { addColReorderHandles } from './reorder.js';
import { setupTableInteraction } from './interaction.js';

// Matches common level-column header names (th OR td).
// Covers English abbreviations (lvl, lv, tier, rank, indent, node, step, depth)
// and Japanese terms (レベル, 階層, 深さ, 深度, 段階, ノード).
export const LEVEL_RE = /^(level|lvl|lv\.?|tier|rank|indent|node|step|depth|レベル|階層|深さ|深度|段階|ノード)$/i;

/**
 * Returns the indent level encoded by leading underscores (or full-width
 * spaces / ideographic spaces) in `text`.
 * e.g.  "root"   → 1,  "_child" → 2,  "__grand" → 3
 */
export function underscoreLevel(text) {
  const m = text.match(/^[_\u3000\u00a0 ]*/);
  return (m ? m[0].length : 0) + 1;
}

/** Strip leading indent characters from the first text node inside `cell`. */
export function stripIndentPrefix(cell) {
  const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode();
  if (node) node.textContent = node.textContent.replace(/^[_\u3000\u00a0 ]+/, '');
}

export function transformToTree(table) {
  if (isTransformed(table)) {
    notify('すでに変換済みです。先に「元に戻す」を実行してください。');
    return;
  }

  saveSnapshot(table);
  ensureStructure(table);

  // Initialize dataset.col on each header cell so that addColReorderHandles
  // can read the column index from dragstart/drop events (rich.js does this
  // in its own setup loop; tree mode needs it too).
  getHeaderCells(table).forEach((cell, i) => { cell.dataset.col = i; });

  const headCells = getHeaderCells(table);
  const lvIdx     = headCells.findIndex(c => LEVEL_RE.test(c.textContent.trim()));
  const rows      = getBodyRows(table);
  if (lvIdx !== -1) table._wteLvColIdx = lvIdx;

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
        '対応列名: Level / Lvl / Lv / Tier / Rank / Indent / Node / Step / Depth\n' +
        '　　　　　レベル / 階層 / 深さ / 深度 / 段階 / ノード\n' +
        'または先頭列の値を「_」で字下げしてください。'
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

  // Wrap in scrollable container with toolbar
  const wrap = document.createElement('div');
  wrap.className = 'wte-tree-wrap';
  table.before(wrap);

  const toolbar = document.createElement('div');
  toolbar.className = 'wte-toolbar';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.className = 'wte-search';
  searchInput.placeholder = 'フィルター...';
  searchInput.setAttribute('aria-label', 'ツリーをフィルター');
  toolbar.appendChild(searchInput);
  wrap.appendChild(toolbar);

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

  // Wire up filter input
  let filterTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => applyTreeFilter(table, searchInput.value), 150);
  });

  setupTableInteraction(table);
  addColResizeHandles(table);
  addColReorderHandles(table);
  notify('ツリー表示に変換しました ✓');
}

// ── Expand / Collapse ──────────────────────────────────────────────────────

function setToggleBtn(btn, open) {
  btn.textContent = open ? '−' : '+';
  btn.title       = open ? '折りたたむ' : '展開する';
  btn.setAttribute('aria-expanded', String(open));
}

export function expandAll(table) {
  const nodes = table._wteNodes;
  if (!nodes) return;
  nodes.forEach(node => {
    node.el.hidden = false;
    if (node.children.length) {
      node.open = true;
      const btn = node.el.cells[0]?.querySelector('.wte-btn');
      if (btn) setToggleBtn(btn, true);
    }
  });
}

export function collapseAll(table) {
  const nodes = table._wteNodes;
  if (!nodes) return;
  nodes.forEach(node => {
    if (node.parent) node.el.hidden = true;
    if (node.children.length) {
      node.open = false;
      const btn = node.el.cells[0]?.querySelector('.wte-btn');
      if (btn) setToggleBtn(btn, false);
    }
  });
}

export function expandToLevel(table, maxLevel) {
  const nodes = table._wteNodes;
  if (!nodes) return;
  nodes.forEach(node => {
    node.el.hidden = node.level > maxLevel;
    if (node.children.length) {
      const open = node.level < maxLevel;
      node.open  = open;
      const btn  = node.el.cells[0]?.querySelector('.wte-btn');
      if (btn) setToggleBtn(btn, open);
    }
  });
}

export function toggleNode(node, btn) {
  node.open = !node.open;
  setToggleBtn(btn, node.open);
  applyVisibility(node.children, node.open);
}

/** Recursively show/hide descendants, respecting each node's open state. */
export function applyVisibility(children, show) {
  children.forEach(c => {
    c.el.hidden = !show;
    // Recurse: only reveal grandchildren if this child was left open
    applyVisibility(c.children, show && c.open);
  });
}

export function applyTreeFilter(table, query) {
  const nodes = table._wteNodes;
  if (!nodes) return;
  const q = query.trim().toLowerCase();

  if (!q) {
    // Restore expand/collapse state: a node is visible only if all ancestors are open
    nodes.forEach(node => {
      node.el.hidden = hasClosedAncestor(node);
    });
    return;
  }

  // Find nodes whose row text matches the query
  const matched = new Set();
  nodes.forEach(node => {
    if (node.el.textContent.toLowerCase().includes(q)) matched.add(node);
  });

  // Also show all ancestors of matched nodes so the tree is navigable
  const toShow = new Set(matched);
  matched.forEach(node => {
    let p = node.parent;
    while (p) { toShow.add(p); p = p.parent; }
  });

  nodes.forEach(node => { node.el.hidden = !toShow.has(node); });
}

function hasClosedAncestor(node) {
  let p = node.parent;
  while (p) {
    if (!p.open) return true;
    p = p.parent;
  }
  return false;
}
