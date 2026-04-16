import { describe, it, expect } from 'vitest';
import { parseNum, cmpCells } from '../src/sort.js';

// ── parseNum ──────────────────────────────────────────────────────────────────

describe('parseNum', () => {
  it('整数を返す', () => expect(parseNum('42')).toBe(42));
  it('小数を返す', () => expect(parseNum('3.14')).toBe(3.14));
  it('カンマ区切りを除去する', () => expect(parseNum('1,234,567')).toBe(1234567));
  it('全角カンマを除去する', () => expect(parseNum('1，234')).toBe(1234));
  it('円記号を除去する', () => expect(parseNum('¥1,000')).toBe(1000));
  it('ドル記号を除去する', () => expect(parseNum('$9.99')).toBe(9.99));
  it('ユーロ記号を除去する', () => expect(parseNum('€12.50')).toBe(12.50));
  it('ポンド記号を除去する', () => expect(parseNum('£5')).toBe(5));
  it('パーセントを除去する', () => expect(parseNum('75%')).toBe(75));
  it('負の数を返す', () => expect(parseNum('-10')).toBe(-10));
  it('テキストは null を返す', () => expect(parseNum('abc')).toBeNull());
  it('空文字は null を返す', () => expect(parseNum('')).toBeNull());
  it('NaN は null を返す', () => expect(parseNum('NaN')).toBeNull());
});

// ── cmpCells helpers ──────────────────────────────────────────────────────────

function td(text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

// ── cmpCells ─────────────────────────────────────────────────────────────────

describe('cmpCells — 数値比較', () => {
  it('昇順: 小さい方が前', () => expect(cmpCells(td('5'), td('10'), true)).toBeLessThan(0));
  it('昇順: 大きい方が後', () => expect(cmpCells(td('10'), td('5'), true)).toBeGreaterThan(0));
  it('降順: 大きい方が前', () => expect(cmpCells(td('10'), td('5'), false)).toBeLessThan(0));
  it('同値はゼロ', () => expect(cmpCells(td('7'), td('7'), true)).toBe(0));
  it('通貨同士を比較する', () => expect(cmpCells(td('¥500'), td('¥1,000'), true)).toBeLessThan(0));
});

describe('cmpCells — 日付比較', () => {
  it('昇順: 古い日付が前', () => expect(cmpCells(td('2020-01-01'), td('2023-06-15'), true)).toBeLessThan(0));
  it('降順: 新しい日付が前', () => expect(cmpCells(td('2023-06-15'), td('2020-01-01'), false)).toBeLessThan(0));
});

describe('cmpCells — テキスト比較', () => {
  it('昇順: a < b', () => expect(cmpCells(td('apple'), td('banana'), true)).toBeLessThan(0));
  it('降順: b > a なので b が前', () => expect(cmpCells(td('banana'), td('apple'), false)).toBeLessThan(0));
  it('同値テキストはゼロ', () => expect(cmpCells(td('foo'), td('foo'), true)).toBe(0));
});

describe('cmpCells — null セル', () => {
  it('undefined セルは空文字として扱う', () => {
    expect(cmpCells(undefined, td('a'), true)).toBeLessThanOrEqual(0);
  });
});
