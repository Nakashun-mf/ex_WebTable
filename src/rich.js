// Rich table transformation — sorting, filtering, resize, reorder.

import {
  getHeaderCells, getBodyRows, getCachedBodyRows, ensureStructure,
  isTransformed, saveSnapshot, notify
} from './utils.js';
import { saveSession } from './session.js';
import { sortBy } from './sort.js';
import { applyAllFilters, showColFilterPanel } from './filters.js';
import { addColResizeHandles } from './resize.js';
import { addColReorderHandles } from './reorder.js';
import { setupTableInteraction } from './interaction.js';

export function transformToRich(table) {
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

  // Pre-compute text caches on each body row to avoid live DOM reads during
  // filtering. Set before header-cell setup so all rows are already in tbody.
  {
    const bodyRows = getBodyRows(table);
    table._wteBodyRowsCache = bodyRows;
    bodyRows.forEach(row => {
      row._wteText  = row.textContent.toLowerCase();
      row._wteCells = Array.from(row.cells).map(c => c.textContent.trim());
    });
  }

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
    getCachedBodyRows(table).forEach(r => {
      if (!r.hidden) n++;
      r.classList.toggle('wte-stripe', !r.hidden && n % 2 === 0);
    });
  };
  table._wteApplyStripes = applyStripes;

  const refreshCount = () => {
    const rows = getCachedBodyRows(table);
    const vis  = rows.filter(r => !r.hidden).length;
    counter.textContent = vis === rows.length
      ? `${rows.length} 件`
      : `${vis} / ${rows.length} 件`;
  };
  table._wteRefreshCount = refreshCount;

  // Debounce search to avoid running filter on every keystroke.
  let _searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      table._wteSearchQuery = search.value;
      applyAllFilters(table); // applyAllFilters calls saveSession internally
    }, 150);
  });

  refreshCount();
  applyStripes();
  setupTableInteraction(table);
  addColResizeHandles(table);
  addColReorderHandles(table);
  saveSession(table);
  notify('リッチ表示に変換しました ✓');
}
