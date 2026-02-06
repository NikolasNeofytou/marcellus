import { create } from "zustand";

// ── Tool Types ────────────────────────────────────────────────────────

export type ToolId =
  | "select"
  | "rect"
  | "polygon"
  | "path"
  | "via"
  | "ruler"
  | "pan";

export type ToolState =
  | "idle"
  | "drawing"
  | "dragging"
  | "resizing"
  | "placing";

export interface ToolPoint {
  x: number;
  y: number;
}

/** A geometry being drawn (not yet committed to the database). */
export interface DrawingPreview {
  /** Tool that created this preview. */
  tool: ToolId;
  /** Layer to draw on. */
  layerId: number;
  /** Points collected so far (snapped). */
  points: ToolPoint[];
  /** For path: width of the wire. */
  width?: number;
  /** Current cursor position (unsnapped for rubber-band). */
  cursorPos?: ToolPoint;
}

/** A selected geometry reference. */
export interface SelectedItem {
  cellId: string;
  geometryIndex: number;
  type: "rect" | "polygon" | "path" | "via";
}

/** Cloned geometry data for clipboard (decoupled from source indices). */
export interface ClipboardEntry {
  type: "rect" | "polygon" | "path" | "via";
  layerId: number;
  points: { x: number; y: number }[];
  width?: number;
}

// ── Store ─────────────────────────────────────────────────────────────

interface ToolStoreState {
  // Current tool
  activeTool: ToolId;
  toolState: ToolState;

  // Drawing
  drawingPreview: DrawingPreview | null;

  // Selection
  selectedItems: SelectedItem[];
  selectionBox: { start: ToolPoint; end: ToolPoint } | null;

  // Clipboard
  clipboard: ClipboardEntry[];

  // Actions
  setActiveTool: (tool: ToolId) => void;
  setToolState: (state: ToolState) => void;

  // Drawing lifecycle
  beginDrawing: (tool: ToolId, layerId: number, startPoint: ToolPoint) => void;
  addDrawingPoint: (point: ToolPoint) => void;
  updateCursorPos: (point: ToolPoint) => void;
  finishDrawing: () => DrawingPreview | null;
  cancelDrawing: () => void;

  // Selection
  select: (item: SelectedItem) => void;
  addToSelection: (item: SelectedItem) => void;
  removeFromSelection: (index: number) => void;
  clearSelection: () => void;
  setSelectionBox: (start: ToolPoint, end: ToolPoint) => void;
  clearSelectionBox: () => void;

  // Clipboard
  /** Copy selected geometries — caller must provide geometry data */
  copyGeometries: (entries: ClipboardEntry[]) => void;
  paste: () => ClipboardEntry[];
}

export const useToolStore = create<ToolStoreState>((set, get) => ({
  activeTool: "select",
  toolState: "idle",
  drawingPreview: null,
  selectedItems: [],
  selectionBox: null,
  clipboard: [],

  setActiveTool: (tool) => {
    const state = get();
    // Cancel any in-progress drawing when switching tools
    if (state.toolState === "drawing") {
      set({ drawingPreview: null });
    }
    set({
      activeTool: tool,
      toolState: "idle",
      drawingPreview: null,
    });
  },

  setToolState: (toolState) => set({ toolState }),

  // ── Drawing ──────────────────────────────────────────────────────

  beginDrawing: (tool, layerId, startPoint) => {
    set({
      toolState: "drawing",
      drawingPreview: {
        tool,
        layerId,
        points: [startPoint],
        cursorPos: startPoint,
        width: tool === "path" ? 0.1 : undefined, // default wire width
      },
    });
  },

  addDrawingPoint: (point) => {
    const { drawingPreview } = get();
    if (!drawingPreview) return;
    set({
      drawingPreview: {
        ...drawingPreview,
        points: [...drawingPreview.points, point],
      },
    });
  },

  updateCursorPos: (point) => {
    const { drawingPreview } = get();
    if (!drawingPreview) return;
    set({
      drawingPreview: {
        ...drawingPreview,
        cursorPos: point,
      },
    });
  },

  finishDrawing: () => {
    const { drawingPreview } = get();
    if (!drawingPreview) return null;

    // For rect: need exactly 2 points (start & end corners)
    // For polygon: need at least 3 points
    // For path: need at least 2 points
    const result = { ...drawingPreview };
    set({
      toolState: "idle",
      drawingPreview: null,
    });
    return result;
  },

  cancelDrawing: () => {
    set({
      toolState: "idle",
      drawingPreview: null,
    });
  },

  // ── Selection ────────────────────────────────────────────────────

  select: (item) =>
    set({
      selectedItems: [item],
    }),

  addToSelection: (item) =>
    set((state) => ({
      selectedItems: [...state.selectedItems, item],
    })),

  removeFromSelection: (index) =>
    set((state) => ({
      selectedItems: state.selectedItems.filter((_, i) => i !== index),
    })),

  clearSelection: () => set({ selectedItems: [] }),

  setSelectionBox: (start, end) => set({ selectionBox: { start, end } }),

  clearSelectionBox: () => set({ selectionBox: null }),

  // ── Clipboard ────────────────────────────────────────────────────

  copyGeometries: (entries) => {
    set({ clipboard: entries.map((e) => ({ ...e, points: e.points.map((p) => ({ ...p })) })) });
  },

  paste: () => {
    // Return deep-cloned copies so each paste is independent
    return get().clipboard.map((e) => ({
      ...e,
      points: e.points.map((p) => ({ ...p })),
    }));
  },
}));
