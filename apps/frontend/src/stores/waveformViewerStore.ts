/**
 * Waveform Viewer Store — Zustand state for VCD/FST waveform viewing.
 */

import { create } from "zustand";
import { parseVcd, generateDemoVcd, type VcdParseResult, type VcdTimescale } from "../engines/vcdParser";

export interface WaveformCursor {
  id: string;
  time: number;
  color: string;
  label: string;
}

export interface SignalDisplay {
  signalId: string;
  name: string;
  scopePath: string;
  width: number;
  type: string;
  visible: boolean;
  height: number; // row height in pixels
  radix: "binary" | "hex" | "decimal" | "ascii";
  color: string;
  isAnalog: boolean;
}

interface WaveformViewerState {
  /** Parsed VCD data */
  vcdData: VcdParseResult | null;
  /** All signals with display settings */
  signals: SignalDisplay[];
  /** Selected signal IDs */
  selectedSignals: Set<string>;

  /** Viewport */
  viewStart: number;
  viewEnd: number;
  totalTimeStart: number;
  totalTimeEnd: number;
  timescale: VcdTimescale | null;

  /** Cursors */
  cursors: WaveformCursor[];
  activeCursorId: string | null;

  /** UI state */
  signalTreeExpanded: Set<string>;
  zoomLevel: number;
  isLoaded: boolean;

  /** Actions */
  loadVcd: (source: string) => void;
  loadDemoVcd: () => void;
  toggleSignalVisible: (signalId: string) => void;
  selectSignal: (signalId: string) => void;
  deselectSignal: (signalId: string) => void;
  setSignalRadix: (signalId: string, radix: SignalDisplay["radix"]) => void;
  setSignalColor: (signalId: string, color: string) => void;
  setSignalHeight: (signalId: string, height: number) => void;
  setViewRange: (start: number, end: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  panLeft: () => void;
  panRight: () => void;
  addCursor: (time: number) => void;
  removeCursor: (id: string) => void;
  moveCursor: (id: string, time: number) => void;
  setActiveCursor: (id: string | null) => void;
  toggleScopeExpand: (scope: string) => void;
}

const SIGNAL_COLORS = [
  "#4fc3f7", // light blue
  "#81c784", // green
  "#ffb74d", // orange
  "#e57373", // red
  "#ba68c8", // purple
  "#4dd0e1", // cyan
  "#fff176", // yellow
  "#a1887f", // brown
  "#90a4ae", // blue grey
  "#f06292", // pink
];

let cursorIdCounter = 0;

export const useWaveformViewerStore = create<WaveformViewerState>((set, get) => ({
  vcdData: null,
  signals: [],
  selectedSignals: new Set(),
  viewStart: 0,
  viewEnd: 1000,
  totalTimeStart: 0,
  totalTimeEnd: 1000,
  timescale: null,
  cursors: [],
  activeCursorId: null,
  signalTreeExpanded: new Set(["top"]),
  zoomLevel: 1,
  isLoaded: false,

  loadVcd: (source) => {
    const result = parseVcd(source);
    if (!result) return;

    // Build signal display list
    const signals: SignalDisplay[] = [];
    let colorIdx = 0;
    for (const sig of result.signals) {
      const v = sig.variable;
      const isAnalog = v.type === "real" || v.name.includes("voltage") || v.name.includes("current");
      signals.push({
        signalId: v.idCode,
        name: v.name,
        scopePath: v.scope.join("."),
        width: v.width,
        type: v.type,
        visible: true,
        height: isAnalog ? 60 : 30,
        radix: v.width > 1 ? "hex" : "binary",
        color: SIGNAL_COLORS[colorIdx % SIGNAL_COLORS.length],
        isAnalog,
      });
      colorIdx++;
    }

    // Find time range
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const sig of result.signals) {
      for (const t of sig.transitions) {
        if (t.time < minTime) minTime = t.time;
        if (t.time > maxTime) maxTime = t.time;
      }
    }
    if (minTime === Infinity) { minTime = 0; maxTime = 1000; }

    set({
      vcdData: result,
      signals,
      viewStart: minTime,
      viewEnd: maxTime,
      totalTimeStart: minTime,
      totalTimeEnd: maxTime,
      timescale: result.timescale,
      isLoaded: true,
      cursors: [],
      activeCursorId: null,
      selectedSignals: new Set(),
      signalTreeExpanded: new Set(["top"]),
      zoomLevel: 1,
    });
  },

  loadDemoVcd: () => {
    const demoSource = generateDemoVcd();
    get().loadVcd(demoSource);
  },

  toggleSignalVisible: (signalId) =>
    set((s) => ({
      signals: s.signals.map((sig) =>
        sig.signalId === signalId ? { ...sig, visible: !sig.visible } : sig
      ),
    })),

  selectSignal: (signalId) =>
    set((s) => {
      const next = new Set(s.selectedSignals);
      next.add(signalId);
      return { selectedSignals: next };
    }),

  deselectSignal: (signalId) =>
    set((s) => {
      const next = new Set(s.selectedSignals);
      next.delete(signalId);
      return { selectedSignals: next };
    }),

  setSignalRadix: (signalId, radix) =>
    set((s) => ({
      signals: s.signals.map((sig) =>
        sig.signalId === signalId ? { ...sig, radix } : sig
      ),
    })),

  setSignalColor: (signalId, color) =>
    set((s) => ({
      signals: s.signals.map((sig) =>
        sig.signalId === signalId ? { ...sig, color } : sig
      ),
    })),

  setSignalHeight: (signalId, height) =>
    set((s) => ({
      signals: s.signals.map((sig) =>
        sig.signalId === signalId ? { ...sig, height } : sig
      ),
    })),

  setViewRange: (start, end) => set({ viewStart: start, viewEnd: end }),

  zoomIn: () =>
    set((s) => {
      const center = (s.viewStart + s.viewEnd) / 2;
      const halfSpan = (s.viewEnd - s.viewStart) / 4;
      return {
        viewStart: Math.max(s.totalTimeStart, center - halfSpan),
        viewEnd: Math.min(s.totalTimeEnd, center + halfSpan),
        zoomLevel: s.zoomLevel * 2,
      };
    }),

  zoomOut: () =>
    set((s) => {
      const center = (s.viewStart + s.viewEnd) / 2;
      const halfSpan = s.viewEnd - s.viewStart;
      return {
        viewStart: Math.max(s.totalTimeStart, center - halfSpan),
        viewEnd: Math.min(s.totalTimeEnd, center + halfSpan),
        zoomLevel: Math.max(0.01, s.zoomLevel / 2),
      };
    }),

  zoomFit: () =>
    set((s) => ({
      viewStart: s.totalTimeStart,
      viewEnd: s.totalTimeEnd,
      zoomLevel: 1,
    })),

  panLeft: () =>
    set((s) => {
      const span = s.viewEnd - s.viewStart;
      const shift = span * 0.25;
      const newStart = Math.max(s.totalTimeStart, s.viewStart - shift);
      return { viewStart: newStart, viewEnd: newStart + span };
    }),

  panRight: () =>
    set((s) => {
      const span = s.viewEnd - s.viewStart;
      const shift = span * 0.25;
      const newEnd = Math.min(s.totalTimeEnd, s.viewEnd + shift);
      return { viewStart: newEnd - span, viewEnd: newEnd };
    }),

  addCursor: (time) =>
    set((s) => {
      const id = `cursor-${cursorIdCounter++}`;
      const colors = ["#ff5252", "#448aff", "#69f0ae", "#ffd740"];
      return {
        cursors: [
          ...s.cursors,
          {
            id,
            time,
            color: colors[s.cursors.length % colors.length],
            label: `C${s.cursors.length + 1}`,
          },
        ],
        activeCursorId: id,
      };
    }),

  removeCursor: (id) =>
    set((s) => ({
      cursors: s.cursors.filter((c) => c.id !== id),
      activeCursorId: s.activeCursorId === id ? null : s.activeCursorId,
    })),

  moveCursor: (id, time) =>
    set((s) => ({
      cursors: s.cursors.map((c) =>
        c.id === id ? { ...c, time } : c
      ),
    })),

  setActiveCursor: (id) => set({ activeCursorId: id }),

  toggleScopeExpand: (scope) =>
    set((s) => {
      const next = new Set(s.signalTreeExpanded);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return { signalTreeExpanded: next };
    }),
}));
