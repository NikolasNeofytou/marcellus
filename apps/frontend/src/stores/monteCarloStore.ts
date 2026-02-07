/**
 * Monte Carlo / Statistical Simulation Engine — Sprint 29-30
 *
 * GUI-driven Monte Carlo setup, yield histograms, statistical analysis,
 * and corner matrix manager.
 */

import { create } from "zustand";
import type { WaveformData, CornerType } from "./simStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface MCParameter {
  /** Parameter name (e.g. "VTH0_NMOS") */
  name: string;
  /** Nominal value */
  nominal: number;
  /** Sigma (1σ standard deviation) */
  sigma: number;
  /** Distribution type */
  distribution: "gaussian" | "uniform" | "lognormal";
  /** Unit */
  unit: string;
  /** Category for grouping in UI */
  category: "process" | "voltage" | "temperature" | "mismatch";
}

export interface MCMeasurement {
  /** Measurement name (e.g. "Offset voltage") */
  name: string;
  /** Unit (e.g. "mV") */
  unit: string;
  /** Expression or signal name to measure */
  expression: string;
  /** Type of measurement */
  type: "max" | "min" | "mean" | "final" | "rise_time" | "fall_time" | "delay" | "custom";
}

export interface MCRunResult {
  /** Run index */
  index: number;
  /** Random parameter values for this run */
  paramValues: Record<string, number>;
  /** Measured values */
  measurements: Record<string, number>;
  /** Full waveform (optional—can be null if only measurements stored) */
  waveform: WaveformData | null;
}

export interface MCStatistics {
  /** Measurement name */
  name: string;
  unit: string;
  mean: number;
  stddev: number;
  min: number;
  max: number;
  median: number;
  /** Yield = % of runs within spec */
  yield: number;
  /** Spec limits (optional) */
  specMin?: number;
  specMax?: number;
  /** Histogram bins */
  histogram: { binStart: number; binEnd: number; count: number }[];
}

export interface MCConfig {
  /** Number of Monte Carlo runs */
  numRuns: number;
  /** Seed for reproducibility (0 = random) */
  seed: number;
  /** Parameters to vary */
  parameters: MCParameter[];
  /** Measurements to extract */
  measurements: MCMeasurement[];
  /** Include mismatch variation */
  includeMismatch: boolean;
  /** Include process variation */
  includeProcess: boolean;
}

// ── Corner Matrix ─────────────────────────────────────────────────

export interface CornerMatrixCell {
  corner: CornerType;
  voltage: number;
  temperature: number;
  enabled: boolean;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  measurements?: Record<string, number>;
}

export interface CornerMatrix {
  voltages: number[];
  temperatures: number[];
  corners: CornerType[];
  cells: CornerMatrixCell[];
}

// ══════════════════════════════════════════════════════════════════════
// Computation helpers
// ══════════════════════════════════════════════════════════════════════

/** Box-Muller transform for Gaussian random numbers */
function gaussianRandom(mean: number, sigma: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sigma;
}

function uniformRandom(mean: number, sigma: number): number {
  const half = sigma * Math.sqrt(3); // match σ for uniform
  return mean - half + Math.random() * 2 * half;
}

function lognormalRandom(mean: number, sigma: number): number {
  const variance = sigma * sigma;
  const mu = Math.log(mean * mean / Math.sqrt(variance + mean * mean));
  const s = Math.sqrt(Math.log(1 + variance / (mean * mean)));
  return Math.exp(gaussianRandom(mu, s));
}

function sampleParameter(p: MCParameter): number {
  switch (p.distribution) {
    case "gaussian":  return gaussianRandom(p.nominal, p.sigma);
    case "uniform":   return uniformRandom(p.nominal, p.sigma);
    case "lognormal": return lognormalRandom(p.nominal, p.sigma);
  }
}

/** Compute histogram bins from an array of values */
function computeHistogram(values: number[], numBins = 20): { binStart: number; binEnd: number; count: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / numBins || 1;
  const bins = Array.from({ length: numBins }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[idx].count++;
  }
  return bins;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stddev(arr: number[], mean: number): number {
  const sqDiffs = arr.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

/** Synthesise demo waveform data with parameter perturbation */
function generatePerturbedWaveform(paramValues: Record<string, number>, runIndex: number): WaveformData {
  const vthShift = (paramValues["VTH0_NMOS"] ?? 0.45) - 0.45;
  const tempShift = ((paramValues["TEMPERATURE"] ?? 27) - 27) / 100;
  const perturbation = vthShift * 0.3 + tempShift * 0.15;

  const points = 200;
  const tMax = 20e-9;
  const dt = tMax / points;

  const vout: { time: number; value: number }[] = [];
  for (let i = 0; i <= points; i++) {
    const t = i * dt;
    const base = 0.9 * (1 - Math.exp(-t / (2e-9 + perturbation * 1e-9)));
    const noise = (Math.random() - 0.5) * 0.005;
    vout.push({ time: t, value: base + perturbation * 0.1 + noise });
  }

  return {
    signals: [
      {
        name: `Vout_mc${runIndex}`,
        unit: "V",
        data: vout,
        color: `hsl(${(runIndex * 37) % 360}, 70%, 55%)`,
        visible: true,
      },
    ],
    timeRange: { start: 0, end: tMax },
    timeUnit: "ns",
  };
}

// ══════════════════════════════════════════════════════════════════════
// Zustand Store
// ══════════════════════════════════════════════════════════════════════

interface MonteCarloStoreState {
  /** Configuration */
  config: MCConfig;

  /** Run results */
  results: MCRunResult[];

  /** Computed statistics per measurement */
  statistics: MCStatistics[];

  /** Running state */
  status: "idle" | "running" | "completed" | "error";
  progress: number; // 0-100
  error: string | null;

  /** Corner matrix */
  cornerMatrix: CornerMatrix | null;

  /** Active histogram measurement */
  activeHistogramMeasurement: string | null;

  /** Overlay all MC waveforms on a single plot? */
  overlayWaveforms: boolean;

  // ── Actions ──

  setConfig: (config: Partial<MCConfig>) => void;
  addParameter: (p: MCParameter) => void;
  removeParameter: (name: string) => void;
  addMeasurement: (m: MCMeasurement) => void;
  removeMeasurement: (name: string) => void;

  runMonteCarloDemo: () => void;
  clearResults: () => void;

  setActiveHistogramMeasurement: (name: string | null) => void;
  setOverlayWaveforms: (on: boolean) => void;

  // Corner matrix
  initCornerMatrix: () => void;
  toggleCornerMatrixCell: (corner: CornerType, voltage: number, temperature: number) => void;
  runCornerMatrixDemo: () => void;
  clearCornerMatrix: () => void;
}

const defaultParameters: MCParameter[] = [
  { name: "VTH0_NMOS", nominal: 0.45, sigma: 0.025, distribution: "gaussian", unit: "V", category: "process" },
  { name: "VTH0_PMOS", nominal: -0.42, sigma: 0.022, distribution: "gaussian", unit: "V", category: "process" },
  { name: "TOX", nominal: 4.1e-9, sigma: 0.15e-9, distribution: "gaussian", unit: "m", category: "process" },
  { name: "TEMPERATURE", nominal: 27, sigma: 15, distribution: "uniform", unit: "°C", category: "temperature" },
  { name: "VDD", nominal: 1.8, sigma: 0.05, distribution: "gaussian", unit: "V", category: "voltage" },
];

const defaultMeasurements: MCMeasurement[] = [
  { name: "Rise Time", unit: "ps", expression: "rise_time(Vout)", type: "rise_time" },
  { name: "Delay", unit: "ps", expression: "delay(Vin, Vout, 0.5)", type: "delay" },
  { name: "Offset Voltage", unit: "mV", expression: "Vout(final) - 0.9", type: "custom" },
];

export const useMonteCarloStore = create<MonteCarloStoreState>((set, get) => ({
  config: {
    numRuns: 100,
    seed: 0,
    parameters: defaultParameters,
    measurements: defaultMeasurements,
    includeMismatch: true,
    includeProcess: true,
  },
  results: [],
  statistics: [],
  status: "idle",
  progress: 0,
  error: null,
  cornerMatrix: null,
  activeHistogramMeasurement: null,
  overlayWaveforms: false,

  setConfig: (partial) =>
    set((s) => ({ config: { ...s.config, ...partial } })),

  addParameter: (p) =>
    set((s) => ({
      config: { ...s.config, parameters: [...s.config.parameters, p] },
    })),

  removeParameter: (name) =>
    set((s) => ({
      config: {
        ...s.config,
        parameters: s.config.parameters.filter((p) => p.name !== name),
      },
    })),

  addMeasurement: (m) =>
    set((s) => ({
      config: { ...s.config, measurements: [...s.config.measurements, m] },
    })),

  removeMeasurement: (name) =>
    set((s) => ({
      config: {
        ...s.config,
        measurements: s.config.measurements.filter((m) => m.name !== name),
      },
    })),

  runMonteCarloDemo: () => {
    const { config } = get();
    set({ status: "running", progress: 0, results: [], statistics: [], error: null });

    const results: MCRunResult[] = [];

    for (let i = 0; i < config.numRuns; i++) {
      // Sample parameters
      const paramValues: Record<string, number> = {};
      for (const p of config.parameters) {
        paramValues[p.name] = sampleParameter(p);
      }

      // Generate perturbed waveform
      const waveform = generatePerturbedWaveform(paramValues, i);

      // Extract measurements (demo)
      const vthShift = (paramValues["VTH0_NMOS"] ?? 0.45) - 0.45;
      const measurements: Record<string, number> = {
        "Rise Time": (150 + vthShift * 200 + (Math.random() - 0.5) * 30),
        "Delay": (220 + vthShift * 300 + (Math.random() - 0.5) * 40),
        "Offset Voltage": ((paramValues["VDD"] ?? 1.8) * 500 - 900 + (Math.random() - 0.5) * 20),
      };

      results.push({ index: i, paramValues, measurements, waveform });
    }

    // Compute statistics
    const statistics: MCStatistics[] = config.measurements.map((m) => {
      const values = results.map((r) => r.measurements[m.name] ?? 0);
      const meanVal = values.reduce((a, b) => a + b, 0) / values.length;
      const stdVal = stddev(values, meanVal);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const medianVal = median(values);

      // Default spec: mean ± 3σ
      const specMin = meanVal - 3 * stdVal;
      const specMax = meanVal + 3 * stdVal;
      const inSpec = values.filter((v) => v >= specMin && v <= specMax).length;

      return {
        name: m.name,
        unit: m.unit,
        mean: meanVal,
        stddev: stdVal,
        min: minVal,
        max: maxVal,
        median: medianVal,
        yield: (inSpec / values.length) * 100,
        specMin,
        specMax,
        histogram: computeHistogram(values),
      };
    });

    set({
      results,
      statistics,
      status: "completed",
      progress: 100,
      activeHistogramMeasurement: statistics[0]?.name ?? null,
    });
  },

  clearResults: () =>
    set({ results: [], statistics: [], status: "idle", progress: 0, error: null }),

  setActiveHistogramMeasurement: (name) =>
    set({ activeHistogramMeasurement: name }),

  setOverlayWaveforms: (on) =>
    set({ overlayWaveforms: on }),

  // ── Corner Matrix ──

  initCornerMatrix: () => {
    const voltages = [1.62, 1.80, 1.98];
    const temperatures = [-40, 27, 125];
    const corners: CornerType[] = ["TT", "FF", "SS", "FS", "SF"];

    const cells: CornerMatrixCell[] = [];
    for (const corner of corners) {
      for (const voltage of voltages) {
        for (const temperature of temperatures) {
          cells.push({
            corner,
            voltage,
            temperature,
            enabled: true,
            status: "pending",
          });
        }
      }
    }

    set({
      cornerMatrix: { voltages, temperatures, corners, cells },
    });
  },

  toggleCornerMatrixCell: (corner, voltage, temperature) =>
    set((s) => {
      if (!s.cornerMatrix) return {};
      const cells = s.cornerMatrix.cells.map((c) =>
        c.corner === corner && c.voltage === voltage && c.temperature === temperature
          ? { ...c, enabled: !c.enabled }
          : c,
      );
      return { cornerMatrix: { ...s.cornerMatrix, cells } };
    }),

  runCornerMatrixDemo: () =>
    set((s) => {
      if (!s.cornerMatrix) return {};
      const cells = s.cornerMatrix.cells.map((c) => {
        if (!c.enabled) return { ...c, status: "skipped" as const };
        const passed = Math.random() > 0.12;
        return {
          ...c,
          status: (passed ? "passed" : "failed") as "passed" | "failed",
          measurements: {
            "Delay (ps)": 180 + Math.random() * 60,
            "Power (µW)": 1.5 + Math.random() * 1.5,
            "Frequency (GHz)": 1.2 + Math.random() * 0.5,
          },
        };
      });
      return { cornerMatrix: { ...s.cornerMatrix, cells } };
    }),

  clearCornerMatrix: () => set({ cornerMatrix: null }),
}));
