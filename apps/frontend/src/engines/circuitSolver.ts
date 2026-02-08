/**
 * Circuit Solver — built-in SPICE-like numerical simulation engine.
 *
 * Implements:
 *  - Modified Nodal Analysis (MNA) matrix formulation
 *  - DC Operating Point analysis
 *  - Transient analysis (Backward Euler integration)
 *  - DC Sweep analysis
 *  - AC Small-Signal analysis (linearized around OP)
 *  - MOSFET Level-1 Shichman-Hodge model
 *  - Newton-Raphson nonlinear iteration
 *
 * This provides simulation capability without requiring ngspice WASM,
 * and serves as the fallback/built-in engine.
 */

import {
  type ParsedNetlist,
  type AnalysisDirective,
  type TranAnalysis,
  type DcAnalysis,
  type AcAnalysis,
  evalTransientSource,
} from "./spiceParser";

import type { WaveformSignal, WaveformData } from "../stores/simStore";

// ══════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════

export interface SimulationResult {
  analysis: AnalysisDirective;
  waveform: WaveformData;
  opPoint?: Record<string, number>;
  converged: boolean;
  iterations: number;
  timeMs: number;
  log: string[];
}

interface MNASystem {
  size: number;
  G: Float64Array; // Conductance matrix (flattened size x size)
  rhs: Float64Array; // Right-hand side vector
  solution: Float64Array; // Solution vector
  nodeMap: Map<string, number>; // node name -> matrix index
  vsourceMap: Map<string, number>; // vsource name -> extra row index
}

// ── MOSFET Level-1 Parameters ────────────────────────────────────

interface MOSParams {
  vth0: number; // Threshold voltage
  kp: number; // Transconductance parameter
  lambda: number; // Channel-length modulation
  tox: number; // Oxide thickness
  cox: number; // Gate oxide capacitance
  cgso: number; // Gate-source overlap cap
  cgdo: number; // Gate-drain overlap cap
  cbd: number; // Bulk-drain junction cap
  cbs: number; // Bulk-source junction cap
  w: number; // Width
  l: number; // Length
  isPmos: boolean;
}

function getDefaultMOSParams(isPmos: boolean): MOSParams {
  return {
    vth0: isPmos ? -0.4 : 0.4,
    kp: isPmos ? 60e-6 : 120e-6,
    lambda: 0.04,
    tox: 9e-9,
    cox: 3.9 * 8.854e-12 / 9e-9,
    cgso: 0.3e-12,
    cgdo: 0.3e-12,
    cbd: 0.1e-12,
    cbs: 0.1e-12,
    w: 1e-6,
    l: 0.13e-6,
    isPmos,
  };
}

// ══════════════════════════════════════════════════════════════════
// MOSFET Level-1 Model (Shichman-Hodge)
// ══════════════════════════════════════════════════════════════════

interface MOSCurrent {
  ids: number; // Drain-source current
  gm: number; // Transconductance dIds/dVgs
  gds: number; // Output conductance dIds/dVds
  gmb: number; // Body transconductance
  region: "cutoff" | "linear" | "saturation";
}

function mosfetLevel1(vgs: number, vds: number, _vbs: number, p: MOSParams): MOSCurrent {
  const sign = p.isPmos ? -1 : 1;
  const Vgs = sign * vgs;
  const Vds = sign * vds;
  // vbs reserved for body-effect (gamma correction)

  const beta = p.kp * (p.w / p.l);
  const Vth = Math.abs(p.vth0); // simplified, ignoring body effect for now

  if (Vgs <= Vth) {
    // Cutoff
    return { ids: 0, gm: 0, gds: 1e-12, gmb: 0, region: "cutoff" };
  }

  const Vov = Vgs - Vth;

  if (Vds < Vov) {
    // Linear / Triode
    const ids = beta * (Vov * Vds - 0.5 * Vds * Vds) * (1 + p.lambda * Vds);
    const gm = beta * Vds * (1 + p.lambda * Vds);
    const gds = beta * (Vov - Vds) * (1 + p.lambda * Vds) + beta * (Vov * Vds - 0.5 * Vds * Vds) * p.lambda;
    return { ids: sign * ids, gm: sign * gm, gds: Math.abs(gds) + 1e-12, gmb: 0, region: "linear" };
  }

  // Saturation
  const ids = 0.5 * beta * Vov * Vov * (1 + p.lambda * Vds);
  const gm = beta * Vov * (1 + p.lambda * Vds);
  const gds = 0.5 * beta * Vov * Vov * p.lambda;
  return { ids: sign * ids, gm: sign * gm, gds: Math.abs(gds) + 1e-12, gmb: 0, region: "saturation" };
}

// ══════════════════════════════════════════════════════════════════
// MNA System Construction
// ══════════════════════════════════════════════════════════════════

function createMNA(netlist: ParsedNetlist): MNASystem {
  // Build node map (excluding ground = "0")
  const nodeMap = new Map<string, number>();
  let idx = 0;
  for (const name of netlist.nodeNames) {
    if (name === "0" || name.toLowerCase() === "gnd") continue;
    nodeMap.set(name, idx++);
  }

  // Count voltage sources (they add extra MNA rows)
  const vsourceMap = new Map<string, number>();
  for (const dev of netlist.devices) {
    if (dev.type === "vsource") {
      vsourceMap.set(dev.name, idx++);
    }
    // Inductors are also like voltage sources in MNA
    if (dev.type === "inductor") {
      vsourceMap.set(dev.name, idx++);
    }
  }

  const size = idx;
  return {
    size,
    G: new Float64Array(size * size),
    rhs: new Float64Array(size),
    solution: new Float64Array(size),
    nodeMap,
    vsourceMap,
  };
}

function clearMNA(mna: MNASystem) {
  mna.G.fill(0);
  mna.rhs.fill(0);
}

function stamp(mna: MNASystem, i: number, j: number, value: number) {
  if (i >= 0 && j >= 0) {
    mna.G[i * mna.size + j] += value;
  }
}

function stampRhs(mna: MNASystem, i: number, value: number) {
  if (i >= 0) {
    mna.rhs[i] += value;
  }
}

function nodeIdx(mna: MNASystem, name: string): number {
  if (name === "0" || name.toLowerCase() === "gnd") return -1;
  return mna.nodeMap.get(name) ?? -1;
}

// ══════════════════════════════════════════════════════════════════
// Stamp Devices into MNA
// ══════════════════════════════════════════════════════════════════

function stampLinearDevices(
  mna: MNASystem,
  netlist: ParsedNetlist,
  time: number | null, // null for DC
) {
  for (const dev of netlist.devices) {
    switch (dev.type) {
      case "resistor": {
        const g = 1 / dev.value;
        const a = nodeIdx(mna, dev.nodeA);
        const b = nodeIdx(mna, dev.nodeB);
        stamp(mna, a, a, g);
        stamp(mna, b, b, g);
        stamp(mna, a, b, -g);
        stamp(mna, b, a, -g);
        break;
      }
      case "vsource": {
        const p = nodeIdx(mna, dev.nodePos);
        const n = nodeIdx(mna, dev.nodeNeg);
        const vs = mna.vsourceMap.get(dev.name)!;

        // MNA voltage source stamps
        stamp(mna, vs, p, 1);
        stamp(mna, vs, n, -1);
        stamp(mna, p, vs, 1);
        stamp(mna, n, vs, -1);

        // RHS: voltage value
        let v = dev.dcValue;
        if (time != null && dev.transient) {
          v = evalTransientSource(dev.transient, time);
        }
        stampRhs(mna, vs, v);
        break;
      }
      case "isource": {
        const p = nodeIdx(mna, dev.nodePos);
        const n = nodeIdx(mna, dev.nodeNeg);
        let i = dev.dcValue;
        if (time != null && dev.transient) {
          i = evalTransientSource(dev.transient, time);
        }
        stampRhs(mna, p, -i);
        stampRhs(mna, n, i);
        break;
      }
      case "capacitor": {
        // For DC: open circuit (skip)
        // For transient: handled separately with companion model
        break;
      }
      case "inductor": {
        // For DC: short circuit (voltage source with V=0)
        const a = nodeIdx(mna, dev.nodeA);
        const b = nodeIdx(mna, dev.nodeB);
        const vs = mna.vsourceMap.get(dev.name)!;
        stamp(mna, vs, a, 1);
        stamp(mna, vs, b, -1);
        stamp(mna, a, vs, 1);
        stamp(mna, b, vs, -1);
        // For DC: V=0 (short)
        // For transient: companion model stamps handled separately
        break;
      }
      default:
        break;
    }
  }
}

function stampCapacitorCompanion(
  mna: MNASystem,
  netlist: ParsedNetlist,
  dt: number,
  prevSolution: Float64Array,
) {
  for (const dev of netlist.devices) {
    if (dev.type !== "capacitor") continue;
    const a = nodeIdx(mna, dev.nodeA);
    const b = nodeIdx(mna, dev.nodeB);
    const geq = dev.value / dt; // Backward Euler: G_eq = C/h
    const vPrev =
      (a >= 0 ? prevSolution[a] : 0) - (b >= 0 ? prevSolution[b] : 0);
    const ieq = geq * vPrev; // I_eq = (C/h) * v(n-1)

    stamp(mna, a, a, geq);
    stamp(mna, b, b, geq);
    stamp(mna, a, b, -geq);
    stamp(mna, b, a, -geq);
    stampRhs(mna, a, ieq);
    stampRhs(mna, b, -ieq);
  }
}

function stampInductorCompanion(
  mna: MNASystem,
  netlist: ParsedNetlist,
  dt: number,
  prevSolution: Float64Array,
) {
  for (const dev of netlist.devices) {
    if (dev.type !== "inductor") continue;
    const vs = mna.vsourceMap.get(dev.name)!;
    // Backward Euler: V_L = L/h * (i(n) - i(n-1))
    // replace voltage source row with: -L/h * i + V_a - V_b = L/h * i_prev
    const Leq = dev.value / dt;
    // Override the vs row to be: V_a - V_b - L/h * i = -L/h * i_prev
    // The stamps for Va - Vb are already there, add the -L/h term
    stamp(mna, vs, vs, -Leq);
    const iPrev = prevSolution[vs];
    stampRhs(mna, vs, -Leq * iPrev);
  }
}

function stampMosfets(
  mna: MNASystem,
  netlist: ParsedNetlist,
  solution: Float64Array,
) {
  for (const dev of netlist.devices) {
    if (dev.type !== "mosfet") continue;
    const d = nodeIdx(mna, dev.drain);
    const g = nodeIdx(mna, dev.gate);
    const s = nodeIdx(mna, dev.source);
    const b = nodeIdx(mna, dev.body);

    const isPmos = dev.model.toLowerCase().includes("pmos") || dev.model.toLowerCase().includes("pfet");
    const params = getDefaultMOSParams(isPmos);

    // Apply instance params
    if (dev.params.w) params.w = dev.params.w;
    if (dev.params.l) params.l = dev.params.l;

    // Look up model params from netlist
    const model = netlist.models.find(
      (m) => m.name.toLowerCase() === dev.model.toLowerCase(),
    );
    if (model) {
      if (model.params.vth0 != null) params.vth0 = model.params.vth0;
      if (model.params.kp != null) params.kp = model.params.kp;
      if (model.params.lambda != null) params.lambda = model.params.lambda;
      if (model.params.tox != null) params.tox = model.params.tox;
    }

    const vg = g >= 0 ? solution[g] : 0;
    const vd = d >= 0 ? solution[d] : 0;
    const vs_ = s >= 0 ? solution[s] : 0;
    const vb = b >= 0 ? solution[b] : 0;

    const vgs = vg - vs_;
    const vds = vd - vs_;
    const vbs = vb - vs_;

    const { ids, gm, gds } = mosfetLevel1(vgs, vds, vbs, params);

    // Linearized stamp: I_ds = gm*(Vgs - Vgs0) + gds*(Vds - Vds0) + Ids0
    // Current: I_eq = Ids0 - gm*Vgs0 - gds*Vds0
    const ieq = ids - gm * vgs - gds * vds;

    // Conductance stamps (d-s branch)
    stamp(mna, d, d, gds);
    stamp(mna, s, s, gds);
    stamp(mna, d, s, -gds);
    stamp(mna, s, d, -gds);

    // Transconductance stamps (g controls d-s)
    stamp(mna, d, g, gm);
    stamp(mna, s, g, -gm);
    stamp(mna, d, s, -gm);
    stamp(mna, s, s, gm);

    // Equivalent current source
    stampRhs(mna, d, -ieq);
    stampRhs(mna, s, ieq);
  }
}

// ══════════════════════════════════════════════════════════════════
// Gaussian Elimination (LU w/ partial pivoting)
// ══════════════════════════════════════════════════════════════════

function solveLinearSystem(mna: MNASystem): boolean {
  const n = mna.size;
  if (n === 0) return true;

  // Make a copy of G and rhs for solving
  const A = new Float64Array(mna.G);
  const b = new Float64Array(mna.rhs);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxVal = Math.abs(A[col * n + col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(A[row * n + col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    if (maxVal < 1e-18) {
      // Singular matrix — add small conductance to ground
      A[col * n + col] += 1e-12;
    }

    // Swap rows
    if (maxRow !== col) {
      for (let j = 0; j < n; j++) {
        const tmp = A[col * n + j];
        A[col * n + j] = A[maxRow * n + j];
        A[maxRow * n + j] = tmp;
      }
      const tmp = b[col];
      b[col] = b[maxRow];
      b[maxRow] = tmp;
    }

    // Eliminate
    const pivot = A[col * n + col];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row * n + col] / pivot;
      for (let j = col; j < n; j++) {
        A[row * n + j] -= factor * A[col * n + j];
      }
      b[row] -= factor * b[col];
    }
  }

  // Back substitution
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let j = row + 1; j < n; j++) {
      sum -= A[row * n + j] * mna.solution[j];
    }
    const diag = A[row * n + row];
    mna.solution[row] = diag !== 0 ? sum / diag : 0;
  }

  return true;
}

// ══════════════════════════════════════════════════════════════════
// Newton-Raphson Iteration
// ══════════════════════════════════════════════════════════════════

function dcOpPoint(
  mna: MNASystem,
  netlist: ParsedNetlist,
  maxIter = 100,
  tol = 1e-6,
): { converged: boolean; iterations: number } {
  let converged = false;
  let iter = 0;

  // Initial guess: 0V everywhere
  mna.solution.fill(0);

  // Set initial guesses for supply voltages
  for (const dev of netlist.devices) {
    if (dev.type === "vsource") {
      const vs = mna.vsourceMap.get(dev.name);
      if (vs != null) {
        const p = nodeIdx(mna, dev.nodePos);
        if (p >= 0) mna.solution[p] = dev.dcValue;
      }
    }
  }

  for (iter = 0; iter < maxIter; iter++) {
    const prevSol = new Float64Array(mna.solution);

    clearMNA(mna);
    stampLinearDevices(mna, netlist, null);
    stampMosfets(mna, netlist, mna.solution);

    solveLinearSystem(mna);

    // Check convergence
    let maxDelta = 0;
    for (let i = 0; i < mna.size; i++) {
      const delta = Math.abs(mna.solution[i] - prevSol[i]);
      if (delta > maxDelta) maxDelta = delta;
    }

    if (maxDelta < tol) {
      converged = true;
      break;
    }

    // Damping for first iterations
    if (iter < 10) {
      const damp = 0.5;
      for (let i = 0; i < mna.size; i++) {
        mna.solution[i] = prevSol[i] + damp * (mna.solution[i] - prevSol[i]);
      }
    }
  }

  return { converged, iterations: iter };
}

// ══════════════════════════════════════════════════════════════════
// Analysis Engines
// ══════════════════════════════════════════════════════════════════

const signalColors = [
  "#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#ec4899",
  "#14b8a6", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16",
];

export function runDCOp(netlist: ParsedNetlist): SimulationResult {
  const t0 = performance.now();
  const log: string[] = [];

  const mna = createMNA(netlist);
  log.push(`MNA matrix size: ${mna.size}x${mna.size}`);
  log.push(`Nodes: ${netlist.nodeNames.filter((n) => n !== "0").join(", ")}`);

  const { converged, iterations } = dcOpPoint(mna, netlist);

  const opPoint: Record<string, number> = {};
  for (const [name, idx] of mna.nodeMap) {
    opPoint[`V(${name})`] = mna.solution[idx];
  }
  for (const [name, idx] of mna.vsourceMap) {
    opPoint[`I(${name})`] = mna.solution[idx];
  }

  log.push(converged ? `Converged in ${iterations} iterations` : `Did not converge after ${iterations} iterations`);
  for (const [k, v] of Object.entries(opPoint)) {
    log.push(`  ${k} = ${v.toFixed(6)}`);
  }

  const timeMs = performance.now() - t0;
  log.push(`Simulation time: ${timeMs.toFixed(1)}ms`);

  // Create a minimal waveform showing OP values
  const signals: WaveformSignal[] = [];
  let colorIdx = 0;
  for (const [name, value] of Object.entries(opPoint)) {
    if (name.startsWith("V(")) {
      signals.push({
        name,
        unit: "V",
        data: [{ time: 0, value }, { time: 1, value }],
        color: signalColors[colorIdx++ % signalColors.length],
        visible: true,
      });
    }
  }

  return {
    analysis: { type: "op" },
    waveform: { signals, timeRange: { start: 0, end: 1 }, timeUnit: "s" },
    opPoint,
    converged,
    iterations,
    timeMs,
    log,
  };
}

export function runTransient(
  netlist: ParsedNetlist,
  config: TranAnalysis,
  progressCb?: (pct: number) => void,
): SimulationResult {
  const t0 = performance.now();
  const log: string[] = [];

  const mna = createMNA(netlist);
  log.push(`Transient analysis: ${config.step}s step, ${config.stop}s stop`);
  log.push(`MNA matrix size: ${mna.size}x${mna.size}`);

  // DC operating point first
  const op = dcOpPoint(mna, netlist);
  log.push(op.converged ? `DC OP converged in ${op.iterations} iter` : "DC OP did not converge");

  // Prepare output signals for all voltage nodes
  const signalMap = new Map<string, WaveformSignal>();
  let colorIdx = 0;

  for (const [name] of mna.nodeMap) {
    const sig: WaveformSignal = {
      name: `V(${name})`,
      unit: "V",
      data: [],
      color: signalColors[colorIdx++ % signalColors.length],
      visible: true,
    };
    signalMap.set(name, sig);
  }

  // Also track voltage source currents
  for (const [name] of mna.vsourceMap) {
    // Only track actual vsources, not inductors
    const dev = netlist.devices.find((d) => d.name === name && d.type === "vsource");
    if (dev) {
      const sig: WaveformSignal = {
        name: `I(${name})`,
        unit: "A",
        data: [],
        color: signalColors[colorIdx++ % signalColors.length],
        visible: true,
      };
      signalMap.set(`I_${name}`, sig);
    }
  }

  // Time stepping
  const dt = config.step;
  const tStart = config.start ?? 0;
  const tStop = config.stop;
  const totalSteps = Math.ceil((tStop - tStart) / dt);
  const maxTranIter = 50;
  const tol = 1e-6;
  let totalIterations = 0;
  let allConverged = true;

  // Record initial point
  for (const [name, idx] of mna.nodeMap) {
    signalMap.get(name)!.data.push({ time: tStart, value: mna.solution[idx] });
  }
  for (const [name, idx] of mna.vsourceMap) {
    const key = `I_${name}`;
    if (signalMap.has(key)) {
      signalMap.get(key)!.data.push({ time: tStart, value: mna.solution[idx] });
    }
  }

  for (let step = 1; step <= totalSteps; step++) {
    const t = tStart + step * dt;
    const prevSolution = new Float64Array(mna.solution);

    // Newton-Raphson at this time step
    let stepConverged = false;
    for (let iter = 0; iter < maxTranIter; iter++) {
      const prevIter = new Float64Array(mna.solution);

      clearMNA(mna);
      stampLinearDevices(mna, netlist, t);
      stampCapacitorCompanion(mna, netlist, dt, prevSolution);
      stampInductorCompanion(mna, netlist, dt, prevSolution);
      stampMosfets(mna, netlist, mna.solution);

      solveLinearSystem(mna);

      let maxDelta = 0;
      for (let i = 0; i < mna.size; i++) {
        maxDelta = Math.max(maxDelta, Math.abs(mna.solution[i] - prevIter[i]));
      }

      totalIterations++;

      if (maxDelta < tol) {
        stepConverged = true;
        break;
      }
    }

    if (!stepConverged) allConverged = false;

    // Record values (downsample if too many points)
    const recordEvery = Math.max(1, Math.floor(totalSteps / 2000));
    if (step % recordEvery === 0 || step === totalSteps) {
      for (const [name, idx] of mna.nodeMap) {
        signalMap.get(name)!.data.push({ time: t, value: mna.solution[idx] });
      }
      for (const [name, idx] of mna.vsourceMap) {
        const key = `I_${name}`;
        if (signalMap.has(key)) {
          signalMap.get(key)!.data.push({ time: t, value: mna.solution[idx] });
        }
      }
    }

    if (progressCb && step % 100 === 0) {
      progressCb(step / totalSteps);
    }
  }

  const signals = Array.from(signalMap.values());
  const timeMs = performance.now() - t0;

  log.push(`Completed ${totalSteps} time steps, ${totalIterations} NR iterations total`);
  log.push(allConverged ? "All steps converged" : "Warning: some steps did not converge");
  log.push(`Simulation time: ${timeMs.toFixed(1)}ms`);

  return {
    analysis: config,
    waveform: {
      signals,
      timeRange: { start: tStart, end: tStop },
      timeUnit: "s",
    },
    converged: allConverged,
    iterations: totalIterations,
    timeMs,
    log,
  };
}

export function runDCSweep(
  netlist: ParsedNetlist,
  config: DcAnalysis,
  progressCb?: (pct: number) => void,
): SimulationResult {
  const t0 = performance.now();
  const log: string[] = [];

  log.push(`DC Sweep: ${config.source} from ${config.start} to ${config.stop}, step ${config.step}`);

  // Find the source to sweep
  const sourceIdx = netlist.devices.findIndex(
    (d) => d.name.toLowerCase() === config.source.toLowerCase() && d.type === "vsource",
  );

  if (sourceIdx < 0) {
    return {
      analysis: config,
      waveform: { signals: [], timeRange: { start: 0, end: 0 }, timeUnit: "V" },
      converged: false,
      iterations: 0,
      timeMs: 0,
      log: [`Error: Source "${config.source}" not found`],
    };
  }

  const mna = createMNA(netlist);
  const sweepPoints = Math.ceil((config.stop - config.start) / config.step) + 1;

  // Create output signals
  const signalMap = new Map<string, WaveformSignal>();
  let colorIdx = 0;
  for (const [name] of mna.nodeMap) {
    signalMap.set(name, {
      name: `V(${name})`,
      unit: "V",
      data: [],
      color: signalColors[colorIdx++ % signalColors.length],
      visible: true,
    });
  }
  for (const [name] of mna.vsourceMap) {
    const dev = netlist.devices.find((d) => d.name === name && d.type === "vsource");
    if (dev) {
      signalMap.set(`I_${name}`, {
        name: `I(${name})`,
        unit: "A",
        data: [],
        color: signalColors[colorIdx++ % signalColors.length],
        visible: true,
      });
    }
  }

  let totalIterations = 0;
  let allConverged = true;

  // Create a modified netlist for each sweep point
  for (let i = 0; i < sweepPoints; i++) {
    const sweepVal = config.start + i * config.step;

    // Modify the source value
    const modifiedDevices = netlist.devices.map((d, idx) => {
      if (idx === sourceIdx && d.type === "vsource") {
        return { ...d, dcValue: sweepVal };
      }
      return d;
    });
    const modifiedNetlist = { ...netlist, devices: modifiedDevices };

    // Solve DC OP
    const mnaStep = createMNA(modifiedNetlist);
    // Use previous solution as initial guess
    if (i > 0) mnaStep.solution.set(mna.solution);
    const op = dcOpPoint(mnaStep, modifiedNetlist);
    mna.solution.set(mnaStep.solution);

    totalIterations += op.iterations;
    if (!op.converged) allConverged = false;

    // Record
    for (const [name, solIdx] of mnaStep.nodeMap) {
      signalMap.get(name)?.data.push({ time: sweepVal, value: mnaStep.solution[solIdx] });
    }
    for (const [name, solIdx] of mnaStep.vsourceMap) {
      const key = `I_${name}`;
      signalMap.get(key)?.data.push({ time: sweepVal, value: mnaStep.solution[solIdx] });
    }

    if (progressCb && i % 10 === 0) {
      progressCb(i / sweepPoints);
    }
  }

  const signals = Array.from(signalMap.values());
  const timeMs = performance.now() - t0;

  log.push(`Completed ${sweepPoints} sweep points`);
  log.push(`Simulation time: ${timeMs.toFixed(1)}ms`);

  return {
    analysis: config,
    waveform: {
      signals,
      timeRange: { start: config.start, end: config.stop },
      timeUnit: "V",
    },
    converged: allConverged,
    iterations: totalIterations,
    timeMs,
    log,
  };
}

export function runACAnalysis(
  netlist: ParsedNetlist,
  config: AcAnalysis,
  progressCb?: (pct: number) => void,
): SimulationResult {
  const t0 = performance.now();
  const log: string[] = [];

  log.push(`AC Analysis: ${config.variation} ${config.points}pts ${config.fstart}Hz-${config.fstop}Hz`);

  // First get DC operating point
  const mna = createMNA(netlist);
  const op = dcOpPoint(mna, netlist);
  log.push(op.converged ? `DC OP converged in ${op.iterations} iter` : "DC OP did not converge");

  // Generate frequency points
  const freqs: number[] = [];
  if (config.variation === "dec") {
    const decades = Math.log10(config.fstop / config.fstart);
    const totalPoints = Math.ceil(decades * config.points);
    for (let i = 0; i <= totalPoints; i++) {
      freqs.push(config.fstart * Math.pow(10, i / config.points));
    }
  } else if (config.variation === "oct") {
    const octaves = Math.log2(config.fstop / config.fstart);
    const totalPoints = Math.ceil(octaves * config.points);
    for (let i = 0; i <= totalPoints; i++) {
      freqs.push(config.fstart * Math.pow(2, i / config.points));
    }
  } else {
    // Linear
    const step = (config.fstop - config.fstart) / config.points;
    for (let i = 0; i <= config.points; i++) {
      freqs.push(config.fstart + i * step);
    }
  }

  // For each node, create magnitude and phase signals
  const magSignals = new Map<string, WaveformSignal>();
  const phaseSignals = new Map<string, WaveformSignal>();
  let colorIdx = 0;

  for (const [name] of mna.nodeMap) {
    magSignals.set(name, {
      name: `|V(${name})| dB`,
      unit: "dB",
      data: [],
      color: signalColors[colorIdx % signalColors.length],
      visible: true,
    });
    phaseSignals.set(name, {
      name: `∠V(${name})`,
      unit: "°",
      data: [],
      color: signalColors[colorIdx % signalColors.length],
      visible: false, // Phase hidden by default
    });
    colorIdx++;
  }

  // Simplified AC analysis: compute transfer function at each frequency
  // Using the linearized MOSFET model from the DC operating point
  for (let fi = 0; fi < freqs.length; fi++) {
    const freq = freqs[fi];
    const omega = 2 * Math.PI * freq;

    // Build complex MNA at this frequency
    const n = mna.size;
    const Gr = new Float64Array(n * n); // Real
    const Gi = new Float64Array(n * n); // Imaginary
    const rhsR = new Float64Array(n);
    const rhsI = new Float64Array(n);

    // Copy the linearized DC conductance matrix
    clearMNA(mna);
    stampLinearDevices(mna, netlist, null);
    stampMosfets(mna, netlist, mna.solution);
    Gr.set(mna.G);
    rhsR.set(mna.rhs);

    // Add jωC for capacitors
    for (const dev of netlist.devices) {
      if (dev.type !== "capacitor") continue;
      const a = nodeIdx(mna, dev.nodeA);
      const b = nodeIdx(mna, dev.nodeB);
      const bc = omega * dev.value;
      if (a >= 0) Gi[a * n + a] += bc;
      if (b >= 0) Gi[b * n + b] += bc;
      if (a >= 0 && b >= 0) {
        Gi[a * n + b] -= bc;
        Gi[b * n + a] -= bc;
      }
    }

    // Add 1/(jωL) for inductors
    for (const dev of netlist.devices) {
      if (dev.type !== "inductor") continue;
      const vs = mna.vsourceMap.get(dev.name)!;
      // Add -jωL to the inductor companion row
      Gi[vs * n + vs] -= omega * dev.value;
    }

    // Set AC source excitation
    for (const dev of netlist.devices) {
      if (dev.type !== "vsource") continue;
      if (dev.acMag != null && dev.acMag > 0) {
        const vs = mna.vsourceMap.get(dev.name)!;
        const phase = (dev.acPhase ?? 0) * Math.PI / 180;
        rhsR[vs] = dev.acMag * Math.cos(phase);
        rhsI[vs] = dev.acMag * Math.sin(phase);
      }
    }

    // Solve complex system: (Gr + jGi) * x = rhsR + j*rhsI
    // Convert to real system of double size
    const N2 = 2 * n;
    const bigA = new Float64Array(N2 * N2);
    const bigB = new Float64Array(N2);
    const bigX = new Float64Array(N2);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        // [Gr -Gi] [xr]   [br]
        // [Gi  Gr] [xi] = [bi]
        bigA[r * N2 + c] = Gr[r * n + c];
        bigA[r * N2 + (c + n)] = -Gi[r * n + c];
        bigA[(r + n) * N2 + c] = Gi[r * n + c];
        bigA[(r + n) * N2 + (c + n)] = Gr[r * n + c];
      }
      bigB[r] = rhsR[r];
      bigB[r + n] = rhsI[r];
    }

    // Solve using Gaussian elimination
    solveRealSystem(N2, bigA, bigB, bigX);

    // Extract magnitude and phase for each node
    for (const [name, nIdx] of mna.nodeMap) {
      const real = bigX[nIdx];
      const imag = bigX[nIdx + n];
      const mag = Math.sqrt(real * real + imag * imag);
      const magDb = mag > 1e-20 ? 20 * Math.log10(mag) : -400;
      const phase = Math.atan2(imag, real) * 180 / Math.PI;

      magSignals.get(name)!.data.push({ time: freq, value: magDb });
      phaseSignals.get(name)!.data.push({ time: freq, value: phase });
    }

    if (progressCb && fi % 10 === 0) {
      progressCb(fi / freqs.length);
    }
  }

  const signals = [
    ...Array.from(magSignals.values()),
    ...Array.from(phaseSignals.values()),
  ];

  const timeMs = performance.now() - t0;
  log.push(`Completed ${freqs.length} frequency points`);
  log.push(`Simulation time: ${timeMs.toFixed(1)}ms`);

  return {
    analysis: config,
    waveform: {
      signals,
      timeRange: { start: config.fstart, end: config.fstop },
      timeUnit: "Hz",
    },
    opPoint: undefined,
    converged: op.converged,
    iterations: op.iterations,
    timeMs,
    log,
  };
}

function solveRealSystem(n: number, A: Float64Array, b: Float64Array, x: Float64Array) {
  // Gaussian elimination with partial pivoting
  const AA = new Float64Array(A);
  const bb = new Float64Array(b);

  for (let col = 0; col < n; col++) {
    let maxVal = Math.abs(AA[col * n + col]);
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(AA[row * n + col]);
      if (val > maxVal) { maxVal = val; maxRow = row; }
    }
    if (maxVal < 1e-18) AA[col * n + col] += 1e-12;
    if (maxRow !== col) {
      for (let j = 0; j < n; j++) {
        const tmp = AA[col * n + j]; AA[col * n + j] = AA[maxRow * n + j]; AA[maxRow * n + j] = tmp;
      }
      const tmp = bb[col]; bb[col] = bb[maxRow]; bb[maxRow] = tmp;
    }
    const pivot = AA[col * n + col];
    for (let row = col + 1; row < n; row++) {
      const factor = AA[row * n + col] / pivot;
      for (let j = col; j < n; j++) AA[row * n + j] -= factor * AA[col * n + j];
      bb[row] -= factor * bb[col];
    }
  }
  for (let row = n - 1; row >= 0; row--) {
    let sum = bb[row];
    for (let j = row + 1; j < n; j++) sum -= AA[row * n + j] * x[j];
    const diag = AA[row * n + row];
    x[row] = diag !== 0 ? sum / diag : 0;
  }
}

// ══════════════════════════════════════════════════════════════════
// Main Entry Point
// ══════════════════════════════════════════════════════════════════

export function runSimulation(
  netlist: ParsedNetlist,
  analysis?: AnalysisDirective,
  progressCb?: (pct: number) => void,
): SimulationResult {
  const directive = analysis ?? netlist.analyses[0] ?? { type: "op" };

  switch (directive.type) {
    case "op":
      return runDCOp(netlist);
    case "tran":
      return runTransient(netlist, directive, progressCb);
    case "dc":
      return runDCSweep(netlist, directive, progressCb);
    case "ac":
      return runACAnalysis(netlist, directive, progressCb);
    default:
      return runDCOp(netlist);
  }
}
