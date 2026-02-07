/**
 * Advanced Analysis Store — Sprint 35-36
 *
 * IR drop overlay, antenna checker, noise contribution analysis,
 * and stability analyzer.
 */

import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────

export interface IRDropNode {
  x: number;
  y: number;
  layerId: number;
  voltage: number;
  /** Drop relative to supply */
  drop: number;
  /** Current density in A/µm */
  currentDensity: number;
}

export interface IRDropResult {
  id: string;
  timestamp: number;
  supply: string;
  nominalVoltage: number;
  nodes: IRDropNode[];
  maxDrop: number;
  avgDrop: number;
  worstNodeIdx: number;
  /** Grid resolution for the mesh */
  gridResolution: number;
  /** Colour map bounds */
  minV: number;
  maxV: number;
}

export interface IRDropConfig {
  supplyNet: string;
  nominalVoltage: number;
  gridResolution: number;
  maxCurrent: number;
  /** Sheet resistance per layer in Ω/sq */
  sheetRes: Map<number, number>;
}

export interface AntennaViolation {
  id: string;
  gateLayerId: number;
  metalLayerId: number;
  gateArea: number;
  metalArea: number;
  ratio: number;
  maxAllowedRatio: number;
  severity: "error" | "warning";
  location: { x: number; y: number };
  suggestion: string;
}

export interface AntennaConfig {
  maxRatio: number;
  /** Per-layer overrides */
  layerOverrides: Map<number, number>;
  checkDiodes: boolean;
}

export interface NoiseSource {
  id: string;
  name: string;
  type: "thermal" | "flicker" | "shot" | "supply" | "substrate";
  frequency: number;
  magnitude: number; // V²/Hz or A²/Hz
  unit: string;
  deviceId?: string;
  contribution: number; // percentage of total
}

export interface NoiseAnalysisResult {
  id: string;
  timestamp: number;
  totalNoise: number;
  unit: string;
  sources: NoiseSource[];
  frequencyRange: { start: number; end: number };
  /** Noise spectral density curve */
  spectrum: { freq: number; density: number }[];
}

export interface StabilityResult {
  id: string;
  timestamp: number;
  gainMargin: number; // dB
  phaseMargin: number; // degrees
  unityGainFreq: number; // Hz
  dcGain: number; // dB
  dominantPole: number; // Hz
  isStable: boolean;
  /** Bode plot data */
  bode: { freq: number; gain: number; phase: number }[];
}

// ── Demo data generators ──────────────────────────────────────────

function generateDemoIRDrop(config: IRDropConfig): IRDropResult {
  const nodes: IRDropNode[] = [];
  const gridSize = config.gridResolution;
  const totalNodes = gridSize * gridSize;

  for (let iy = 0; iy < gridSize; iy++) {
    for (let ix = 0; ix < gridSize; ix++) {
      const cx = ix / (gridSize - 1);
      const cy = iy / (gridSize - 1);
      // Higher drop near center (load), lower near rails (supply pads at edges)
      const distFromEdge = Math.min(cx, 1 - cx, cy, 1 - cy);
      const dropFactor = (1 - distFromEdge * 2) * 0.08;
      const drop = Math.max(0, dropFactor + (Math.random() - 0.5) * 0.005);
      const voltage = config.nominalVoltage - drop;
      const currentDensity = config.maxCurrent * (0.3 + 0.7 * (1 - distFromEdge));

      nodes.push({
        x: ix * 10,
        y: iy * 10,
        layerId: 10, // met1 heuristic
        voltage,
        drop,
        currentDensity,
      });
    }
  }

  const maxDrop = Math.max(...nodes.map((n) => n.drop));
  const avgDrop = nodes.reduce((s, n) => s + n.drop, 0) / totalNodes;
  const worstIdx = nodes.findIndex((n) => n.drop === maxDrop);

  return {
    id: `irdrop-${Date.now()}`,
    timestamp: Date.now(),
    supply: config.supplyNet,
    nominalVoltage: config.nominalVoltage,
    nodes,
    maxDrop,
    avgDrop,
    worstNodeIdx: worstIdx,
    gridResolution: gridSize,
    minV: config.nominalVoltage - maxDrop,
    maxV: config.nominalVoltage,
  };
}

function generateDemoAntennaViolations(): AntennaViolation[] {
  return [
    {
      id: "ant-1",
      gateLayerId: 2,
      metalLayerId: 10,
      gateArea: 0.04,
      metalArea: 12.5,
      ratio: 312.5,
      maxAllowedRatio: 200,
      severity: "error",
      location: { x: 45, y: 120 },
      suggestion: "Add reverse-biased diode connection or split metal routing",
    },
    {
      id: "ant-2",
      gateLayerId: 2,
      metalLayerId: 11,
      gateArea: 0.06,
      metalArea: 10.8,
      ratio: 180.0,
      maxAllowedRatio: 200,
      severity: "warning",
      location: { x: 90, y: 55 },
      suggestion: "Close to limit — consider adding protection diode",
    },
    {
      id: "ant-3",
      gateLayerId: 2,
      metalLayerId: 12,
      gateArea: 0.035,
      metalArea: 15.2,
      ratio: 434.3,
      maxAllowedRatio: 400,
      severity: "error",
      location: { x: 210, y: 180 },
      suggestion: "Route through lower metal layers or add jumper via",
    },
  ];
}

function generateDemoNoiseAnalysis(): NoiseAnalysisResult {
  const sources: NoiseSource[] = [
    { id: "n1", name: "M1 (NMOS input)", type: "flicker", frequency: 1e3, magnitude: 1.2e-15, unit: "V²/Hz", contribution: 42 },
    { id: "n2", name: "M2 (PMOS load)", type: "thermal", frequency: 1e6, magnitude: 3.5e-17, unit: "V²/Hz", contribution: 25 },
    { id: "n3", name: "M3 (tail current)", type: "thermal", frequency: 1e6, magnitude: 2.1e-17, unit: "V²/Hz", contribution: 15 },
    { id: "n4", name: "R_bias", type: "thermal", frequency: 1e6, magnitude: 1.6e-17, unit: "V²/Hz", contribution: 10 },
    { id: "n5", name: "VDD supply", type: "supply", frequency: 1e5, magnitude: 5e-18, unit: "V²/Hz", contribution: 5 },
    { id: "n6", name: "Substrate coupling", type: "substrate", frequency: 1e4, magnitude: 3e-18, unit: "V²/Hz", contribution: 3 },
  ];

  const spectrum: { freq: number; density: number }[] = [];
  for (let f = 1; f <= 1e9; f *= 1.2) {
    // 1/f + thermal floor
    const flickerPart = 1.2e-15 / f;
    const thermalPart = 4e-17;
    spectrum.push({ freq: f, density: flickerPart + thermalPart + Math.random() * 1e-18 });
  }

  return {
    id: `noise-${Date.now()}`,
    timestamp: Date.now(),
    totalNoise: 85.4e-6,
    unit: "Vrms",
    sources,
    frequencyRange: { start: 1, end: 1e9 },
    spectrum,
  };
}

function generateDemoStability(): StabilityResult {
  const bode: { freq: number; gain: number; phase: number }[] = [];
  const dcGain = 72; // dB
  const pole1 = 1e3;
  const pole2 = 1e7;
  const zero1 = 5e6;

  for (let f = 1; f <= 1e10; f *= 1.15) {
    const s = f;
    const gainNum = dcGain - 20 * Math.log10(Math.sqrt(1 + (s / pole1) ** 2)) - 20 * Math.log10(Math.sqrt(1 + (s / pole2) ** 2)) + 20 * Math.log10(Math.sqrt(1 + (s / zero1) ** 2));
    const ph = -Math.atan(s / pole1) * (180 / Math.PI) - Math.atan(s / pole2) * (180 / Math.PI) + Math.atan(s / zero1) * (180 / Math.PI);
    bode.push({ freq: f, gain: gainNum, phase: ph });
  }

  const ugfEntry = bode.find((b) => b.gain <= 0);
  const ugf = ugfEntry?.freq ?? 1e8;
  const phaseAtUgf = ugfEntry?.phase ?? -120;
  const phaseMargin = 180 + phaseAtUgf;

  // Gain margin: gain at phase = -180
  const pm180 = bode.find((b) => b.phase <= -180);
  const gainMargin = pm180 ? -pm180.gain : 40;

  return {
    id: `stability-${Date.now()}`,
    timestamp: Date.now(),
    gainMargin,
    phaseMargin,
    unityGainFreq: ugf,
    dcGain,
    dominantPole: pole1,
    isStable: phaseMargin > 0 && gainMargin > 0,
    bode,
  };
}

// ── Store ─────────────────────────────────────────────────────────

interface AdvancedAnalysisState {
  // ── IR Drop ──
  irDropConfig: IRDropConfig;
  irDropResult: IRDropResult | null;
  irOverlayVisible: boolean;
  runIRDrop: () => void;
  setIRDropConfig: (patch: Partial<Omit<IRDropConfig, "sheetRes">>) => void;
  toggleIROverlay: () => void;

  // ── Antenna ──
  antennaConfig: AntennaConfig;
  antennaViolations: AntennaViolation[];
  selectedAntennaId: string | null;
  runAntennaCheck: () => void;
  setAntennaConfig: (patch: Partial<Omit<AntennaConfig, "layerOverrides">>) => void;
  setSelectedAntenna: (id: string | null) => void;

  // ── Noise ──
  noiseResult: NoiseAnalysisResult | null;
  runNoiseAnalysis: () => void;
  clearNoise: () => void;

  // ── Stability ──
  stabilityResult: StabilityResult | null;
  runStabilityAnalysis: () => void;
  clearStability: () => void;

  // ── Active tab ──
  activeTab: "irdrop" | "antenna" | "noise" | "stability";
  setActiveTab: (tab: "irdrop" | "antenna" | "noise" | "stability") => void;
}

export const useAdvancedAnalysisStore = create<AdvancedAnalysisState>((set, get) => ({
  // ── IR Drop ──
  irDropConfig: {
    supplyNet: "VDD",
    nominalVoltage: 1.8,
    gridResolution: 16,
    maxCurrent: 0.01,
    sheetRes: new Map([[10, 0.07], [11, 0.07], [12, 0.03]]),
  },
  irDropResult: null,
  irOverlayVisible: false,

  runIRDrop() {
    const result = generateDemoIRDrop(get().irDropConfig);
    set({ irDropResult: result, irOverlayVisible: true });
  },

  setIRDropConfig(patch) {
    set({ irDropConfig: { ...get().irDropConfig, ...patch } });
  },

  toggleIROverlay() {
    set({ irOverlayVisible: !get().irOverlayVisible });
  },

  // ── Antenna ──
  antennaConfig: {
    maxRatio: 200,
    layerOverrides: new Map(),
    checkDiodes: true,
  },
  antennaViolations: [],
  selectedAntennaId: null,

  runAntennaCheck() {
    const violations = generateDemoAntennaViolations();
    set({ antennaViolations: violations, selectedAntennaId: violations[0]?.id ?? null });
  },

  setAntennaConfig(patch) {
    set({ antennaConfig: { ...get().antennaConfig, ...patch } });
  },

  setSelectedAntenna(id) {
    set({ selectedAntennaId: id });
  },

  // ── Noise ──
  noiseResult: null,

  runNoiseAnalysis() {
    const result = generateDemoNoiseAnalysis();
    set({ noiseResult: result });
  },

  clearNoise() {
    set({ noiseResult: null });
  },

  // ── Stability ──
  stabilityResult: null,

  runStabilityAnalysis() {
    const result = generateDemoStability();
    set({ stabilityResult: result });
  },

  clearStability() {
    set({ stabilityResult: null });
  },

  // ── Active tab ──
  activeTab: "irdrop",
  setActiveTab(tab) {
    set({ activeTab: tab });
  },
}));
