/**
 * LVS (Layout vs Schematic) Engine
 *
 * Compares an extracted layout netlist against a reference schematic netlist
 * to verify that the physical layout matches the intended circuit.
 *
 * Reports:
 * - Device mismatches (extra/missing/wrong parameters)
 * - Net mismatches (extra/missing/shorted/open nets)
 * - Pin connectivity mismatches
 * - Cross-probing links (device ↔ geometry, net ↔ geometry)
 */

import type {
  ExtractedNetlist,
  NetlistDevice,
} from "./netlist";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface SchematicDevice {
  /** Instance name (e.g. M0, R1) */
  name: string;
  /** Device type */
  type: "nmos" | "pmos" | "resistor" | "capacitor";
  /** Model reference */
  model: string;
  /** Terminal→net mapping */
  terminals: Record<string, string>;
  /** Expected parameters */
  parameters: Record<string, number>;
}

export interface SchematicNetlist {
  /** Title */
  title: string;
  /** Net names */
  nets: string[];
  /** Devices */
  devices: SchematicDevice[];
  /** Port / pin names */
  ports: string[];
}

export type LvsMatchStatus = "match" | "mismatch" | "extra" | "missing";

export interface DeviceMatch {
  status: LvsMatchStatus;
  layoutDevice?: NetlistDevice;
  schematicDevice?: SchematicDevice;
  /** Specific parameter mismatches */
  parameterDiffs: ParameterDiff[];
  /** Terminal connectivity mismatches */
  terminalDiffs: TerminalDiff[];
  /** Geometry indices for cross-probing */
  geometryIndices: number[];
}

export interface ParameterDiff {
  parameter: string;
  layoutValue?: number;
  schematicValue?: number;
  tolerance: number;
  withinTolerance: boolean;
}

export interface TerminalDiff {
  terminal: string;
  layoutNet?: string;
  schematicNet?: string;
  match: boolean;
}

export interface NetMatch {
  status: LvsMatchStatus;
  layoutNet?: string;
  schematicNet?: string;
  /** Geometry indices connected to this net */
  geometryIndices: number[];
}

export interface LvsResult {
  /** Overall status */
  status: "clean" | "errors";
  /** Timestamp */
  timestamp: number;
  /** Comparison time */
  durationMs: number;
  /** Device-by-device comparison */
  deviceMatches: DeviceMatch[];
  /** Net-by-net comparison */
  netMatches: NetMatch[];
  /** Summary counts */
  summary: LvsSummary;
  /** Net name mapping (layout ↔ schematic) */
  netMapping: Map<string, string>;
}

export interface LvsSummary {
  totalDevices: number;
  matchedDevices: number;
  mismatchedDevices: number;
  extraLayoutDevices: number;
  missingLayoutDevices: number;
  totalNets: number;
  matchedNets: number;
  extraNets: number;
  missingNets: number;
  parameterErrors: number;
  connectivityErrors: number;
}

// ══════════════════════════════════════════════════════════════════════
// Demo Schematic Generator
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate a demo schematic netlist for testing LVS against the layout.
 * Creates an inverter-like circuit that partially matches.
 */
export function generateDemoSchematic(): SchematicNetlist {
  return {
    title: "Demo Inverter – Schematic",
    nets: ["VDD", "VSS", "IN", "OUT", "net1"],
    ports: ["VDD", "VSS", "IN", "OUT"],
    devices: [
      {
        name: "M0",
        type: "nmos",
        model: "sky130_fd_pr__nfet_01v8",
        terminals: { drain: "OUT", gate: "IN", source: "VSS", body: "VSS" },
        parameters: { w: 0.42, l: 0.15, nf: 1 },
      },
      {
        name: "M1",
        type: "pmos",
        model: "sky130_fd_pr__pfet_01v8",
        terminals: { drain: "OUT", gate: "IN", source: "VDD", body: "VDD" },
        parameters: { w: 0.84, l: 0.15, nf: 1 },
      },
      {
        name: "R0",
        type: "resistor",
        model: "sky130_fd_pr__res_generic_po",
        terminals: { plus: "OUT", minus: "net1" },
        parameters: { r: 1000, w: 0.35 },
      },
      {
        name: "C0",
        type: "capacitor",
        model: "sky130_fd_pr__cap_mim_m3_1",
        terminals: { plus: "net1", minus: "VSS" },
        parameters: { c: 1e-12 },
      },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════
// LVS Comparison Engine
// ══════════════════════════════════════════════════════════════════════

const PARAM_TOLERANCE = 0.1; // 10% tolerance

function devTypeKey(d: { type: string; model: string }): string {
  return `${d.type}:${d.model}`;
}

/**
 * Build a mapping of device type keys to arrays of devices
 */
function groupByType<T extends { type: string; model: string }>(
  devices: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const d of devices) {
    const key = devTypeKey(d);
    const arr = map.get(key) ?? [];
    arr.push(d);
    map.set(key, arr);
  }
  return map;
}

/**
 * Score how well two devices match based on terminal connectivity patterns
 */
function connectivityScore(
  layout: NetlistDevice,
  schem: SchematicDevice,
  netMap: Map<string, string>
): number {
  let score = 0;
  for (const [term, schemNet] of Object.entries(schem.terminals)) {
    const layoutNet = layout.terminals[term];
    if (!layoutNet) continue;
    const mappedLayout = netMap.get(layoutNet) ?? layoutNet;
    if (mappedLayout === schemNet) score += 2;
    else if (layoutNet.toLowerCase() === schemNet.toLowerCase()) score += 1;
  }
  return score;
}

/**
 * Compare parameters between layout and schematic device
 */
function compareParams(
  layout: NetlistDevice,
  schem: SchematicDevice
): ParameterDiff[] {
  const diffs: ParameterDiff[] = [];
  const allKeys = new Set([
    ...Object.keys(layout.parameters),
    ...Object.keys(schem.parameters),
  ]);

  for (const key of allKeys) {
    const lv = layout.parameters[key];
    const sv = schem.parameters[key];
    if (lv === undefined || sv === undefined) {
      diffs.push({
        parameter: key,
        layoutValue: lv,
        schematicValue: sv,
        tolerance: PARAM_TOLERANCE,
        withinTolerance: false,
      });
      continue;
    }
    const diff = Math.abs(lv - sv) / Math.max(Math.abs(sv), 1e-18);
    diffs.push({
      parameter: key,
      layoutValue: lv,
      schematicValue: sv,
      tolerance: PARAM_TOLERANCE,
      withinTolerance: diff <= PARAM_TOLERANCE,
    });
  }
  return diffs;
}

/**
 * Compare terminal connectivity between layout and schematic device
 */
function compareTerminals(
  layout: NetlistDevice,
  schem: SchematicDevice,
  netMap: Map<string, string>
): TerminalDiff[] {
  const diffs: TerminalDiff[] = [];
  const allTerminals = new Set([
    ...Object.keys(layout.terminals),
    ...Object.keys(schem.terminals),
  ]);

  for (const term of allTerminals) {
    const layoutNet = layout.terminals[term];
    const schemNet = schem.terminals[term];
    const mappedLayout = layoutNet ? (netMap.get(layoutNet) ?? layoutNet) : undefined;
    diffs.push({
      terminal: term,
      layoutNet: mappedLayout ?? layoutNet,
      schematicNet: schemNet,
      match: mappedLayout === schemNet,
    });
  }
  return diffs;
}

/**
 * Attempt to build a net name mapping between layout and schematic
 * using device connectivity as clues.
 */
function buildNetMapping(
  layoutDevices: NetlistDevice[],
  schemDevices: SchematicDevice[]
): Map<string, string> {
  const netMap = new Map<string, string>();

  // Power/ground nets map directly
  for (const d of layoutDevices) {
    for (const [, net] of Object.entries(d.terminals)) {
      const lower = net.toLowerCase();
      if (lower.includes("vdd") || lower.includes("vcc")) netMap.set(net, "VDD");
      if (lower.includes("vss") || lower.includes("gnd")) netMap.set(net, "VSS");
    }
  }

  // Try to infer mappings from matched device terminals
  const layoutByType = groupByType(layoutDevices);
  const schemByType = groupByType(schemDevices);

  for (const [typeKey, sdevices] of schemByType) {
    const ldevices = layoutByType.get(typeKey);
    if (!ldevices || ldevices.length !== sdevices.length) continue;

    // Simple 1:1 if same count
    if (ldevices.length === 1 && sdevices.length === 1) {
      const ld = ldevices[0];
      const sd = sdevices[0];
      for (const [term, snet] of Object.entries(sd.terminals)) {
        const lnet = ld.terminals[term];
        if (lnet && !netMap.has(lnet)) {
          netMap.set(lnet, snet);
        }
      }
    }
  }

  return netMap;
}

/**
 * Run LVS comparison between layout-extracted netlist and schematic reference.
 */
export function runLvs(
  layout: ExtractedNetlist,
  schematic: SchematicNetlist
): LvsResult {
  const start = performance.now();
  const netMap = buildNetMapping(layout.devices, schematic.devices);

  const deviceMatches: DeviceMatch[] = [];
  const netMatches: NetMatch[] = [];

  // ── Device comparison ──
  const layoutByType = groupByType(layout.devices);
  const schemByType = groupByType(schematic.devices);
  const allTypeKeys = new Set([...layoutByType.keys(), ...schemByType.keys()]);

  const matchedLayoutDevices = new Set<string>();
  const matchedSchemDevices = new Set<string>();

  for (const typeKey of allTypeKeys) {
    const ldevs = layoutByType.get(typeKey) ?? [];
    const sdevs = schemByType.get(typeKey) ?? [];

    // Score-based matching using connectivity
    const pairs: { li: number; si: number; score: number }[] = [];
    for (let li = 0; li < ldevs.length; li++) {
      for (let si = 0; si < sdevs.length; si++) {
        pairs.push({
          li,
          si,
          score: connectivityScore(ldevs[li], sdevs[si], netMap),
        });
      }
    }
    pairs.sort((a, b) => b.score - a.score);

    const usedL = new Set<number>();
    const usedS = new Set<number>();

    for (const { li, si } of pairs) {
      if (usedL.has(li) || usedS.has(si)) continue;
      usedL.add(li);
      usedS.add(si);

      const ld = ldevs[li];
      const sd = sdevs[si];
      const paramDiffs = compareParams(ld, sd);
      const termDiffs = compareTerminals(ld, sd, netMap);
      const hasParamError = paramDiffs.some((p) => !p.withinTolerance);
      const hasTermError = termDiffs.some((t) => !t.match);

      deviceMatches.push({
        status: hasParamError || hasTermError ? "mismatch" : "match",
        layoutDevice: ld,
        schematicDevice: sd,
        parameterDiffs: paramDiffs,
        terminalDiffs: termDiffs,
        geometryIndices: ld.geometryIndices,
      });

      matchedLayoutDevices.add(ld.name);
      matchedSchemDevices.add(sd.name);
    }

    // Un-matched layout devices → extra
    for (let i = 0; i < ldevs.length; i++) {
      if (!usedL.has(i)) {
        deviceMatches.push({
          status: "extra",
          layoutDevice: ldevs[i],
          parameterDiffs: [],
          terminalDiffs: [],
          geometryIndices: ldevs[i].geometryIndices,
        });
      }
    }

    // Un-matched schematic devices → missing
    for (let i = 0; i < sdevs.length; i++) {
      if (!usedS.has(i)) {
        deviceMatches.push({
          status: "missing",
          schematicDevice: sdevs[i],
          parameterDiffs: [],
          terminalDiffs: [],
          geometryIndices: [],
        });
      }
    }
  }

  // ── Net comparison ──
  const layoutNetSet = new Set(layout.nodes.map((n) => n.name));
  const schemNetSet = new Set(schematic.nets);

  // Map layout nets to schematic equivalents
  const mappedLayoutNets = new Set<string>();
  for (const ln of layoutNetSet) {
    const sn = netMap.get(ln) ?? ln;
    mappedLayoutNets.add(sn);
    if (schemNetSet.has(sn)) {
      // Build geometry index list for matching net
      const geomIndices: number[] = [];
      for (const d of layout.devices) {
        for (const [, tnet] of Object.entries(d.terminals)) {
          if (tnet === ln) {
            geomIndices.push(...d.geometryIndices);
          }
        }
      }
      netMatches.push({
        status: "match",
        layoutNet: ln,
        schematicNet: sn,
        geometryIndices: [...new Set(geomIndices)],
      });
    }
  }

  // Extra nets (in layout but not schematic)
  for (const ln of layoutNetSet) {
    const sn = netMap.get(ln) ?? ln;
    if (!schemNetSet.has(sn)) {
      netMatches.push({
        status: "extra",
        layoutNet: ln,
        geometryIndices: [],
      });
    }
  }

  // Missing nets (in schematic but not layout)
  for (const sn of schemNetSet) {
    if (!mappedLayoutNets.has(sn)) {
      netMatches.push({
        status: "missing",
        schematicNet: sn,
        geometryIndices: [],
      });
    }
  }

  // ── Summary ──
  const matchedDevs = deviceMatches.filter((d) => d.status === "match").length;
  const mismatchedDevs = deviceMatches.filter((d) => d.status === "mismatch").length;
  const extraDevs = deviceMatches.filter((d) => d.status === "extra").length;
  const missingDevs = deviceMatches.filter((d) => d.status === "missing").length;
  const paramErrors = deviceMatches.reduce(
    (sum, d) => sum + d.parameterDiffs.filter((p) => !p.withinTolerance).length,
    0
  );
  const connErrors = deviceMatches.reduce(
    (sum, d) => sum + d.terminalDiffs.filter((t) => !t.match).length,
    0
  );

  const matchedNets = netMatches.filter((n) => n.status === "match").length;
  const extraNets = netMatches.filter((n) => n.status === "extra").length;
  const missingNets = netMatches.filter((n) => n.status === "missing").length;

  const hasErrors =
    mismatchedDevs > 0 ||
    extraDevs > 0 ||
    missingDevs > 0 ||
    extraNets > 0 ||
    missingNets > 0;

  return {
    status: hasErrors ? "errors" : "clean",
    timestamp: Date.now(),
    durationMs: performance.now() - start,
    deviceMatches,
    netMatches,
    netMapping: netMap,
    summary: {
      totalDevices: deviceMatches.length,
      matchedDevices: matchedDevs,
      mismatchedDevices: mismatchedDevs,
      extraLayoutDevices: extraDevs,
      missingLayoutDevices: missingDevs,
      totalNets: netMatches.length,
      matchedNets,
      extraNets,
      missingNets,
      parameterErrors: paramErrors,
      connectivityErrors: connErrors,
    },
  };
}

/**
 * Generate a demo LVS result for UI testing.
 * Creates a realistic-looking LVS comparison with some mismatches.
 */
export function runDemoLvs(): LvsResult {
  const schematic = generateDemoSchematic();

  // Create a mock layout netlist that partially matches
  const mockLayout: ExtractedNetlist = {
    title: "Demo Inverter – Layout Extraction",
    nodes: [
      { name: "VDD", type: "power" },
      { name: "VSS", type: "ground" },
      { name: "IN", type: "io" },
      { name: "OUT", type: "io" },
      { name: "net1", type: "signal" },
      { name: "net_extra", type: "signal" },
    ],
    devices: [
      {
        name: "M0",
        type: "nmos",
        model: "sky130_fd_pr__nfet_01v8",
        terminals: { drain: "OUT", gate: "IN", source: "VSS", body: "VSS" },
        parameters: { w: 0.42, l: 0.15, nf: 1 },
        geometryIndices: [0, 1, 2, 3],
      },
      {
        name: "M1",
        type: "pmos",
        model: "sky130_fd_pr__pfet_01v8",
        terminals: { drain: "OUT", gate: "IN", source: "VDD", body: "VDD" },
        parameters: { w: 0.80, l: 0.15, nf: 1 }, // Slightly off: 0.80 vs 0.84
        geometryIndices: [4, 5, 6, 7],
      },
      {
        name: "R0",
        type: "resistor",
        model: "sky130_fd_pr__res_generic_po",
        terminals: { plus: "OUT", minus: "net1" },
        parameters: { r: 1000, w: 0.35 },
        geometryIndices: [8, 9],
      },
      // Missing C0 — will show as "missing" in LVS
      // Extra device — will show as "extra"
      {
        name: "R_extra",
        type: "resistor",
        model: "sky130_fd_pr__res_generic_po",
        terminals: { plus: "net_extra", minus: "VSS" },
        parameters: { r: 500, w: 0.35 },
        geometryIndices: [10, 11],
      },
    ],
    parasitics: [],
    spiceText: "",
    timestamp: Date.now(),
    stats: {
      deviceCount: 4,
      nodeCount: 6,
      parasiticCount: 0,
      extractionTimeMs: 12,
    },
  };

  return runLvs(mockLayout, schematic);
}
