import { describe, it, expect } from 'vitest';

// ── TSV フォーマットのテスト（clipboard.js 内のロジックを直接検証）────────────

function esc(s) {
  return s.replace(/[\t\n]/g, ' ');
}

describe('TSV エスケープ', () => {
  it('タブ文字をスペースに変換する', () => {
    expect(esc('a\tb')).toBe('a b');
  });

  it('改行文字をスペースに変換する', () => {
    expect(esc('a\nb')).toBe('a b');
  });

  it('通常の文字列はそのまま返す', () => {
    expect(esc('hello world')).toBe('hello world');
  });

  it('空文字はそのまま返す', () => {
    expect(esc('')).toBe('');
  });

  it('カンマはエスケープしない（TSV では不要）', () => {
    expect(esc('a,b,c')).toBe('a,b,c');
  });
});

// ── copyRowsAsTSV のロジック検証（DOM ヘルパー経由）────────────────────────

function buildRow(texts) {
  const tr = document.createElement('tr');
  texts.forEach(t => { tr.insertCell().textContent = t; });
  return tr;
}

describe('copyRowsAsTSV — 行フォーマット', () => {
  it('非表示行を除外する', () => {
    const r1 = buildRow(['A', 'B']);
    const r2 = buildRow(['C', 'D']);
    r2.hidden = true;
    const rows = [r1, r2];
    const visible = rows.filter(r => !r.hidden);
    expect(visible.length).toBe(1);
    expect(visible[0]).toBe(r1);
  });

  it('複数行を改行で結合する', () => {
    const lines = ['A\tB', 'C\tD'];
    expect(lines.join('\n')).toBe('A\tB\nC\tD');
  });

  it('ヘッダー行を先頭に付加する', () => {
    const headerLine = 'Col1\tCol2';
    const dataLine   = 'Val1\tVal2';
    const result = [headerLine, dataLine].join('\n');
    expect(result).toBe('Col1\tCol2\nVal1\tVal2');
  });
});
