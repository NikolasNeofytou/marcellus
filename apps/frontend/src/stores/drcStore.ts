/**
 * DRC Store — manages DRC state, violations, run lifecycle,
 * incremental dirty tracking, and auto-run subscriptions.
 */

import { create } from "zustand";
import type { DrcViolation, DrcResult } from "../engines/drc";

// ── Store ─────────────────────────────────────────────────────────────

export type DrcRunState = "idle" | "running" | "completed" | "error";

interface DrcStoreState {
  /** Current DRC run state */
  runState: DrcRunState;

  /** Result from last DRC run */
  lastResult: DrcResult | null;

  /** All violations */
  violations: DrcViolation[];

  /** Currently selected violation (for navigation) */
  selectedViolationId: string | null;

  /** Violation filter: severity */
  severityFilter: Set<"error" | "warning" | "info">;

  /** Violation filter: layer */
  layerFilter: string | null;

  /** Whether to show violations as canvas overlay */
  showOverlay: boolean;

  /** Whether DRC auto-runs on geometry changes */
  autoRun: boolean;

  /** Geometry version counter — incremented on each geometry change for incremental DRC */
  geometryVersion: number;

  /** Version at which last DRC was run */
  lastCheckedVersion: number;

  /** Set of dirty geometry indices that changed since last DRC */
  dirtyIndices: Set<number>;

  // ── Actions ──

  /** Set a new DRC result */
  setResult: (result: DrcResult) => void;

  /** Clear all violations */
  clearViolations: () => void;

  /** Set run state */
  setRunState: (state: DrcRunState) => void;

  /** Select a violation by id */
  selectViolation: (id: string | null) => void;

  /** Navigate to next/previous violation */
  nextViolation: () => void;
  prevViolation: () => void;

  /** Toggle severity filter */
  toggleSeverityFilter: (severity: "error" | "warning" | "info") => void;

  /** Set layer filter */
  setLayerFilter: (layer: string | null) => void;

  /** Toggle overlay visibility */
  toggleOverlay: () => void;

  /** Toggle auto-run */
  toggleAutoRun: () => void;

  /** Get filtered violations */
  getFilteredViolations: () => DrcViolation[];

  /** Get violation counts by severity */
  getCounts: () => { errors: number; warnings: number; infos: number; total: number };

  /** Mark geometry indices as dirty (changed since last DRC run) */
  markDirty: (indices: number[]) => void;

  /** Mark all geometries as dirty */
  markAllDirty: () => void;

  /** Clear dirty state (called after a DRC run completes) */
  clearDirty: () => void;

  /** Whether there are pending geometry changes not yet checked */
  isDirty: () => boolean;
}

export const useDrcStore = create<DrcStoreState>((set, get) => ({
  runState: "idle",
  lastResult: null,
  violations: [],
  selectedViolationId: null,
  severityFilter: new Set(["error", "warning", "info"]),
  layerFilter: null,
  showOverlay: true,
  autoRun: false,
  geometryVersion: 0,
  lastCheckedVersion: 0,
  dirtyIndices: new Set<number>(),

  setResult: (result) =>
    set((s) => ({
      lastResult: result,
      violations: result.violations,
      runState: "completed",
      selectedViolationId: null,
      lastCheckedVersion: s.geometryVersion,
    })),

  clearViolations: () =>
    set({
      violations: [],
      lastResult: null,
      runState: "idle",
      selectedViolationId: null,
    }),

  setRunState: (state) => set({ runState: state }),

  selectViolation: (id) => set({ selectedViolationId: id }),

  nextViolation: () => {
    const { selectedViolationId } = get();
    const filtered = get().getFilteredViolations();
    if (filtered.length === 0) return;

    const currentIndex = filtered.findIndex((v) => v.id === selectedViolationId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % filtered.length;
    set({ selectedViolationId: filtered[nextIndex].id });
  },

  prevViolation: () => {
    const { selectedViolationId } = get();
    const filtered = get().getFilteredViolations();
    if (filtered.length === 0) return;

    const currentIndex = filtered.findIndex((v) => v.id === selectedViolationId);
    const prevIndex = currentIndex <= 0 ? filtered.length - 1 : currentIndex - 1;
    set({ selectedViolationId: filtered[prevIndex].id });
  },

  toggleSeverityFilter: (severity) =>
    set((s) => {
      const next = new Set(s.severityFilter);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return { severityFilter: next };
    }),

  setLayerFilter: (layer) => set({ layerFilter: layer }),

  toggleOverlay: () => set((s) => ({ showOverlay: !s.showOverlay })),

  toggleAutoRun: () => set((s) => ({ autoRun: !s.autoRun })),

  getFilteredViolations: () => {
    const { violations, severityFilter, layerFilter } = get();
    return violations.filter((v) => {
      if (!severityFilter.has(v.severity)) return false;
      if (layerFilter && !v.layers.includes(layerFilter)) return false;
      return true;
    });
  },

  getCounts: () => {
    const { violations } = get();
    let errors = 0, warnings = 0, infos = 0;
    for (const v of violations) {
      if (v.severity === "error") errors++;
      else if (v.severity === "warning") warnings++;
      else infos++;
    }
    return { errors, warnings, infos, total: violations.length };
  },

  markDirty: (indices) =>
    set((s) => {
      const next = new Set(s.dirtyIndices);
      for (const i of indices) next.add(i);
      return { dirtyIndices: next, geometryVersion: s.geometryVersion + 1 };
    }),

  markAllDirty: () =>
    set((s) => ({ dirtyIndices: new Set<number>(), geometryVersion: s.geometryVersion + 1 })),

  clearDirty: () => set({ dirtyIndices: new Set<number>() }),

  isDirty: () => {
    const { geometryVersion, lastCheckedVersion } = get();
    return geometryVersion > lastCheckedVersion;
  },
}));
