// Column index remapping helpers — pure functions used by reorder and colvis.

/** Maps a single column index through a move of fromIdx → toIdx. */
export function shiftIndex(idx, fromIdx, toIdx) {
  if (idx === fromIdx) return toIdx;
  if (fromIdx < toIdx && idx > fromIdx && idx <= toIdx) return idx - 1;
  if (fromIdx > toIdx && idx >= toIdx && idx < fromIdx) return idx + 1;
  return idx;
}

export function remapColFilters(table, fromIdx, toIdx) {
  if (!table._wteColFilters || Object.keys(table._wteColFilters).length === 0) return;
  const newFilters = {};
  for (const [idxStr, filter] of Object.entries(table._wteColFilters)) {
    newFilters[shiftIndex(parseInt(idxStr), fromIdx, toIdx)] = filter;
  }
  table._wteColFilters = newFilters;
}
