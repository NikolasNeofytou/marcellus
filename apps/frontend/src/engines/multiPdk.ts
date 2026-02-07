/**
 * Multi-PDK Engine — Sprint 27-28
 *
 * GF180MCU and IHP SG13G2 PDK definitions, plus a process migration
 * assistant for converting designs between PDKs.
 */

import type {
  PDKDefinition,
  TechLayer,
  ViaDefinition,
  DesignRule,
  DeviceGeneratorDef,
} from "../plugins/types";
import type { CanvasGeometry } from "../stores/geometryStore";

// ══════════════════════════════════════════════════════════════════════
// GF180MCU PDK
// ══════════════════════════════════════════════════════════════════════

const gf180Layers: TechLayer[] = [
  { gdsLayer: 22, gdsDatatype: 0, name: "nwell.drawing",   alias: "NW",   purpose: "drawing", material: "well",      color: "#a04040", fillPattern: "hatch", defaultVisible: true, sheetResistance: 900 },
  { gdsLayer: 33, gdsDatatype: 0, name: "pplus.drawing",   alias: "PP",   purpose: "drawing", material: "implant",   color: "#ff8888", fillPattern: "dots",  defaultVisible: true },
  { gdsLayer: 32, gdsDatatype: 0, name: "nplus.drawing",   alias: "NP",   purpose: "drawing", material: "implant",   color: "#8888ff", fillPattern: "dots",  defaultVisible: true },
  { gdsLayer: 30, gdsDatatype: 0, name: "diff.drawing",    alias: "DIFF", purpose: "drawing", material: "diffusion", color: "#40c040", fillPattern: "solid", defaultVisible: true, sheetResistance: 150 },
  { gdsLayer: 34, gdsDatatype: 0, name: "poly.drawing",    alias: "POLY", purpose: "drawing", material: "poly",      color: "#cc4444", fillPattern: "solid", defaultVisible: true, sheetResistance: 40, thickness: 0.18, height: 0 },
  { gdsLayer: 35, gdsDatatype: 0, name: "contact.drawing", alias: "CONT", purpose: "drawing", material: "cut",       color: "#808080", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 36, gdsDatatype: 0, name: "met1.drawing",    alias: "M1",   purpose: "drawing", material: "metal",     color: "#4488cc", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.105, thickness: 0.36, height: 0.55 },
  { gdsLayer: 51, gdsDatatype: 0, name: "via1.drawing",    alias: "V1",   purpose: "drawing", material: "cut",       color: "#666666", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 38, gdsDatatype: 0, name: "met2.drawing",    alias: "M2",   purpose: "drawing", material: "metal",     color: "#448844", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.105, thickness: 0.36, height: 1.28 },
  { gdsLayer: 40, gdsDatatype: 0, name: "via2.drawing",    alias: "V2",   purpose: "drawing", material: "cut",       color: "#777777", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 42, gdsDatatype: 0, name: "met3.drawing",    alias: "M3",   purpose: "drawing", material: "metal",     color: "#cc44cc", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.105, thickness: 0.36, height: 2.01 },
  { gdsLayer: 46, gdsDatatype: 0, name: "via3.drawing",    alias: "V3",   purpose: "drawing", material: "cut",       color: "#888888", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 48, gdsDatatype: 0, name: "met4.drawing",    alias: "M4",   purpose: "drawing", material: "metal",     color: "#cc8844", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.047, thickness: 0.90, height: 2.74 },
  { gdsLayer: 50, gdsDatatype: 0, name: "via4.drawing",    alias: "V4",   purpose: "drawing", material: "cut",       color: "#999999", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 53, gdsDatatype: 0, name: "met5.drawing",    alias: "M5",   purpose: "drawing", material: "metal",     color: "#cccc44", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.029, thickness: 1.60, height: 4.01 },
];

const gf180Vias: ViaDefinition[] = [
  { name: "CONT", bottomLayer: "poly.drawing", topLayer: "met1.drawing", cutLayer: "contact.drawing", width: 0.22, height: 0.22, spacing: 0.25, bottomEnclosure: 0.07, topEnclosure: 0.06 },
  { name: "VIA1", bottomLayer: "met1.drawing", topLayer: "met2.drawing", cutLayer: "via1.drawing", width: 0.26, height: 0.26, spacing: 0.26, bottomEnclosure: 0.06, topEnclosure: 0.06 },
  { name: "VIA2", bottomLayer: "met2.drawing", topLayer: "met3.drawing", cutLayer: "via2.drawing", width: 0.26, height: 0.26, spacing: 0.26, bottomEnclosure: 0.06, topEnclosure: 0.06 },
  { name: "VIA3", bottomLayer: "met3.drawing", topLayer: "met4.drawing", cutLayer: "via3.drawing", width: 0.26, height: 0.26, spacing: 0.26, bottomEnclosure: 0.06, topEnclosure: 0.12 },
  { name: "VIA4", bottomLayer: "met4.drawing", topLayer: "met5.drawing", cutLayer: "via4.drawing", width: 0.26, height: 0.26, spacing: 0.26, bottomEnclosure: 0.12, topEnclosure: 0.12 },
];

const gf180Rules: DesignRule[] = [
  { id: "MET1.W.1",  layers: ["met1.drawing"], type: "min_width",   value: 0.23, description: "Met1 minimum width", severity: "error", enabled: true },
  { id: "MET1.S.1",  layers: ["met1.drawing"], type: "min_spacing", value: 0.23, description: "Met1 minimum spacing", severity: "error", enabled: true },
  { id: "MET2.W.1",  layers: ["met2.drawing"], type: "min_width",   value: 0.28, description: "Met2 minimum width", severity: "error", enabled: true },
  { id: "MET2.S.1",  layers: ["met2.drawing"], type: "min_spacing", value: 0.28, description: "Met2 minimum spacing", severity: "error", enabled: true },
  { id: "POLY.W.1",  layers: ["poly.drawing"], type: "min_width",   value: 0.18, description: "Poly minimum width", severity: "error", enabled: true },
  { id: "POLY.S.1",  layers: ["poly.drawing"], type: "min_spacing", value: 0.24, description: "Poly minimum spacing", severity: "error", enabled: true },
  { id: "DIFF.W.1",  layers: ["diff.drawing"], type: "min_width",   value: 0.22, description: "Diffusion minimum width", severity: "error", enabled: true },
  { id: "CONT.W.1",  layers: ["contact.drawing"], type: "min_width",value: 0.22, description: "Contact minimum width", severity: "error", enabled: true },
  { id: "MET3.W.1",  layers: ["met3.drawing"], type: "min_width",   value: 0.28, description: "Met3 minimum width", severity: "error", enabled: true },
  { id: "MET4.W.1",  layers: ["met4.drawing"], type: "min_width",   value: 0.28, description: "Met4 minimum width", severity: "error", enabled: true },
];

const gf180DeviceGenerators: DeviceGeneratorDef[] = [
  {
    name: "NMOS 3.3V",
    deviceType: "nmos",
    description: "3.3V NMOS transistor (thick oxide)",
    parameters: [
      { name: "W", label: "Width (µm)", type: "number", default: 0.5, min: 0.22, max: 100 },
      { name: "L", label: "Length (µm)", type: "number", default: 0.28, min: 0.28, max: 100 },
      { name: "nf", label: "Fingers", type: "number", default: 1, min: 1, max: 128 },
    ],
  },
  {
    name: "PMOS 3.3V",
    deviceType: "pmos",
    description: "3.3V PMOS transistor (thick oxide)",
    parameters: [
      { name: "W", label: "Width (µm)", type: "number", default: 0.5, min: 0.22, max: 100 },
      { name: "L", label: "Length (µm)", type: "number", default: 0.28, min: 0.28, max: 100 },
      { name: "nf", label: "Fingers", type: "number", default: 1, min: 1, max: 128 },
    ],
  },
  {
    name: "MIM Capacitor",
    deviceType: "capacitor",
    description: "Metal-Insulator-Metal capacitor",
    parameters: [
      { name: "W", label: "Width (µm)", type: "number", default: 5, min: 2, max: 100 },
      { name: "L", label: "Length (µm)", type: "number", default: 5, min: 2, max: 100 },
    ],
  },
];

export const GF180MCU_PDK: PDKDefinition = {
  name: "GF180MCU",
  foundry: "GlobalFoundries",
  node: "180nm",
  metalLayers: 5,
  dbuPerMicron: 1000,
  manufacturingGrid: 0.005,
  layers: gf180Layers,
  vias: gf180Vias,
  designRules: gf180Rules,
};

// ══════════════════════════════════════════════════════════════════════
// IHP SG13G2 PDK
// ══════════════════════════════════════════════════════════════════════

const ihpLayers: TechLayer[] = [
  { gdsLayer: 1,  gdsDatatype: 0, name: "activ.drawing",   alias: "ACT",  purpose: "drawing", material: "diffusion", color: "#40c040", fillPattern: "solid", defaultVisible: true, sheetResistance: 100 },
  { gdsLayer: 5,  gdsDatatype: 0, name: "gatpoly.drawing", alias: "POLY", purpose: "drawing", material: "poly",    color: "#cc4444", fillPattern: "solid", defaultVisible: true, sheetResistance: 25, thickness: 0.16, height: 0 },
  { gdsLayer: 6,  gdsDatatype: 0, name: "nsd.drawing",     alias: "NSD",  purpose: "drawing", material: "implant", color: "#8888ff", fillPattern: "dots",  defaultVisible: true },
  { gdsLayer: 31, gdsDatatype: 0, name: "psd.drawing",     alias: "PSD",  purpose: "drawing", material: "implant", color: "#ff8888", fillPattern: "dots",  defaultVisible: true },
  { gdsLayer: 19, gdsDatatype: 0, name: "cont.drawing",    alias: "CONT", purpose: "drawing", material: "cut",     color: "#808080", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 8,  gdsDatatype: 0, name: "metal1.drawing",  alias: "M1",   purpose: "drawing", material: "metal",   color: "#4488cc", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.070, thickness: 0.42, height: 0.45 },
  { gdsLayer: 19, gdsDatatype: 1, name: "via1.drawing",    alias: "V1",   purpose: "drawing", material: "cut",     color: "#666666", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 10, gdsDatatype: 0, name: "metal2.drawing",  alias: "M2",   purpose: "drawing", material: "metal",   color: "#448844", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.070, thickness: 0.42, height: 1.39 },
  { gdsLayer: 30, gdsDatatype: 0, name: "via2.drawing",    alias: "V2",   purpose: "drawing", material: "cut",     color: "#777777", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 11, gdsDatatype: 0, name: "metal3.drawing",  alias: "M3",   purpose: "drawing", material: "metal",   color: "#cc44cc", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.070, thickness: 0.42, height: 2.33 },
  { gdsLayer: 25, gdsDatatype: 0, name: "via3.drawing",    alias: "V3",   purpose: "drawing", material: "cut",     color: "#888888", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 12, gdsDatatype: 0, name: "metal4.drawing",  alias: "M4",   purpose: "drawing", material: "metal",   color: "#cc8844", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.070, thickness: 0.42, height: 3.27 },
  { gdsLayer: 26, gdsDatatype: 0, name: "via4.drawing",    alias: "V4",   purpose: "drawing", material: "cut",     color: "#999999", fillPattern: "cross", defaultVisible: true },
  { gdsLayer: 13, gdsDatatype: 0, name: "metal5.drawing",  alias: "M5",   purpose: "drawing", material: "metal",   color: "#cccc44", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.014, thickness: 2.00, height: 4.21 },
  { gdsLayer: 50, gdsDatatype: 0, name: "topmetal1.drawing", alias: "TM1",purpose: "drawing", material: "metal",   color: "#ddaa22", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.007, thickness: 3.00, height: 7.21 },
  { gdsLayer: 51, gdsDatatype: 0, name: "topmetal2.drawing", alias: "TM2",purpose: "drawing", material: "metal",   color: "#eecc33", fillPattern: "solid", defaultVisible: true, sheetResistance: 0.003, thickness: 3.00, height: 10.81 },
];

const ihpVias: ViaDefinition[] = [
  { name: "CONT", bottomLayer: "gatpoly.drawing", topLayer: "metal1.drawing", cutLayer: "cont.drawing", width: 0.16, height: 0.16, spacing: 0.20, bottomEnclosure: 0.04, topEnclosure: 0.04 },
  { name: "VIA1", bottomLayer: "metal1.drawing",  topLayer: "metal2.drawing", cutLayer: "via1.drawing", width: 0.20, height: 0.20, spacing: 0.22, bottomEnclosure: 0.04, topEnclosure: 0.04 },
  { name: "VIA2", bottomLayer: "metal2.drawing",  topLayer: "metal3.drawing", cutLayer: "via2.drawing", width: 0.20, height: 0.20, spacing: 0.22, bottomEnclosure: 0.04, topEnclosure: 0.04 },
  { name: "VIA3", bottomLayer: "metal3.drawing",  topLayer: "metal4.drawing", cutLayer: "via3.drawing", width: 0.20, height: 0.20, spacing: 0.22, bottomEnclosure: 0.04, topEnclosure: 0.04 },
  { name: "VIA4", bottomLayer: "metal4.drawing",  topLayer: "metal5.drawing", cutLayer: "via4.drawing", width: 0.20, height: 0.20, spacing: 0.22, bottomEnclosure: 0.04, topEnclosure: 0.10 },
];

const ihpRules: DesignRule[] = [
  { id: "M1.W",  layers: ["metal1.drawing"],  type: "min_width",   value: 0.16, description: "Metal1 minimum width", severity: "error", enabled: true },
  { id: "M1.S",  layers: ["metal1.drawing"],  type: "min_spacing", value: 0.18, description: "Metal1 minimum spacing", severity: "error", enabled: true },
  { id: "M2.W",  layers: ["metal2.drawing"],  type: "min_width",   value: 0.20, description: "Metal2 minimum width", severity: "error", enabled: true },
  { id: "M2.S",  layers: ["metal2.drawing"],  type: "min_spacing", value: 0.21, description: "Metal2 minimum spacing", severity: "error", enabled: true },
  { id: "GP.W",  layers: ["gatpoly.drawing"], type: "min_width",   value: 0.13, description: "Gate poly minimum width", severity: "error", enabled: true },
  { id: "GP.S",  layers: ["gatpoly.drawing"], type: "min_spacing", value: 0.18, description: "Gate poly minimum spacing", severity: "error", enabled: true },
  { id: "ACT.W", layers: ["activ.drawing"],   type: "min_width",   value: 0.15, description: "Active minimum width", severity: "error", enabled: true },
  { id: "TM1.W", layers: ["topmetal1.drawing"], type: "min_width", value: 1.80, description: "TopMetal1 minimum width", severity: "error", enabled: true },
  { id: "TM2.W", layers: ["topmetal2.drawing"], type: "min_width", value: 2.80, description: "TopMetal2 minimum width", severity: "error", enabled: true },
];

const ihpDeviceGenerators: DeviceGeneratorDef[] = [
  {
    name: "SG13G2 NMOS",
    deviceType: "nmos",
    description: "130nm NMOS transistor",
    parameters: [
      { name: "W", label: "Width (µm)", type: "number", default: 0.35, min: 0.15, max: 50 },
      { name: "L", label: "Length (µm)", type: "number", default: 0.13, min: 0.13, max: 50 },
      { name: "nf", label: "Fingers", type: "number", default: 1, min: 1, max: 128 },
    ],
  },
  {
    name: "SG13G2 PMOS",
    deviceType: "pmos",
    description: "130nm PMOS transistor",
    parameters: [
      { name: "W", label: "Width (µm)", type: "number", default: 0.35, min: 0.15, max: 50 },
      { name: "L", label: "Length (µm)", type: "number", default: 0.13, min: 0.13, max: 50 },
      { name: "nf", label: "Fingers", type: "number", default: 1, min: 1, max: 128 },
    ],
  },
  {
    name: "SG13G2 SiGe HBT",
    deviceType: "bipolar",
    description: "SiGe HBT NPN bipolar transistor (fT > 350 GHz)",
    parameters: [
      { name: "W", label: "Emitter Width (µm)", type: "number", default: 0.07, min: 0.07, max: 0.5 },
      { name: "L", label: "Emitter Length (µm)", type: "number", default: 0.9, min: 0.5, max: 5 },
    ],
  },
];

export const IHP_SG13G2_PDK: PDKDefinition = {
  name: "IHP SG13G2",
  foundry: "IHP Microelectronics",
  node: "130nm BiCMOS",
  metalLayers: 7,
  dbuPerMicron: 1000,
  manufacturingGrid: 0.005,
  layers: ihpLayers,
  vias: ihpVias,
  designRules: ihpRules,
};

// ══════════════════════════════════════════════════════════════════════
// Process Migration Assistant
// ══════════════════════════════════════════════════════════════════════

export interface LayerMapping {
  sourceLayer: string;
  targetLayer: string | null;
  confidence: "high" | "medium" | "low" | "unmapped";
  notes?: string;
}

export interface MigrationReport {
  sourcePdk: string;
  targetPdk: string;
  layerMappings: LayerMapping[];
  ruleViolations: MigrationRuleViolation[];
  geometryChanges: number;
  warnings: string[];
  status: "ready" | "warnings" | "errors";
}

export interface MigrationRuleViolation {
  ruleId: string;
  description: string;
  severity: "error" | "warning" | "info";
  geometry?: CanvasGeometry;
  suggestion?: string;
}

/**
 * Automatically generate layer mappings between two PDKs
 * based on material type, purpose, and alias matching.
 */
export function generateLayerMappings(
  source: PDKDefinition,
  target: PDKDefinition,
): LayerMapping[] {
  const mappings: LayerMapping[] = [];

  for (const sl of source.layers) {
    // Try exact alias match
    let match = target.layers.find((tl) => tl.alias === sl.alias && tl.purpose === sl.purpose);
    if (match) {
      mappings.push({ sourceLayer: sl.name, targetLayer: match.name, confidence: "high" });
      continue;
    }

    // Try material + purpose match
    match = target.layers.find((tl) => tl.material === sl.material && tl.purpose === sl.purpose);
    if (match) {
      mappings.push({
        sourceLayer: sl.name,
        targetLayer: match.name,
        confidence: "medium",
        notes: `Matched by material (${sl.material})`,
      });
      continue;
    }

    // Try material match only
    match = target.layers.find((tl) => tl.material === sl.material);
    if (match) {
      mappings.push({
        sourceLayer: sl.name,
        targetLayer: match.name,
        confidence: "low",
        notes: `Weak match — same material but different purpose`,
      });
      continue;
    }

    mappings.push({ sourceLayer: sl.name, targetLayer: null, confidence: "unmapped", notes: "No equivalent layer found" });
  }

  return mappings;
}

/**
 * Analyse a layout for migration feasibility.
 * Checks design rules of the target PDK against existing geometries.
 */
export function analyseProcessMigration(
  geometries: CanvasGeometry[],
  source: PDKDefinition,
  target: PDKDefinition,
  layerMappings: LayerMapping[],
): MigrationReport {
  const violations: MigrationRuleViolation[] = [];
  const warnings: string[] = [];

  // Check unmapped layers
  const unmapped = layerMappings.filter((m) => m.confidence === "unmapped");
  if (unmapped.length > 0) {
    warnings.push(`${unmapped.length} source layer(s) have no mapping in ${target.name}`);
  }

  // Check minimum widths: any source geom that is narrow might violate target rules
  const targetRulesByLayer = new Map<string, DesignRule[]>();
  for (const rule of target.designRules) {
    for (const layerName of rule.layers) {
      if (!targetRulesByLayer.has(layerName)) targetRulesByLayer.set(layerName, []);
      targetRulesByLayer.get(layerName)!.push(rule);
    }
  }

  let geomChanges = 0;
  for (const geom of geometries) {
    const mapping = layerMappings.find((m) => {
      const sl = source.layers.find((l) => l.gdsLayer === geom.layerId);
      return sl && m.sourceLayer === sl.name;
    });
    if (!mapping || !mapping.targetLayer) continue;

    const rules = targetRulesByLayer.get(mapping.targetLayer) || [];
    for (const rule of rules) {
      if (rule.type === "min_width") {
        const w = geomWidth(geom);
        if (w < rule.value) {
          violations.push({
            ruleId: rule.id,
            description: `${rule.description} — current width ${w.toFixed(3)}µm < minimum ${rule.value}µm`,
            severity: "error",
            geometry: geom,
            suggestion: `Increase width to ≥ ${rule.value}µm`,
          });
        }
      }
    }
    geomChanges++;
  }

  // Metal layer count mismatch
  if (source.metalLayers !== target.metalLayers) {
    warnings.push(`Metal layer count differs: ${source.name} has ${source.metalLayers}, ${target.name} has ${target.metalLayers}`);
  }

  // Grid mismatch
  if (source.manufacturingGrid !== target.manufacturingGrid) {
    warnings.push(`Manufacturing grid differs: ${source.manufacturingGrid * 1000}nm → ${target.manufacturingGrid * 1000}nm. Geometries may need snapping.`);
  }

  return {
    sourcePdk: source.name,
    targetPdk: target.name,
    layerMappings,
    ruleViolations: violations,
    geometryChanges: geomChanges,
    warnings,
    status: violations.length > 0 ? "errors" : warnings.length > 0 ? "warnings" : "ready",
  };
}

function geomWidth(g: CanvasGeometry): number {
  if (g.width) return g.width;
  if (g.points.length < 2) return 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of g.points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return Math.min(maxX - minX, maxY - minY);
}

// ── Exported PDK + generators registry ────────────────────────────

export const AVAILABLE_PDKS: { pdk: PDKDefinition; generators: DeviceGeneratorDef[] }[] = [
  { pdk: GF180MCU_PDK, generators: gf180DeviceGenerators },
  { pdk: IHP_SG13G2_PDK, generators: ihpDeviceGenerators },
];
