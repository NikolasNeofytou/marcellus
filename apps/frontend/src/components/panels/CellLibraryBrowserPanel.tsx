/**
 * Cell Library Browser Panel (V6)
 *
 * Full-featured cell library browser with search, filter, sort,
 * cell preview, and place-from-library workflow.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useCellLibraryStore, type LibraryCell, type LibraryCellCategory } from "../../stores/cellLibraryStore";
import { useCellStore } from "../../stores/cellStore";
import { useGeometryStore } from "../../stores/geometryStore";
import { useSimStore } from "../../stores/simStore";
import "./CellLibraryBrowserPanel.css";

// ── Category display names ──
const categoryLabels: Record<LibraryCellCategory | "all", string> = {
  all: "All",
  inverter: "Inverter",
  buffer: "Buffer",
  nand: "NAND",
  nor: "NOR",
  and: "AND",
  or: "OR",
  xor: "XOR",
  xnor: "XNOR",
  mux: "MUX",
  latch: "Latch",
  "flip-flop": "Flip-Flop",
  "tri-state": "Tri-State",
  delay: "Delay",
  filler: "Filler",
  tap: "Tap",
  decap: "Decap",
  special: "Special",
  other: "Other",
};

type ViewMode = "grid" | "list" | "compact";

export function CellLibraryBrowserPanel() {
  const {
    cells,
    searchQuery,
    categoryFilter,
    driveStrengthFilter,
    sortField,
    sortOrder,
    selectedCellId,
    previewCell,
    placingCellId,
    loadState,
    availableCategories,
    availableDriveStrengths,
    favorites,
    recentlyUsed,
    loadSky130Hd,
    setSearchQuery,
    setCategoryFilter,
    setDriveStrengthFilter,
    setSort,
    selectCell,
    startPlacing,
    cancelPlacing,
    toggleFavorite,
    getFilteredCells,
    getCellById,
  } = useCellLibraryStore();

  const addCellDefinition = useCellStore((s) => s.addCellDefinition);
  const placeInstance = useCellStore((s) => s.placeInstance);
  const addGeometries = useGeometryStore((s) => s.addGeometries);
  const appendLine = useSimStore((s) => s.appendTerminalLine);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showRecent, setShowRecent] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const filteredCells = useMemo(() => getFilteredCells(), [
    cells, searchQuery, categoryFilter, driveStrengthFilter, sortField, sortOrder,
  ]);

  const displayCells = useMemo(() => {
    if (showFavorites) return filteredCells.filter((c) => favorites.has(c.id));
    if (showRecent) {
      return recentlyUsed
        .map((id) => getCellById(id))
        .filter((c): c is LibraryCell => !!c);
    }
    return filteredCells;
  }, [filteredCells, showFavorites, showRecent, favorites, recentlyUsed, getCellById]);

  // Draw cell preview on canvas
  useEffect(() => {
    if (!previewCell || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const cellW = previewCell.widthMicrons;
    const cellH = previewCell.heightMicrons;

    const scale = Math.min((w - 20) / cellW, (h - 40) / cellH);
    const ox = (w - cellW * scale) / 2;
    const oy = (h - cellH * scale) / 2;

    ctx.clearRect(0, 0, w, h);

    // Cell boundary
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.strokeRect(ox, oy, cellW * scale, cellH * scale);

    // VDD rail (top)
    ctx.fillStyle = "#6366f140";
    ctx.fillRect(ox, oy, cellW * scale, 4);
    ctx.fillStyle = "#6366f1";
    ctx.font = "9px monospace";
    ctx.fillText("VDD", ox + 2, oy + 10);

    // VSS rail (bottom)
    ctx.fillStyle = "#6366f140";
    ctx.fillRect(ox, oy + cellH * scale - 4, cellW * scale, 4);
    ctx.fillStyle = "#6366f1";
    ctx.fillText("VSS", ox + 2, oy + cellH * scale - 6);

    // PMOS region (top half)
    ctx.fillStyle = "#3b82f610";
    ctx.fillRect(ox, oy + 4, cellW * scale, cellH * scale / 2 - 4);

    // NMOS region (bottom half)
    ctx.fillStyle = "#22c55e10";
    ctx.fillRect(ox, oy + cellH * scale / 2, cellW * scale, cellH * scale / 2 - 4);

    // Region labels
    ctx.fillStyle = "#3b82f660";
    ctx.font = "10px sans-serif";
    ctx.fillText("PMOS", ox + cellW * scale / 2 - 16, oy + cellH * scale / 4 + 4);
    ctx.fillStyle = "#22c55e60";
    ctx.fillText("NMOS", ox + cellW * scale / 2 - 16, oy + 3 * cellH * scale / 4 + 4);

    // Draw pins
    previewCell.pins.forEach((pin) => {
      const px = ox + pin.position.x * scale;
      const py = oy + pin.position.y * scale;
      const isInput = pin.direction === "input";
      const isPower = pin.direction === "power";

      ctx.fillStyle = isPower ? "#f59e0b" : isInput ? "#22c55e" : "#ef4444";
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      // Pin label
      ctx.fillStyle = "#e5e5e5";
      ctx.font = "9px monospace";
      const labelX = pin.position.x === 0 ? px + 6 : px - ctx.measureText(pin.name).width - 6;
      ctx.fillText(pin.name, labelX, py + 3);
    });

    // Cell name centered
    ctx.fillStyle = "#e5e5e5";
    ctx.font = "bold 11px sans-serif";
    const nameText = previewCell.shortName;
    ctx.fillText(nameText, ox + cellW * scale / 2 - ctx.measureText(nameText).width / 2, oy - 6);
  }, [previewCell]);

  const handlePlaceCell = useCallback(
    (cell: LibraryCell) => {
      // Register in cell store if not already there
      const cellId = addCellDefinition({
        name: cell.name,
        category: "standard-cell",
        geometries: cell.previewGeometries,
        pins: cell.pins,
        parameters: {
          driveStrength: cell.driveStrength,
          function: cell.function,
          widthInSites: cell.widthInSites,
        },
        pdk: cell.pdk,
        source: "library",
      });

      // Place instance at origin
      placeInstance(cellId, { x: 0, y: 0 }, {
        instanceName: `${cell.shortName}_inst`,
      });

      // Also add preview geometries to layout
      addGeometries(cell.previewGeometries);

      startPlacing(cell.id);
      appendLine(`> Placed ${cell.name} (${cell.function})`);
    },
    [addCellDefinition, placeInstance, addGeometries, startPlacing, appendLine],
  );

  // ── Load library on first mount ──
  useEffect(() => {
    if (loadState === "idle") {
      loadSky130Hd();
    }
  }, [loadState, loadSky130Hd]);

  if (loadState === "loading") {
    return (
      <div className="cell-lib">
        <div className="cell-lib__loading">Loading SKY130 HD library...</div>
      </div>
    );
  }

  return (
    <div className="cell-lib">
      {/* ── Header ── */}
      <div className="cell-lib__header">
        <div className="cell-lib__stats">
          {cells.length} cells | {displayCells.length} shown
        </div>
        <div className="cell-lib__view-modes">
          <button
            className={`cell-lib__btn-sm ${viewMode === "grid" ? "cell-lib__btn-sm--active" : ""}`}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >⊞</button>
          <button
            className={`cell-lib__btn-sm ${viewMode === "list" ? "cell-lib__btn-sm--active" : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >☰</button>
          <button
            className={`cell-lib__btn-sm ${viewMode === "compact" ? "cell-lib__btn-sm--active" : ""}`}
            onClick={() => setViewMode("compact")}
            title="Compact view"
          >⊟</button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="cell-lib__search">
        <input
          type="text"
          placeholder="Search cells..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="cell-lib__search-input"
        />
        {searchQuery && (
          <button
            className="cell-lib__search-clear"
            onClick={() => setSearchQuery("")}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Quick filters ── */}
      <div className="cell-lib__quick-filters">
        <button
          className={`cell-lib__btn-sm ${showRecent ? "cell-lib__btn-sm--active" : ""}`}
          onClick={() => { setShowRecent(!showRecent); setShowFavorites(false); }}
        >
          Recent
        </button>
        <button
          className={`cell-lib__btn-sm ${showFavorites ? "cell-lib__btn-sm--active" : ""}`}
          onClick={() => { setShowFavorites(!showFavorites); setShowRecent(false); }}
        >
          ★ Favorites
        </button>
      </div>

      {/* ── Category filter ── */}
      <div className="cell-lib__filters">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as LibraryCellCategory | "all")}
          className="cell-lib__select"
        >
          {(["all", ...availableCategories] as (LibraryCellCategory | "all")[]).map((cat) => (
            <option key={cat} value={cat}>{categoryLabels[cat] ?? cat}</option>
          ))}
        </select>

        <select
          value={driveStrengthFilter ?? "all"}
          onChange={(e) =>
            setDriveStrengthFilter(e.target.value === "all" ? null : Number(e.target.value))
          }
          className="cell-lib__select"
        >
          <option value="all">All Drives</option>
          {availableDriveStrengths.map((ds) => (
            <option key={ds} value={ds}>x{ds}</option>
          ))}
        </select>

        <select
          value={`${sortField}-${sortOrder}`}
          onChange={(e) => {
            const [f, o] = e.target.value.split("-");
            setSort(f as "name" | "area" | "driveStrength" | "transistorCount", o as "asc" | "desc");
          }}
          className="cell-lib__select"
        >
          <option value="name-asc">Name ↑</option>
          <option value="name-desc">Name ↓</option>
          <option value="area-asc">Area ↑</option>
          <option value="area-desc">Area ↓</option>
          <option value="driveStrength-asc">Drive ↑</option>
          <option value="driveStrength-desc">Drive ↓</option>
          <option value="transistorCount-asc">Transistors ↑</option>
          <option value="transistorCount-desc">Transistors ↓</option>
        </select>
      </div>

      {/* ── Cell List ── */}
      <div className={`cell-lib__cells cell-lib__cells--${viewMode}`}>
        {displayCells.length === 0 ? (
          <div className="cell-lib__empty">
            {showFavorites
              ? "No favorites yet. Click ★ on a cell."
              : showRecent
              ? "No recently used cells."
              : "No cells match your filters."}
          </div>
        ) : (
          displayCells.map((cell) => (
            <CellCard
              key={cell.id}
              cell={cell}
              viewMode={viewMode}
              isSelected={selectedCellId === cell.id}
              isFavorite={favorites.has(cell.id)}
              isPlacing={placingCellId === cell.id}
              onSelect={() => selectCell(cell.id)}
              onPlace={() => handlePlaceCell(cell)}
              onFavorite={() => toggleFavorite(cell.id)}
            />
          ))
        )}
      </div>

      {/* ── Preview ── */}
      {previewCell && (
        <div className="cell-lib__preview">
          <div className="cell-lib__preview-header">
            <span className="cell-lib__preview-name">{previewCell.name}</span>
            <span className="cell-lib__preview-drive">x{previewCell.driveStrength}</span>
          </div>

          <canvas
            ref={canvasRef}
            className="cell-lib__preview-canvas"
          />

          <div className="cell-lib__preview-info">
            <div className="cell-lib__preview-row">
              <span>Function</span>
              <span className="cell-lib__mono">{previewCell.function}</span>
            </div>
            <div className="cell-lib__preview-row">
              <span>Category</span>
              <span>{categoryLabels[previewCell.category]}</span>
            </div>
            <div className="cell-lib__preview-row">
              <span>Size</span>
              <span className="cell-lib__mono">
                {previewCell.widthMicrons.toFixed(2)} × {previewCell.heightMicrons.toFixed(2)} µm
              </span>
            </div>
            <div className="cell-lib__preview-row">
              <span>Area</span>
              <span className="cell-lib__mono">{previewCell.area.toFixed(2)} µm²</span>
            </div>
            <div className="cell-lib__preview-row">
              <span>Sites</span>
              <span>{previewCell.widthInSites}</span>
            </div>
            <div className="cell-lib__preview-row">
              <span>Transistors</span>
              <span>~{previewCell.transistorCount}</span>
            </div>

            {/* Pin table */}
            <div className="cell-lib__preview-pins">
              <div className="cell-lib__pin-header">Pins</div>
              <div className="cell-lib__pin-list">
                {previewCell.pins.map((pin) => (
                  <span
                    key={pin.name}
                    className={`cell-lib__pin cell-lib__pin--${pin.direction}`}
                    title={`${pin.name} (${pin.direction})`}
                  >
                    {pin.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            className="cell-lib__btn cell-lib__btn--place"
            onClick={() => handlePlaceCell(previewCell)}
          >
            Place in Layout
          </button>
        </div>
      )}

      {/* ── Placing indicator ── */}
      {placingCellId && (
        <div className="cell-lib__placing">
          <span>Placing: {getCellById(placingCellId)?.shortName}</span>
          <button className="cell-lib__btn-sm" onClick={cancelPlacing}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Cell Card ──

interface CellCardProps {
  cell: LibraryCell;
  viewMode: ViewMode;
  isSelected: boolean;
  isFavorite: boolean;
  isPlacing: boolean;
  onSelect: () => void;
  onPlace: () => void;
  onFavorite: () => void;
}

function CellCard({
  cell,
  viewMode,
  isSelected,
  isFavorite,
  isPlacing,
  onSelect,
  onPlace,
  onFavorite,
}: CellCardProps) {
  return (
    <div
      className={`cell-card cell-card--${viewMode} ${isSelected ? "cell-card--selected" : ""} ${isPlacing ? "cell-card--placing" : ""}`}
      onClick={onSelect}
      onDoubleClick={onPlace}
      title={`${cell.name}\n${cell.function}\nDouble-click to place`}
    >
      <div className="cell-card__top">
        <span className="cell-card__short-name">{cell.shortName}</span>
        <span className="cell-card__drive">x{cell.driveStrength}</span>
      </div>

      {viewMode !== "compact" && (
        <div className="cell-card__fn">{cell.function}</div>
      )}

      {viewMode === "list" && (
        <div className="cell-card__details">
          <span>{cell.widthMicrons.toFixed(2)}×{cell.heightMicrons.toFixed(2)}</span>
          <span>{cell.inputs.length}in/{cell.outputs.length}out</span>
          <span>~{cell.transistorCount}T</span>
        </div>
      )}

      <div className="cell-card__actions">
        <button
          className={`cell-card__fav ${isFavorite ? "cell-card__fav--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onFavorite(); }}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? "★" : "☆"}
        </button>
        <button
          className="cell-card__place"
          onClick={(e) => { e.stopPropagation(); onPlace(); }}
          title="Place in layout"
        >
          +
        </button>
      </div>
    </div>
  );
}
