import { describe, it, expect, beforeEach } from 'vitest';
import { tableKey, saveSession, clearSession } from '../src/session.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function buildTable({ id = '', headers = [], bodyRows = [] } = {}) {
  const table = document.createElement('table');
  if (id) table.id = id;

  if (headers.length) {
    const thead = table.createTHead();
    const tr = thead.insertRow();
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      tr.appendChild(th);
    });
  }

  const tbody = table.createTBody();
  bodyRows.forEach(cells => {
    const tr = tbody.insertRow();
    cells.forEach(text => { tr.insertCell().textContent = text; });
  });

  document.body.appendChild(table);
  return table;
}

// ── tableKey ──────────────────────────────────────────────────────────────────

describe('tableKey — キー生成', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('id がある場合は id ベースのキーを返す', () => {
    const table = buildTable({ id: 'my-table' });
    expect(tableKey(table)).toMatch(/^wte:.*:id:my-table$/);
  });

  it('ヘッダーがある場合はコンテンツベースのキーを返す', () => {
    const table = buildTable({ headers: ['名前', '年齢', '部署'] });
    const key = tableKey(table);
    expect(key).toMatch(/^wte:.*:h:/);
  });

  it('同じヘッダーを持つテーブルは同じキーを返す', () => {
    const t1 = buildTable({ headers: ['A', 'B', 'C'] });
    const t2 = buildTable({ headers: ['A', 'B', 'C'] });
    expect(tableKey(t1)).toBe(tableKey(t2));
  });

  it('異なるヘッダーを持つテーブルは異なるキーを返す', () => {
    const t1 = buildTable({ headers: ['X', 'Y'] });
    const t2 = buildTable({ headers: ['A', 'B'] });
    expect(tableKey(t1)).not.toBe(tableKey(t2));
  });

  it('id が異なれば異なるキーを返す', () => {
    const t1 = buildTable({ id: 'table-alpha' });
    const t2 = buildTable({ id: 'table-beta' });
    expect(tableKey(t1)).not.toBe(tableKey(t2));
  });
});

// ── saveSession / clearSession ─────────────────────────────────────────────────

describe('saveSession / clearSession', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
  });

  it('変換済みでないテーブルは保存しない', () => {
    const table = buildTable({ headers: ['A'] });
    saveSession(table);
    expect(sessionStorage.length).toBe(0);
  });

  it('wte-rich クラスのテーブルを保存する', () => {
    const table = buildTable({ headers: ['名前', '年齢'] });
    table.classList.add('wte-rich');
    table._wteColFilters  = {};
    table._wteSearchQuery = '';
    table._wteHiddenCols  = new Set();

    saveSession(table);
    expect(sessionStorage.length).toBe(1);

    const key   = tableKey(table);
    const state = JSON.parse(sessionStorage.getItem(key));
    expect(state.mode).toBe('rich');
    expect(state.searchQuery).toBe('');
  });

  it('検索クエリとフィルターをシリアライズして保存する', () => {
    const table = buildTable({ headers: ['A', 'B'] });
    table.classList.add('wte-rich');
    table._wteColFilters  = { 0: { checkedValues: new Set(['foo', 'bar']) } };
    table._wteSearchQuery = 'test';
    table._wteHiddenCols  = new Set([1]);

    saveSession(table);
    const state = JSON.parse(sessionStorage.getItem(tableKey(table)));
    expect(state.searchQuery).toBe('test');
    expect(state.colFilters['0']).toEqual(expect.arrayContaining(['foo', 'bar']));
    expect(state.hiddenCols).toContain(1);
  });

  it('clearSession でエントリが削除される', () => {
    const table = buildTable({ headers: ['X'] });
    table.classList.add('wte-tree');
    table._wteColFilters  = {};
    table._wteSearchQuery = '';
    table._wteHiddenCols  = new Set();

    saveSession(table);
    expect(sessionStorage.length).toBe(1);

    clearSession(table);
    expect(sessionStorage.length).toBe(0);
  });
});
