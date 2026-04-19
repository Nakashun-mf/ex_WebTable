import { describe, it, expect, beforeEach } from 'vitest';
import { shiftIndex, remapColFilters } from '../src/remap.js';

// ── shiftIndex ────────────────────────────────────────────────────────────────

describe('shiftIndex — 移動先のインデックスを返す', () => {
  it('移動元と同じインデックスは移動先を返す', () => {
    expect(shiftIndex(2, 2, 5)).toBe(5);
  });

  it('左から右へ移動: 間のインデックスは -1 される', () => {
    // col 1 → col 4 に移動。col 2,3,4 は左にずれる
    expect(shiftIndex(2, 1, 4)).toBe(1);
    expect(shiftIndex(3, 1, 4)).toBe(2);
    expect(shiftIndex(4, 1, 4)).toBe(3);
  });

  it('右から左へ移動: 間のインデックスは +1 される', () => {
    // col 4 → col 1 に移動。col 1,2,3 は右にずれる
    expect(shiftIndex(1, 4, 1)).toBe(2);
    expect(shiftIndex(2, 4, 1)).toBe(3);
    expect(shiftIndex(3, 4, 1)).toBe(4);
  });

  it('移動範囲外のインデックスは変わらない', () => {
    expect(shiftIndex(0, 2, 5)).toBe(0);
    expect(shiftIndex(6, 2, 5)).toBe(6);
  });

  it('同じ位置への移動は変化なし', () => {
    expect(shiftIndex(3, 3, 3)).toBe(3);
  });
});

// ── remapColFilters ───────────────────────────────────────────────────────────

describe('remapColFilters', () => {
  let table;

  beforeEach(() => {
    table = document.createElement('table');
  });

  it('フィルターが空の場合は何もしない', () => {
    table._wteColFilters = {};
    remapColFilters(table, 1, 3);
    expect(table._wteColFilters).toEqual({});
  });

  it('フィルターが未定義の場合は何もしない', () => {
    remapColFilters(table, 1, 3);
    expect(table._wteColFilters).toBeUndefined();
  });

  it('列移動に合わせてフィルターキーを再マッピングする', () => {
    const filterA = { checkedValues: new Set(['A']) };
    const filterD = { checkedValues: new Set(['D']) };
    // col 1 を col 3 に移動: col2(元1), col3(元2) → col1,col2 にずれる
    table._wteColFilters = { 1: filterA, 3: filterD };
    remapColFilters(table, 1, 3);
    // 元col1 → 新col3, 元col3 → 新col2
    expect(table._wteColFilters[3]).toBe(filterA);
    expect(table._wteColFilters[2]).toBe(filterD);
  });
});
