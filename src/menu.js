// Custom in-page context menu for transformed tables.

import { getHeaderCells, cleanCell, positionPopup } from './utils.js';
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
import { copyRowsAsTSV, copyText } from './clipboard.js';

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
window.addEventListener('scroll', e => {
  const filterPanel = document.querySelector('.wte-col-filter-panel');
  const visPanel    = document.querySelector('.wte-col-vis-panel');
  hideMenu();
  if (!filterPanel || !filterPanel.contains(e.target)) hideColFilterPanel();
  if (!visPanel    || !visPanel.contains(e.target))    hideColVisibilityPanel();
}, { passive: true, capture: true });

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

export function showMenu(clientX, clientY, table, row, th = null, cell = null) {
  const selectedRows  = getSelectedRows(table);
  const selectedText  = window.getSelection()?.toString() ?? '';

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
  if (selectedText) {
    menu.appendChild(makeMenuItem(
      '選択したテキストをコピー',
      () => { copyText(selectedText); hideMenu(); }
    ));
  }
  menu.appendChild(makeMenuItem(
    'セルの内容をコピー',
    () => { copyText(cleanCell(cell), 'セルの内容をコピーしました ✓'); hideMenu(); },
    cell === null
  ));
  menu.appendChild(makeMenuItem('ヘッダーと選択した行をコピー', () => {
    copyRowsAsTSV([...targets], true, table); hideMenu();
  }, !hasTargets));
  menu.appendChild(makeSubMenuSection('その他のコピー・出力', [
    makeMenuItem('選択した行をコピー', () => {
      copyRowsAsTSV([...targets], false, table); hideMenu();
    }, !hasTargets),
    makeMenuItem('CSV でダウンロード', () => {
      exportTableAsCSV(table); hideMenu();
    }),
  ]));

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
    false
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
      // Clear col pixel-widths in wrap mode so table-layout:auto can honour width:100%
      if (enabling) {
        if (table._wteCols) {
          table._wteWrapColWidths = table._wteCols.map(c => c.style.width);
          table._wteCols.forEach(c => { c.style.width = ''; });
        }
      } else {
        if (table._wteWrapColWidths && table._wteCols) {
          table._wteCols.forEach((c, i) => { c.style.width = table._wteWrapColWidths[i] || ''; });
          table._wteWrapColWidths = null;
        }
      }
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
    menu.appendChild(makeMenuItem('全折りたたみ', () => { collapseAll(table); hideMenu(); }));
    if (maxLv > 1) {
      const levelItems = [];
      for (let lv = 1; lv < maxLv; lv++) {
        const level = lv;
        levelItems.push(makeMenuItem(
          `レベル${level}まで展開`,
          () => { expandToLevel(table, level); hideMenu(); }
        ));
      }
      menu.appendChild(makeSubMenuSection('レベル指定で展開', levelItems));
    }
  }

  menu.appendChild(makeSep());

  // Reset
  menu.appendChild(makeMenuItem('元に戻す', () => { resetTable(table); hideMenu(); }));

  menu.hidden = false;
  positionPopup(menu, clientX, clientY);
}

function makeMenuItem(label, onClick, disabled = false) {
  const el = document.createElement('div');
  el.className = disabled ? 'wte-ctx-item wte-ctx-disabled' : 'wte-ctx-item';
  el.textContent = label;
  if (!disabled) el.addEventListener('click', e => { e.stopPropagation(); onClick(); });
  return el;
}

function makeSubMenuSection(label, items) {
  const el = document.createElement('div');
  el.className = 'wte-ctx-item wte-ctx-submenu';
  el.appendChild(document.createTextNode(label));

  const panel = document.createElement('div');
  panel.className = 'wte-ctx-submenu-panel';
  items.forEach(item => panel.appendChild(item));
  el.appendChild(panel);

  el.addEventListener('mouseenter', () => {
    panel.style.visibility = 'hidden';
    panel.style.display = 'block';

    const elRect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (elRect.right + panel.offsetWidth > vw - 8) {
      panel.style.left = 'auto';
      panel.style.right = '100%';
    } else {
      panel.style.left = '100%';
      panel.style.right = 'auto';
    }

    if (elRect.top + panel.offsetHeight > vh - 8) {
      panel.style.top = 'auto';
      panel.style.bottom = '0';
    } else {
      panel.style.top = '0';
      panel.style.bottom = 'auto';
    }

    panel.style.visibility = '';
  });

  el.addEventListener('mouseleave', () => {
    panel.style.display = '';
  });

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
