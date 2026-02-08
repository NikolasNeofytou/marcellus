/**
 * Schematic ↔ Layout Bi-directional Synchronisation Engine (V5)
 *
 * Maps between schematic elements and layout geometries, supporting:
 * 1. Forward sync: schematic → layout (place devices from schematic)
 * 2. Back-annotate: layout → schematic (update params from extracted layout)
 * 3. Net consistency checking between domains
 * 4. Parasitic back-annotation from post-layout extraction
 */

import type { SchematicSymbol, SchematicNet } from "../stores/schematicStore";
import type { CanvasGeometry } from "../stores/geometryStore";
import type { NetlistDevice, ExtractedNetlist } from "./netlist";
import type { LvsResult } from "./lvs";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

/** A bidirectional mapping entry between schematic and layout */
export interface SyncMapping {
  /** Schematic symbol ID */
  schematicId: string;
  /** Schematic instance name (M0, R1, etc.) */
  instanceName: string;
  /** Layout geometry indices that represent this device */
  layoutGeometryIndices: number[];
  /** Layout cell instance ID (if placed via cell store) */
  layoutInstanceId?: string;
  /** Net mappings: schematic pin name → layout net name */
  netMappings: Record<string, string>;
  /** Sync status */
  status: "synced" | "param-mismatch" | "missing-layout" | "missing-schematic" | "unlinked";
  /** Parameter deltas (if any) */
  parameterDeltas: ParameterDelta[];
}

export interface ParameterDelta {
  param: string;
  schematicValue: number | string;
  layoutValue: number | string;
  /** Percentage difference for numeric values */
  percentDiff?: number;
}

/** Actions the sync engine can suggest */
export interface SyncAction {
  type:
    | "create-layout-device"     // Device in schematic but no layout
    | "create-schematic-symbol"  // Device in layout but no schematic
    | "update-layout-params"     // Push schematic params → layout
    | "update-schematic-params"  // Pull layout params → schematic (back-annotate)
    | "fix-net-connection"       // Net mismatch
    | "remove-extra-layout"      // Extra device in layout
    | "remove-extra-schematic";  // Extra symbol in schematic
  /** Human-readable description */
  description: string;
  /** Device/symbol involved */
  instanceName: string;
  /** Mapping entry (if exists) */
  mapping?: SyncMapping;
  /** Suggested parameter values */
  suggestedParams?: Record<string, number | string>;
  /** Priority (lower = more important) */
  priority: number;
}

/** Full sync report */
export interface SyncReport {
  /** Timestamp */
  timestamp: number;
  /** Duration in ms */
  durationMs: number;
  /** All mappings */
  mappings: SyncMapping[];
  /** Suggested actions */
  actions: SyncAction[];
  /** Summary */
  summary: SyncSummary;
}

export interface SyncSummary {
  totalSchematicDevices: number;
  totalLayoutDevices: number;
  synced: number;
  paramMismatches: number;
  missingInLayout: number;
  missingInSchematic: number;
  unlinked: number;
  netMismatches: number;
}

/** Back-annotation data from post-layout extraction */
export interface BackAnnotation {
  /** Instance name */
  instanceName: string;
  /** Extracted parameters (W, L, etc.) */
  extractedParams: Record<string, number>;
  /** Parasitic elements associated with this device */
  parasitics: ParasiticSummary;
  /** Layout net connections */
  netConnections: Record<string, string>;
}

export interface ParasiticSummary {
  /** Total parasitic resistance on this device's nets (Ω) */
  totalResistance: number;
  /** Total parasitic capacitance on this device's nets (fF) */
  totalCapacitance: number;
  /** Per-terminal parasitic breakdown */
  perTerminal: Record<string, { resistance: number; capacitance: number }>;
}

// ══════════════════════════════════════════════════════════════════════
// Mapping Builder
// ══════════════════════════════════════════════════════════════════════

/**
 * Build a name-based mapping between schematic symbols and layout devices.
 * Uses instance names (M0, R1, etc.) as the primary key for pairing.
 */
export function buildSyncMappings(
  schematicSymbols: SchematicSymbol[],
  layoutDevices: NetlistDevice[],
): SyncMapping[] {
  const mappings: SyncMapping[] = [];

  // Index layout devices by instance name
  const layoutByName = new Map<string, NetlistDevice>();
  for (const ld of layoutDevices) {
    layoutByName.set(ld.name.toUpperCase(), ld);
  }

  const matchedLayoutNames = new Set<string>();

  // Match schematic symbols to layout devices
  for (const sym of schematicSymbols) {
    const nameKey = sym.instanceName.toUpperCase();
    const layoutDev = layoutByName.get(nameKey);

    if (layoutDev) {
      matchedLayoutNames.add(nameKey);

      // Compare parameters
      const deltas = compareDeviceParams(sym, layoutDev);
      const hasParamDiff = deltas.length > 0;

      // Build net mappings from schematic pins
      const netMappings: Record<string, string> = {};
      for (const pin of sym.pins) {
        if (pin.netName) {
          const layoutTerminal = pinNameToTerminal(pin.name, sym.deviceType);
          const layoutNet = layoutDev.terminals[layoutTerminal];
          netMappings[pin.name] = layoutNet ?? "";
        }
      }

      mappings.push({
        schematicId: sym.id,
        instanceName: sym.instanceName,
        layoutGeometryIndices: layoutDev.geometryIndices,
        netMappings,
        status: hasParamDiff ? "param-mismatch" : "synced",
        parameterDeltas: deltas,
      });
    } else {
      // Schematic device with no layout counterpart
      mappings.push({
        schematicId: sym.id,
        instanceName: sym.instanceName,
        layoutGeometryIndices: [],
        netMappings: {},
        status: "missing-layout",
        parameterDeltas: [],
      });
    }
  }

  // Find layout devices with no schematic counterpart
  for (const ld of layoutDevices) {
    if (!matchedLayoutNames.has(ld.name.toUpperCase())) {
      mappings.push({
        schematicId: "",
        instanceName: ld.name,
        layoutGeometryIndices: ld.geometryIndices,
        netMappings: {},
        status: "missing-schematic",
        parameterDeltas: [],
      });
    }
  }

  return mappings;
}

/** Map schematic pin names to layout terminal names */
function pinNameToTerminal(pinName: string, deviceType: string): string {
  const upper = pinName.toUpperCase();
  // MOS devices
  if (deviceType === "nmos" || deviceType === "pmos") {
    if (upper === "D" || upper === "DRAIN") return "drain";
    if (upper === "G" || upper === "GATE") return "gate";
    if (upper === "S" || upper === "SOURCE") return "source";
    if (upper === "B" || upper === "BODY" || upper === "BULK") return "body";
  }
  // Passives
  if (upper === "A" || upper === "+") return "plus";
  if (upper === "B" || upper === "-" || upper === "K") return "minus";
  return pinName.toLowerCase();
}

/** Compare parameters between a schematic symbol and a layout device */
function compareDeviceParams(
  sym: SchematicSymbol,
  layoutDev: NetlistDevice,
): ParameterDelta[] {
  const deltas: ParameterDelta[] = [];
  const TOLERANCE = 0.05; // 5%

  // Check standard parameters
  const paramsToCheck = ["w", "l", "nf", "r", "c", "mult"];
  for (const p of paramsToCheck) {
    const sv = sym.parameters[p];
    const lv = layoutDev.parameters[p];

    if (sv === undefined && lv === undefined) continue;
    if (sv === undefined || lv === undefined) {
      deltas.push({
        param: p,
        schematicValue: sv ?? "missing",
        layoutValue: lv ?? "missing",
      });
      continue;
    }

    const sNum = typeof sv === "number" ? sv : parseFloat(String(sv));
    const lNum = typeof lv === "number" ? lv : parseFloat(String(lv));

    if (isNaN(sNum) || isNaN(lNum)) {
      if (String(sv) !== String(lv)) {
        deltas.push({ param: p, schematicValue: sv, layoutValue: lv });
      }
      continue;
    }

    const denom = Math.max(Math.abs(sNum), 1e-18);
    const pctDiff = Math.abs(sNum - lNum) / denom;
    if (pctDiff > TOLERANCE) {
      deltas.push({
        param: p,
        schematicValue: sNum,
        layoutValue: lNum,
        percentDiff: Math.round(pctDiff * 10000) / 100,
      });
    }
  }

  return deltas;
}

// ══════════════════════════════════════════════════════════════════════
// Sync Report Generator
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate a full sync report with mappings and suggested actions.
 */
export function generateSyncReport(
  schematicSymbols: SchematicSymbol[],
  layoutDevices: NetlistDevice[],
  _schematicNets: SchematicNet[],
): SyncReport {
  const start = performance.now();

  const mappings = buildSyncMappings(schematicSymbols, layoutDevices);
  const actions: SyncAction[] = [];

  let netMismatches = 0;

  for (const m of mappings) {
    switch (m.status) {
      case "missing-layout":
        actions.push({
          type: "create-layout-device",
          description: `Create layout for ${m.instanceName} (exists in schematic only)`,
          instanceName: m.instanceName,
          mapping: m,
          priority: 1,
        });
        break;

      case "missing-schematic":
        actions.push({
          type: "create-schematic-symbol",
          description: `Add ${m.instanceName} to schematic (exists in layout only)`,
          instanceName: m.instanceName,
          mapping: m,
          priority: 2,
        });
        break;

      case "param-mismatch":
        // Suggest both directions
        const schemParams: Record<string, number | string> = {};
        const layoutParams: Record<string, number | string> = {};
        for (const d of m.parameterDeltas) {
          schemParams[d.param] = d.schematicValue;
          layoutParams[d.param] = d.layoutValue;
        }

        actions.push({
          type: "update-layout-params",
          description: `Push schematic params to layout for ${m.instanceName}: ${m.parameterDeltas.map((d) => `${d.param}`).join(", ")}`,
          instanceName: m.instanceName,
          mapping: m,
          suggestedParams: schemParams,
          priority: 3,
        });

        actions.push({
          type: "update-schematic-params",
          description: `Back-annotate layout params to schematic for ${m.instanceName}: ${m.parameterDeltas.map((d) => `${d.param}`).join(", ")}`,
          instanceName: m.instanceName,
          mapping: m,
          suggestedParams: layoutParams,
          priority: 4,
        });
        break;

      default:
        break;
    }

    // Check net mismatches for synced/param-mismatch devices
    if (m.status === "synced" || m.status === "param-mismatch") {
      for (const [_pin, layoutNet] of Object.entries(m.netMappings)) {
        if (!layoutNet) {
          netMismatches++;
        }
      }
    }
  }

  // Sort actions by priority
  actions.sort((a, b) => a.priority - b.priority);

  const summary: SyncSummary = {
    totalSchematicDevices: schematicSymbols.length,
    totalLayoutDevices: layoutDevices.length,
    synced: mappings.filter((m) => m.status === "synced").length,
    paramMismatches: mappings.filter((m) => m.status === "param-mismatch").length,
    missingInLayout: mappings.filter((m) => m.status === "missing-layout").length,
    missingInSchematic: mappings.filter((m) => m.status === "missing-schematic").length,
    unlinked: mappings.filter((m) => m.status === "unlinked").length,
    netMismatches,
  };

  return {
    timestamp: Date.now(),
    durationMs: performance.now() - start,
    mappings,
    actions,
    summary,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Back-Annotation Engine
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate back-annotation data from a post-layout extraction.
 * Maps extracted devices back to schematic symbols and summarizes parasitics.
 */
export function generateBackAnnotation(
  extraction: ExtractedNetlist,
): BackAnnotation[] {
  const annotations: BackAnnotation[] = [];

  for (const device of extraction.devices) {
    // Summarize parasitics connected to this device's nets
    const deviceNets = new Set(Object.values(device.terminals));
    const parasiticR: Record<string, number> = {};
    const parasiticC: Record<string, number> = {};

    for (const p of extraction.parasitics) {
      if (deviceNets.has(p.nodeA) || deviceNets.has(p.nodeB)) {
        if (p.type === "resistor") {
          const net = deviceNets.has(p.nodeA) ? p.nodeA : p.nodeB;
          parasiticR[net] = (parasiticR[net] ?? 0) + p.value;
        } else {
          const net = deviceNets.has(p.nodeA) ? p.nodeA : p.nodeB;
          parasiticC[net] = (parasiticC[net] ?? 0) + p.value * 1e15; // → fF
        }
      }
    }

    // Build per-terminal breakdown
    const perTerminal: Record<string, { resistance: number; capacitance: number }> = {};
    for (const [term, net] of Object.entries(device.terminals)) {
      perTerminal[term] = {
        resistance: parasiticR[net] ?? 0,
        capacitance: parasiticC[net] ?? 0,
      };
    }

    const totalR = Object.values(parasiticR).reduce((s, v) => s + v, 0);
    const totalC = Object.values(parasiticC).reduce((s, v) => s + v, 0);

    annotations.push({
      instanceName: device.name,
      extractedParams: { ...device.parameters },
      parasitics: { totalResistance: totalR, totalCapacitance: totalC, perTerminal },
      netConnections: { ...device.terminals },
    });
  }

  return annotations;
}

/**
 * Apply back-annotation to schematic symbols, returning updated parameter maps.
 * Does not mutate — returns the new parameter values for each symbol.
 */
export function applyBackAnnotation(
  annotations: BackAnnotation[],
  symbols: SchematicSymbol[],
): Map<string, Record<string, number | string>> {
  const updates = new Map<string, Record<string, number | string>>();

  const annotByName = new Map<string, BackAnnotation>();
  for (const a of annotations) {
    annotByName.set(a.instanceName.toUpperCase(), a);
  }

  for (const sym of symbols) {
    const annot = annotByName.get(sym.instanceName.toUpperCase());
    if (!annot) continue;

    const newParams: Record<string, number | string> = { ...sym.parameters };
    // Copy extracted geometric parameters
    for (const [key, val] of Object.entries(annot.extractedParams)) {
      if (key === "w" || key === "l" || key === "nf" || key === "mult" || key === "r" || key === "c") {
        newParams[key] = val;
      }
    }

    // Add parasitic annotation parameters (informational)
    newParams["_parasitic_R"] = Math.round(annot.parasitics.totalResistance * 1000) / 1000;
    newParams["_parasitic_C_fF"] = Math.round(annot.parasitics.totalCapacitance * 1000) / 1000;

    updates.set(sym.id, newParams);
  }

  return updates;
}

// ══════════════════════════════════════════════════════════════════════
// Forward Sync Helpers
// ══════════════════════════════════════════════════════════════════════

/** Grid pitch for auto-placement (µm) */
const PLACE_PITCH_X = 2.0;
const PLACE_PITCH_Y = 3.0;

/**
 * Generate layout placement suggestions for schematic symbols
 * that don't yet have layout counterparts.
 */
export function suggestLayoutPlacements(
  missingMappings: SyncMapping[],
  existingGeometries: CanvasGeometry[],
): Array<{
  instanceName: string;
  schematicId: string;
  suggestedPosition: { x: number; y: number };
  deviceType: string;
}> {
  // Find the bounding box of existing layout
  let maxX = 0;
  let maxY = 0;
  for (const g of existingGeometries) {
    for (const p of g.points) {
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  // Place new devices in a row to the right of existing layout
  const suggestions: Array<{
    instanceName: string;
    schematicId: string;
    suggestedPosition: { x: number; y: number };
    deviceType: string;
  }> = [];

  let col = 0;
  for (const m of missingMappings) {
    suggestions.push({
      instanceName: m.instanceName,
      schematicId: m.schematicId,
      suggestedPosition: {
        x: maxX + PLACE_PITCH_X * (col + 1),
        y: PLACE_PITCH_Y,
      },
      deviceType: "", // Will be filled by consumer from schematic symbol
    });
    col++;
  }

  return suggestions;
}

// ══════════════════════════════════════════════════════════════════════
// LVS-driven Sync Update
// ══════════════════════════════════════════════════════════════════════

/**
 * Use an LVS result to update sync mappings with more accurate matching.
 * LVS provides connectivity-based matching which is superior to name-only.
 */
export function refineMappingsFromLvs(
  existingMappings: SyncMapping[],
  lvsResult: LvsResult,
): SyncMapping[] {
  const refined = [...existingMappings];

  for (const dm of lvsResult.deviceMatches) {
    if (dm.status === "match" || dm.status === "mismatch") {
      const layoutName = dm.layoutDevice?.name?.toUpperCase();
      const schemName = dm.schematicDevice?.name?.toUpperCase();
      if (!layoutName || !schemName) continue;

      // Find existing mapping and update
      const idx = refined.findIndex(
        (m) => m.instanceName.toUpperCase() === schemName || m.instanceName.toUpperCase() === layoutName,
      );
      if (idx >= 0) {
        refined[idx] = {
          ...refined[idx],
          layoutGeometryIndices: dm.geometryIndices,
          status: dm.status === "match" ? "synced" : "param-mismatch",
          parameterDeltas: dm.parameterDiffs
            .filter((p) => !p.withinTolerance)
            .map((p) => ({
              param: p.parameter,
              schematicValue: p.schematicValue ?? "missing",
              layoutValue: p.layoutValue ?? "missing",
              percentDiff: p.schematicValue && p.layoutValue
                ? Math.round((Math.abs(p.schematicValue - p.layoutValue) / Math.max(Math.abs(p.schematicValue), 1e-18)) * 10000) / 100
                : undefined,
            })),
        };
      }
    }
  }

  return refined;
}

// ══════════════════════════════════════════════════════════════════════
// Demo / Testing
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate a demo sync report for UI testing.
 */
export function generateDemoSyncReport(): SyncReport {
  const demoSymbols: SchematicSymbol[] = [
    {
      kind: "symbol", id: "s1", instanceName: "M0",
      deviceType: "nmos", position: { x: 100, y: 100 }, rotation: 0, mirror: false,
      pins: [
        { id: "p1", name: "D", position: { x: 0, y: -1 }, direction: "top", type: "inout", netName: "OUT" },
        { id: "p2", name: "G", position: { x: -1, y: 0 }, direction: "left", type: "input", netName: "IN" },
        { id: "p3", name: "S", position: { x: 0, y: 1 }, direction: "bottom", type: "inout", netName: "VSS" },
        { id: "p4", name: "B", position: { x: 1, y: 0 }, direction: "right", type: "inout", netName: "VSS" },
      ],
      parameters: { w: 0.42, l: 0.15, nf: 1 },
      layoutGeometryIndices: [0, 1],
    },
    {
      kind: "symbol", id: "s2", instanceName: "M1",
      deviceType: "pmos", position: { x: 100, y: 200 }, rotation: 0, mirror: false,
      pins: [
        { id: "p5", name: "D", position: { x: 0, y: -1 }, direction: "top", type: "inout", netName: "OUT" },
        { id: "p6", name: "G", position: { x: -1, y: 0 }, direction: "left", type: "input", netName: "IN" },
        { id: "p7", name: "S", position: { x: 0, y: 1 }, direction: "bottom", type: "inout", netName: "VDD" },
        { id: "p8", name: "B", position: { x: 1, y: 0 }, direction: "right", type: "inout", netName: "VDD" },
      ],
      parameters: { w: 0.84, l: 0.15, nf: 1 },
      layoutGeometryIndices: [2, 3],
    },
    {
      kind: "symbol", id: "s3", instanceName: "R0",
      deviceType: "resistor", position: { x: 200, y: 100 }, rotation: 0, mirror: false,
      pins: [
        { id: "p9", name: "A", position: { x: 0, y: -1 }, direction: "top", type: "passive", netName: "OUT" },
        { id: "p10", name: "B", position: { x: 0, y: 1 }, direction: "bottom", type: "passive", netName: "net1" },
      ],
      parameters: { r: 1000, w: 0.35 },
      layoutGeometryIndices: [],
    },
  ];

  const demoLayoutDevices: NetlistDevice[] = [
    {
      name: "M0", type: "nmos", model: "sky130_fd_pr__nfet_01v8",
      terminals: { drain: "OUT", gate: "IN", source: "VSS", body: "VSS" },
      parameters: { w: 0.42, l: 0.15, nf: 1 },
      geometryIndices: [0, 1],
    },
    {
      name: "M1", type: "pmos", model: "sky130_fd_pr__pfet_01v8",
      terminals: { drain: "OUT", gate: "IN", source: "VDD", body: "VDD" },
      parameters: { w: 0.80, l: 0.15, nf: 1 }, // Slightly off from schematic's 0.84
      geometryIndices: [2, 3],
    },
    // R0 missing from layout
    // Extra device in layout
    {
      name: "M2", type: "nmos", model: "sky130_fd_pr__nfet_01v8",
      terminals: { drain: "net2", gate: "ctrl", source: "VSS", body: "VSS" },
      parameters: { w: 0.42, l: 0.15, nf: 1 },
      geometryIndices: [4, 5],
    },
  ];

  return generateSyncReport(demoSymbols, demoLayoutDevices, []);
}
