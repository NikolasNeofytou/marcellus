/**
 * Incremental LVS Store — Sprint 23-24
 *
 * Adds incremental LVS capability with:
 * - Dirty geometry tracking (mirroring drcStore pattern)
 * - Graphical LVS debug state (connectivity graph, zoom-to-error)
 * - Parasitic estimation overlay state
 * - Pre/post layout comparison for design iteration
 */

import { create } from "zustand";
import type { LvsResult } from "../engines/lvs";
import type { ParasiticElement } from "../engines/netlist";
import type { CanvasGeometry } from "./geometryStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export type IncrementalLvsState = "idle" | "running" | "completed" | "error";

/** Connectivity graph node for graphical LVS debug */
export interface ConnGraphNode {
  id: string;
  label: string;
  type: "device" | "net" | "port";
  x: number;
  y: number;
  status: "match" | "mismatch" | "extra" | "missing";
  /** Index into deviceMatches or netMatches */
  matchIndex: number;
  /** Geometry indices for cross-probing */
  geometryIndices: number[];
}

/** Edge in the connectivity graph */
export interface ConnGraphEdge {
  from: string;
  to: string;
  label: string;
  status: "ok" | "error";
}

/** A connectivity graph for LVS debug visualization */
export interface ConnectivityGraph {
  nodes: ConnGraphNode[];
  edges: ConnGraphEdge[];
}

/** Parasitic overlay element for display on canvas */
export interface ParasiticOverlayItem {
  /** Element from extraction */
  element: ParasiticElement;
  /** Display position (centroid of source geometry) */
  x: number;
  y: number;
  /** Heat value 0-1 for heatmap colouring */
  heat: number;
  /** Display label (e.g., "12.5 Ω" or "0.38 fF") */
  label: string;
}

/** Heatmap configuration */
export interface ParasiticHeatmapConfig {
  /** Show resistance overlay */
  showResistance: boolean;
  /** Show capacitance overlay */
  showCapacitance: boolean;
  /** Display mode */
  displayMode: "labels" | "heatmap" | "both";
  /** Opacity 0-1 */
  opacity: number;
  /** Maximum resistance for heatmap normalization (Ω) */
  rMax: number;
  /** Maximum capacitance for heatmap normalization (fF) */
  cMax: number;
}

/** Pre/post comparison snapshot */
export interface LayoutSnapshot {
  /** Snapshot name / label */
  name: string;
  /** Timestamp */
  timestamp: number;
  /** LVS result at time of snapshot */
  lvsResult: LvsResult | null;
  /** Parasitic elements at time of snapshot */
  parasitics: ParasiticElement[];
  /** Summary stats for quick comparison */
  stats: {
    deviceCount: number;
    netCount: number;
    matchedDevices: number;
    errors: number;
    totalParasiticR: number;
    totalParasiticC: number;
  };
}

/** Comparison between two snapshots */
export interface SnapshotComparison {
  before: LayoutSnapshot;
  after: LayoutSnapshot;
  /** Delta in device match count */
  deltaMatchedDevices: number;
  /** Delta in error count */
  deltaErrors: number;
  /** Delta in total parasitic resistance (Ω) */
  deltaTotalR: number;
  /** Delta in total parasitic capacitance (fF) */
  deltaTotalC: number;
  /** Newly introduced errors */
  newErrors: string[];
  /** Fixed errors */
  fixedErrors: string[];
}

// ══════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════

interface IncrLvsStoreState {
  /** Incremental LVS run state */
  runState: IncrementalLvsState;
  /** Geometry version counter */
  geometryVersion: number;
  /** Version at last LVS run */
  lastCheckedVersion: number;
  /** Dirty geometry indices */
  dirtyIndices: Set<number>;

  // ── Graphical Debug ──
  /** Connectivity graph for debug visualization */
  connectivityGraph: ConnectivityGraph | null;
  /** Selected node in the graph */
  selectedGraphNode: string | null;
  /** Zoom target (geometry indices to focus camera on) */
  zoomTarget: { indices: number[]; source: string } | null;

  // ── Parasitic Overlay ──
  /** Parasitic elements from most recent extraction */
  parasiticElements: ParasiticElement[];
  /** Overlay items (positioned for canvas rendering) */
  overlayItems: ParasiticOverlayItem[];
  /** Heatmap configuration */
  heatmapConfig: ParasiticHeatmapConfig;
  /** Whether overlay is visible */
  overlayVisible: boolean;

  // ── Pre/Post Comparison ──
  /** Saved snapshots */
  snapshots: LayoutSnapshot[];
  /** Active comparison */
  activeComparison: SnapshotComparison | null;

  // ── Actions ──

  /** Mark geometry indices as dirty */
  markDirty: (indices: number[]) => void;
  /** Mark all dirty */
  markAllDirty: () => void;
  /** Clear dirty after LVS run */
  clearDirty: () => void;
  /** Check if dirty */
  isDirty: () => boolean;
  /** Set run state */
  setRunState: (state: IncrementalLvsState) => void;

  /** Build connectivity graph from LVS result */
  buildConnectivityGraph: (result: LvsResult) => void;
  /** Select a graph node */
  selectGraphNode: (nodeId: string | null) => void;
  /** Set zoom target */
  setZoomTarget: (indices: number[], source: string) => void;
  /** Clear zoom target */
  clearZoomTarget: () => void;

  /** Set parasitic elements and build overlay */
  setParasitics: (
    elements: ParasiticElement[],
    geometries: CanvasGeometry[],
  ) => void;
  /** Update heatmap config */
  updateHeatmapConfig: (config: Partial<ParasiticHeatmapConfig>) => void;
  /** Toggle overlay visibility */
  toggleOverlay: () => void;

  /** Take a snapshot of current state */
  takeSnapshot: (
    name: string,
    lvsResult: LvsResult | null,
    parasitics: ParasiticElement[],
  ) => void;
  /** Compare two snapshots */
  compareSnapshots: (beforeIndex: number, afterIndex: number) => void;
  /** Delete a snapshot */
  deleteSnapshot: (index: number) => void;
  /** Clear comparison */
  clearComparison: () => void;
}

// ── Helpers ──

function buildGraph(result: LvsResult): ConnectivityGraph {
  const nodes: ConnGraphNode[] = [];
  const edges: ConnGraphEdge[] = [];
  const nodeMap = new Map<string, ConnGraphNode>();

  // Create net nodes (left column)
  const nets = result.netMatches;
  for (let i = 0; i < nets.length; i++) {
    const n = nets[i];
    const id = `net_${n.layoutNet ?? n.schematicNet ?? i}`;
    const node: ConnGraphNode = {
      id,
      label: n.layoutNet ?? n.schematicNet ?? `net${i}`,
      type: "net",
      x: 50,
      y: 40 + i * 60,
      status: n.status,
      matchIndex: i,
      geometryIndices: n.geometryIndices,
    };
    nodes.push(node);
    nodeMap.set(id, node);
  }

  // Create device nodes (right column)
  const devs = result.deviceMatches;
  for (let i = 0; i < devs.length; i++) {
    const d = devs[i];
    const name = d.layoutDevice?.name ?? d.schematicDevice?.name ?? `dev${i}`;
    const id = `dev_${name}`;
    const node: ConnGraphNode = {
      id,
      label: name,
      type: "device",
      x: 250,
      y: 40 + i * 60,
      status: d.status,
      matchIndex: i,
      geometryIndices: d.geometryIndices,
    };
    nodes.push(node);
    nodeMap.set(id, node);

    // Create edges from device terminals to nets
    const dev = d.layoutDevice ?? d.schematicDevice;
    if (dev) {
      for (const [term, netName] of Object.entries(dev.terminals)) {
        const netId = `net_${netName}`;
        const termDiff = d.terminalDiffs.find((t) => t.terminal === term);
        edges.push({
          from: id,
          to: netId,
          label: term,
          status: termDiff && !termDiff.match ? "error" : "ok",
        });
      }
    }
  }

  return { nodes, edges };
}

function computeOverlayItems(
  elements: ParasiticElement[],
  geometries: CanvasGeometry[],
  config: ParasiticHeatmapConfig,
): ParasiticOverlayItem[] {
  const items: ParasiticOverlayItem[] = [];

  for (const el of elements) {
    if (el.type === "resistor" && !config.showResistance) continue;
    if (el.type === "capacitor" && !config.showCapacitance) continue;

    // Find position from geometry
    let x = 0, y = 0;
    if (el.geometryIndex !== undefined && el.geometryIndex < geometries.length) {
      const geom = geometries[el.geometryIndex];
      const pts = geom.points;
      x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    }

    // Compute heat (normalized value)
    let heat: number;
    if (el.type === "resistor") {
      heat = Math.min(el.value / config.rMax, 1);
    } else {
      heat = Math.min((el.value * 1e15) / config.cMax, 1); // value in F → fF
    }

    // Format label
    let label: string;
    if (el.type === "resistor") {
      if (el.value >= 1e3) label = `${(el.value / 1e3).toFixed(1)}kΩ`;
      else label = `${el.value.toFixed(1)}Ω`;
    } else {
      const fF = el.value * 1e15;
      if (fF >= 1000) label = `${(fF / 1000).toFixed(2)}pF`;
      else label = `${fF.toFixed(2)}fF`;
    }

    items.push({ element: el, x, y, heat, label });
  }

  return items;
}

function computeSnapshotStats(
  lvsResult: LvsResult | null,
  parasitics: ParasiticElement[],
): LayoutSnapshot["stats"] {
  const totalR = parasitics
    .filter((p) => p.type === "resistor")
    .reduce((s, p) => s + p.value, 0);
  const totalC = parasitics
    .filter((p) => p.type === "capacitor")
    .reduce((s, p) => s + p.value * 1e15, 0); // in fF

  if (!lvsResult) {
    return {
      deviceCount: 0, netCount: 0, matchedDevices: 0, errors: 0,
      totalParasiticR: totalR, totalParasiticC: totalC,
    };
  }

  return {
    deviceCount: lvsResult.summary.totalDevices,
    netCount: lvsResult.summary.totalNets,
    matchedDevices: lvsResult.summary.matchedDevices,
    errors:
      lvsResult.summary.mismatchedDevices +
      lvsResult.summary.extraLayoutDevices +
      lvsResult.summary.missingLayoutDevices +
      lvsResult.summary.parameterErrors +
      lvsResult.summary.connectivityErrors,
    totalParasiticR: totalR,
    totalParasiticC: totalC,
  };
}

export const useIncrLvsStore = create<IncrLvsStoreState>((set, get) => ({
  runState: "idle",
  geometryVersion: 0,
  lastCheckedVersion: 0,
  dirtyIndices: new Set(),

  connectivityGraph: null,
  selectedGraphNode: null,
  zoomTarget: null,

  parasiticElements: [],
  overlayItems: [],
  heatmapConfig: {
    showResistance: true,
    showCapacitance: true,
    displayMode: "both",
    opacity: 0.7,
    rMax: 100,
    cMax: 10,
  },
  overlayVisible: false,

  snapshots: [],
  activeComparison: null,

  // ── Dirty tracking ──

  markDirty: (indices) =>
    set((s) => {
      const next = new Set(s.dirtyIndices);
      for (const i of indices) next.add(i);
      return { dirtyIndices: next, geometryVersion: s.geometryVersion + 1 };
    }),

  markAllDirty: () =>
    set((s) => ({ dirtyIndices: new Set<number>(), geometryVersion: s.geometryVersion + 1 })),

  clearDirty: () =>
    set((s) => ({
      dirtyIndices: new Set(),
      lastCheckedVersion: s.geometryVersion,
    })),

  isDirty: () => {
    const s = get();
    return s.geometryVersion > s.lastCheckedVersion;
  },

  setRunState: (state) => set({ runState: state }),

  // ── Graphical Debug ──

  buildConnectivityGraph: (result) => {
    const graph = buildGraph(result);
    set({ connectivityGraph: graph });
  },

  selectGraphNode: (nodeId) => set({ selectedGraphNode: nodeId }),

  setZoomTarget: (indices, source) =>
    set({ zoomTarget: { indices, source } }),

  clearZoomTarget: () => set({ zoomTarget: null }),

  // ── Parasitic Overlay ──

  setParasitics: (elements, geometries) => {
    const config = get().heatmapConfig;
    const items = computeOverlayItems(elements, geometries, config);
    set({ parasiticElements: elements, overlayItems: items });
  },

  updateHeatmapConfig: (partial) => {
    const config = { ...get().heatmapConfig, ...partial };
    const items = computeOverlayItems(get().parasiticElements, [], config);
    set({ heatmapConfig: config, overlayItems: items });
  },

  toggleOverlay: () =>
    set((s) => ({ overlayVisible: !s.overlayVisible })),

  // ── Snapshots ──

  takeSnapshot: (name, lvsResult, parasitics) => {
    const snapshot: LayoutSnapshot = {
      name,
      timestamp: Date.now(),
      lvsResult,
      parasitics: [...parasitics],
      stats: computeSnapshotStats(lvsResult, parasitics),
    };
    set((s) => ({ snapshots: [...s.snapshots, snapshot] }));
  },

  compareSnapshots: (beforeIndex, afterIndex) => {
    const { snapshots } = get();
    if (beforeIndex >= snapshots.length || afterIndex >= snapshots.length) return;

    const before = snapshots[beforeIndex];
    const after = snapshots[afterIndex];

    // Find new / fixed errors
    const beforeErrors = new Set<string>();
    const afterErrors = new Set<string>();

    if (before.lvsResult) {
      for (const d of before.lvsResult.deviceMatches) {
        if (d.status !== "match") {
          beforeErrors.add(d.layoutDevice?.name ?? d.schematicDevice?.name ?? "?");
        }
      }
    }
    if (after.lvsResult) {
      for (const d of after.lvsResult.deviceMatches) {
        if (d.status !== "match") {
          afterErrors.add(d.layoutDevice?.name ?? d.schematicDevice?.name ?? "?");
        }
      }
    }

    const newErrors = [...afterErrors].filter((e) => !beforeErrors.has(e));
    const fixedErrors = [...beforeErrors].filter((e) => !afterErrors.has(e));

    const comparison: SnapshotComparison = {
      before,
      after,
      deltaMatchedDevices: after.stats.matchedDevices - before.stats.matchedDevices,
      deltaErrors: after.stats.errors - before.stats.errors,
      deltaTotalR: after.stats.totalParasiticR - before.stats.totalParasiticR,
      deltaTotalC: after.stats.totalParasiticC - before.stats.totalParasiticC,
      newErrors,
      fixedErrors,
    };

    set({ activeComparison: comparison });
  },

  deleteSnapshot: (index) =>
    set((s) => ({
      snapshots: s.snapshots.filter((_, i) => i !== index),
      activeComparison: null,
    })),

  clearComparison: () => set({ activeComparison: null }),
}));
