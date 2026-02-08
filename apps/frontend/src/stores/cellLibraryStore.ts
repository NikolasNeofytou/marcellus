/**
 * Cell Library Store (V6)
 *
 * Manages the standard cell library for browsing, searching, previewing,
 * and placing cells from the library into the layout.
 *
 * Integrates with the existing CellStore for instantiation and the
 * plugin system for PDK-specific cell libraries.
 */

import { create } from "zustand";
import type { StandardCellDef } from "../plugins/types";
import type { CellPin } from "./cellStore";
import type { CanvasGeometry } from "./geometryStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

/** Extended cell info for the library browser (beyond StandardCellDef) */
export interface LibraryCell {
  /** Unique ID */
  id: string;
  /** Cell name (e.g., "sky130_fd_sc_hd__inv_1") */
  name: string;
  /** Short name (e.g., "INV") */
  shortName: string;
  /** Function/description */
  function: string;
  /** Functional category */
  category: LibraryCellCategory;
  /** Drive strength (1, 2, 4, 8, etc.) */
  driveStrength: number;
  /** Input pin names */
  inputs: string[];
  /** Output pin names */
  outputs: string[];
  /** Power pins */
  powerPins: string[];
  /** Width in site units */
  widthInSites: number;
  /** Width in microns */
  widthMicrons: number;
  /** Height in microns (cell height from library) */
  heightMicrons: number;
  /** Area in µm² */
  area: number;
  /** Number of transistors */
  transistorCount: number;
  /** Pin definitions for layout placement */
  pins: CellPin[];
  /** Preview geometries (schematic-like representation) */
  previewGeometries: CanvasGeometry[];
  /** Source PDK */
  pdk: string;
  /** Whether this cell has a full layout */
  hasLayout: boolean;
  /** Tags for search */
  tags: string[];
}

export type LibraryCellCategory =
  | "inverter"
  | "buffer"
  | "nand"
  | "nor"
  | "and"
  | "or"
  | "xor"
  | "xnor"
  | "mux"
  | "latch"
  | "flip-flop"
  | "tri-state"
  | "delay"
  | "filler"
  | "tap"
  | "decap"
  | "special"
  | "other";

export type SortField = "name" | "area" | "driveStrength" | "transistorCount";
export type SortOrder = "asc" | "desc";

// ══════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════

interface CellLibraryStoreState {
  /** All library cells */
  cells: LibraryCell[];
  /** Search query */
  searchQuery: string;
  /** Active category filter */
  categoryFilter: LibraryCellCategory | "all";
  /** Drive strength filter */
  driveStrengthFilter: number | null;
  /** Sort field */
  sortField: SortField;
  /** Sort order */
  sortOrder: SortOrder;
  /** Currently selected cell ID for preview */
  selectedCellId: string | null;
  /** Currently previewing cell (full detail) */
  previewCell: LibraryCell | null;
  /** Cell being placed (drag from library) */
  placingCellId: string | null;
  /** Library load state */
  loadState: "idle" | "loading" | "loaded" | "error";
  /** Available categories (computed from cells) */
  availableCategories: LibraryCellCategory[];
  /** Available drive strengths (computed from cells) */
  availableDriveStrengths: number[];
  /** Favorites */
  favorites: Set<string>;
  /** Recently used cell IDs */
  recentlyUsed: string[];

  // ── Actions ──

  /** Load cells from a PDK definition */
  loadFromPdk: (cells: StandardCellDef[], pdk: string, cellHeight: number, siteWidth: number) => void;
  /** Load the built-in SKY130 HD cells */
  loadSky130Hd: () => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Set category filter */
  setCategoryFilter: (cat: LibraryCellCategory | "all") => void;
  /** Set drive strength filter */
  setDriveStrengthFilter: (ds: number | null) => void;
  /** Set sort */
  setSort: (field: SortField, order?: SortOrder) => void;
  /** Select a cell for preview */
  selectCell: (id: string | null) => void;
  /** Start placing a cell */
  startPlacing: (id: string) => void;
  /** Cancel placing */
  cancelPlacing: () => void;
  /** Toggle favorite */
  toggleFavorite: (id: string) => void;
  /** Add to recently used */
  addToRecent: (id: string) => void;
  /** Get filtered & sorted cells */
  getFilteredCells: () => LibraryCell[];
  /** Get cell by ID */
  getCellById: (id: string) => LibraryCell | undefined;
}

// ── Helpers ──

function inferCategory(name: string, fn: string): LibraryCellCategory {
  const lower = (name + " " + fn).toLowerCase();
  if (lower.includes("inv")) return "inverter";
  if (lower.includes("buf") || lower.includes("clkbuf")) return "buffer";
  if (lower.includes("nand")) return "nand";
  if (lower.includes("nor")) return "nor";
  if (lower.includes("xnor")) return "xnor";
  if (lower.includes("xor")) return "xor";
  if (lower.includes("and") && !lower.includes("nand")) return "and";
  if (lower.includes("or") && !lower.includes("nor") && !lower.includes("xor") && !lower.includes("xnor")) return "or";
  if (lower.includes("mux")) return "mux";
  if (lower.includes("latch") || lower.includes("dlat")) return "latch";
  if (lower.includes("dff") || lower.includes("flip") || lower.includes("sdf")) return "flip-flop";
  if (lower.includes("tbuf") || lower.includes("einv")) return "tri-state";
  if (lower.includes("dly") || lower.includes("delay")) return "delay";
  if (lower.includes("fill")) return "filler";
  if (lower.includes("tap")) return "tap";
  if (lower.includes("decap")) return "decap";
  if (lower.includes("clk") || lower.includes("conb") || lower.includes("diode")) return "special";
  return "other";
}

function inferShortName(name: string): string {
  // "sky130_fd_sc_hd__inv_1" → "INV"
  const parts = name.split("__");
  if (parts.length >= 2) {
    const cellPart = parts[1]; // "inv_1"
    const base = cellPart.replace(/_\d+$/, ""); // "inv"
    return base.toUpperCase();
  }
  return name.toUpperCase();
}

function inferTransistorCount(category: LibraryCellCategory, inputs: number, ds: number): number {
  // Rough estimate based on category and inputs
  const base: Record<string, number> = {
    inverter: 2,
    buffer: 4,
    nand: 4,
    nor: 4,
    and: 6,
    or: 6,
    xor: 8,
    xnor: 8,
    mux: 12,
    latch: 16,
    "flip-flop": 24,
    "tri-state": 6,
    delay: 4,
    filler: 0,
    tap: 0,
    decap: 2,
    special: 4,
    other: 4,
  };
  const b = base[category] ?? 4;
  const inputScale = Math.max(inputs, 1);
  return b * Math.ceil(inputScale / 2) * Math.max(ds, 1);
}

function generatePreviewGeometries(
  cell: LibraryCell,
): CanvasGeometry[] {
  // Generate a simple box + pin visualization
  const geoms: CanvasGeometry[] = [];
  const w = cell.widthMicrons;
  const h = cell.heightMicrons;

  // Body rectangle
  geoms.push({
    type: "rect",
    layerId: 8, // M1
    points: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    properties: { _cellPreview: true },
  });

  // Power rails
  geoms.push({
    type: "rect",
    layerId: 8, // M1 for VDD
    points: [
      { x: 0, y: h - 0.05 },
      { x: w, y: h - 0.05 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    properties: { _rail: "VDD" },
  });

  geoms.push({
    type: "rect",
    layerId: 8, // M1 for VSS
    points: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: 0.05 },
      { x: 0, y: 0.05 },
    ],
    properties: { _rail: "VSS" },
  });

  return geoms;
}

function buildLibraryCell(
  def: StandardCellDef,
  pdk: string,
  cellHeight: number,
  siteWidth: number,
  index: number,
): LibraryCell {
  const category = inferCategory(def.name, def.function);
  const shortName = inferShortName(def.name);
  const widthMicrons = def.widthInSites * siteWidth;
  const transistorCount = inferTransistorCount(category, def.inputs.length, def.driveStrength);

  const cell: LibraryCell = {
    id: `lib_${index}_${def.name}`,
    name: def.name,
    shortName,
    function: def.function,
    category,
    driveStrength: def.driveStrength,
    inputs: def.inputs,
    outputs: def.outputs,
    powerPins: ["VPWR", "VGND", "VPB", "VNB"],
    widthInSites: def.widthInSites,
    widthMicrons,
    heightMicrons: cellHeight,
    area: widthMicrons * cellHeight,
    transistorCount,
    pins: buildPinsFromDef(def, widthMicrons, cellHeight),
    previewGeometries: [],
    pdk,
    hasLayout: false, // Will be true when GDS data is loaded
    tags: [shortName, category, `x${def.driveStrength}`, def.function],
  };

  cell.previewGeometries = generatePreviewGeometries(cell);
  return cell;
}

function buildPinsFromDef(
  def: StandardCellDef,
  width: number,
  height: number,
): CellPin[] {
  const pins: CellPin[] = [];
  // Pin positions distributed evenly on cell edges

  // Input pins on left side
  def.inputs.forEach((name, i) => {
    pins.push({
      name,
      direction: "input",
      position: { x: 0, y: height * (i + 1) / (def.inputs.length + 1) },
      layerId: 8, // M1
      size: { w: 0.14, h: 0.14 },
    });
  });

  // Output pins on right side
  def.outputs.forEach((name, i) => {
    pins.push({
      name,
      direction: "output",
      position: { x: width, y: height * (i + 1) / (def.outputs.length + 1) },
      layerId: 8, // M1
      size: { w: 0.14, h: 0.14 },
    });
  });

  // Power pins
  pins.push(
    { name: "VPWR", direction: "power", position: { x: width / 2, y: height }, layerId: 8 },
    { name: "VGND", direction: "power", position: { x: width / 2, y: 0 }, layerId: 8 },
  );

  return pins;
}

export const useCellLibraryStore = create<CellLibraryStoreState>((set, get) => ({
  cells: [],
  searchQuery: "",
  categoryFilter: "all",
  driveStrengthFilter: null,
  sortField: "name",
  sortOrder: "asc",
  selectedCellId: null,
  previewCell: null,
  placingCellId: null,
  loadState: "idle",
  availableCategories: [],
  availableDriveStrengths: [],
  favorites: new Set(),
  recentlyUsed: [],

  loadFromPdk: (stdCells, pdk, cellHeight, siteWidth) => {
    set({ loadState: "loading" });

    const cells: LibraryCell[] = stdCells.map((def, i) =>
      buildLibraryCell(def, pdk, cellHeight, siteWidth, i),
    );

    const categories = [...new Set(cells.map((c) => c.category))].sort() as LibraryCellCategory[];
    const driveStrengths = [...new Set(cells.map((c) => c.driveStrength))].sort((a, b) => a - b);

    set({
      cells,
      availableCategories: categories,
      availableDriveStrengths: driveStrengths,
      loadState: "loaded",
    });
  },

  loadSky130Hd: () => {
    // Import the sky130 HD cell definitions from the built-in data
    import("../plugins/sky130CellLibrary").then((mod) => {
      get().loadFromPdk(mod.sky130HdCells, "SKY130", mod.SKY130_CELL_HEIGHT, mod.SKY130_SITE_WIDTH);
    });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setCategoryFilter: (cat) => set({ categoryFilter: cat }),

  setDriveStrengthFilter: (ds) => set({ driveStrengthFilter: ds }),

  setSort: (field, order) =>
    set((s) => ({
      sortField: field,
      sortOrder: order ?? (s.sortField === field && s.sortOrder === "asc" ? "desc" : "asc"),
    })),

  selectCell: (id) => {
    const cell = id ? get().cells.find((c) => c.id === id) : null;
    set({ selectedCellId: id, previewCell: cell ?? null });
  },

  startPlacing: (id) => {
    set({ placingCellId: id });
    get().addToRecent(id);
  },

  cancelPlacing: () => set({ placingCellId: null }),

  toggleFavorite: (id) => {
    set((s) => {
      const next = new Set(s.favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { favorites: next };
    });
  },

  addToRecent: (id) => {
    set((s) => {
      const recent = [id, ...s.recentlyUsed.filter((r) => r !== id)].slice(0, 10);
      return { recentlyUsed: recent };
    });
  },

  getFilteredCells: () => {
    const { cells, searchQuery, categoryFilter, driveStrengthFilter, sortField, sortOrder } = get();

    let filtered = [...cells];

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((c) => c.category === categoryFilter);
    }

    // Drive strength filter
    if (driveStrengthFilter !== null) {
      filtered = filtered.filter((c) => c.driveStrength === driveStrengthFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.shortName.toLowerCase().includes(q) ||
          c.function.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "area":
          cmp = a.area - b.area;
          break;
        case "driveStrength":
          cmp = a.driveStrength - b.driveStrength || a.name.localeCompare(b.name);
          break;
        case "transistorCount":
          cmp = a.transistorCount - b.transistorCount;
          break;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return filtered;
  },

  getCellById: (id) => get().cells.find((c) => c.id === id),
}));
