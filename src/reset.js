// Reset a transformed table back to its original state.

import { notify } from './utils.js';
import { hideColFilterPanel } from './filters.js';
import { hideColVisibilityPanel } from './colvis.js';

export function resetTable(table) {
  if (table.dataset.wteSnap === undefined) {
    notify('このテーブルはまだ変換されていません。');
    return;
  }

  // Move table out of wrapper before destroying it
  const wrap = table.closest('.wte-wrap, .wte-tree-wrap');
  if (wrap) {
    wrap.before(table);
    wrap.remove();
  }

  // Restore original inner HTML and attributes
  table.innerHTML = table.dataset.wteSnap;
  const origStyle = table.dataset.wteStyle;
  if (origStyle) table.setAttribute('style', origStyle);
  else table.removeAttribute('style');

  table.classList.remove('wte-rich', 'wte-tree');
  delete table.dataset.wteSnap;
  delete table.dataset.wteStyle;
  delete table._wteOriginalOrder;
  delete table._wteApplyStripes;
  delete table._wteInteractionSetup;
  delete table._wteLastClickedRow;
  delete table._wteCols;
  delete table._wteNodes;
  delete table._wteColFilters;
  delete table._wteSearchQuery;
  delete table._wteRefreshCount;
  delete table._wteHiddenCols;
  delete table._wteLvColIdx;
  hideColFilterPanel();
  hideColVisibilityPanel();

  notify('元の表示に戻しました ✓');
}
