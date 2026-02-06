/**
 * Simulation Store — manages simulation state, netlist, waveform data,
 * parameter sweeps, corner analysis, and measurement cursors.
 */

import { create } from "zustand";
import type { ExtractedNetlist } from "../engines/netlist";

// ── Waveform data ─────────────────────────────────────────────────

export interface WaveformSignal {
  name: string;
  unit: string;
  data: { time: number; value: number }[];
  color: string;
  visible: boolean;
}

export interface WaveformData {
  signals: WaveformSignal[];
  timeRange: { start: number; end: number };
  timeUnit: string;
}

// ── Parameter Sweep ───────────────────────────────────────────────

export interface SweepParameter {
  name: string;
  values: number[];
  unit: string;
}

export interface SweepResult {
  /** Parameter configuration for this run */
  paramValues: Record<string, number>;
  /** Label e.g. "VDD=1.8V, Temp=27°C" */
  label: string;
  /** Waveform data for this sweep point */
  waveform: WaveformData;
}

export interface SweepConfig {
  parameters: SweepParameter[];
  results: SweepResult[];
  activeSweepIndex: number;
}

// ── Corner Analysis ───────────────────────────────────────────────

export type CornerType = "TT" | "FF" | "SS" | "FS" | "SF";

export interface CornerConfig {
  name: CornerType;
  temperature: number;
  voltage: number;
  processVariation: number; // multiplier, e.g. 1.0 = typical
  enabled: boolean;
}

export interface CornerResult {
  corner: CornerType;
  label: string;
  waveform: WaveformData;
  metrics: Record<string, number>; // e.g. { delay: 120e-12, power: 2.1e-6 }
}

export interface CornerAnalysis {
  corners: CornerConfig[];
  results: CornerResult[];
  activeCornerIndex: number;
}

// ── Measurement Cursors ───────────────────────────────────────────

export interface WaveformCursor {
  id: string;
  time: number;
  color: string;
  label: string;
}

export interface CursorMeasurement {
  signalName: string;
  cursor1Value: number;
  cursor2Value: number;
  delta: number;
  timeDelta: number;
  frequency: number; // 1 / timeDelta
}

// ── Simulation state ──────────────────────────────────────────────

export type SimState = "idle" | "extracting" | "running" | "completed" | "error";

interface SimStoreState {
  /** Current simulation state */
  state: SimState;

  /** Extracted netlist */
  netlist: ExtractedNetlist | null;

  /** SPICE output text */
  spiceOutput: string;

  /** Waveform data from simulation */
  waveform: WaveformData | null;

  /** Error message if simulation failed */
  error: string | null;

  /** Active bottom panel tab */
  activeTab: "terminal" | "netlist" | "simulation" | "waveform" | "lvs";

  /** Terminal output lines */
  terminalLines: string[];

  /** Parameter sweep state */
  sweep: SweepConfig | null;

  /** Corner analysis state */
  cornerAnalysis: CornerAnalysis | null;

  /** Measurement cursors */
  cursors: WaveformCursor[];

  /** Cursor measurements (computed) */
  cursorMeasurements: CursorMeasurement[];

  // ── Actions ──

  setNetlist: (netlist: ExtractedNetlist) => void;
  clearNetlist: () => void;
  setState: (state: SimState) => void;
  setSpiceOutput: (output: string) => void;
  setWaveform: (waveform: WaveformData) => void;
  setError: (error: string) => void;
  clearError: () => void;
  setActiveTab: (tab: SimStoreState["activeTab"]) => void;
  appendTerminalLine: (line: string) => void;
  clearTerminal: () => void;

  // ── Sweep ──
  runParameterSweep: (params: SweepParameter[]) => void;
  setActiveSweepIndex: (index: number) => void;
  clearSweep: () => void;

  // ── Corner Analysis ──
  runCornerAnalysis: () => void;
  setActiveCornerIndex: (index: number) => void;
  toggleCorner: (corner: CornerType) => void;
  clearCornerAnalysis: () => void;

  // ── Cursors ──
  addCursor: (time: number) => void;
  removeCursor: (id: string) => void;
  moveCursor: (id: string, time: number) => void;
  clearCursors: () => void;
  computeCursorMeasurements: () => void;

  /** Generate demo waveform data for testing */
  generateDemoWaveform: () => void;
}

// Default signal colors
const signalColors = [
  "#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#ec4899",
  "#14b8a6", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16",
];

export const useSimStore = create<SimStoreState>((set, get) => ({
  state: "idle",
  netlist: null,
  spiceOutput: "",
  waveform: null,
  error: null,
  activeTab: "terminal",
  terminalLines: ["OpenSilicon v0.1.0 — Ready", ""],
  sweep: null,
  cornerAnalysis: null,
  cursors: [],
  cursorMeasurements: [],

  setNetlist: (netlist) =>
    set({ netlist, state: "completed", activeTab: "netlist" }),

  clearNetlist: () =>
    set({ netlist: null, state: "idle", spiceOutput: "" }),

  setState: (state) => set({ state }),

  setSpiceOutput: (spiceOutput) => set({ spiceOutput }),

  setWaveform: (waveform) =>
    set({ waveform, activeTab: "waveform" }),

  setError: (error) =>
    set({ error, state: "error" }),

  clearError: () =>
    set({ error: null }),

  setActiveTab: (activeTab) => set({ activeTab }),

  appendTerminalLine: (line) =>
    set((s) => ({ terminalLines: [...s.terminalLines, line] })),

  clearTerminal: () =>
    set({ terminalLines: ["OpenSilicon v0.1.0 — Terminal cleared", ""] }),

  // ── Parameter Sweep ──

  runParameterSweep: (params) => {
    const results: SweepResult[] = [];
    // Generate Cartesian product of param values
    const combos = cartesianProduct(params.map((p) => p.values));
    const baseWaveform = get().waveform;
    const timeEnd = baseWaveform?.timeRange.end ?? 10e-9;
    const timePoints = 200;
    const dt = timeEnd / timePoints;

    for (const combo of combos) {
      const paramValues: Record<string, number> = {};
      const labelParts: string[] = [];
      params.forEach((p, i) => {
        paramValues[p.name] = combo[i];
        labelParts.push(`${p.name}=${combo[i]}${p.unit}`);
      });

      // Generate variation of waveforms based on param values
      const vdd = paramValues["VDD"] ?? 1.8;
      const temp = paramValues["Temp"] ?? 27;
      const tempFactor = 1 + (temp - 27) * 0.002;
      const signals: WaveformSignal[] = [
        generateSweptSignal("OUT", "V", dt, timePoints, vdd, tempFactor, signalColors[2]),
        generateSweptSignal("I(VDD)", "mA", dt, timePoints, vdd * 0.1, tempFactor, signalColors[3]),
      ];

      results.push({
        paramValues,
        label: labelParts.join(", "),
        waveform: {
          signals,
          timeRange: { start: 0, end: timeEnd },
          timeUnit: "s",
        },
      });
    }

    set({
      sweep: { parameters: params, results, activeSweepIndex: 0 },
      activeTab: "waveform",
    });
    get().appendTerminalLine(`> Parameter sweep: ${results.length} configurations`);
  },

  setActiveSweepIndex: (index) => {
    const sweep = get().sweep;
    if (!sweep || index < 0 || index >= sweep.results.length) return;
    set({
      sweep: { ...sweep, activeSweepIndex: index },
      waveform: sweep.results[index].waveform,
    });
  },

  clearSweep: () => set({ sweep: null }),

  // ── Corner Analysis ──

  runCornerAnalysis: () => {
    const defaultCorners: CornerConfig[] = [
      { name: "TT", temperature: 27, voltage: 1.8, processVariation: 1.0, enabled: true },
      { name: "FF", temperature: -40, voltage: 1.98, processVariation: 0.9, enabled: true },
      { name: "SS", temperature: 125, voltage: 1.62, processVariation: 1.1, enabled: true },
      { name: "FS", temperature: 27, voltage: 1.8, processVariation: 0.95, enabled: true },
      { name: "SF", temperature: 27, voltage: 1.8, processVariation: 1.05, enabled: true },
    ];

    const timeEnd = 10e-9;
    const timePoints = 200;
    const dt = timeEnd / timePoints;
    const results: CornerResult[] = [];

    const cornerColors = ["#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#ec4899"];

    for (let ci = 0; ci < defaultCorners.length; ci++) {
      const corner = defaultCorners[ci];
      if (!corner.enabled) continue;

      const tempFactor = 1 + (corner.temperature - 27) * 0.002;
      const vdd = corner.voltage;
      const pv = corner.processVariation;

      const outSignal = generateCornerSignal(
        `OUT_${corner.name}`, "V", dt, timePoints,
        vdd, tempFactor * pv, cornerColors[ci],
      );

      // Compute metrics
      const delay = (0.15e-9 * tempFactor * pv);
      const power = vdd * vdd * 0.5e-3 * tempFactor;

      results.push({
        corner: corner.name,
        label: `${corner.name} (${corner.temperature}°C, ${corner.voltage}V)`,
        waveform: {
          signals: [outSignal],
          timeRange: { start: 0, end: timeEnd },
          timeUnit: "s",
        },
        metrics: { delay, power },
      });
    }

    set({
      cornerAnalysis: { corners: defaultCorners, results, activeCornerIndex: 0 },
      activeTab: "waveform",
    });
    get().appendTerminalLine(`> Corner analysis: ${results.length} corners simulated`);
  },

  setActiveCornerIndex: (index) => {
    set((s) => {
      if (!s.cornerAnalysis) return {};
      return { cornerAnalysis: { ...s.cornerAnalysis, activeCornerIndex: index } };
    });
  },

  toggleCorner: (corner) => {
    set((s) => {
      if (!s.cornerAnalysis) return {};
      const corners = s.cornerAnalysis.corners.map((c) =>
        c.name === corner ? { ...c, enabled: !c.enabled } : c,
      );
      return { cornerAnalysis: { ...s.cornerAnalysis, corners } };
    });
  },

  clearCornerAnalysis: () => set({ cornerAnalysis: null }),

  // ── Cursors ──

  addCursor: (time) => {
    const cursors = get().cursors;
    if (cursors.length >= 2) return; // Max 2 cursors
    const cursorColors = ["#f59e0b", "#ec4899"];
    const id = `cursor-${Date.now()}`;
    const newCursor: WaveformCursor = {
      id,
      time,
      color: cursorColors[cursors.length],
      label: `C${cursors.length + 1}`,
    };
    set({ cursors: [...cursors, newCursor] });
    get().computeCursorMeasurements();
  },

  removeCursor: (id) => {
    set((s) => ({ cursors: s.cursors.filter((c) => c.id !== id) }));
    get().computeCursorMeasurements();
  },

  moveCursor: (id, time) => {
    set((s) => ({
      cursors: s.cursors.map((c) => (c.id === id ? { ...c, time } : c)),
    }));
    get().computeCursorMeasurements();
  },

  clearCursors: () => set({ cursors: [], cursorMeasurements: [] }),

  computeCursorMeasurements: () => {
    const { cursors, waveform } = get();
    if (cursors.length < 2 || !waveform) {
      set({ cursorMeasurements: [] });
      return;
    }

    const t1 = cursors[0].time;
    const t2 = cursors[1].time;
    const timeDelta = Math.abs(t2 - t1);
    const frequency = timeDelta > 0 ? 1 / timeDelta : 0;

    const measurements: CursorMeasurement[] = waveform.signals
      .filter((s) => s.visible)
      .map((signal) => {
        const v1 = interpolateValue(signal.data, t1);
        const v2 = interpolateValue(signal.data, t2);
        return {
          signalName: signal.name,
          cursor1Value: v1,
          cursor2Value: v2,
          delta: v2 - v1,
          timeDelta,
          frequency,
        };
      });

    set({ cursorMeasurements: measurements });
  },

  generateDemoWaveform: () => {
    const timePoints = 200;
    const timeEnd = 10e-9; // 10ns
    const dt = timeEnd / timePoints;

    const clk: WaveformSignal = {
      name: "CLK",
      unit: "V",
      data: [],
      color: signalColors[0],
      visible: true,
    };

    const input: WaveformSignal = {
      name: "IN",
      unit: "V",
      data: [],
      color: signalColors[1],
      visible: true,
    };

    const output: WaveformSignal = {
      name: "OUT",
      unit: "V",
      data: [],
      color: signalColors[2],
      visible: true,
    };

    const current: WaveformSignal = {
      name: "I(VDD)",
      unit: "mA",
      data: [],
      color: signalColors[3],
      visible: true,
    };

    for (let i = 0; i <= timePoints; i++) {
      const t = i * dt;

      // CLK: 1GHz square wave
      const clkVal = Math.sin(2 * Math.PI * 1e9 * t) > 0 ? 1.8 : 0;
      clk.data.push({ time: t, value: clkVal });

      // IN: step at 3ns, with RC rise
      const inRaw = t > 3e-9 ? 1.8 * (1 - Math.exp(-(t - 3e-9) / 0.2e-9)) : 0;
      input.data.push({ time: t, value: inRaw });

      // OUT: inverted, delayed by ~0.1ns with RC
      const delay = 0.15e-9;
      const tDelayed = Math.max(0, t - 3e-9 - delay);
      const outVal = t > 3e-9 + delay
        ? 1.8 * Math.exp(-tDelayed / 0.25e-9)
        : 1.8;
      output.data.push({ time: t, value: outVal });

      // Current: spikes at transitions
      const idd = Math.abs(Math.sin(2 * Math.PI * 1e9 * t)) * 0.1 +
        (t > 3e-9 && t < 3.5e-9 ? 2 * Math.exp(-(t - 3e-9) / 0.1e-9) : 0);
      current.data.push({ time: t, value: idd });
    }

    set({
      waveform: {
        signals: [clk, input, output, current],
        timeRange: { start: 0, end: timeEnd },
        timeUnit: "s",
      },
      activeTab: "waveform",
    });
  },
}));

// ── Helpers ───────────────────────────────────────────────────────

function cartesianProduct(arrays: number[][]): number[][] {
  if (arrays.length === 0) return [[]];
  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);
  return first.flatMap((v) => restProduct.map((r) => [v, ...r]));
}

function interpolateValue(data: { time: number; value: number }[], t: number): number {
  if (data.length === 0) return 0;
  if (t <= data[0].time) return data[0].value;
  if (t >= data[data.length - 1].time) return data[data.length - 1].value;
  for (let i = 1; i < data.length; i++) {
    if (data[i].time >= t) {
      const frac = (t - data[i - 1].time) / (data[i].time - data[i - 1].time);
      return data[i - 1].value + frac * (data[i].value - data[i - 1].value);
    }
  }
  return data[data.length - 1].value;
}

function generateSweptSignal(
  name: string, unit: string, dt: number, points: number,
  amplitude: number, variation: number, color: string,
): WaveformSignal {
  const data: { time: number; value: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const t = i * dt;
    const delay = 0.15e-9 * variation;
    const tDelayed = Math.max(0, t - 3e-9 - delay);
    const val = t > 3e-9 + delay
      ? amplitude * Math.exp(-tDelayed / (0.25e-9 * variation))
      : amplitude;
    data.push({ time: t, value: unit === "mA" ? val * 0.5 : val });
  }
  return { name, unit, data, color, visible: true };
}

function generateCornerSignal(
  name: string, unit: string, dt: number, points: number,
  vdd: number, variation: number, color: string,
): WaveformSignal {
  const data: { time: number; value: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const t = i * dt;
    const delay = 0.15e-9 * variation;
    const tDelayed = Math.max(0, t - 3e-9 - delay);
    const val = t > 3e-9 + delay
      ? vdd * Math.exp(-tDelayed / (0.25e-9 * variation))
      : vdd;
    data.push({ time: t, value: val });
  }
  return { name, unit, data, color, visible: true };
}
