// CSV export of visible table rows.

import { getHeaderCells, getBodyRows, notify, cleanCell } from './utils.js';
import { getVisibleColIndices } from './colvis.js';

export function exportTableAsCSV(table) {
  const headers    = getHeaderCells(table);
  const visColIdxs = getVisibleColIndices(table);

  if (!visColIdxs.length) { notify('表示中の列がありません。'); return; }

  const escCSV = s => {
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [];
  lines.push(visColIdxs.map(i => escCSV(cleanCell(headers[i]))).join(','));

  const emptyCell   = document.createElement('td');
  const visibleRows = getBodyRows(table).filter(r => !r.hidden);
  visibleRows.forEach(row => {
    lines.push(visColIdxs.map(i => escCSV(cleanCell(row.cells[i] ?? emptyCell))).join(','));
  });

  const csv  = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: 'table_export.csv', style: 'display:none'
  });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  notify(`${visibleRows.length} 行を CSV でダウンロードしました ✓`);
}
