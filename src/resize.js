// Column resize via drag handle.

import { getHeaderCells } from './utils.js';

export function addColResizeHandles(table) {
  const headers = getHeaderCells(table);
  if (!headers.length) return;

  // Add handle elements immediately; set up colgroup after layout is computed
  headers.forEach(th => {
    const handle = document.createElement('div');
    handle.className = 'wte-col-resizer';
    th.appendChild(handle);
  });

  // Wait for layout so offsetWidth values are accurate
  requestAnimationFrame(() => {
    // Build colgroup with captured column widths
    let colgroup = table.querySelector(':scope > colgroup');
    if (!colgroup) {
      colgroup = document.createElement('colgroup');
      table.insertBefore(colgroup, table.firstChild);
    } else {
      colgroup.innerHTML = '';
    }
    const cols = headers.map(th => {
      const col = document.createElement('col');
      col.style.width = `${th.offsetWidth}px`;
      colgroup.appendChild(col);
      return col;
    });
    table._wteCols = cols;
    table.style.tableLayout = 'fixed';

    // Wire up drag events now that cols are ready
    headers.forEach((th, i) => {
      const handle = th.querySelector('.wte-col-resizer');
      if (!handle) return;

      handle.addEventListener('mousedown', e => {
        e.stopPropagation();
        e.preventDefault();
        const col = table._wteCols[i];
        if (!col) return;
        const startX = e.clientX;
        const startW = th.offsetWidth;
        handle.classList.add('wte-resizing');
        const prevCursor = document.body.style.cursor;
        const prevSelect = document.body.style.userSelect;
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = ev => {
          const newW = Math.max(40, startW + ev.clientX - startX);
          col.style.width = `${newW}px`;
        };
        const onUp = () => {
          handle.classList.remove('wte-resizing');
          document.body.style.cursor     = prevCursor;
          document.body.style.userSelect = prevSelect;
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      // Prevent resize handle click from triggering column sort
      handle.addEventListener('click', e => e.stopPropagation());
    });
  });
}
