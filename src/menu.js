// Custom in-page context menu for transformed tables.

import { getHeaderCells, notify } from './utils.js';
import { getBodyRows } from './utils.js';
import { hideColFilterPanel } from './filters.js';
import {
  getThColIdx, hideColumn, hideColVisibilityPanel,
  showColVisibilityPanel
} from './colvis.js';
import { exportTableAsCSV } from './csv.js';
import { transformToRich } from './rich.js';
import { transformToTree, expandAll, collapseAll, expandToLevel } from './tree.js';
import { clearSelection } from './interaction.js';
import { resetTable } from './reset.js';

// ── Close menu on outside click / Escape / scroll ─────────────────────────
document.addEventListener('click', e => {
  const menu = document.getElementById('wte-ctx-menu');
  if (menu && !menu.hidden && !menu.contains(e.target)) hideMenu();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideMenu();
    hideColFilterPanel();
    hideColVisibilityPanel();
    // 変換済みテーブルの行選択をすべて解除
    document.querySelectorAll('.wte-rich, .wte-tree').forEach(t => clearSelection(t));
  }
});
window.addEventListener('scroll', () => { hideMenu(); hideColFilterPanel(); hideColVisibilityPanel(); }, { passive: true, capture: true });

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

export function hideMenu() {
  const menu = document.getElementById('wte-ctx-menu');
  if (menu) menu.hidden = true;
}

export function showMenu(clientX, clientY, table, row, th = null) {
  const selectedRows = getSelectedRows(table);

  // Determine which rows actions should apply to
  let targets;
  if (row) {
    targets = selectedRows.has(row) ? selectedRows : new Set([row]);
  } else {
    targets = selectedRows;
  }

  const hasTargets    = targets.size > 0;
  const allHighlit    = hasTargets && [...targets].every(r => r.classList.contains('wte-highlight'));
  const isRich        = table.classList.contains('wte-rich');
  const hasHiddenCols = (table._wteHiddenCols?.size ?? 0) > 0;

  const menu = getOrCreateMenu();
  menu.innerHTML = '';

  // ① Highlight
  menu.appendChild(makeMenuItem(
    allHighlit ? 'ハイライトを解除' : '行をハイライト',
    () => { targets.forEach(r => r.classList.toggle('wte-highlight', !allHighlit)); hideMenu(); },
    !hasTargets
  ));

  menu.appendChild(makeSep());

  // ② Copy + CSV download
  menu.appendChild(makeMenuItem('選択した行をコピー', () => {
    copyRowsAsTSV([...targets], false, table); hideMenu();
  }, !hasTargets));
  menu.appendChild(makeMenuItem('ヘッダーと選択した行をコピー', () => {
    copyRowsAsTSV([...targets], true, table); hideMenu();
  }, !hasTargets));
  menu.appendChild(makeMenuItem('CSV でダウンロード', () => {
    exportTableAsCSV(table); hideMenu();
  }));

  menu.appendChild(makeSep());

  // ③ Column visibility
  if (th !== null) {
    const thColIdx    = getThColIdx(table, th);
    const isLevelCol  = table._wteLvColIdx !== undefined && thColIdx === table._wteLvColIdx;
    const totalCols   = getHeaderCells(table).length;
    const hiddenCount = table._wteHiddenCols?.size ?? 0;
    const isLastVisible = !table._wteHiddenCols?.has(thColIdx) && hiddenCount >= totalCols - 1;
    menu.appendChild(makeMenuItem(
      'この列を非表示',
      () => { hideColumn(table, thColIdx); hideMenu(); },
      isLevelCol || isLastVisible
    ));
  }
  menu.appendChild(makeMenuItem(
    '非表示列の管理',
    () => { hideMenu(); showColVisibilityPanel(table, clientX, clientY); },
    !hasHiddenCols
  ));

  menu.appendChild(makeSep());

  // ④ Text-wrap mode toggle (both rich and tree)
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

  // ⑤ Switch view
  menu.appendChild(makeMenuItem(
    isRich ? 'ツリー表示に変換' : 'リッチ表示に変換',
    () => {
      resetTable(table);
      if (isRich) transformToTree(table);
      else        transformToRich(table);
      hideMenu();
    }
  ));

  // ⑥ Tree expand / collapse (tree only)
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

  const hidden      = table._wteHiddenCols || new Set();
  const headers     = getHeaderCells(table);
  const visColIdxs  = Array.from({ length: headers.length }, (_, i) => i).filter(i => !hidden.has(i));

  const esc  = s => s.replace(/[\t\n]/g, ' ');
  const text = cell => {
    const c = cell.cloneNode(true);
    c.querySelectorAll('.wte-arrow, .wte-btn, .wte-spc, .wte-th-controls, .wte-col-resizer, .wte-filter-btn').forEach(n => n.remove());
    return esc(c.textContent.trim());
  };

  const emptyCell = document.createElement('td');
  const lines = [];
  if (includeHeader) lines.push(visColIdxs.map(i => text(headers[i])).join('\t'));
  visibleRows.forEach(r => lines.push(visColIdxs.map(i => text(r.cells[i] ?? emptyCell)).join('\t')));

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
    notify(ok ? `${rowCount} 行をコピーしました ✓` : copyFailMessage());
  } catch {
    notify(copyFailMessage());
  } finally {
    ta.remove();
  }
}

function copyFailMessage() {
  return location.protocol === 'http:'
    ? 'コピーに失敗しました（HTTPページではクリップボードへのアクセスが制限されています）。CSVダウンロードをご利用ください。'
    : 'コピーに失敗しました。';
}
