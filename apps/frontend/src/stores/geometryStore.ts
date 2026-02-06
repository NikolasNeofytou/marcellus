/**
 * Geometry Store — centralised geometry state with undo/redo history.
 *
 * Replaces the local `useState<CanvasGeometry[]>` in LayoutCanvas so that
 * undo/redo, clipboard, DRC, and the properties panel can all share state.
 */

import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────────

export interface CanvasGeometry {
  type: "rect" | "polygon" | "path" | "via";
  layerId: number;
  points: { x: number; y: number }[];
  width?: number;
}

const MAX_UNDO = 100;

// ── Store ─────────────────────────────────────────────────────────────

interface GeometryStoreState {
  /** Current geometry list */
  geometries: CanvasGeometry[];

  /** Undo stack (snapshots of previous geometry arrays) */
  undoStack: CanvasGeometry[][];

  /** Redo stack */
  redoStack: CanvasGeometry[][];

  /** Whether the current state is modified since last save */
  modified: boolean;

  /** Project name */
  projectName: string;

  // ── Mutation (always pushes undo) ──

  /**
   * Replace the entire geometry list, pushing current state onto undo stack.
   * This is the primitive that all mutations go through.
   */
  commit: (next: CanvasGeometry[] | ((prev: CanvasGeometry[]) => CanvasGeometry[])) => void;

  /** Add a single geometry */
  addGeometry: (geom: CanvasGeometry) => void;

  /** Remove geometries by indices */
  removeGeometries: (indices: number[]) => void;

  /** Replace geometries wholesale (e.g. after move/stretch) */
  replaceAll: (geoms: CanvasGeometry[]) => void;

  // ── Undo / Redo ──

  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── File operations ──

  /** Load geometries from external source (clears history) */
  load: (geoms: CanvasGeometry[], projectName?: string) => void;

  /** Mark as saved */
  markSaved: () => void;

  /** Export current geometries as JSON string */
  exportJson: () => string;

  /** Set project name */
  setProjectName: (name: string) => void;

  /** Load built-in demo geometries (NMOS inverter-like layout) */
  loadDemo: () => void;
}

/** Deep-clone a geometry array (no shared references). */
function cloneGeometries(geoms: CanvasGeometry[]): CanvasGeometry[] {
  return geoms.map((g) => ({
    ...g,
    points: g.points.map((p) => ({ ...p })),
  }));
}

export const useGeometryStore = create<GeometryStoreState>((set, get) => ({
  geometries: [],
  undoStack: [],
  redoStack: [],
  modified: false,
  projectName: "Untitled Project",

  // ── Core commit ──

  commit: (next) => {
    const current = get().geometries;
    const resolved = typeof next === "function" ? next(current) : next;
    set((s) => ({
      geometries: resolved,
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), cloneGeometries(current)],
      redoStack: [],
      modified: true,
    }));
  },

  addGeometry: (geom) => {
    get().commit((prev) => [...prev, geom]);
  },

  removeGeometries: (indices) => {
    const idxSet = new Set(indices);
    get().commit((prev) => prev.filter((_, i) => !idxSet.has(i)));
  },

  replaceAll: (geoms) => {
    get().commit(geoms);
  },

  // ── Undo / Redo ──

  undo: () => {
    const { undoStack, geometries, redoStack } = get();
    if (undoStack.length === 0) return false;
    const prev = undoStack[undoStack.length - 1];
    set({
      geometries: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cloneGeometries(geometries)],
      modified: true,
    });
    return true;
  },

  redo: () => {
    const { redoStack, geometries, undoStack } = get();
    if (redoStack.length === 0) return false;
    const next = redoStack[redoStack.length - 1];
    set({
      geometries: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, cloneGeometries(geometries)],
      modified: true,
    });
    return true;
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // ── File operations ──

  load: (geoms, projectName) => {
    set({
      geometries: cloneGeometries(geoms),
      undoStack: [],
      redoStack: [],
      modified: false,
      projectName: projectName ?? get().projectName,
    });
  },

  markSaved: () => set({ modified: false }),

  exportJson: () => {
    const { geometries, projectName } = get();
    return JSON.stringify({ projectName, geometries }, null, 2);
  },

  setProjectName: (name) => set({ projectName: name }),

  loadDemo: () => {
    get().load(
      [
        { type: "rect", layerId: 0, points: [{ x: 0, y: 0 }, { x: 2, y: 4 }] },
        { type: "rect", layerId: 2, points: [{ x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5 }] },
        { type: "rect", layerId: 2, points: [{ x: 0.5, y: 2.5 }, { x: 1.5, y: 3.5 }] },
        { type: "rect", layerId: 4, points: [{ x: 0.3, y: 1.0 }, { x: 1.7, y: 1.2 }] },
        { type: "rect", layerId: 4, points: [{ x: 0.3, y: 2.8 }, { x: 1.7, y: 3.0 }] },
        { type: "path", layerId: 4, points: [{ x: 1.0, y: 1.2 }, { x: 1.0, y: 2.8 }], width: 0.15 },
        { type: "rect", layerId: 8, points: [{ x: 0.6, y: 0.8 }, { x: 1.4, y: 1.4 }] },
        { type: "rect", layerId: 8, points: [{ x: 0.6, y: 2.6 }, { x: 1.4, y: 3.2 }] },
        { type: "rect", layerId: 10, points: [{ x: 0.4, y: 1.7 }, { x: 1.6, y: 2.3 }] },
        { type: "via", layerId: 9, points: [{ x: 1.0, y: 1.1 }], width: 0.17 },
        { type: "via", layerId: 9, points: [{ x: 1.0, y: 2.9 }], width: 0.17 },
      ],
      "Demo NMOS Layout",
    );
  },
}));
