// Clipboard utilities shared across modules.

import { getHeaderCells, notify, cleanCell } from './utils.js';
import { getVisibleColIndices } from './colvis.js';

export function copyText(text, successMsg = 'コピーしました ✓') {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => notify(successMsg))
      .catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

export function copyRowsAsTSV(rows, includeHeader, table) {
  const visibleRows = rows.filter(r => !r.hidden);
  if (!visibleRows.length) { notify('コピーする行がありません。'); return; }

  const headers    = getHeaderCells(table);
  const visColIdxs = getVisibleColIndices(table);

  const esc  = s => s.replace(/[\t\n]/g, ' ');
  const text = cell => esc(cleanCell(cell));

  const emptyCell = document.createElement('td');
  const lines = [];
  if (includeHeader) lines.push(visColIdxs.map(i => text(headers[i])).join('\t'));
  visibleRows.forEach(r => lines.push(visColIdxs.map(i => text(r.cells[i] ?? emptyCell)).join('\t')));

  copyText(lines.join('\n'), `${visibleRows.length} 行をコピーしました ✓`);
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    notify(ok ? successMsg : failMsg());
  } catch {
    notify(failMsg());
  } finally {
    ta.remove();
  }
}

function failMsg() {
  return location.protocol === 'http:'
    ? 'コピーに失敗しました（HTTPページではクリップボードへのアクセスが制限されています）。CSVダウンロードをご利用ください。'
    : 'コピーに失敗しました。';
}
