// Session persistence — save and restore table state across page reloads
// using sessionStorage (per-tab, cleared on tab close, no manifest changes needed).

import { isTransformed } from './utils.js';

/**
 * Generates a stable key for the table using:
 * 1. table#id if present
 * 2. First 5 header texts encoded as base64 (content-based, order-independent)
 * Falls back to index-based key only when no headers exist.
 */
export function tableKey(table) {
  if (table.id) {
    return `wte:${location.pathname}:id:${table.id}`;
  }
  const headers = Array.from(table.querySelectorAll('th, thead td')).slice(0, 5)
    .map(th => th.textContent.trim())
    .join('\0');
  if (headers) {
    const encoded = btoa(encodeURIComponent(headers)).slice(0, 32);
    return `wte:${location.pathname}:h:${encoded}`;
  }
  const idx = Array.from(document.querySelectorAll('table')).indexOf(table);
  return `wte:${location.pathname}:${idx}`;
}

/** Serialize and save the current table state to sessionStorage. */
export function saveSession(table) {
  const mode = table.classList.contains('wte-rich') ? 'rich'
             : table.classList.contains('wte-tree') ? 'tree'
             : null;
  if (!mode) return;

  // Serialize colFilters: { colIdx: Set<string> } → { colIdx: string[] }
  const colFilters = {};
  for (const [idx, filter] of Object.entries(table._wteColFilters || {})) {
    if (filter.checkedValues) colFilters[idx] = [...filter.checkedValues];
  }

  const state = {
    mode,
    searchQuery: table._wteSearchQuery || '',
    colFilters,
    hiddenCols: [...(table._wteHiddenCols || [])],
    colCount: Array.from(table.tHead?.rows[0]?.cells || []).length,
  };

  try {
    sessionStorage.setItem(tableKey(table), JSON.stringify(state));
  } catch { /* quota exceeded or private browsing — fail silently */ }
}

/** Remove the saved session state for a table (called on reset). */
export function clearSession(table) {
  try {
    sessionStorage.removeItem(tableKey(table));
  } catch { /* ignore */ }
}

/**
 * On content-script startup: scan all tables, find those with saved session
 * state, transform them and restore filters/visibility.
 * Import transformToRich/Tree lazily to avoid circular dependency.
 */
export async function restoreAllSessions() {
  const prefix = `wte:${location.pathname}:`;
  const keys   = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix)) keys.push(k);
  }
  if (!keys.length) return;

  // Lazy import to avoid circular dependency with rich.js / tree.js
  const { transformToRich } = await import('./rich.js');
  const { transformToTree }  = await import('./tree.js');
  const { applyAllFilters }  = await import('./filters.js');
  const { applyColVisibility } = await import('./colvis.js');

  const tables = Array.from(document.querySelectorAll('table'));

  for (const key of keys) {
    // Match the table by re-computing each table's key and comparing
    const table = tables.find(t => !isTransformed(t) && tableKey(t) === key);
    if (!table) continue;

    let state;
    try { state = JSON.parse(sessionStorage.getItem(key)); } catch { continue; }
    if (!state?.mode) continue;

    // Transform the table
    if (state.mode === 'rich') transformToRich(table);
    else                       transformToTree(table);

    // Safety: skip filter/visibility restore if column count changed
    const currentColCount = Array.from(table.tHead?.rows[0]?.cells || []).length;
    if (currentColCount !== state.colCount) continue;

    // Restore search query
    if (state.searchQuery) {
      table._wteSearchQuery = state.searchQuery;
      const searchInput = table.closest('.wte-wrap')?.querySelector('.wte-search');
      if (searchInput) searchInput.value = state.searchQuery;
    }

    // Restore column filters: string[] → Set<string>
    if (state.colFilters && Object.keys(state.colFilters).length) {
      table._wteColFilters = {};
      for (const [idx, vals] of Object.entries(state.colFilters)) {
        table._wteColFilters[idx] = { checkedValues: new Set(vals) };
      }
      // Mark filter buttons as active
      Object.keys(state.colFilters).forEach(i => {
        const th = Array.from(table.tHead?.rows[0]?.cells || [])[parseInt(i)];
        th?.querySelector('.wte-filter-btn')?.classList.add('wte-filter-active');
      });
    }

    // Restore hidden columns
    if (state.hiddenCols?.length) {
      table._wteHiddenCols = new Set(state.hiddenCols);
      applyColVisibility(table);
    }

    // Apply filters last (covers search + col filters together)
    if (state.searchQuery || Object.keys(state.colFilters || {}).length) {
      applyAllFilters(table);
    }
  }
}
