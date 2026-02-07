/**
 * Git Integration Store — Sprint 25-26
 *
 * State management for layout diff/XOR overlay, cell-level locking,
 * and GitHub/GitLab PR integration.
 */

import { create } from "zustand";
import {
  computeLayoutXor,
  createLockManager,
  generateDemoPRs,
  type LayoutDiffResult,
  type XorRegion,
  type CellLock,
  type RemoteConfig,
  type PullRequestSummary,
  type LockManager,
} from "../engines/gitIntegration";
import type { CanvasGeometry } from "./geometryStore";

// ── Types ─────────────────────────────────────────────────────────

export interface XorOverlayConfig {
  enabled: boolean;
  opacity: number;
  showOnlyA: boolean;
  showOnlyB: boolean;
  colorA: string;
  colorB: string;
}

export interface GitIntegrationState {
  // ── XOR / Layout Diff ──
  xorResult: LayoutDiffResult | null;
  xorOverlay: XorOverlayConfig;
  xorSourceLabel: string;
  xorTargetLabel: string;
  computeXor: (a: CanvasGeometry[], b: CanvasGeometry[], labelA: string, labelB: string) => void;
  clearXor: () => void;
  setXorOverlay: (patch: Partial<XorOverlayConfig>) => void;
  getVisibleXorRegions: () => XorRegion[];

  // ── Cell-Level Locking ──
  lockManager: LockManager;
  lockList: CellLock[];
  acquireLock: (cellId: string, cellName: string, reason?: string) => void;
  releaseLock: (cellId: string) => void;
  refreshLocks: () => void;

  // ── Remote / PR Integration ──
  remoteConfig: RemoteConfig;
  pullRequests: PullRequestSummary[];
  setRemoteConfig: (config: Partial<RemoteConfig>) => void;
  fetchPullRequests: (branches: string[]) => void;
  prFilter: "all" | "open" | "merged" | "closed";
  setPrFilter: (f: "all" | "open" | "merged" | "closed") => void;

  // ── Diff view state ──
  diffViewMode: "unified" | "split" | "xor";
  setDiffViewMode: (m: "unified" | "split" | "xor") => void;
}

// ── Store ─────────────────────────────────────────────────────────

export const useGitIntegrationStore = create<GitIntegrationState>((set, get) => {
  const lockManager = createLockManager();

  return {
    // ── XOR ──
    xorResult: null,
    xorOverlay: {
      enabled: false,
      opacity: 0.6,
      showOnlyA: true,
      showOnlyB: true,
      colorA: "#ff4444",
      colorB: "#44ff44",
    },
    xorSourceLabel: "",
    xorTargetLabel: "",

    computeXor(a, b, labelA, labelB) {
      const result = computeLayoutXor(a, b);
      set({
        xorResult: result,
        xorSourceLabel: labelA,
        xorTargetLabel: labelB,
        xorOverlay: { ...get().xorOverlay, enabled: true },
      });
    },

    clearXor() {
      set({
        xorResult: null,
        xorOverlay: { ...get().xorOverlay, enabled: false },
      });
    },

    setXorOverlay(patch) {
      set({ xorOverlay: { ...get().xorOverlay, ...patch } });
    },

    getVisibleXorRegions() {
      const { xorResult, xorOverlay } = get();
      if (!xorResult || !xorOverlay.enabled) return [];
      return xorResult.xorRegions.filter((r) => {
        if (r.side === "only-a" && !xorOverlay.showOnlyA) return false;
        if (r.side === "only-b" && !xorOverlay.showOnlyB) return false;
        return true;
      });
    },

    // ── Cell-Level Locking ──
    lockManager,
    lockList: [],

    acquireLock(cellId, cellName, reason) {
      lockManager.acquireLock(cellId, cellName, "local-user", reason);
      set({ lockList: lockManager.listLocks() });
    },

    releaseLock(cellId) {
      lockManager.releaseLock(cellId, "local-user");
      set({ lockList: lockManager.listLocks() });
    },

    refreshLocks() {
      set({ lockList: lockManager.listLocks() });
    },

    // ── Remote / PR ──
    remoteConfig: {
      provider: "github",
      baseUrl: "https://github.com",
      owner: "opensilicon",
      repo: "design",
    },
    pullRequests: [],
    prFilter: "all",

    setRemoteConfig(config) {
      set({ remoteConfig: { ...get().remoteConfig, ...config } });
    },

    fetchPullRequests(branches) {
      const prs = generateDemoPRs(branches);
      set({ pullRequests: prs });
    },

    setPrFilter(f) {
      set({ prFilter: f });
    },

    // ── Diff View ──
    diffViewMode: "unified",
    setDiffViewMode(m) {
      set({ diffViewMode: m });
    },
  };
});
