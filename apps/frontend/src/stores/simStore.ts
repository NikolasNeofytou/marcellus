/**
 * Simulation Store — manages simulation state, netlist, and waveform data.
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
  activeTab: "terminal" | "netlist" | "simulation" | "waveform";

  /** Terminal output lines */
  terminalLines: string[];

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

  /** Generate demo waveform data for testing */
  generateDemoWaveform: () => void;
}

// Default signal colors
const signalColors = [
  "#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#ec4899",
  "#14b8a6", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16",
];

export const useSimStore = create<SimStoreState>((set, _get) => ({
  state: "idle",
  netlist: null,
  spiceOutput: "",
  waveform: null,
  error: null,
  activeTab: "terminal",
  terminalLines: ["OpenSilicon v0.1.0 — Ready", ""],

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
