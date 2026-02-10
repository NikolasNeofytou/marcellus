import { useEffect } from "react";
import { useOutlineStore, type OutlineSymbol } from "../../stores/outlineStore";
import { useHdlStore } from "../../stores/hdlStore";
import { Search, ChevronsUpDown, ChevronsDownUp, ChevronRight } from "lucide-react";
import "./OutlinePanel.css";

/* ------------------------------------------------------------------ */
/*  Tree node                                                         */
/* ------------------------------------------------------------------ */

interface OutlineNodeProps {
  symbol: OutlineSymbol;
  depth: number;
  onNavigate: (line: number) => void;
}

function OutlineNode({ symbol, depth, onNavigate }: OutlineNodeProps) {
  const expandedIds = useOutlineStore((s) => s.expandedIds);
  const toggleExpanded = useOutlineStore((s) => s.toggleExpanded);
  const selectedId = useOutlineStore((s) => s.selectedId);
  const setSelectedId = useOutlineStore((s) => s.setSelectedId);

  const isExpanded = expandedIds.has(symbol.id);
  const hasChildren = symbol.children.length > 0;

  const handleClick = () => {
    setSelectedId(symbol.id);
    onNavigate(symbol.line);
  };

  return (
    <div className="outline-node">
      <div
        className={`outline-node__row ${selectedId === symbol.id ? "outline-node__row--selected" : ""}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={handleClick}
      >
        {/* Chevron */}
        <span
          className={`outline-node__chevron ${isExpanded ? "outline-node__chevron--expanded" : ""} ${!hasChildren ? "outline-node__chevron--empty" : ""}`}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleExpanded(symbol.id); }}
        >
          <ChevronRight size={12} />
        </span>

        {/* Kind icon */}
        <span className={`outline-node__icon outline-node__icon--${symbol.kind}`}>
          {symbol.icon}
        </span>

        {/* Name */}
        <span className="outline-node__name">{symbol.name}</span>

        {/* Detail */}
        {symbol.detail && <span className="outline-node__detail">{symbol.detail}</span>}

        {/* Line number */}
        <span className="outline-node__line">:{symbol.line}</span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="outline-node__children">
          {symbol.children.map((child) => (
            <OutlineNode key={child.id} symbol={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Outline Panel                                                     */
/* ------------------------------------------------------------------ */

export function OutlinePanel() {
  const filterText = useOutlineStore((s) => s.filterText);
  const setFilterText = useOutlineStore((s) => s.setFilterText);
  const expandAll = useOutlineStore((s) => s.expandAll);
  const collapseAll = useOutlineStore((s) => s.collapseAll);
  const buildOutline = useOutlineStore((s) => s.buildOutline);
  const getFilteredSymbols = useOutlineStore((s) => s.getFilteredSymbols);

  // Watch current HDL file for changes
  const activeFileId = useHdlStore((s) => s.activeFileId);
  const files = useHdlStore((s) => s.files);
  const activeFile = activeFileId ? files.get(activeFileId) : undefined;
  const setCursorLine = useHdlStore((s) => s.setCursorPosition);

  useEffect(() => {
    if (activeFile) {
      buildOutline(activeFile.parseResult, activeFile.content);
    } else {
      buildOutline(null, "");
    }
  }, [activeFile?.content, activeFile?.parseResult, buildOutline]);

  const symbols = getFilteredSymbols();

  const handleNavigate = (line: number) => {
    if (activeFile) {
      setCursorLine(activeFile.id, line, 0);
    }
  };

  return (
    <div className="outline-panel">
      {/* Search / filter */}
      <div className="outline-panel__search">
        <div className="outline-panel__search-wrap">
          <Search size={14} style={{ color: "var(--os-fg-muted)", flexShrink: 0 }} />
          <input
            className="outline-panel__search-input"
            placeholder="Filter symbols…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="outline-panel__toolbar">
        <button className="outline-panel__tool-btn" title="Expand All" onClick={expandAll}>
          <ChevronsUpDown size={14} />
        </button>
        <button className="outline-panel__tool-btn" title="Collapse All" onClick={collapseAll}>
          <ChevronsDownUp size={14} />
        </button>
      </div>

      {/* Tree */}
      <div className="outline-panel__tree">
        {symbols.length === 0 ? (
          <div className="outline-panel__empty">
            {activeFile ? "No symbols found." : "Open an HDL file to see its outline."}
          </div>
        ) : (
          symbols.map((sym) => (
            <OutlineNode key={sym.id} symbol={sym} depth={0} onNavigate={handleNavigate} />
          ))
        )}
      </div>
    </div>
  );
}
