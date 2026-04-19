import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── helpers ───────────────────────────────────────────────────────────────────

function buildTable(headers, rows) {
  const table = document.createElement('table');
  const thead = table.createTHead();
  const hrow  = thead.insertRow();
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    hrow.appendChild(th);
  });
  const tbody = table.createTBody();
  rows.forEach(cells => {
    const tr = tbody.insertRow();
    cells.forEach(text => { tr.insertCell().textContent = text; });
  });
  return table;
}

// ── CSV escape logic (extracted from csv.js as pure function) ─────────────────

function escCSV(s) {
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

describe('escCSV — CSV エスケープ', () => {
  it('通常の文字列はそのまま返す', () => {
    expect(escCSV('hello')).toBe('hello');
  });

  it('カンマを含む場合はダブルクォートで囲む', () => {
    expect(escCSV('a,b')).toBe('"a,b"');
  });

  it('ダブルクォートは二重化してクォートで囲む', () => {
    expect(escCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it('改行を含む場合はクォートで囲む', () => {
    expect(escCSV('line1\nline2')).toBe('"line1\nline2"');
  });

  it('CRを含む場合はクォートで囲む', () => {
    expect(escCSV('line1\rline2')).toBe('"line1\rline2"');
  });

  it('空文字はそのまま返す', () => {
    expect(escCSV('')).toBe('');
  });
});

// ── exportTableAsCSV integration ──────────────────────────────────────────────

describe('exportTableAsCSV — 列なし時の安全性', () => {
  it('表示中の列がない場合はエラーを投げない', async () => {
    // createObjectURL / revokeObjectURL をスタブ（URL クラス自体は保持）
    const origCreate  = URL.createObjectURL;
    const origRevoke  = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:mock';
    URL.revokeObjectURL = () => {};

    try {
      const { exportTableAsCSV } = await import('../src/csv.js');
      const table = buildTable(['A', 'B'], [['1', '2']]);
      table._wteHiddenCols = new Set([0, 1]);
      expect(() => exportTableAsCSV(table)).not.toThrow();
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
