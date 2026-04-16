// Column filter panel (Excel-like per-column checkbox filters) and global search.

import { getCachedBodyRows } from './utils.js';
import { saveSession } from './session.js';

/** Apply global search + all active column filters together. */
export function applyAllFilters(table) {
  const colFilters    = table._wteColFilters || {};
  const searchQ       = (table._wteSearchQuery || '').toLowerCase();
  const hasColFilters = Object.keys(colFilters).length > 0;

  getCachedBodyRows(table).forEach(row => {
    let visible = true;

    // Global text search — use pre-computed lowercase text when available.
    if (searchQ) {
      const text = row._wteText ?? row.textContent.toLowerCase();
      if (!text.includes(searchQ)) visible = false;
    }

    // Column-level checkbox filters — use pre-computed cell texts when available.
    if (visible && hasColFilters) {
      for (const [idxStr, filter] of Object.entries(colFilters)) {
        const idx      = parseInt(idxStr);
        const cellText = row._wteCells
          ? (row._wteCells[idx] ?? '')
          : (row.cells[idx]?.textContent.trim() ?? '');
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
  saveSession(table);
}

export function hideColFilterPanel() {
  document.getElementById('wte-col-filter-panel')?.remove();
}

export function showColFilterPanel(table, colIdx, th) {
  // Toggle: clicking the same column's button again closes the panel
  const existing = document.getElementById('wte-col-filter-panel');
  if (existing) {
    const isSame = existing._wteColIdx === colIdx && existing._wteTable === table;
    hideColFilterPanel();
    if (isSame) return;
  }

  // Collect unique values from this column across all body rows
  const rows = getCachedBodyRows(table);
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
