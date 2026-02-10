/**
 * SPICE Netlist Parser
 *
 * Parses SPICE netlist text into a structured circuit model suitable for
 * simulation by the built-in solver or handoff to ngspice WASM.
 *
 * Supports:
 *  - MOSFET (M), Resistor (R), Capacitor (C), Inductor (L)
 *  - Voltage source (V), Current source (I)
 *  - .model statements
 *  - .subckt / .ends
 *  - .tran, .dc, .ac, .op analysis directives
 *  - .param parameters
 *  - .include / .lib (recorded, not resolved)
 *  - Comments (* and $)
 *  - Line continuations (+)
 *  - SI suffixes (f p n u m k meg g t)
 */

// ══════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════

export type DeviceType =
  | "mosfet"
  | "resistor"
  | "capacitor"
  | "inductor"
  | "vsource"
  | "isource"
  | "diode"
  | "bjt"
  | "subcircuit_instance";

export interface SpiceNode {
  name: string;
  index: number; // 0 = GND
}

export interface MosfetDevice {
  type: "mosfet";
  name: string;
  drain: string;
  gate: string;
  source: string;
  body: string;
  model: string;
  params: Record<string, number>;
}

export interface ResistorDevice {
  type: "resistor";
  name: string;
  nodeA: string;
  nodeB: string;
  value: number;
}

export interface CapacitorDevice {
  type: "capacitor";
  name: string;
  nodeA: string;
  nodeB: string;
  value: number;
  ic?: number; // initial condition
}

export interface InductorDevice {
  type: "inductor";
  name: string;
  nodeA: string;
  nodeB: string;
  value: number;
  ic?: number;
}

export interface VoltageSource {
  type: "vsource";
  name: string;
  nodePos: string;
  nodeNeg: string;
  dcValue: number;
  acMag?: number;
  acPhase?: number;
  /** Transient source specification */
  transient?: TransientSource;
}

export interface CurrentSource {
  type: "isource";
  name: string;
  nodePos: string;
  nodeNeg: string;
  dcValue: number;
  acMag?: number;
  acPhase?: number;
  transient?: TransientSource;
}

export interface DiodeDevice {
  type: "diode";
  name: string;
  nodeAnode: string;
  nodeCathode: string;
  model: string;
}

export interface SubcircuitInstance {
  type: "subcircuit_instance";
  name: string;
  nodes: string[];
  subcktName: string;
  params: Record<string, number>;
}

export type SpiceDevice =
  | MosfetDevice
  | ResistorDevice
  | CapacitorDevice
  | InductorDevice
  | VoltageSource
  | CurrentSource
  | DiodeDevice
  | SubcircuitInstance;

// ── Transient Source Specifications ───────────────────────────────

export type TransientSourceType = "pulse" | "sin" | "pwl" | "exp";

export interface PulseSource {
  kind: "pulse";
  v1: number;
  v2: number;
  delay: number;
  rise: number;
  fall: number;
  width: number;
  period: number;
}

export interface SinSource {
  kind: "sin";
  offset: number;
  amplitude: number;
  frequency: number;
  delay: number;
  damping: number;
  phase: number;
}

export interface PwlSource {
  kind: "pwl";
  points: { time: number; value: number }[];
}

export interface ExpSource {
  kind: "exp";
  v1: number;
  v2: number;
  td1: number;
  tau1: number;
  td2: number;
  tau2: number;
}

export type TransientSource = PulseSource | SinSource | PwlSource | ExpSource;

// ── Analysis Directives ──────────────────────────────────────────

export interface TranAnalysis {
  type: "tran";
  step: number;
  stop: number;
  start?: number;
  maxStep?: number;
  uic?: boolean; // Use Initial Conditions
}

export interface DcAnalysis {
  type: "dc";
  source: string;
  start: number;
  stop: number;
  step: number;
  source2?: string;
  start2?: number;
  stop2?: number;
  step2?: number;
}

export interface AcAnalysis {
  type: "ac";
  variation: "dec" | "oct" | "lin";
  points: number;
  fstart: number;
  fstop: number;
}

export interface OpAnalysis {
  type: "op";
}

export type AnalysisDirective = TranAnalysis | DcAnalysis | AcAnalysis | OpAnalysis;

// ── Model Statement ──────────────────────────────────────────────

export interface SpiceModel {
  name: string;
  type: string; // "nmos", "pmos", "d", "npn", "pnp", etc.
  level?: number;
  params: Record<string, number>;
}

// ── Subcircuit Definition ────────────────────────────────────────

export interface SubcircuitDef {
  name: string;
  ports: string[];
  params: Record<string, number>;
  devices: SpiceDevice[];
  models: SpiceModel[];
}

// ── Parsed Netlist ───────────────────────────────────────────────

export interface ParsedNetlist {
  title: string;
  devices: SpiceDevice[];
  models: SpiceModel[];
  subcircuits: SubcircuitDef[];
  analyses: AnalysisDirective[];
  params: Record<string, number>;
  nodeNames: string[];
  includes: string[];
  globalNodes: string[];
  options: Record<string, string>;
  rawText: string;
}

// ══════════════════════════════════════════════════════════════════
// SI Suffix Parser
// ══════════════════════════════════════════════════════════════════

const SI_SUFFIXES: Record<string, number> = {
  f: 1e-15,
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  m: 1e-3,
  k: 1e3,
  meg: 1e6,
  g: 1e9,
  t: 1e12,
};

export function parseSpiceNumber(raw: string): number {
  if (!raw) return 0;
  const s = raw.trim().toLowerCase();

  // Handle pure numeric
  const numericMatch = s.match(/^([+-]?\d+\.?\d*(?:e[+-]?\d+)?)\s*(.*)$/);
  if (!numericMatch) return parseFloat(s) || 0;

  const num = parseFloat(numericMatch[1]);
  const suffix = numericMatch[2].trim();

  if (!suffix) return num;

  // Check for meg first (before m)
  if (suffix.startsWith("meg")) return num * 1e6;
  const mult = SI_SUFFIXES[suffix.charAt(0)];
  return mult ? num * mult : num;
}

// ══════════════════════════════════════════════════════════════════
// Tokenizer — handles line continuations and comments
// ══════════════════════════════════════════════════════════════════

function preprocessLines(text: string): string[] {
  const rawLines = text.split(/\r?\n/);
  const result: string[] = [];
  let current = "";

  for (const line of rawLines) {
    const trimmed = line.trimStart();

    // Line continuation: starts with '+'
    if (trimmed.startsWith("+")) {
      current += " " + trimmed.slice(1).trim();
      continue;
    }

    if (current) result.push(current);
    current = trimmed;
  }
  if (current) result.push(current);

  return result
    .map((l) => l.replace(/\$.*$/, "").trim()) // Inline comments
    .filter((l) => l && !l.startsWith("*")); // Remove empty and comment lines
}

// ══════════════════════════════════════════════════════════════════
// Transient Source Parser
// ══════════════════════════════════════════════════════════════════

function parseTransientSource(tokens: string[]): TransientSource | undefined {
  // Find transient specification: PULSE(...), SIN(...), PWL(...), EXP(...)
  const joined = tokens.join(" ");

  // PULSE(v1 v2 td tr tf pw per)
  const pulseMatch = joined.match(/pulse\s*\(\s*([^)]+)\s*\)/i);
  if (pulseMatch) {
    const vals = pulseMatch[1].trim().split(/[\s,]+/).map(parseSpiceNumber);
    return {
      kind: "pulse",
      v1: vals[0] ?? 0,
      v2: vals[1] ?? 1.8,
      delay: vals[2] ?? 0,
      rise: vals[3] ?? 1e-12,
      fall: vals[4] ?? 1e-12,
      width: vals[5] ?? 5e-9,
      period: vals[6] ?? 10e-9,
    };
  }

  // SIN(offset amp freq delay damping phase)
  const sinMatch = joined.match(/sin\s*\(\s*([^)]+)\s*\)/i);
  if (sinMatch) {
    const vals = sinMatch[1].trim().split(/[\s,]+/).map(parseSpiceNumber);
    return {
      kind: "sin",
      offset: vals[0] ?? 0,
      amplitude: vals[1] ?? 1,
      frequency: vals[2] ?? 1e9,
      delay: vals[3] ?? 0,
      damping: vals[4] ?? 0,
      phase: vals[5] ?? 0,
    };
  }

  // PWL(t1 v1 t2 v2 ...)
  const pwlMatch = joined.match(/pwl\s*\(\s*([^)]+)\s*\)/i);
  if (pwlMatch) {
    const vals = pwlMatch[1].trim().split(/[\s,]+/).map(parseSpiceNumber);
    const points: { time: number; value: number }[] = [];
    for (let i = 0; i < vals.length - 1; i += 2) {
      points.push({ time: vals[i], value: vals[i + 1] });
    }
    return { kind: "pwl", points };
  }

  // EXP(v1 v2 td1 tau1 td2 tau2)
  const expMatch = joined.match(/exp\s*\(\s*([^)]+)\s*\)/i);
  if (expMatch) {
    const vals = expMatch[1].trim().split(/[\s,]+/).map(parseSpiceNumber);
    return {
      kind: "exp",
      v1: vals[0] ?? 0,
      v2: vals[1] ?? 1.8,
      td1: vals[2] ?? 0,
      tau1: vals[3] ?? 1e-9,
      td2: vals[4] ?? 0,
      tau2: vals[5] ?? 1e-9,
    };
  }

  return undefined;
}

// ══════════════════════════════════════════════════════════════════
// Device Parsers
// ══════════════════════════════════════════════════════════════════

function parseMosfet(tokens: string[]): MosfetDevice {
  // M<name> drain gate source body model [params]
  const params: Record<string, number> = {};
  for (let i = 6; i < tokens.length; i++) {
    const eq = tokens[i].split("=");
    if (eq.length === 2) {
      params[eq[0].toLowerCase()] = parseSpiceNumber(eq[1]);
    }
  }
  return {
    type: "mosfet",
    name: tokens[0],
    drain: tokens[1],
    gate: tokens[2],
    source: tokens[3],
    body: tokens[4],
    model: tokens[5] || "NMOS",
    params,
  };
}

function parseResistor(tokens: string[]): ResistorDevice {
  return {
    type: "resistor",
    name: tokens[0],
    nodeA: tokens[1],
    nodeB: tokens[2],
    value: parseSpiceNumber(tokens[3] || "0"),
  };
}

function parseCapacitor(tokens: string[]): CapacitorDevice {
  const dev: CapacitorDevice = {
    type: "capacitor",
    name: tokens[0],
    nodeA: tokens[1],
    nodeB: tokens[2],
    value: parseSpiceNumber(tokens[3] || "0"),
  };
  // Check for IC=value
  for (let i = 4; i < tokens.length; i++) {
    if (tokens[i].toLowerCase().startsWith("ic=")) {
      dev.ic = parseSpiceNumber(tokens[i].slice(3));
    }
  }
  return dev;
}

function parseInductor(tokens: string[]): InductorDevice {
  const dev: InductorDevice = {
    type: "inductor",
    name: tokens[0],
    nodeA: tokens[1],
    nodeB: tokens[2],
    value: parseSpiceNumber(tokens[3] || "0"),
  };
  for (let i = 4; i < tokens.length; i++) {
    if (tokens[i].toLowerCase().startsWith("ic=")) {
      dev.ic = parseSpiceNumber(tokens[i].slice(3));
    }
  }
  return dev;
}

function parseVoltageSource(tokens: string[]): VoltageSource {
  const src: VoltageSource = {
    type: "vsource",
    name: tokens[0],
    nodePos: tokens[1],
    nodeNeg: tokens[2],
    dcValue: 0,
  };

  // Parse remaining tokens for DC, AC, and transient specs
  const rest = tokens.slice(3);
  const joined = rest.join(" ").toLowerCase();

  // DC value
  const dcMatch = joined.match(/(?:dc\s+)?(\d+\.?\d*(?:e[+-]?\d+)?(?:[a-z]*)?)/);
  if (dcMatch) {
    src.dcValue = parseSpiceNumber(dcMatch[1]);
  }

  // AC specification
  const acMatch = joined.match(/ac\s+(\S+)(?:\s+(\S+))?/);
  if (acMatch) {
    src.acMag = parseSpiceNumber(acMatch[1]);
    if (acMatch[2]) src.acPhase = parseSpiceNumber(acMatch[2]);
  }

  // Transient source
  src.transient = parseTransientSource(rest);

  return src;
}

function parseCurrentSource(tokens: string[]): CurrentSource {
  const src: CurrentSource = {
    type: "isource",
    name: tokens[0],
    nodePos: tokens[1],
    nodeNeg: tokens[2],
    dcValue: 0,
  };

  const rest = tokens.slice(3);
  const joined = rest.join(" ").toLowerCase();

  const dcMatch = joined.match(/(?:dc\s+)?(\d+\.?\d*(?:e[+-]?\d+)?(?:[a-z]*)?)/);
  if (dcMatch) src.dcValue = parseSpiceNumber(dcMatch[1]);

  const acMatch = joined.match(/ac\s+(\S+)(?:\s+(\S+))?/);
  if (acMatch) {
    src.acMag = parseSpiceNumber(acMatch[1]);
    if (acMatch[2]) src.acPhase = parseSpiceNumber(acMatch[2]);
  }

  src.transient = parseTransientSource(rest);
  return src;
}

// ── Analysis Parsers ─────────────────────────────────────────────

function parseTranDirective(tokens: string[]): TranAnalysis {
  // .tran step stop [start] [maxstep] [UIC]
  const analysis: TranAnalysis = {
    type: "tran",
    step: parseSpiceNumber(tokens[1] || "1n"),
    stop: parseSpiceNumber(tokens[2] || "10n"),
  };
  if (tokens[3] && !tokens[3].toLowerCase().startsWith("uic")) {
    analysis.start = parseSpiceNumber(tokens[3]);
  }
  if (tokens[4] && !tokens[4].toLowerCase().startsWith("uic")) {
    analysis.maxStep = parseSpiceNumber(tokens[4]);
  }
  if (tokens.some((t) => t.toLowerCase() === "uic")) {
    analysis.uic = true;
  }
  return analysis;
}

function parseDcDirective(tokens: string[]): DcAnalysis {
  // .dc source start stop step [source2 start2 stop2 step2]
  const analysis: DcAnalysis = {
    type: "dc",
    source: tokens[1] || "VIN",
    start: parseSpiceNumber(tokens[2] || "0"),
    stop: parseSpiceNumber(tokens[3] || "1.8"),
    step: parseSpiceNumber(tokens[4] || "0.01"),
  };
  if (tokens[5]) {
    analysis.source2 = tokens[5];
    analysis.start2 = parseSpiceNumber(tokens[6] || "0");
    analysis.stop2 = parseSpiceNumber(tokens[7] || "1.8");
    analysis.step2 = parseSpiceNumber(tokens[8] || "0.01");
  }
  return analysis;
}

function parseAcDirective(tokens: string[]): AcAnalysis {
  // .ac dec|oct|lin points fstart fstop
  const variation = (tokens[1]?.toLowerCase() || "dec") as "dec" | "oct" | "lin";
  return {
    type: "ac",
    variation,
    points: parseInt(tokens[2] || "10"),
    fstart: parseSpiceNumber(tokens[3] || "1"),
    fstop: parseSpiceNumber(tokens[4] || "1g"),
  };
}

function parseModelDirective(tokens: string[]): SpiceModel {
  // .model name type [(] params [)]
  const name = tokens[1] || "unnamed";
  let typeStr = (tokens[2] || "nmos").toLowerCase();

  // Strip parentheses
  typeStr = typeStr.replace(/[()]/g, "");

  const params: Record<string, number> = {};
  const joined = tokens.slice(3).join(" ");
  // Extract level
  const levelMatch = joined.match(/level\s*=\s*(\d+)/i);
  const level = levelMatch ? parseInt(levelMatch[1]) : undefined;

  // Extract key=value pairs
  const paramRegex = /(\w+)\s*=\s*([^\s)]+)/g;
  let match;
  while ((match = paramRegex.exec(joined))) {
    params[match[1].toLowerCase()] = parseSpiceNumber(match[2]);
  }

  return { name, type: typeStr, level, params };
}

// ══════════════════════════════════════════════════════════════════
// Main Parser
// ══════════════════════════════════════════════════════════════════

export function parseSpiceNetlist(text: string): ParsedNetlist {
  const lines = preprocessLines(text);

  const result: ParsedNetlist = {
    title: "",
    devices: [],
    models: [],
    subcircuits: [],
    analyses: [],
    params: {},
    nodeNames: [],
    includes: [],
    globalNodes: [],
    options: {},
    rawText: text,
  };

  // First line is traditionally the title (SPICE convention)
  let startLine = 0;
  if (lines.length > 0 && !lines[0].startsWith(".")) {
    result.title = lines[0];
    startLine = 1; // skip title line from device parsing
  } else if (lines.length > 0) {
    result.title = "untitled";
  }

  const nodeSet = new Set<string>();
  nodeSet.add("0"); // Ground is always present

  let inSubckt = false;
  let currentSubckt: SubcircuitDef | null = null;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const tokens = line.split(/[\s,]+/).filter(Boolean);
    if (tokens.length === 0) continue;

    const first = tokens[0].toLowerCase();

    // ── Dot directives ──
    if (first.startsWith(".")) {
      switch (first) {
        case ".tran":
          result.analyses.push(parseTranDirective(tokens));
          break;
        case ".dc":
          result.analyses.push(parseDcDirective(tokens));
          break;
        case ".ac":
          result.analyses.push(parseAcDirective(tokens));
          break;
        case ".op":
          result.analyses.push({ type: "op" });
          break;
        case ".model":
          if (inSubckt && currentSubckt) {
            currentSubckt.models.push(parseModelDirective(tokens));
          } else {
            result.models.push(parseModelDirective(tokens));
          }
          break;
        case ".subckt": {
          inSubckt = true;
          const subcktName = tokens[1] || "unnamed";
          const ports: string[] = [];
          const subcktParams: Record<string, number> = {};
          let paramsMode = false;
          for (let j = 2; j < tokens.length; j++) {
            if (tokens[j].toLowerCase() === "params:") {
              paramsMode = true;
              continue;
            }
            if (paramsMode || tokens[j].includes("=")) {
              const eq = tokens[j].split("=");
              if (eq.length === 2) subcktParams[eq[0]] = parseSpiceNumber(eq[1]);
            } else {
              ports.push(tokens[j]);
            }
          }
          currentSubckt = { name: subcktName, ports, params: subcktParams, devices: [], models: [] };
          break;
        }
        case ".ends":
          if (currentSubckt) {
            result.subcircuits.push(currentSubckt);
            currentSubckt = null;
          }
          inSubckt = false;
          break;
        case ".param": {
          for (let j = 1; j < tokens.length; j++) {
            const eq = tokens[j].split("=");
            if (eq.length === 2) {
              result.params[eq[0]] = parseSpiceNumber(eq[1]);
            }
          }
          break;
        }
        case ".include":
        case ".lib":
          result.includes.push(tokens.slice(1).join(" ").replace(/'/g, "").replace(/"/g, ""));
          break;
        case ".global":
          result.globalNodes.push(...tokens.slice(1));
          break;
        case ".option":
        case ".options":
          for (let j = 1; j < tokens.length; j++) {
            const eq = tokens[j].split("=");
            if (eq.length === 2) {
              result.options[eq[0].toLowerCase()] = eq[1];
            }
          }
          break;
        case ".end":
          break;
        default:
          break;
      }
      continue;
    }

    // ── Device instances ──
    const prefix = first.charAt(0);
    let device: SpiceDevice | null = null;

    switch (prefix) {
      case "m":
        device = parseMosfet(tokens);
        nodeSet.add(tokens[1]).add(tokens[2]).add(tokens[3]).add(tokens[4]);
        break;
      case "r":
        device = parseResistor(tokens);
        nodeSet.add(tokens[1]).add(tokens[2]);
        break;
      case "c":
        device = parseCapacitor(tokens);
        nodeSet.add(tokens[1]).add(tokens[2]);
        break;
      case "l":
        device = parseInductor(tokens);
        nodeSet.add(tokens[1]).add(tokens[2]);
        break;
      case "v":
        device = parseVoltageSource(tokens);
        nodeSet.add(tokens[1]).add(tokens[2]);
        break;
      case "i":
        device = parseCurrentSource(tokens);
        nodeSet.add(tokens[1]).add(tokens[2]);
        break;
      case "d":
        device = {
          type: "diode",
          name: tokens[0],
          nodeAnode: tokens[1],
          nodeCathode: tokens[2],
          model: tokens[3] || "D",
        };
        nodeSet.add(tokens[1]).add(tokens[2]);
        break;
      case "x": {
        // Subcircuit instance: X<name> node1 node2 ... subcktName [params]
        const nodes: string[] = [];
        const instParams: Record<string, number> = {};
        // Find the subcircuit name: last non-param token
        for (let j = 1; j < tokens.length; j++) {
          if (tokens[j].includes("=")) {
            const eq = tokens[j].split("=");
            instParams[eq[0]] = parseSpiceNumber(eq[1]);
          } else {
            nodes.push(tokens[j]);
          }
        }
        const subcktName = nodes.pop() || "unknown";
        nodes.forEach((n) => nodeSet.add(n));
        device = {
          type: "subcircuit_instance",
          name: tokens[0],
          nodes,
          subcktName,
          params: instParams,
        };
        break;
      }
      default:
        break;
    }

    if (device) {
      if (inSubckt && currentSubckt) {
        currentSubckt.devices.push(device);
      } else {
        result.devices.push(device);
      }
    }
  }

  result.nodeNames = Array.from(nodeSet);
  return result;
}

// ══════════════════════════════════════════════════════════════════
// Evaluate Transient Sources at a given time
// ══════════════════════════════════════════════════════════════════

export function evalTransientSource(src: TransientSource, t: number): number {
  switch (src.kind) {
    case "pulse": {
      const { v1, v2, delay, rise, fall, width, period } = src;
      if (t < delay) return v1;
      const tMod = (t - delay) % period;
      if (tMod < rise) return v1 + (v2 - v1) * (tMod / rise);
      if (tMod < rise + width) return v2;
      if (tMod < rise + width + fall) return v2 + (v1 - v2) * ((tMod - rise - width) / fall);
      return v1;
    }
    case "sin": {
      const { offset, amplitude, frequency, delay, damping, phase } = src;
      if (t < delay) return offset;
      const td = t - delay;
      const dampFactor = damping > 0 ? Math.exp(-damping * td) : 1;
      return offset + amplitude * dampFactor * Math.sin(2 * Math.PI * frequency * td + (phase * Math.PI) / 180);
    }
    case "pwl": {
      const { points } = src;
      if (points.length === 0) return 0;
      if (t <= points[0].time) return points[0].value;
      if (t >= points[points.length - 1].time) return points[points.length - 1].value;
      for (let i = 1; i < points.length; i++) {
        if (t <= points[i].time) {
          const frac = (t - points[i - 1].time) / (points[i].time - points[i - 1].time);
          return points[i - 1].value + frac * (points[i].value - points[i - 1].value);
        }
      }
      return points[points.length - 1].value;
    }
    case "exp": {
      const { v1, v2, td1, tau1, td2, tau2 } = src;
      if (t < td1) return v1;
      if (t < td2) return v1 + (v2 - v1) * (1 - Math.exp(-(t - td1) / tau1));
      return v1 + (v2 - v1) * (1 - Math.exp(-(t - td1) / tau1)) + (v1 - v2) * (1 - Math.exp(-(t - td2) / tau2));
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// Generate SPICE text from analysis config
// ══════════════════════════════════════════════════════════════════

export function analysisToSpice(analysis: AnalysisDirective): string {
  switch (analysis.type) {
    case "tran": {
      let line = `.tran ${formatEng(analysis.step)} ${formatEng(analysis.stop)}`;
      if (analysis.start != null) line += ` ${formatEng(analysis.start)}`;
      if (analysis.maxStep != null) line += ` ${formatEng(analysis.maxStep)}`;
      if (analysis.uic) line += " UIC";
      return line;
    }
    case "dc": {
      let line = `.dc ${analysis.source} ${formatEng(analysis.start)} ${formatEng(analysis.stop)} ${formatEng(analysis.step)}`;
      if (analysis.source2) {
        line += ` ${analysis.source2} ${formatEng(analysis.start2!)} ${formatEng(analysis.stop2!)} ${formatEng(analysis.step2!)}`;
      }
      return line;
    }
    case "ac":
      return `.ac ${analysis.variation} ${analysis.points} ${formatEng(analysis.fstart)} ${formatEng(analysis.fstop)}`;
    case "op":
      return ".op";
  }
}

function formatEng(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${value / 1e12}t`;
  if (abs >= 1e9) return `${value / 1e9}g`;
  if (abs >= 1e6) return `${value / 1e6}meg`;
  if (abs >= 1e3) return `${value / 1e3}k`;
  if (abs >= 1) return `${value}`;
  if (abs >= 1e-3) return `${value * 1e3}m`;
  if (abs >= 1e-6) return `${value * 1e6}u`;
  if (abs >= 1e-9) return `${value * 1e9}n`;
  if (abs >= 1e-12) return `${value * 1e12}p`;
  if (abs >= 1e-15) return `${value * 1e15}f`;
  return value.toExponential(3);
}
