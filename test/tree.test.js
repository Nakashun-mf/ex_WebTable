import { describe, it, expect, beforeEach } from 'vitest';
import {
  LEVEL_RE,
  underscoreLevel,
  applyVisibility,
  expandAll,
  collapseAll,
  expandToLevel,
  toggleNode,
} from '../src/tree.js';

// ── LEVEL_RE ──────────────────────────────────────────────────────────────────

describe('LEVEL_RE', () => {
  const match = s => LEVEL_RE.test(s);

  it('level', () => expect(match('level')).toBe(true));
  it('Level (大文字)', () => expect(match('Level')).toBe(true));
  it('lvl', () => expect(match('lvl')).toBe(true));
  it('Lvl', () => expect(match('Lvl')).toBe(true));
  it('lv', () => expect(match('lv')).toBe(true));
  it('depth', () => expect(match('depth')).toBe(true));
  it('tier', () => expect(match('tier')).toBe(true));
  it('indent', () => expect(match('indent')).toBe(true));
  it('レベル', () => expect(match('レベル')).toBe(true));
  it('階層', () => expect(match('階層')).toBe(true));
  it('深さ', () => expect(match('深さ')).toBe(true));
  it('深度', () => expect(match('深度')).toBe(true));
  it('段階', () => expect(match('段階')).toBe(true));
  it('ノード', () => expect(match('ノード')).toBe(true));
  it('無関係なワードにはマッチしない', () => expect(match('name')).toBe(false));
  it('部分一致しない', () => expect(match('level_col')).toBe(false));
});

// ── underscoreLevel ───────────────────────────────────────────────────────────

describe('underscoreLevel', () => {
  it('プレフィックスなし → 1', () => expect(underscoreLevel('root')).toBe(1));
  it('_ 1個 → 2', () => expect(underscoreLevel('_child')).toBe(2));
  it('__ 2個 → 3', () => expect(underscoreLevel('__grand')).toBe(3));
  it('___ 3個 → 4', () => expect(underscoreLevel('___deep')).toBe(4));
  it('空文字 → 1', () => expect(underscoreLevel('')).toBe(1));
  it('全角スペース → 2', () => expect(underscoreLevel('\u3000child')).toBe(2));
});

// ── applyVisibility ───────────────────────────────────────────────────────────

function makeRow() {
  const tr = document.createElement('tr');
  const td = document.createElement('td');
  tr.appendChild(td);
  tr.hidden = false;
  return tr;
}

function makeNode(el, children = [], open = true) {
  const node = { el, children, open, level: 1, parent: null };
  children.forEach(c => { c.parent = node; });
  return node;
}

describe('applyVisibility', () => {
  it('show=true で子が表示される', () => {
    const child = makeNode(makeRow());
    applyVisibility([child], true);
    expect(child.el.hidden).toBe(false);
  });

  it('show=false で子が非表示になる', () => {
    const child = makeNode(makeRow());
    applyVisibility([child], false);
    expect(child.el.hidden).toBe(true);
  });

  it('show=false のとき孫も非表示になる', () => {
    const grandchild = makeNode(makeRow());
    const child = makeNode(makeRow(), [grandchild]);
    applyVisibility([child], false);
    expect(grandchild.el.hidden).toBe(true);
  });

  it('親が非表示なら子が open=true でも孫は非表示のまま', () => {
    const grandchild = makeNode(makeRow());
    const child = makeNode(makeRow(), [grandchild], true);
    // show=false で child は閉じられる → 孫も非表示
    applyVisibility([child], false);
    expect(grandchild.el.hidden).toBe(true);
  });

  it('親が open=false なら show=true でも孫は非表示', () => {
    const grandchild = makeNode(makeRow());
    const child = makeNode(makeRow(), [grandchild], false);
    applyVisibility([child], true);
    expect(child.el.hidden).toBe(false);
    expect(grandchild.el.hidden).toBe(true);
  });
});

// ── expandAll / collapseAll / expandToLevel ───────────────────────────────────

function makeTable(nodes) {
  const table = document.createElement('table');
  table._wteNodes = nodes;
  return table;
}

function makeNodeWithBtn(el, children = [], open = true) {
  const node = makeNode(el, children, open);
  if (children.length) {
    const btn = document.createElement('button');
    btn.className = 'wte-btn';
    btn.textContent = open ? '−' : '+';
    btn.setAttribute('aria-expanded', String(open));
    // tree.js は cells[0] を参照するのでセルに挿入
    el.cells[0].appendChild(btn);
    node.level = 1;
  } else {
    node.level = 2;
  }
  node.children.forEach(c => { c.parent = node; });
  return node;
}

describe('expandAll', () => {
  it('全ノードが表示される', () => {
    const child = makeNodeWithBtn(makeRow());
    const parent = makeNodeWithBtn(makeRow(), [child]);
    child.el.hidden = true;
    parent.open = false;

    const table = makeTable([parent, child]);
    expandAll(table);

    expect(parent.el.hidden).toBe(false);
    expect(child.el.hidden).toBe(false);
    expect(parent.open).toBe(true);
  });

  it('ボタンが − になる', () => {
    const child = makeNodeWithBtn(makeRow());
    const parent = makeNodeWithBtn(makeRow(), [child]);
    parent.open = false;
    parent.el.querySelector('.wte-btn').textContent = '+';

    const table = makeTable([parent, child]);
    expandAll(table);

    expect(parent.el.querySelector('.wte-btn').textContent).toBe('−');
  });
});

describe('collapseAll', () => {
  it('子ノードが非表示になる', () => {
    const child = makeNodeWithBtn(makeRow());
    const parent = makeNodeWithBtn(makeRow(), [child]);

    const table = makeTable([parent, child]);
    collapseAll(table);

    expect(child.el.hidden).toBe(true);
  });

  it('ルートノードは表示のまま', () => {
    const child = makeNodeWithBtn(makeRow());
    const parent = makeNodeWithBtn(makeRow(), [child]);
    parent.parent = null;

    const table = makeTable([parent, child]);
    collapseAll(table);

    expect(parent.el.hidden).toBe(false);
  });
});

describe('expandToLevel', () => {
  it('指定レベルまで展開される', () => {
    const grandchild = makeNodeWithBtn(makeRow());
    grandchild.level = 3;
    const child = makeNodeWithBtn(makeRow(), [grandchild]);
    child.level = 2;
    const parent = makeNodeWithBtn(makeRow(), [child]);
    parent.level = 1;

    const table = makeTable([parent, child, grandchild]);
    expandToLevel(table, 2);

    expect(parent.el.hidden).toBe(false);  // level 1 ≤ 2
    expect(child.el.hidden).toBe(false);   // level 2 ≤ 2
    expect(grandchild.el.hidden).toBe(true); // level 3 > 2
  });
});

describe('toggleNode', () => {
  it('open → close に切り替わる', () => {
    const child = makeNodeWithBtn(makeRow());
    const parent = makeNodeWithBtn(makeRow(), [child]);
    parent.open = true;

    const btn = parent.el.querySelector('.wte-btn');
    toggleNode(parent, btn);

    expect(parent.open).toBe(false);
    expect(btn.textContent).toBe('+');
    expect(child.el.hidden).toBe(true);
  });

  it('close → open に切り替わる', () => {
    const child = makeNodeWithBtn(makeRow());
    child.el.hidden = true;
    const parent = makeNodeWithBtn(makeRow(), [child]);
    parent.open = false;
    const btn = parent.el.querySelector('.wte-btn');
    btn.textContent = '+';

    toggleNode(parent, btn);

    expect(parent.open).toBe(true);
    expect(btn.textContent).toBe('−');
    expect(child.el.hidden).toBe(false);
  });
});
