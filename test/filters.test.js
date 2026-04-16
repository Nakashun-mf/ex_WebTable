import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyAllFilters } from '../src/filters.js';

// session.js は sessionStorage を使うのでモックする
vi.mock('../src/session.js', () => ({ saveSession: vi.fn() }));

// ── テーブルとrow のファクトリ ────────────────────────────────────────────────

function makeRow(cells, { text, cachedCells } = {}) {
  const tr = document.createElement('tr');
  cells.forEach(val => {
    const td = document.createElement('td');
    td.textContent = val;
    tr.appendChild(td);
  });
  tr.hidden = false;
  if (text !== undefined)         tr._wteText   = text;
  if (cachedCells !== undefined)  tr._wteCells  = cachedCells;
  return tr;
}

function makeTable(rows) {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  rows.forEach(r => tbody.appendChild(r));
  table.appendChild(tbody);
  table._wteBodyRowsCache = rows;
  return table;
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('applyAllFilters — グローバル検索', () => {
  it('一致する行は表示される', () => {
    const row = makeRow(['Alice', 'Sales'], { text: 'alice sales' });
    const table = makeTable([row]);
    table._wteSearchQuery = 'alice';
    applyAllFilters(table);
    expect(row.hidden).toBe(false);
  });

  it('一致しない行は非表示になる', () => {
    const row = makeRow(['Bob', 'HR'], { text: 'bob hr' });
    const table = makeTable([row]);
    table._wteSearchQuery = 'alice';
    applyAllFilters(table);
    expect(row.hidden).toBe(true);
  });

  it('大文字小文字を区別しない', () => {
    const row = makeRow(['ALICE'], { text: 'alice' });
    const table = makeTable([row]);
    table._wteSearchQuery = 'Alice';
    applyAllFilters(table);
    expect(row.hidden).toBe(false);
  });

  it('クエリが空なら全行表示', () => {
    const row = makeRow(['foo'], { text: 'foo' });
    const table = makeTable([row]);
    table._wteSearchQuery = '';
    applyAllFilters(table);
    expect(row.hidden).toBe(false);
  });
});

describe('applyAllFilters — 列フィルタ', () => {
  it('チェックされた値の行は表示される', () => {
    const row = makeRow(['Sales'], { cachedCells: ['Sales'] });
    const table = makeTable([row]);
    table._wteColFilters = { 0: { checkedValues: new Set(['Sales']) } };
    applyAllFilters(table);
    expect(row.hidden).toBe(false);
  });

  it('チェックされていない値の行は非表示になる', () => {
    const row = makeRow(['HR'], { cachedCells: ['HR'] });
    const table = makeTable([row]);
    table._wteColFilters = { 0: { checkedValues: new Set(['Sales']) } };
    applyAllFilters(table);
    expect(row.hidden).toBe(true);
  });

  it('複数列フィルタ — 両方に一致する行は表示', () => {
    const row = makeRow(['Alice', 'Sales'], { cachedCells: ['Alice', 'Sales'] });
    const table = makeTable([row]);
    table._wteColFilters = {
      0: { checkedValues: new Set(['Alice']) },
      1: { checkedValues: new Set(['Sales']) },
    };
    applyAllFilters(table);
    expect(row.hidden).toBe(false);
  });

  it('複数列フィルタ — 片方のみ一致する行は非表示', () => {
    const row = makeRow(['Alice', 'HR'], { cachedCells: ['Alice', 'HR'] });
    const table = makeTable([row]);
    table._wteColFilters = {
      0: { checkedValues: new Set(['Alice']) },
      1: { checkedValues: new Set(['Sales']) },
    };
    applyAllFilters(table);
    expect(row.hidden).toBe(true);
  });
});

describe('applyAllFilters — グローバル検索 + 列フィルタの組み合わせ', () => {
  it('両方に一致すれば表示', () => {
    const row = makeRow(['Alice', 'Sales'], { text: 'alice sales', cachedCells: ['Alice', 'Sales'] });
    const table = makeTable([row]);
    table._wteSearchQuery = 'alice';
    table._wteColFilters  = { 1: { checkedValues: new Set(['Sales']) } };
    applyAllFilters(table);
    expect(row.hidden).toBe(false);
  });

  it('検索は通るが列フィルタに外れれば非表示', () => {
    const row = makeRow(['Alice', 'HR'], { text: 'alice hr', cachedCells: ['Alice', 'HR'] });
    const table = makeTable([row]);
    table._wteSearchQuery = 'alice';
    table._wteColFilters  = { 1: { checkedValues: new Set(['Sales']) } };
    applyAllFilters(table);
    expect(row.hidden).toBe(true);
  });
});

describe('applyAllFilters — フィルタなし', () => {
  it('フィルタ未設定なら全行表示', () => {
    const rows = [makeRow(['A']), makeRow(['B']), makeRow(['C'])];
    rows.forEach(r => { r._wteText = r.cells[0].textContent.toLowerCase(); });
    const table = makeTable(rows);
    applyAllFilters(table);
    rows.forEach(r => expect(r.hidden).toBe(false));
  });
});
