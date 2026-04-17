// WebTable Enhancer — entry point.
// Injected into every page. Tracks the last right-clicked element and
// transforms the nearest <table> on command from the background worker.

import { findTable, notify, isTransformed } from './utils.js';
import { transformToRich } from './rich.js';
import { transformToTree } from './tree.js';
import { resetTable } from './reset.js';
import { showMenu } from './menu.js';
import { restoreAllSessions } from './session.js';

// Restore any previously saved table state when the page loads.
restoreAllSessions();

let lastContextTarget = null;

document.addEventListener('contextmenu', e => {
  lastContextTarget = e.target;

  // Show custom in-page menu for already-converted tables
  const wrap  = e.target.closest('.wte-wrap');
  let ctxTable;
  if (wrap) {
    ctxTable = wrap.querySelector(':scope > .wte-rich, :scope > .wte-tree');
  } else {
    const t  = findTable(e.target);
    ctxTable = (t && isTransformed(t)) ? t : null;
  }
  if (ctxTable) {
    e.preventDefault();
    const headerCell = e.target.closest('thead th, thead td');
    const ctxTh   = (headerCell && ctxTable.contains(headerCell)) ? headerCell : null;
    const anyCell = e.target.closest('td, th');
    const ctxCell = (anyCell && ctxTable.contains(anyCell)) ? anyCell : null;
    showMenu(e.clientX, e.clientY, ctxTable, e.target.closest('tbody tr') || null, ctxTh, ctxCell);
  }
});

chrome.runtime.onMessage.addListener(msg => {
  if (!['wte-rich', 'wte-tree', 'wte-reset'].includes(msg.action)) return;

  const table = findTable(lastContextTarget);
  if (!table) {
    notify('テーブルの上で右クリックしてください。');
    return;
  }

  if (msg.action === 'wte-rich')  transformToRich(table);
  if (msg.action === 'wte-tree')  transformToTree(table);
  if (msg.action === 'wte-reset') resetTable(table);
});
