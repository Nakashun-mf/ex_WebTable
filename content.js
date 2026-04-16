(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/utils.js
  function findTable(el) {
    if (!el) return null;
    return el.tagName === "TABLE" ? el : el.closest("table");
  }
  function notify(text) {
    document.querySelectorAll(".wte-toast").forEach((t) => t.remove());
    const el = document.createElement("div");
    el.className = "wte-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = text;
    document.body.appendChild(el);
    const onKey = (e) => {
      if (e.key === "Escape") remove();
    };
    const remove = () => {
      if (el.isConnected) el.remove();
      document.removeEventListener("keydown", onKey);
    };
    el.addEventListener("click", remove);
    document.addEventListener("keydown", onKey);
    setTimeout(remove, 3500);
  }
  function ensureStructure(table) {
    if (table.tHead) return;
    const allRows = Array.from(table.querySelectorAll(":scope > tr, :scope > tbody > tr"));
    if (!allRows.length) return;
    Array.from(table.tBodies).forEach((tb) => tb.remove());
    const thead = table.createTHead();
    thead.appendChild(allRows[0]);
    const tbody = table.createTBody();
    allRows.slice(1).forEach((r) => tbody.appendChild(r));
  }
  function getHeaderCells(table) {
    const row = table.tHead?.rows[0];
    if (!row) return [];
    return Array.from(row.cells);
  }
  function getBodyRows(table) {
    return Array.from(table.tBodies).flatMap((tb) => Array.from(tb.rows));
  }
  function getCachedBodyRows(table) {
    return table._wteBodyRowsCache ?? getBodyRows(table);
  }
  function isTransformed(table) {
    return table.classList.contains("wte-rich") || table.classList.contains("wte-tree");
  }
  function saveSnapshot(table) {
    if (table._wteSnapNode === void 0) {
      table._wteSnapNode = table.cloneNode(true);
    }
  }
  function cleanCell(cell) {
    const c = cell.cloneNode(true);
    c.querySelectorAll(".wte-arrow, .wte-btn, .wte-spc, .wte-th-controls, .wte-col-resizer, .wte-filter-btn").forEach((n) => n.remove());
    return c.textContent.trim();
  }
  function positionPopup(el, x, y) {
    el.style.visibility = "hidden";
    el.style.left = "-9999px";
    el.style.top = "-9999px";
    requestAnimationFrame(() => {
      const pw = el.offsetWidth;
      const ph = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      el.style.left = `${Math.max(8, Math.min(x, vw - pw - 8))}px`;
      el.style.top = `${Math.max(8, Math.min(y, vh - ph - 8))}px`;
      el.style.visibility = "";
    });
  }
  function addOutsideClickListener(el, onClose) {
    const handler = (e) => {
      if (!el.contains(e.target)) {
        onClose();
        document.removeEventListener("click", handler, { capture: true });
      }
    };
    setTimeout(() => document.addEventListener("click", handler, { capture: true }), 0);
  }
  var init_utils = __esm({
    "src/utils.js"() {
    }
  });

  // src/resize.js
  function addColResizeHandles(table) {
    const headers = getHeaderCells(table);
    if (!headers.length) return;
    headers.forEach((th) => {
      const handle = document.createElement("div");
      handle.className = "wte-col-resizer";
      th.appendChild(handle);
    });
    requestAnimationFrame(() => {
      let colgroup = table.querySelector(":scope > colgroup");
      if (!colgroup) {
        colgroup = document.createElement("colgroup");
        table.insertBefore(colgroup, table.firstChild);
      } else {
        colgroup.innerHTML = "";
      }
      const cols = headers.map((th) => {
        const col = document.createElement("col");
        col.style.width = `${th.offsetWidth}px`;
        colgroup.appendChild(col);
        return col;
      });
      table._wteCols = cols;
      table.style.tableLayout = "fixed";
      headers.forEach((th, i) => {
        const handle = th.querySelector(".wte-col-resizer");
        if (!handle) return;
        handle.addEventListener("mousedown", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const col = table._wteCols[i];
          if (!col) return;
          const startX = e.clientX;
          const startW = th.offsetWidth;
          handle.classList.add("wte-resizing");
          const prevCursor = document.body.style.cursor;
          const prevSelect = document.body.style.userSelect;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
          const onMove = (ev) => {
            const newW = Math.max(40, startW + ev.clientX - startX);
            col.style.width = `${newW}px`;
          };
          const onUp = () => {
            handle.classList.remove("wte-resizing");
            document.body.style.cursor = prevCursor;
            document.body.style.userSelect = prevSelect;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        });
        handle.addEventListener("click", (e) => e.stopPropagation());
      });
    });
  }
  var init_resize = __esm({
    "src/resize.js"() {
      init_utils();
    }
  });

  // src/remap.js
  function shiftIndex(idx, fromIdx, toIdx) {
    if (idx === fromIdx) return toIdx;
    if (fromIdx < toIdx && idx > fromIdx && idx <= toIdx) return idx - 1;
    if (fromIdx > toIdx && idx >= toIdx && idx < fromIdx) return idx + 1;
    return idx;
  }
  function remapColFilters(table, fromIdx, toIdx) {
    if (!table._wteColFilters || Object.keys(table._wteColFilters).length === 0) return;
    const newFilters = {};
    for (const [idxStr, filter] of Object.entries(table._wteColFilters)) {
      newFilters[shiftIndex(parseInt(idxStr), fromIdx, toIdx)] = filter;
    }
    table._wteColFilters = newFilters;
  }
  var init_remap = __esm({
    "src/remap.js"() {
    }
  });

  // src/colvis.js
  var colvis_exports = {};
  __export(colvis_exports, {
    applyColVisibility: () => applyColVisibility,
    getColLabel: () => getColLabel,
    getThColIdx: () => getThColIdx,
    getVisibleColIndices: () => getVisibleColIndices,
    hideColVisibilityPanel: () => hideColVisibilityPanel,
    hideColumn: () => hideColumn,
    remapHiddenCols: () => remapHiddenCols,
    showColVisibilityPanel: () => showColVisibilityPanel,
    showColumn: () => showColumn
  });
  function getThColIdx(table, thEl) {
    if (thEl.dataset.col !== void 0) return parseInt(thEl.dataset.col);
    return getHeaderCells(table).indexOf(thEl);
  }
  function getColLabel(table, colIdx) {
    const th = getHeaderCells(table)[colIdx];
    if (!th) return `\u5217 ${colIdx + 1}`;
    const clone = th.cloneNode(true);
    clone.querySelectorAll(".wte-th-controls, .wte-col-resizer").forEach((n) => n.remove());
    return clone.textContent.trim() || `\u5217 ${colIdx + 1}`;
  }
  function applyColVisibility(table) {
    const hidden = table._wteHiddenCols || /* @__PURE__ */ new Set();
    const allRows = [
      ...table.tHead ? Array.from(table.tHead.rows) : [],
      ...getCachedBodyRows(table)
    ];
    allRows.forEach((row) => {
      Array.from(row.cells).forEach((cell, i) => {
        cell.classList.toggle("wte-col-hidden", hidden.has(i));
      });
    });
    if (table._wteCols) {
      table._wteCols.forEach((col, i) => {
        col.style.display = hidden.has(i) ? "none" : "";
      });
    }
  }
  function hideColumn(table, colIdx) {
    if (!table._wteHiddenCols) table._wteHiddenCols = /* @__PURE__ */ new Set();
    const totalCols = getHeaderCells(table).length;
    const hiddenCount = table._wteHiddenCols.size;
    if (hiddenCount >= totalCols - 1) {
      notify("\u6700\u4F4E1\u5217\u306F\u8868\u793A\u304C\u5FC5\u8981\u3067\u3059\u3002");
      return;
    }
    if (table._wteLvColIdx !== void 0 && colIdx === table._wteLvColIdx) {
      notify("\u30C4\u30EA\u30FC\u306E\u30EC\u30D9\u30EB\u5217\u306F\u975E\u8868\u793A\u306B\u3067\u304D\u307E\u305B\u3093\u3002");
      return;
    }
    table._wteHiddenCols.add(colIdx);
    applyColVisibility(table);
    saveSession(table);
  }
  function showColumn(table, colIdx) {
    if (!table._wteHiddenCols) return;
    table._wteHiddenCols.delete(colIdx);
    applyColVisibility(table);
    saveSession(table);
  }
  function remapHiddenCols(table, fromIdx, toIdx) {
    if (!table._wteHiddenCols || table._wteHiddenCols.size === 0) return;
    const newHidden = /* @__PURE__ */ new Set();
    for (const idx of table._wteHiddenCols) newHidden.add(shiftIndex(idx, fromIdx, toIdx));
    table._wteHiddenCols = newHidden;
  }
  function hideColVisibilityPanel() {
    document.getElementById("wte-col-vis-panel")?.remove();
  }
  function showColVisibilityPanel(table, clientX, clientY) {
    hideColVisibilityPanel();
    const headers = getHeaderCells(table);
    if (!headers.length) return;
    const panel = document.createElement("div");
    panel.id = "wte-col-vis-panel";
    panel.className = "wte-col-vis-panel";
    const title = document.createElement("div");
    title.className = "wte-col-vis-title";
    title.textContent = "\u5217\u306E\u8868\u793A / \u975E\u8868\u793A";
    panel.appendChild(title);
    const list = document.createElement("div");
    list.className = "wte-col-vis-list";
    const updateDisabledStates = () => {
      const hiddenCount = table._wteHiddenCols?.size ?? 0;
      const totalCols = headers.length;
      list.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
        if (table._wteLvColIdx !== void 0 && i === table._wteLvColIdx) return;
        cb.disabled = cb.checked && hiddenCount >= totalCols - 1;
      });
    };
    headers.forEach((_, i) => {
      const isHidden = table._wteHiddenCols?.has(i) ?? false;
      const isLevelCol = table._wteLvColIdx !== void 0 && i === table._wteLvColIdx;
      const label = document.createElement("label");
      label.className = "wte-col-vis-item" + (isLevelCol ? " wte-col-vis-locked" : "");
      if (isLevelCol) label.title = "\u30C4\u30EA\u30FC\u306E\u30EC\u30D9\u30EB\u5217\u306F\u5909\u66F4\u3067\u304D\u307E\u305B\u3093";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !isHidden;
      cb.disabled = isLevelCol;
      cb.addEventListener("change", () => {
        if (cb.checked) {
          showColumn(table, i);
        } else {
          hideColumn(table, i);
        }
        updateDisabledStates();
      });
      label.append(cb, "\xA0" + getColLabel(table, i));
      list.appendChild(label);
    });
    updateDisabledStates();
    panel.appendChild(list);
    document.body.appendChild(panel);
    positionPopup(panel, clientX, clientY);
    addOutsideClickListener(panel, hideColVisibilityPanel);
  }
  function getVisibleColIndices(table) {
    const hidden = table._wteHiddenCols || /* @__PURE__ */ new Set();
    const headers = getHeaderCells(table);
    return Array.from({ length: headers.length }, (_, i) => i).filter((i) => !hidden.has(i));
  }
  var init_colvis = __esm({
    "src/colvis.js"() {
      init_utils();
      init_session();
      init_remap();
    }
  });

  // src/reorder.js
  function addColReorderHandles(table) {
    const headers = getHeaderCells(table);
    if (headers.length < 2) return;
    headers.forEach((th) => {
      th.setAttribute("draggable", "true");
      th.addEventListener("dragstart", (e) => {
        table._wteDragColIdx = parseInt(th.dataset.col);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", th.dataset.col);
        th.classList.add("wte-col-dragging");
      });
      th.addEventListener("dragend", () => {
        th.classList.remove("wte-col-dragging");
        getHeaderCells(table).forEach((h) => h.classList.remove("wte-col-drag-over"));
        table._wteDragColIdx = void 0;
      });
      th.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      });
      th.addEventListener("dragenter", (e) => {
        e.preventDefault();
        const toIdx = parseInt(th.dataset.col);
        if (table._wteDragColIdx !== void 0 && table._wteDragColIdx !== toIdx) {
          getHeaderCells(table).forEach((h) => h.classList.remove("wte-col-drag-over"));
          th.classList.add("wte-col-drag-over");
        }
      });
      th.addEventListener("dragleave", () => {
        th.classList.remove("wte-col-drag-over");
      });
      th.addEventListener("drop", (e) => {
        e.preventDefault();
        th.classList.remove("wte-col-drag-over");
        const fromIdx = table._wteDragColIdx;
        const toIdx = parseInt(th.dataset.col);
        if (fromIdx === void 0 || fromIdx === toIdx) return;
        reorderColumn(table, fromIdx, toIdx);
      });
    });
  }
  function reorderColumn(table, fromIdx, toIdx) {
    const allRows = [
      ...table.tHead ? Array.from(table.tHead.rows) : [],
      ...getBodyRows(table)
    ];
    allRows.forEach((row) => {
      const cells = Array.from(row.cells);
      const cell = cells[fromIdx];
      const ref = cells[toIdx];
      if (!cell || !ref) return;
      if (fromIdx < toIdx) ref.after(cell);
      else ref.before(cell);
    });
    if (table._wteCols) {
      const col = table._wteCols[fromIdx];
      const refCol = table._wteCols[toIdx];
      if (col && refCol) {
        if (fromIdx < toIdx) refCol.after(col);
        else refCol.before(col);
      }
      const newCols = [...table._wteCols];
      newCols.splice(fromIdx, 1);
      newCols.splice(toIdx, 0, col);
      table._wteCols = newCols;
    }
    getHeaderCells(table).forEach((th, i) => {
      th.dataset.col = i;
    });
    remapColFilters(table, fromIdx, toIdx);
    remapHiddenCols(table, fromIdx, toIdx);
    if (table._wteLvColIdx !== void 0) {
      table._wteLvColIdx = shiftIndex(table._wteLvColIdx, fromIdx, toIdx);
    }
  }
  var init_reorder = __esm({
    "src/reorder.js"() {
      init_utils();
      init_remap();
      init_colvis();
    }
  });

  // src/interaction.js
  function setupTableInteraction(table) {
    if (table._wteInteractionSetup) return;
    table._wteInteractionSetup = true;
    table.addEventListener("click", (e) => {
      if (!isTransformed(table)) return;
      if (e.target.classList.contains("wte-btn")) return;
      const row = e.target.closest("tbody tr");
      if (!row || row.hidden) return;
      if (e.shiftKey && table._wteLastClickedRow) {
        rangeSelect(table, row);
      } else if (e.ctrlKey || e.metaKey) {
        row.classList.toggle("wte-selected");
        table._wteLastClickedRow = row;
      } else {
        clearSelection(table);
        row.classList.add("wte-selected");
        table._wteLastClickedRow = row;
      }
    });
    table.addEventListener("dblclick", (e) => {
      if (!isTransformed(table)) return;
      if (e.target.classList.contains("wte-btn")) return;
      const row = e.target.closest("tbody tr");
      if (!row || row.hidden) return;
      row.classList.toggle("wte-highlight");
    });
  }
  function clearSelection(table) {
    table.querySelectorAll("tbody tr.wte-selected").forEach((r) => r.classList.remove("wte-selected"));
  }
  function rangeSelect(table, targetRow) {
    const rows = getBodyRows(table).filter((r) => !r.hidden);
    const startIdx = rows.indexOf(table._wteLastClickedRow);
    const endIdx = rows.indexOf(targetRow);
    if (startIdx === -1 || endIdx === -1) return;
    clearSelection(table);
    const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    rows.slice(from, to + 1).forEach((r) => r.classList.add("wte-selected"));
  }
  var init_interaction = __esm({
    "src/interaction.js"() {
      init_utils();
    }
  });

  // src/tree.js
  var tree_exports = {};
  __export(tree_exports, {
    LEVEL_RE: () => LEVEL_RE,
    applyVisibility: () => applyVisibility,
    collapseAll: () => collapseAll,
    expandAll: () => expandAll,
    expandToLevel: () => expandToLevel,
    stripIndentPrefix: () => stripIndentPrefix,
    toggleNode: () => toggleNode,
    transformToTree: () => transformToTree,
    underscoreLevel: () => underscoreLevel
  });
  function underscoreLevel(text) {
    const m = text.match(/^[_\u3000\u00a0 ]*/);
    return (m ? m[0].length : 0) + 1;
  }
  function stripIndentPrefix(cell) {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    const node = walker.nextNode();
    if (node) node.textContent = node.textContent.replace(/^[_\u3000\u00a0 ]+/, "");
  }
  function transformToTree(table) {
    if (isTransformed(table)) {
      notify("\u3059\u3067\u306B\u5909\u63DB\u6E08\u307F\u3067\u3059\u3002\u5148\u306B\u300C\u5143\u306B\u623B\u3059\u300D\u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    saveSnapshot(table);
    ensureStructure(table);
    getHeaderCells(table).forEach((cell, i) => {
      cell.dataset.col = i;
    });
    const headCells = getHeaderCells(table);
    const lvIdx = headCells.findIndex((c) => LEVEL_RE.test(c.textContent.trim()));
    const rows = getBodyRows(table);
    if (lvIdx !== -1) table._wteLvColIdx = lvIdx;
    let nodes;
    let indentMode = false;
    if (lvIdx !== -1) {
      nodes = rows.map((row) => {
        const cellText = row.cells[lvIdx]?.textContent.trim() ?? "";
        const raw = parseInt(cellText, 10);
        const level = !isNaN(raw) && raw >= 1 ? raw : underscoreLevel(cellText);
        return { el: row, level, children: [], parent: null, open: true };
      });
    } else {
      const hasIndent = rows.some(
        (row) => /^[_\u3000\u00a0 ]+/.test(row.cells[0]?.textContent.trim() ?? "")
      );
      if (!hasIndent) {
        notify(
          "\u30EC\u30D9\u30EB\u5217\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093\u3002\n\u5BFE\u5FDC\u5217\u540D: Level / Lvl / Lv / Tier / Rank / Indent / Node / Step / Depth\n\u3000\u3000\u3000\u3000\u3000\u30EC\u30D9\u30EB / \u968E\u5C64 / \u6DF1\u3055 / \u6DF1\u5EA6 / \u6BB5\u968E / \u30CE\u30FC\u30C9\n\u307E\u305F\u306F\u5148\u982D\u5217\u306E\u5024\u3092\u300C_\u300D\u3067\u5B57\u4E0B\u3052\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
        );
        return;
      }
      indentMode = true;
      nodes = rows.map((row) => ({
        el: row,
        level: underscoreLevel(row.cells[0]?.textContent.trim() ?? ""),
        children: [],
        parent: null,
        open: true
      }));
    }
    table.classList.add("wte-tree");
    const wrap = document.createElement("div");
    wrap.className = "wte-tree-wrap";
    table.before(wrap);
    wrap.appendChild(table);
    const stack = [];
    nodes.forEach((node) => {
      while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
      if (stack.length) {
        node.parent = stack[stack.length - 1];
        node.parent.children.push(node);
      }
      stack.push(node);
    });
    table._wteNodes = nodes;
    if (indentMode) {
      nodes.forEach((node) => {
        const cell = node.el.cells[0];
        if (cell) stripIndentPrefix(cell);
      });
    }
    nodes.forEach((node) => {
      const cell = node.el.cells[0];
      if (!cell) return;
      const indentPx = 8 + (node.level - 1) * 20;
      cell.style.setProperty("--wte-indent", `${indentPx}px`);
      if (node.children.length) {
        const btn = document.createElement("button");
        btn.className = "wte-btn";
        btn.textContent = "\u2212";
        btn.title = "\u6298\u308A\u305F\u305F\u3080";
        btn.setAttribute("aria-expanded", "true");
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleNode(node, btn);
        });
        cell.insertBefore(btn, cell.firstChild);
      } else {
        const spc = document.createElement("span");
        spc.className = "wte-spc";
        cell.insertBefore(spc, cell.firstChild);
      }
    });
    setupTableInteraction(table);
    addColResizeHandles(table);
    addColReorderHandles(table);
    notify("\u30C4\u30EA\u30FC\u8868\u793A\u306B\u5909\u63DB\u3057\u307E\u3057\u305F \u2713");
  }
  function setToggleBtn(btn, open) {
    btn.textContent = open ? "\u2212" : "+";
    btn.title = open ? "\u6298\u308A\u305F\u305F\u3080" : "\u5C55\u958B\u3059\u308B";
    btn.setAttribute("aria-expanded", String(open));
  }
  function expandAll(table) {
    const nodes = table._wteNodes;
    if (!nodes) return;
    nodes.forEach((node) => {
      node.el.hidden = false;
      if (node.children.length) {
        node.open = true;
        const btn = node.el.cells[0]?.querySelector(".wte-btn");
        if (btn) setToggleBtn(btn, true);
      }
    });
  }
  function collapseAll(table) {
    const nodes = table._wteNodes;
    if (!nodes) return;
    nodes.forEach((node) => {
      if (node.parent) node.el.hidden = true;
      if (node.children.length) {
        node.open = false;
        const btn = node.el.cells[0]?.querySelector(".wte-btn");
        if (btn) setToggleBtn(btn, false);
      }
    });
  }
  function expandToLevel(table, maxLevel) {
    const nodes = table._wteNodes;
    if (!nodes) return;
    nodes.forEach((node) => {
      node.el.hidden = node.level > maxLevel;
      if (node.children.length) {
        const open = node.level < maxLevel;
        node.open = open;
        const btn = node.el.cells[0]?.querySelector(".wte-btn");
        if (btn) setToggleBtn(btn, open);
      }
    });
  }
  function toggleNode(node, btn) {
    node.open = !node.open;
    setToggleBtn(btn, node.open);
    applyVisibility(node.children, node.open);
  }
  function applyVisibility(children, show) {
    children.forEach((c) => {
      c.el.hidden = !show;
      applyVisibility(c.children, show && c.open);
    });
  }
  var LEVEL_RE;
  var init_tree = __esm({
    "src/tree.js"() {
      init_utils();
      init_resize();
      init_reorder();
      init_interaction();
      LEVEL_RE = /^(level|lvl|lv\.?|tier|rank|indent|node|step|depth|レベル|階層|深さ|深度|段階|ノード)$/i;
    }
  });

  // src/filters.js
  var filters_exports = {};
  __export(filters_exports, {
    applyAllFilters: () => applyAllFilters,
    hideColFilterPanel: () => hideColFilterPanel,
    showColFilterPanel: () => showColFilterPanel
  });
  function applyAllFilters(table) {
    const colFilters = table._wteColFilters || {};
    const searchQ = (table._wteSearchQuery || "").toLowerCase();
    const hasColFilters = Object.keys(colFilters).length > 0;
    getCachedBodyRows(table).forEach((row) => {
      let visible = true;
      if (searchQ) {
        const text = row._wteText ?? row.textContent.toLowerCase();
        if (!text.includes(searchQ)) visible = false;
      }
      if (visible && hasColFilters) {
        for (const [idxStr, filter] of Object.entries(colFilters)) {
          const idx = parseInt(idxStr);
          const cellText = row._wteCells ? row._wteCells[idx] ?? "" : row.cells[idx]?.textContent.trim() ?? "";
          if (filter.checkedValues && !filter.checkedValues.has(cellText)) {
            visible = false;
            break;
          }
        }
      }
      row.hidden = !visible;
    });
    if (typeof table._wteApplyStripes === "function") table._wteApplyStripes();
    if (typeof table._wteRefreshCount === "function") table._wteRefreshCount();
    saveSession(table);
  }
  function hideColFilterPanel() {
    document.getElementById("wte-col-filter-panel")?.remove();
  }
  function showColFilterPanel(table, colIdx, th) {
    const existing = document.getElementById("wte-col-filter-panel");
    if (existing) {
      const isSame = existing._wteColIdx === colIdx && existing._wteTable === table;
      hideColFilterPanel();
      if (isSame) return;
    }
    const rows = getCachedBodyRows(table);
    const uniqueValues = [...new Set(
      rows.map((r) => r.cells[colIdx]?.textContent.trim() ?? "")
    )].sort((a, b) => a.localeCompare(b, "ja"));
    const currentFilter = (table._wteColFilters || {})[colIdx];
    const activeValues = currentFilter?.checkedValues ? new Set(currentFilter.checkedValues) : new Set(uniqueValues);
    const panel = document.createElement("div");
    panel.id = "wte-col-filter-panel";
    panel.className = "wte-col-filter-panel";
    panel._wteTable = table;
    panel._wteColIdx = colIdx;
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "wte-filter-search";
    searchInput.placeholder = "\u5024\u3092\u691C\u7D22\u2026";
    const selectRow = document.createElement("div");
    selectRow.className = "wte-filter-select-row";
    const selectAllBtn = document.createElement("button");
    selectAllBtn.className = "wte-filter-select-all";
    selectAllBtn.textContent = "\u5168\u9078\u629E";
    const deselectAllBtn = document.createElement("button");
    deselectAllBtn.className = "wte-filter-select-all";
    deselectAllBtn.textContent = "\u5168\u89E3\u9664";
    selectRow.append(selectAllBtn, deselectAllBtn);
    const listEl = document.createElement("div");
    listEl.className = "wte-filter-list";
    const renderList = (filterText = "") => {
      listEl.innerHTML = "";
      const q = filterText.toLowerCase();
      const filtered = uniqueValues.filter((v) => !q || v.toLowerCase().includes(q));
      filtered.forEach((val) => {
        const label = document.createElement("label");
        label.className = "wte-filter-item";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = val;
        cb.checked = activeValues.has(val);
        cb.addEventListener("change", () => {
          if (cb.checked) activeValues.add(val);
          else activeValues.delete(val);
        });
        label.append(cb, document.createTextNode("\xA0" + (val === "" ? "(\u7A7A)" : val)));
        listEl.appendChild(label);
      });
    };
    renderList();
    searchInput.addEventListener("input", () => renderList(searchInput.value));
    selectAllBtn.addEventListener("click", () => {
      uniqueValues.forEach((v) => activeValues.add(v));
      renderList(searchInput.value);
    });
    deselectAllBtn.addEventListener("click", () => {
      activeValues.clear();
      renderList(searchInput.value);
    });
    const btnRow = document.createElement("div");
    btnRow.className = "wte-filter-btn-row";
    const clearBtn = document.createElement("button");
    clearBtn.className = "wte-filter-clear";
    clearBtn.textContent = "\u30AF\u30EA\u30A2";
    const applyBtn = document.createElement("button");
    applyBtn.className = "wte-filter-apply";
    applyBtn.textContent = "\u9069\u7528";
    clearBtn.addEventListener("click", () => {
      if (!table._wteColFilters) table._wteColFilters = {};
      delete table._wteColFilters[colIdx];
      th.querySelector(".wte-filter-btn")?.classList.remove("wte-filter-active");
      applyAllFilters(table);
      hideColFilterPanel();
    });
    applyBtn.addEventListener("click", () => {
      if (!table._wteColFilters) table._wteColFilters = {};
      if (activeValues.size >= uniqueValues.length) {
        delete table._wteColFilters[colIdx];
        th.querySelector(".wte-filter-btn")?.classList.remove("wte-filter-active");
      } else {
        table._wteColFilters[colIdx] = { checkedValues: new Set(activeValues) };
        th.querySelector(".wte-filter-btn")?.classList.add("wte-filter-active");
      }
      applyAllFilters(table);
      hideColFilterPanel();
    });
    btnRow.append(clearBtn, applyBtn);
    panel.append(searchInput, selectRow, listEl, btnRow);
    document.body.appendChild(panel);
    const rect = th.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = 220;
    let left = rect.left;
    let top = rect.bottom + 2;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    requestAnimationFrame(() => {
      const panelH = panel.offsetHeight;
      if (left + panelW > vw - 8) left = vw - panelW - 8;
      if (top + panelH > vh - 8) top = rect.top - panelH - 2;
      panel.style.left = `${Math.max(8, left)}px`;
      panel.style.top = `${Math.max(8, top)}px`;
    });
    addOutsideClickListener(panel, hideColFilterPanel);
  }
  var init_filters = __esm({
    "src/filters.js"() {
      init_utils();
      init_session();
    }
  });

  // src/session.js
  function tableKey(table) {
    const idx = Array.from(document.querySelectorAll("table")).indexOf(table);
    return `wte:${location.href}:${idx}`;
  }
  function saveSession(table) {
    const mode = table.classList.contains("wte-rich") ? "rich" : table.classList.contains("wte-tree") ? "tree" : null;
    if (!mode) return;
    const colFilters = {};
    for (const [idx, filter] of Object.entries(table._wteColFilters || {})) {
      if (filter.checkedValues) colFilters[idx] = [...filter.checkedValues];
    }
    const state = {
      mode,
      searchQuery: table._wteSearchQuery || "",
      colFilters,
      hiddenCols: [...table._wteHiddenCols || []],
      colCount: Array.from(table.tHead?.rows[0]?.cells || []).length
    };
    try {
      sessionStorage.setItem(tableKey(table), JSON.stringify(state));
    } catch {
    }
  }
  function clearSession(table) {
    try {
      sessionStorage.removeItem(tableKey(table));
    } catch {
    }
  }
  async function restoreAllSessions() {
    const prefix = `wte:${location.href}:`;
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    if (!keys.length) return;
    const { transformToRich: transformToRich2 } = await Promise.resolve().then(() => (init_rich(), rich_exports));
    const { transformToTree: transformToTree2 } = await Promise.resolve().then(() => (init_tree(), tree_exports));
    const { applyAllFilters: applyAllFilters2 } = await Promise.resolve().then(() => (init_filters(), filters_exports));
    const { applyColVisibility: applyColVisibility2 } = await Promise.resolve().then(() => (init_colvis(), colvis_exports));
    const tables = Array.from(document.querySelectorAll("table"));
    for (const key of keys) {
      const idx = parseInt(key.slice(prefix.length));
      if (isNaN(idx)) continue;
      const table = tables[idx];
      if (!table || isTransformed(table)) continue;
      let state;
      try {
        state = JSON.parse(sessionStorage.getItem(key));
      } catch {
        continue;
      }
      if (!state?.mode) continue;
      if (state.mode === "rich") transformToRich2(table);
      else transformToTree2(table);
      const currentColCount = Array.from(table.tHead?.rows[0]?.cells || []).length;
      if (currentColCount !== state.colCount) continue;
      if (state.searchQuery) {
        table._wteSearchQuery = state.searchQuery;
        const searchInput = table.closest(".wte-wrap")?.querySelector(".wte-search");
        if (searchInput) searchInput.value = state.searchQuery;
      }
      if (state.colFilters && Object.keys(state.colFilters).length) {
        table._wteColFilters = {};
        for (const [idx2, vals] of Object.entries(state.colFilters)) {
          table._wteColFilters[idx2] = { checkedValues: new Set(vals) };
        }
        Object.keys(state.colFilters).forEach((i) => {
          const th = Array.from(table.tHead?.rows[0]?.cells || [])[parseInt(i)];
          th?.querySelector(".wte-filter-btn")?.classList.add("wte-filter-active");
        });
      }
      if (state.hiddenCols?.length) {
        table._wteHiddenCols = new Set(state.hiddenCols);
        applyColVisibility2(table);
      }
      if (state.searchQuery || Object.keys(state.colFilters || {}).length) {
        applyAllFilters2(table);
      }
    }
  }
  var init_session = __esm({
    "src/session.js"() {
      init_utils();
    }
  });

  // src/sort.js
  function sortBy(table, col) {
    const headers = getHeaderCells(table);
    const th = headers[col];
    if (!th) return;
    const current = th.dataset.dir;
    const next = current === "" ? "asc" : current === "asc" ? "desc" : "";
    headers.forEach((h) => {
      h.dataset.dir = "";
      const a = h.querySelector(".wte-arrow");
      if (a) a.textContent = "\u2195";
      h.setAttribute("aria-sort", "none");
    });
    th.dataset.dir = next;
    const arrow = th.querySelector(".wte-arrow");
    if (arrow) arrow.textContent = next === "asc" ? "\u2191" : next === "desc" ? "\u2193" : "\u2195";
    const rows = getBodyRows(table);
    if (next === "") {
      const originalOrder = table._wteOriginalOrder;
      if (originalOrder) {
        const tbody2 = table.tBodies[0] ?? table.createTBody();
        originalOrder.forEach((r) => tbody2.appendChild(r));
        table._wteBodyRowsCache = [...originalOrder];
      }
      if (typeof table._wteApplyStripes === "function") table._wteApplyStripes();
      return;
    }
    if (!table._wteOriginalOrder) {
      table._wteOriginalOrder = [...rows];
    }
    th.setAttribute("aria-sort", next === "asc" ? "ascending" : "descending");
    rows.sort((a, b) => cmpCells(a.cells[col], b.cells[col], next === "asc"));
    const tbody = table.tBodies[0] ?? table.createTBody();
    rows.forEach((r) => tbody.appendChild(r));
    table._wteBodyRowsCache = rows;
    if (typeof table._wteApplyStripes === "function") table._wteApplyStripes();
  }
  function cmpCells(a, b, asc) {
    const av = a?.textContent.trim() ?? "";
    const bv = b?.textContent.trim() ?? "";
    const sign = asc ? 1 : -1;
    const an = parseNum(av), bn = parseNum(bv);
    if (an !== null && bn !== null) return sign * (an - bn);
    const ad = Date.parse(av), bd = Date.parse(bv);
    if (!isNaN(ad) && !isNaN(bd)) return sign * (ad - bd);
    return sign * av.localeCompare(bv, "ja");
  }
  function parseNum(s) {
    const n = parseFloat(s.replace(/[,，¥$€£%\s]/g, ""));
    return isNaN(n) ? null : n;
  }
  var init_sort = __esm({
    "src/sort.js"() {
      init_utils();
    }
  });

  // src/rich.js
  var rich_exports = {};
  __export(rich_exports, {
    transformToRich: () => transformToRich
  });
  function transformToRich(table) {
    if (isTransformed(table)) {
      notify("\u3059\u3067\u306B\u5909\u63DB\u6E08\u307F\u3067\u3059\u3002\u5148\u306B\u300C\u5143\u306B\u623B\u3059\u300D\u3092\u5B9F\u884C\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    saveSnapshot(table);
    const wrap = document.createElement("div");
    wrap.className = "wte-wrap";
    table.before(wrap);
    const toolbar = document.createElement("div");
    toolbar.className = "wte-toolbar";
    const search = Object.assign(document.createElement("input"), {
      type: "text",
      className: "wte-search",
      placeholder: "\u{1F50D}  \u30C6\u30FC\u30D6\u30EB\u3092\u691C\u7D22\u2026"
    });
    const counter = Object.assign(document.createElement("span"), { className: "wte-counter" });
    toolbar.append(search, counter);
    wrap.append(toolbar, table);
    table.classList.add("wte-rich");
    table._wteColFilters = {};
    table._wteSearchQuery = "";
    ensureStructure(table);
    {
      const bodyRows = getBodyRows(table);
      table._wteBodyRowsCache = bodyRows;
      bodyRows.forEach((row) => {
        row._wteText = row.textContent.toLowerCase();
        row._wteCells = Array.from(row.cells).map((c) => c.textContent.trim());
      });
    }
    getHeaderCells(table).forEach((cell, i) => {
      cell.classList.add("wte-th");
      cell.dataset.col = i;
      cell.dataset.dir = "";
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("role", "columnheader");
      cell.setAttribute("aria-sort", "none");
      const labelEl = document.createElement("div");
      labelEl.className = "wte-th-label";
      while (cell.firstChild) labelEl.appendChild(cell.firstChild);
      const controlsEl = document.createElement("div");
      controlsEl.className = "wte-th-controls";
      const arrow = Object.assign(document.createElement("span"), {
        className: "wte-arrow",
        ariaHidden: "true",
        textContent: "\u2195"
      });
      const filterBtn = document.createElement("button");
      filterBtn.className = "wte-filter-btn";
      filterBtn.textContent = "\u25BC";
      filterBtn.title = "\u5217\u30D5\u30A3\u30EB\u30BF\u30FC";
      controlsEl.append(arrow, filterBtn);
      cell.append(labelEl, controlsEl);
      cell.addEventListener("click", () => sortBy(table, parseInt(cell.dataset.col)));
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          sortBy(table, parseInt(cell.dataset.col));
        }
      });
      filterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showColFilterPanel(table, parseInt(cell.dataset.col), cell);
      });
    });
    const applyStripes = () => {
      let n = 0;
      getCachedBodyRows(table).forEach((r) => {
        if (!r.hidden) n++;
        r.classList.toggle("wte-stripe", !r.hidden && n % 2 === 0);
      });
    };
    table._wteApplyStripes = applyStripes;
    const refreshCount = () => {
      const rows = getCachedBodyRows(table);
      const vis = rows.filter((r) => !r.hidden).length;
      counter.textContent = vis === rows.length ? `${rows.length} \u4EF6` : `${vis} / ${rows.length} \u4EF6`;
    };
    table._wteRefreshCount = refreshCount;
    let _searchTimer;
    search.addEventListener("input", () => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => {
        table._wteSearchQuery = search.value;
        applyAllFilters(table);
      }, 150);
    });
    refreshCount();
    applyStripes();
    setupTableInteraction(table);
    addColResizeHandles(table);
    addColReorderHandles(table);
    saveSession(table);
    notify("\u30EA\u30C3\u30C1\u8868\u793A\u306B\u5909\u63DB\u3057\u307E\u3057\u305F \u2713");
  }
  var init_rich = __esm({
    "src/rich.js"() {
      init_utils();
      init_session();
      init_sort();
      init_filters();
      init_resize();
      init_reorder();
      init_interaction();
    }
  });

  // src/index.js
  init_utils();
  init_rich();
  init_tree();

  // src/reset.js
  init_utils();
  init_filters();
  init_colvis();
  init_session();
  function resetTable(table) {
    if (table._wteSnapNode === void 0) {
      notify("\u3053\u306E\u30C6\u30FC\u30D6\u30EB\u306F\u307E\u3060\u5909\u63DB\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002");
      return;
    }
    const wrap = table.closest(".wte-wrap, .wte-tree-wrap");
    if (wrap) {
      wrap.before(table);
      wrap.remove();
    }
    while (table.firstChild) table.removeChild(table.firstChild);
    const snapClone = table._wteSnapNode.cloneNode(true);
    while (snapClone.firstChild) table.appendChild(snapClone.firstChild);
    const origStyle = table._wteSnapNode.getAttribute("style");
    if (origStyle) table.setAttribute("style", origStyle);
    else table.removeAttribute("style");
    table.classList.remove("wte-rich", "wte-tree");
    delete table._wteSnapNode;
    delete table._wteBodyRowsCache;
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
    clearSession(table);
    hideColFilterPanel();
    hideColVisibilityPanel();
    notify("\u5143\u306E\u8868\u793A\u306B\u623B\u3057\u307E\u3057\u305F \u2713");
  }

  // src/menu.js
  init_utils();
  init_filters();
  init_colvis();

  // src/csv.js
  init_utils();
  init_colvis();
  function exportTableAsCSV(table) {
    const headers = getHeaderCells(table);
    const visColIdxs = getVisibleColIndices(table);
    if (!visColIdxs.length) {
      notify("\u8868\u793A\u4E2D\u306E\u5217\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
      return;
    }
    const escCSV = (s) => {
      if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };
    const lines = [];
    lines.push(visColIdxs.map((i) => escCSV(cleanCell(headers[i]))).join(","));
    const emptyCell = document.createElement("td");
    const visibleRows = getBodyRows(table).filter((r) => !r.hidden);
    visibleRows.forEach((row) => {
      lines.push(visColIdxs.map((i) => escCSV(cleanCell(row.cells[i] ?? emptyCell))).join(","));
    });
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: "table_export.csv",
      style: "display:none"
    });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1e3);
    notify(`${visibleRows.length} \u884C\u3092 CSV \u3067\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3057\u307E\u3057\u305F \u2713`);
  }

  // src/menu.js
  init_rich();
  init_tree();
  init_interaction();
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("wte-ctx-menu");
    if (menu && !menu.hidden && !menu.contains(e.target)) hideMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideMenu();
      hideColFilterPanel();
      hideColVisibilityPanel();
      document.querySelectorAll(".wte-rich, .wte-tree").forEach((t) => clearSelection(t));
    }
  });
  window.addEventListener("scroll", (e) => {
    const filterPanel = document.querySelector(".wte-col-filter-panel");
    const visPanel = document.querySelector(".wte-col-vis-panel");
    hideMenu();
    if (!filterPanel || !filterPanel.contains(e.target)) hideColFilterPanel();
    if (!visPanel || !visPanel.contains(e.target)) hideColVisibilityPanel();
  }, { passive: true, capture: true });
  function getOrCreateMenu() {
    let menu = document.getElementById("wte-ctx-menu");
    if (!menu) {
      menu = document.createElement("div");
      menu.id = "wte-ctx-menu";
      menu.className = "wte-ctx-menu";
      menu.hidden = true;
      document.body.appendChild(menu);
    }
    return menu;
  }
  function hideMenu() {
    const menu = document.getElementById("wte-ctx-menu");
    if (menu) menu.hidden = true;
  }
  function showMenu(clientX, clientY, table, row, th = null) {
    const selectedRows = getSelectedRows(table);
    let targets;
    if (row) {
      targets = selectedRows.has(row) ? selectedRows : /* @__PURE__ */ new Set([row]);
    } else {
      targets = selectedRows;
    }
    const hasTargets = targets.size > 0;
    const allHighlit = hasTargets && [...targets].every((r) => r.classList.contains("wte-highlight"));
    const isRich = table.classList.contains("wte-rich");
    const hasHiddenCols = (table._wteHiddenCols?.size ?? 0) > 0;
    const menu = getOrCreateMenu();
    menu.innerHTML = "";
    menu.appendChild(makeMenuItem(
      allHighlit ? "\u30CF\u30A4\u30E9\u30A4\u30C8\u3092\u89E3\u9664" : "\u884C\u3092\u30CF\u30A4\u30E9\u30A4\u30C8",
      () => {
        targets.forEach((r) => r.classList.toggle("wte-highlight", !allHighlit));
        hideMenu();
      },
      !hasTargets
    ));
    menu.appendChild(makeSep());
    menu.appendChild(makeMenuItem("\u9078\u629E\u3057\u305F\u884C\u3092\u30B3\u30D4\u30FC", () => {
      copyRowsAsTSV([...targets], false, table);
      hideMenu();
    }, !hasTargets));
    menu.appendChild(makeMenuItem("\u30D8\u30C3\u30C0\u30FC\u3068\u9078\u629E\u3057\u305F\u884C\u3092\u30B3\u30D4\u30FC", () => {
      copyRowsAsTSV([...targets], true, table);
      hideMenu();
    }, !hasTargets));
    menu.appendChild(makeMenuItem("CSV \u3067\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9", () => {
      exportTableAsCSV(table);
      hideMenu();
    }));
    menu.appendChild(makeSep());
    if (th !== null) {
      const thColIdx = getThColIdx(table, th);
      const isLevelCol = table._wteLvColIdx !== void 0 && thColIdx === table._wteLvColIdx;
      const totalCols = getHeaderCells(table).length;
      const hiddenCount = table._wteHiddenCols?.size ?? 0;
      const isLastVisible = !table._wteHiddenCols?.has(thColIdx) && hiddenCount >= totalCols - 1;
      menu.appendChild(makeMenuItem(
        "\u3053\u306E\u5217\u3092\u975E\u8868\u793A",
        () => {
          hideColumn(table, thColIdx);
          hideMenu();
        },
        isLevelCol || isLastVisible
      ));
    }
    menu.appendChild(makeMenuItem(
      "\u975E\u8868\u793A\u5217\u306E\u7BA1\u7406",
      () => {
        hideMenu();
        showColVisibilityPanel(table, clientX, clientY);
      },
      !hasHiddenCols
    ));
    menu.appendChild(makeSep());
    const isWrapMode = table.classList.contains("wte-wrap-mode");
    menu.appendChild(makeMenuItem(
      isWrapMode ? "\u306F\u307F\u51FA\u3057\u8868\u793A\u306B\u3059\u308B\uFF08\u6539\u884C\u306A\u3057\uFF09" : "\u753B\u9762\u5185\u306B\u53CE\u3081\u308B\uFF08\u6539\u884C\u3042\u308A\uFF09",
      () => {
        const enabling = !table.classList.contains("wte-wrap-mode");
        table.classList.toggle("wte-wrap-mode");
        const wrapEl = table.closest(".wte-wrap, .wte-tree-wrap");
        if (wrapEl) wrapEl.style.width = enabling ? "100%" : "";
        if (enabling) {
          if (table._wteCols) {
            table._wteWrapColWidths = table._wteCols.map((c) => c.style.width);
            table._wteCols.forEach((c) => {
              c.style.width = "";
            });
          }
        } else {
          if (table._wteWrapColWidths && table._wteCols) {
            table._wteCols.forEach((c, i) => {
              c.style.width = table._wteWrapColWidths[i] || "";
            });
            table._wteWrapColWidths = null;
          }
        }
        hideMenu();
      }
    ));
    menu.appendChild(makeSep());
    menu.appendChild(makeMenuItem(
      isRich ? "\u30C4\u30EA\u30FC\u8868\u793A\u306B\u5909\u63DB" : "\u30EA\u30C3\u30C1\u8868\u793A\u306B\u5909\u63DB",
      () => {
        resetTable(table);
        if (isRich) transformToTree(table);
        else transformToRich(table);
        hideMenu();
      }
    ));
    if (!isRich && table._wteNodes) {
      const maxLv = Math.max(...table._wteNodes.map((n) => n.level));
      menu.appendChild(makeSep());
      menu.appendChild(makeMenuItem("\u5168\u5C55\u958B", () => {
        expandAll(table);
        hideMenu();
      }));
      menu.appendChild(makeMenuItem("\u5168\u6298\u7573\u307F", () => {
        collapseAll(table);
        hideMenu();
      }));
      for (let lv = 1; lv < maxLv; lv++) {
        const level = lv;
        menu.appendChild(makeMenuItem(
          `\u30EC\u30D9\u30EB${level}\u307E\u3067\u5C55\u958B`,
          () => {
            expandToLevel(table, level);
            hideMenu();
          }
        ));
      }
    }
    menu.appendChild(makeSep());
    menu.appendChild(makeMenuItem("\u5143\u306B\u623B\u3059", () => {
      resetTable(table);
      hideMenu();
    }));
    menu.hidden = false;
    positionPopup(menu, clientX, clientY);
  }
  function makeMenuItem(label, onClick, disabled = false) {
    const el = document.createElement("div");
    el.className = disabled ? "wte-ctx-item wte-ctx-disabled" : "wte-ctx-item";
    el.textContent = label;
    if (!disabled) el.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick();
    });
    return el;
  }
  function makeSep() {
    const el = document.createElement("div");
    el.className = "wte-ctx-sep";
    return el;
  }
  function getSelectedRows(table) {
    return new Set(table.querySelectorAll("tbody tr.wte-selected"));
  }
  function copyRowsAsTSV(rows, includeHeader, table) {
    const visibleRows = rows.filter((r) => !r.hidden);
    if (!visibleRows.length) {
      notify("\u30B3\u30D4\u30FC\u3059\u308B\u884C\u304C\u3042\u308A\u307E\u305B\u3093\u3002");
      return;
    }
    const headers = getHeaderCells(table);
    const visColIdxs = getVisibleColIndices(table);
    const esc = (s) => s.replace(/[\t\n]/g, " ");
    const text = (cell) => esc(cleanCell(cell));
    const emptyCell = document.createElement("td");
    const lines = [];
    if (includeHeader) lines.push(visColIdxs.map((i) => text(headers[i])).join("	"));
    visibleRows.forEach((r) => lines.push(visColIdxs.map((i) => text(r.cells[i] ?? emptyCell)).join("	")));
    const tsvText = lines.join("\n");
    const count = visibleRows.length;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(tsvText).then(() => notify(`${count} \u884C\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F \u2713`)).catch(() => fallbackCopy(tsvText, count));
    } else {
      fallbackCopy(tsvText, count);
    }
  }
  function fallbackCopy(text, rowCount) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;width:1px;height:1px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const ok = document.execCommand("copy");
      notify(ok ? `${rowCount} \u884C\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F \u2713` : copyFailMessage());
    } catch {
      notify(copyFailMessage());
    } finally {
      ta.remove();
    }
  }
  function copyFailMessage() {
    return location.protocol === "http:" ? "\u30B3\u30D4\u30FC\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08HTTP\u30DA\u30FC\u30B8\u3067\u306F\u30AF\u30EA\u30C3\u30D7\u30DC\u30FC\u30C9\u3078\u306E\u30A2\u30AF\u30BB\u30B9\u304C\u5236\u9650\u3055\u308C\u3066\u3044\u307E\u3059\uFF09\u3002CSV\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3092\u3054\u5229\u7528\u304F\u3060\u3055\u3044\u3002" : "\u30B3\u30D4\u30FC\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002";
  }

  // src/index.js
  init_session();
  restoreAllSessions();
  var lastContextTarget = null;
  document.addEventListener("contextmenu", (e) => {
    lastContextTarget = e.target;
    const wrap = e.target.closest(".wte-wrap");
    let ctxTable;
    if (wrap) {
      ctxTable = wrap.querySelector(":scope > .wte-rich, :scope > .wte-tree");
    } else {
      const t = findTable(e.target);
      ctxTable = t && isTransformed(t) ? t : null;
    }
    if (ctxTable) {
      e.preventDefault();
      const headerCell = e.target.closest("thead th, thead td");
      const ctxTh = headerCell && ctxTable.contains(headerCell) ? headerCell : null;
      showMenu(e.clientX, e.clientY, ctxTable, e.target.closest("tbody tr") || null, ctxTh);
    }
  });
  chrome.runtime.onMessage.addListener((msg) => {
    if (!["wte-rich", "wte-tree", "wte-reset"].includes(msg.action)) return;
    const table = findTable(lastContextTarget);
    if (!table) {
      notify("\u30C6\u30FC\u30D6\u30EB\u306E\u4E0A\u3067\u53F3\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u304F\u3060\u3055\u3044\u3002");
      return;
    }
    if (msg.action === "wte-rich") transformToRich(table);
    if (msg.action === "wte-tree") transformToTree(table);
    if (msg.action === "wte-reset") resetTable(table);
  });
})();
