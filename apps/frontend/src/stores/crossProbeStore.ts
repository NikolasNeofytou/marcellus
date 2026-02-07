/**
 * Cross-Probing Store
 *
 * Links layout geometries ↔ netlist nodes ↔ schematic devices,
 * enabling bidirectional navigation: click a device in the LVS panel
 * to highlight the corresponding geometry on the canvas, and vice-versa.
 */

import { create } from "zustand";
import type { LvsResult, DeviceMatch, NetMatch } from "../engines/lvs";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface CrossProbeHighlight {
  /** Geometry indices to highlight on canvas */
  geometryIndices: number[];
  /** Colour for highlight overlay */
  color: string;
  /** Source identifier (device or net name) */
  source: string;
  /** Whether this is a persistent highlight or transient hover */
  persistent: boolean;
}

export interface LvsViewState {
  /** Current LVS result */
  result: LvsResult | null;
  /** Active tab in LVS panel */
  activeTab: "summary" | "devices" | "nets";
  /** Selected device match index */
  selectedDeviceIndex: number | null;
  /** Selected net match index */
  selectedNetIndex: number | null;
  /** Filter: show only mismatches? */
  showOnlyErrors: boolean;
  /** Expanded device detail indices */
  expandedDevices: Set<number>;
}

// ══════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════

interface CrossProbeStoreState {
  /** Current highlights on the canvas */
  highlights: CrossProbeHighlight[];
  /** LVS panel view state */
  lvsView: LvsViewState;
  /** Schematic symbols with cross-probe links (symbol ID → geometry indices) */
  symbolGeometryMap: Map<string, number[]>;
  /** Geometry with cross-probe links (geometry index → symbol ID) */
  geometrySymbolMap: Map<number, string>;
  /** Schematic nets with cross-probe links (net name → geometry indices) */
  netGeometryMap: Map<string, number[]>;
  /** Currently selected/highlighted element source */
  activeSource: string | null;

  // ── Cross-probe actions ──

  /** Highlight specific geometries (transient) */
  hoverHighlight: (indices: number[], source: string) => void;
  /** Clear transient highlights */
  clearHover: () => void;
  /** Toggle a persistent highlight for a device/net */
  togglePersistentHighlight: (indices: number[], source: string) => void;
  /** Clear all highlights */
  clearAllHighlights: () => void;
  /** Highlight from device match */
  highlightDevice: (match: DeviceMatch) => void;
  /** Highlight from net match */
  highlightNet: (match: NetMatch) => void;
  /** Highlight a symbol in schematic (cross-probe from layout) */
  highlightSymbol: (symbolId: string) => void;
  /** Highlight geometries by symbol (cross-probe from schematic) */
  highlightGeometryBySymbol: (symbolId: string, source: string) => void;
  /** Register symbol ↔ geometry link */
  linkSymbolToGeometry: (symbolId: string, geometryIndices: number[]) => void;
  /** Register net ↔ geometry link */
  linkNetToGeometry: (netName: string, geometryIndices: number[]) => void;
  /** Highlight a schematic net (by name) */
  highlightSchematicNet: (netName: string) => void;

  // ── LVS view actions ──

  /** Set LVS result */
  setLvsResult: (result: LvsResult | null) => void;
  /** Set active tab */
  setActiveTab: (tab: LvsViewState["activeTab"]) => void;
  /** Select device match */
  selectDevice: (index: number | null) => void;
  /** Select net match */
  selectNet: (index: number | null) => void;
  /** Toggle error-only filter */
  toggleShowOnlyErrors: () => void;
  /** Toggle device expansion */
  toggleDeviceExpanded: (index: number) => void;

  // ── Getters ──

  /** Get device matches, optionally filtered */
  getFilteredDevices: () => DeviceMatch[];
  /** Get net matches, optionally filtered */
  getFilteredNets: () => NetMatch[];
}

const HIGHLIGHT_COLORS = {
  device: "rgba(0, 140, 255, 0.4)",
  net: "rgba(255, 180, 0, 0.4)",
  error: "rgba(255, 60, 60, 0.4)",
  match: "rgba(60, 200, 100, 0.3)",
};

export const useCrossProbeStore = create<CrossProbeStoreState>((set, get) => ({
  highlights: [],
  symbolGeometryMap: new Map(),
  geometrySymbolMap: new Map(),
  netGeometryMap: new Map(),
  activeSource: null,
  lvsView: {
    result: null,
    activeTab: "summary",
    selectedDeviceIndex: null,
    selectedNetIndex: null,
    showOnlyErrors: false,
    expandedDevices: new Set(),
  },

  // ── Cross-probe ──

  hoverHighlight: (indices, source) => {
    if (indices.length === 0) return;
    set((s) => ({
      highlights: [
        ...s.highlights.filter((h) => h.persistent),
        { geometryIndices: indices, color: HIGHLIGHT_COLORS.device, source, persistent: false },
      ],
    }));
  },

  clearHover: () => {
    set((s) => ({
      highlights: s.highlights.filter((h) => h.persistent),
    }));
  },

  togglePersistentHighlight: (indices, source) => {
    set((s) => {
      const existing = s.highlights.find((h) => h.persistent && h.source === source);
      if (existing) {
        return { highlights: s.highlights.filter((h) => h.source !== source) };
      }
      return {
        highlights: [
          ...s.highlights,
          { geometryIndices: indices, color: HIGHLIGHT_COLORS.device, source, persistent: true },
        ],
      };
    });
  },

  clearAllHighlights: () => set({ highlights: [] }),

  highlightDevice: (match) => {
    const color =
      match.status === "match"
        ? HIGHLIGHT_COLORS.match
        : match.status === "mismatch"
        ? HIGHLIGHT_COLORS.error
        : HIGHLIGHT_COLORS.device;

    const source = match.layoutDevice?.name ?? match.schematicDevice?.name ?? "unknown";

    set((s) => ({
      highlights: [
        ...s.highlights.filter((h) => h.persistent),
        {
          geometryIndices: match.geometryIndices,
          color,
          source,
          persistent: false,
        },
      ],
    }));
  },

  highlightNet: (match) => {
    const source = match.layoutNet ?? match.schematicNet ?? "unknown";
    set((s) => ({
      highlights: [
        ...s.highlights.filter((h) => h.persistent),
        {
          geometryIndices: match.geometryIndices,
          color: HIGHLIGHT_COLORS.net,
          source,
          persistent: false,
        },
      ],
    }));
  },

  highlightSymbol: (symbolId) => {
    const { symbolGeometryMap } = get();
    const geometryIndices = symbolGeometryMap.get(symbolId) || [];
    set((s) => ({
      highlights: [
        ...s.highlights.filter((h) => h.persistent),
        {
          geometryIndices,
          color: HIGHLIGHT_COLORS.device,
          source: symbolId,
          persistent: false,
        },
      ],
      activeSource: symbolId,
    }));
  },

  highlightGeometryBySymbol: (symbolId, source) => {
    const { symbolGeometryMap } = get();
    const geometryIndices = symbolGeometryMap.get(symbolId) || [];
    set((s) => ({
      highlights: [
        ...s.highlights.filter((h) => h.persistent),
        {
          geometryIndices,
          color: HIGHLIGHT_COLORS.device,
          source,
          persistent: false,
        },
      ],
      activeSource: source,
    }));
  },

  linkSymbolToGeometry: (symbolId, geometryIndices) => {
    const { symbolGeometryMap, geometrySymbolMap } = get();
    const newSymbolMap = new Map(symbolGeometryMap);
    const newGeomMap = new Map(geometrySymbolMap);

    newSymbolMap.set(symbolId, geometryIndices);
    for (const idx of geometryIndices) {
      newGeomMap.set(idx, symbolId);
    }

    set({
      symbolGeometryMap: newSymbolMap,
      geometrySymbolMap: newGeomMap,
    });
  },

  linkNetToGeometry: (netName, geometryIndices) => {
    const { netGeometryMap } = get();
    const newNetMap = new Map(netGeometryMap);
    newNetMap.set(netName, geometryIndices);
    set({ netGeometryMap: newNetMap });
  },

  highlightSchematicNet: (netName) => {
    const { netGeometryMap } = get();
    const geometryIndices = netGeometryMap.get(netName) || [];
    if (geometryIndices.length === 0) return;
    set((s) => ({
      highlights: [
        ...s.highlights.filter((h) => h.persistent),
        {
          geometryIndices,
          color: HIGHLIGHT_COLORS.net,
          source: netName,
          persistent: false,
        },
      ],
      activeSource: netName,
    }));
  },

  // ── LVS view ──

  setLvsResult: (result) =>
    set((s) => ({
      lvsView: {
        ...s.lvsView,
        result,
        selectedDeviceIndex: null,
        selectedNetIndex: null,
        expandedDevices: new Set(),
      },
    })),

  setActiveTab: (tab) =>
    set((s) => ({ lvsView: { ...s.lvsView, activeTab: tab } })),

  selectDevice: (index) =>
    set((s) => ({ lvsView: { ...s.lvsView, selectedDeviceIndex: index } })),

  selectNet: (index) =>
    set((s) => ({ lvsView: { ...s.lvsView, selectedNetIndex: index } })),

  toggleShowOnlyErrors: () =>
    set((s) => ({
      lvsView: { ...s.lvsView, showOnlyErrors: !s.lvsView.showOnlyErrors },
    })),

  toggleDeviceExpanded: (index) =>
    set((s) => {
      const expanded = new Set(s.lvsView.expandedDevices);
      if (expanded.has(index)) expanded.delete(index);
      else expanded.add(index);
      return { lvsView: { ...s.lvsView, expandedDevices: expanded } };
    }),

  // ── Getters ──

  getFilteredDevices: () => {
    const { result, showOnlyErrors } = get().lvsView;
    if (!result) return [];
    if (showOnlyErrors) {
      return result.deviceMatches.filter((d) => d.status !== "match");
    }
    return result.deviceMatches;
  },

  getFilteredNets: () => {
    const { result, showOnlyErrors } = get().lvsView;
    if (!result) return [];
    if (showOnlyErrors) {
      return result.netMatches.filter((n) => n.status !== "match");
    }
    return result.netMatches;
  },
}));
