/**
 * Cell Store — hierarchical cell definitions and instances for VLSI design.
 *
 * A CellDefinition contains a set of geometries, pin definitions, and metadata.
 * A CellInstance references a cell definition and places it at a location with
 * optional rotation and mirroring.
 *
 * This enables hierarchical design: a standard cell or transistor macro is defined
 * once and instantiated many times.
 */

import { create } from "zustand";
import type { CanvasGeometry } from "./geometryStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

/** Pin on a cell definition — describes an I/O connection point */
export interface CellPin {
  /** Pin name, e.g. "gate", "source", "drain", "A", "Y", "VDD", "VSS" */
  name: string;
  /** Pin direction */
  direction: "input" | "output" | "inout" | "power";
  /** Pin location relative to cell origin (µm) */
  position: { x: number; y: number };
  /** Layer the pin is on */
  layerId: number;
  /** Pin shape extent (width × height in µm) */
  size?: { w: number; h: number };
}

/** A reusable cell definition (like a GDS structure / LEF macro) */
export interface CellDefinition {
  /** Unique cell ID */
  id: string;
  /** Cell name, e.g. "nmos_w420_l150_nf1" */
  name: string;
  /** Cell category for organization */
  category: CellCategory;
  /** Description */
  description?: string;
  /** Geometries that make up this cell (coordinates relative to origin) */
  geometries: CanvasGeometry[];
  /** Pin definitions */
  pins: CellPin[];
  /** Bounding box (auto-computed) */
  bbox: { x1: number; y1: number; x2: number; y2: number };
  /** Design parameters used to generate this cell */
  parameters?: Record<string, number | string | boolean>;
  /** PDK this cell belongs to */
  pdk?: string;
  /** Whether this is a user cell or a library cell */
  source: "library" | "user" | "generated";
  /** Timestamp of creation */
  createdAt: number;
}

export type CellCategory =
  | "transistor"
  | "passive"
  | "contact"
  | "standard-cell"
  | "macro"
  | "pad"
  | "esd"
  | "guard-ring"
  | "custom";

/** An instance of a cell placed in the design */
export interface CellInstance {
  /** Unique instance ID */
  id: string;
  /** Instance name, e.g. "M0", "R1", "U3" */
  instanceName: string;
  /** Reference to cell definition */
  cellId: string;
  /** Placement position (µm) — cell origin maps here */
  position: { x: number; y: number };
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: number;
  /** Mirror along Y axis */
  mirror: boolean;
  /** Net connections: pin name → net name */
  connections: Record<string, string>;
  /** Instance-level parameter overrides */
  parameterOverrides?: Record<string, number | string | boolean>;
}

// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════

let _cellIdCounter = 0;
function genCellId(): string {
  return `cell_${Date.now().toString(36)}_${(++_cellIdCounter).toString(36)}`;
}

let _instIdCounter = 0;
function genInstId(): string {
  return `inst_${Date.now().toString(36)}_${(++_instIdCounter).toString(36)}`;
}

/** Compute bounding box from a set of geometries */
function computeBbox(geometries: CanvasGeometry[]): { x1: number; y1: number; x2: number; y2: number } {
  if (geometries.length === 0) return { x1: 0, y1: 0, x2: 0, y2: 0 };

  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const g of geometries) {
    for (const p of g.points) {
      const hw = (g.width ?? 0) / 2;
      x1 = Math.min(x1, p.x - hw);
      y1 = Math.min(y1, p.y - hw);
      x2 = Math.max(x2, p.x + hw);
      y2 = Math.max(y2, p.y + hw);
    }
  }
  return { x1, y1, x2, y2 };
}

/** Transform a point by rotation + mirror relative to origin, then translate */
function transformPoint(
  p: { x: number; y: number },
  origin: { x: number; y: number },
  rotation: number,
  mirror: boolean,
): { x: number; y: number } {
  const { y } = p;
  let { x } = p;

  // Mirror
  if (mirror) x = -x;

  // Rotate
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = x * cos - y * sin;
  const ry = x * sin + y * cos;

  return { x: rx + origin.x, y: ry + origin.y };
}

/** Flatten a cell instance into concrete geometries for rendering / DRC */
export function flattenInstance(
  instance: CellInstance,
  cellDef: CellDefinition,
): CanvasGeometry[] {
  return cellDef.geometries.map((g) => ({
    ...g,
    id: `${instance.id}_${g.id ?? ""}`,
    cellId: instance.cellId,
    name: instance.instanceName,
    properties: {
      ...g.properties,
      ...instance.parameterOverrides,
      _instanceId: instance.id,
      _cellId: instance.cellId,
    },
    points: g.points.map((pt) =>
      transformPoint(pt, instance.position, instance.rotation, instance.mirror),
    ),
  }));
}

// ══════════════════════════════════════════════════════════════════════
// Instance Name Counters
// ══════════════════════════════════════════════════════════════════════

const instanceCounters: Record<string, number> = {};

function nextInstanceName(category: CellCategory): string {
  const prefix =
    category === "transistor" ? "M" :
    category === "passive" ? "R" :
    category === "contact" ? "X" :
    category === "standard-cell" ? "U" :
    category === "guard-ring" ? "GR" :
    category === "esd" ? "ESD" :
    category === "pad" ? "PAD" :
    "X";

  const count = instanceCounters[prefix] ?? 0;
  instanceCounters[prefix] = count + 1;
  return `${prefix}${count}`;
}

// ══════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════

interface CellStoreState {
  /** All cell definitions */
  cellLibrary: Map<string, CellDefinition>;

  /** All cell instances in the current design */
  instances: CellInstance[];

  /** Currently selected instance IDs */
  selectedInstances: string[];

  // ── Cell Definition Actions ──

  /** Register a new cell definition */
  addCellDefinition: (cell: Omit<CellDefinition, "id" | "bbox" | "createdAt">) => string;

  /** Get a cell definition by ID */
  getCellDefinition: (id: string) => CellDefinition | undefined;

  /** Get all cells of a category */
  getCellsByCategory: (category: CellCategory) => CellDefinition[];

  /** Remove a cell definition (and all its instances) */
  removeCellDefinition: (id: string) => void;

  // ── Instance Actions ──

  /** Place a cell instance */
  placeInstance: (cellId: string, position: { x: number; y: number }, opts?: {
    rotation?: number;
    mirror?: boolean;
    connections?: Record<string, string>;
    instanceName?: string;
  }) => string;

  /** Move an instance to a new position */
  moveInstance: (instanceId: string, position: { x: number; y: number }) => void;

  /** Rotate an instance by 90° */
  rotateInstance: (instanceId: string) => void;

  /** Mirror an instance */
  mirrorInstance: (instanceId: string) => void;

  /** Remove instances */
  removeInstances: (instanceIds: string[]) => void;

  /** Update instance connections */
  setConnection: (instanceId: string, pinName: string, netName: string) => void;

  /** Select instances */
  selectInstances: (ids: string[]) => void;

  /** Clear selection */
  clearSelection: () => void;

  // ── Flatten for rendering ──

  /** Get all instance geometries flattened for rendering / DRC */
  getFlattenedGeometries: () => CanvasGeometry[];

  /** Get instance by ID */
  getInstance: (id: string) => CellInstance | undefined;

  /** Find which instance contains a given flattened geometry ID */
  findInstanceByGeomId: (geomId: string) => CellInstance | undefined;
}

export const useCellStore = create<CellStoreState>((set, get) => ({
  cellLibrary: new Map(),
  instances: [],
  selectedInstances: [],

  // ── Cell Definition Actions ──

  addCellDefinition: (cell) => {
    const id = genCellId();
    const def: CellDefinition = {
      ...cell,
      id,
      bbox: computeBbox(cell.geometries),
      createdAt: Date.now(),
    };
    set((s) => {
      const lib = new Map(s.cellLibrary);
      lib.set(id, def);
      return { cellLibrary: lib };
    });
    return id;
  },

  getCellDefinition: (id) => get().cellLibrary.get(id),

  getCellsByCategory: (category) =>
    Array.from(get().cellLibrary.values()).filter((c) => c.category === category),

  removeCellDefinition: (id) => {
    set((s) => {
      const lib = new Map(s.cellLibrary);
      lib.delete(id);
      return {
        cellLibrary: lib,
        instances: s.instances.filter((inst) => inst.cellId !== id),
      };
    });
  },

  // ── Instance Actions ──

  placeInstance: (cellId, position, opts = {}) => {
    const cellDef = get().cellLibrary.get(cellId);
    if (!cellDef) return "";

    const id = genInstId();
    const instanceName = opts.instanceName ?? nextInstanceName(cellDef.category);

    const instance: CellInstance = {
      id,
      instanceName,
      cellId,
      position,
      rotation: opts.rotation ?? 0,
      mirror: opts.mirror ?? false,
      connections: opts.connections ?? {},
    };

    set((s) => ({ instances: [...s.instances, instance] }));
    return id;
  },

  moveInstance: (instanceId, position) => {
    set((s) => ({
      instances: s.instances.map((inst) =>
        inst.id === instanceId ? { ...inst, position } : inst,
      ),
    }));
  },

  rotateInstance: (instanceId) => {
    set((s) => ({
      instances: s.instances.map((inst) =>
        inst.id === instanceId
          ? { ...inst, rotation: (inst.rotation + 90) % 360 }
          : inst,
      ),
    }));
  },

  mirrorInstance: (instanceId) => {
    set((s) => ({
      instances: s.instances.map((inst) =>
        inst.id === instanceId ? { ...inst, mirror: !inst.mirror } : inst,
      ),
    }));
  },

  removeInstances: (instanceIds) => {
    const idSet = new Set(instanceIds);
    set((s) => ({
      instances: s.instances.filter((inst) => !idSet.has(inst.id)),
      selectedInstances: s.selectedInstances.filter((id) => !idSet.has(id)),
    }));
  },

  setConnection: (instanceId, pinName, netName) => {
    set((s) => ({
      instances: s.instances.map((inst) =>
        inst.id === instanceId
          ? { ...inst, connections: { ...inst.connections, [pinName]: netName } }
          : inst,
      ),
    }));
  },

  selectInstances: (ids) => set({ selectedInstances: ids }),
  clearSelection: () => set({ selectedInstances: [] }),

  // ── Flatten for rendering ──

  getFlattenedGeometries: () => {
    const { instances, cellLibrary } = get();
    const result: CanvasGeometry[] = [];
    for (const inst of instances) {
      const cellDef = cellLibrary.get(inst.cellId);
      if (cellDef) {
        result.push(...flattenInstance(inst, cellDef));
      }
    }
    return result;
  },

  getInstance: (id) => get().instances.find((inst) => inst.id === id),

  findInstanceByGeomId: (geomId) => {
    return get().instances.find((inst) => geomId.startsWith(inst.id));
  },
}));
