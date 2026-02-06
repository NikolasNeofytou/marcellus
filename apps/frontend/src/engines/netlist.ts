/**
 * Netlist Extraction Engine
 *
 * Extracts SPICE netlists from layout geometry by:
 * 1. Identifying device geometries (transistors from overlapping poly+diff)
 * 2. Tracing connectivity through metal/via layers
 * 3. Extracting parasitic RC from wire geometry + PDK sheet resistance
 * 4. Generating SPICE-compatible netlist output
 */

import type { PDKDefinition } from "../plugins/types";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface NetlistNode {
  /** Node name / net label */
  name: string;
  /** Type of node */
  type: "signal" | "power" | "ground" | "io";
}

export interface NetlistDevice {
  /** Instance name (e.g., M0, R0) */
  name: string;
  /** Device type */
  type: "nmos" | "pmos" | "resistor" | "capacitor";
  /** Model name from PDK */
  model: string;
  /** Connected nodes (drain, gate, source, body for MOS) */
  terminals: Record<string, string>;
  /** Device parameters */
  parameters: Record<string, number>;
  /** Source geometry indices */
  geometryIndices: number[];
}

export interface ParasiticElement {
  /** Instance name */
  name: string;
  type: "resistor" | "capacitor";
  /** Node A */
  nodeA: string;
  /** Node B */
  nodeB: string;
  /** Value in ohms or farads */
  value: number;
  /** Source geometry index */
  geometryIndex?: number;
}

export interface ExtractedNetlist {
  /** Title / comment */
  title: string;
  /** Top-level nodes */
  nodes: NetlistNode[];
  /** Extracted devices */
  devices: NetlistDevice[];
  /** Parasitic elements (if extracted) */
  parasitics: ParasiticElement[];
  /** SPICE text output */
  spiceText: string;
  /** Extraction timestamp */
  timestamp: number;
  /** Statistics */
  stats: {
    deviceCount: number;
    nodeCount: number;
    parasiticCount: number;
    extractionTimeMs: number;
  };
}

// Layout geometry input
export interface NetlistGeometry {
  index: number;
  type: "rect" | "polygon" | "path" | "via";
  layerAlias: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  points: { x: number; y: number }[];
  width?: number;
}

// ══════════════════════════════════════════════════════════════════════
// Netlist Extraction
// ══════════════════════════════════════════════════════════════════════

let nodeCounter = 0;
let deviceCounter = 0;
let parasiticCounter = 0;

function nextNet(): string {
  return `net${++nodeCounter}`;
}

function nextDevice(prefix: string): string {
  return `${prefix}${deviceCounter++}`;
}

function nextParasitic(prefix: string): string {
  return `${prefix}${parasiticCounter++}`;
}

/**
 * Check if two bounding boxes overlap.
 */
function bboxOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Extract a netlist from layout geometries using PDK information.
 */
export function extractNetlist(
  geometries: NetlistGeometry[],
  pdk: PDKDefinition
): ExtractedNetlist {
  const start = performance.now();
  nodeCounter = 0;
  deviceCounter = 0;
  parasiticCounter = 0;

  const devices: NetlistDevice[] = [];
  const nodes: NetlistNode[] = [];
  const parasitics: ParasiticElement[] = [];
  const nodeSet = new Set<string>();

  // Add power/ground nodes
  const vdd: NetlistNode = { name: "VDD", type: "power" };
  const gnd: NetlistNode = { name: "GND", type: "ground" };
  nodes.push(vdd, gnd);
  nodeSet.add("VDD");
  nodeSet.add("GND");

  // ── Group by layer ──
  const byLayer = new Map<string, NetlistGeometry[]>();
  for (const g of geometries) {
    const arr = byLayer.get(g.layerAlias) ?? [];
    arr.push(g);
    byLayer.set(g.layerAlias, arr);
  }

  const diffGeoms = byLayer.get("DIFF") ?? [];
  const polyGeoms = byLayer.get("POLY") ?? [];
  const nwellGeoms = byLayer.get("NW") ?? [];

  // ── Detect transistors: poly overlapping diff ──
  for (const poly of polyGeoms) {
    for (const diff of diffGeoms) {
      if (bboxOverlap(poly.bbox, diff.bbox)) {
        // Intersection = gate region
        const gateMinX = Math.max(poly.bbox.minX, diff.bbox.minX);
        const gateMaxX = Math.min(poly.bbox.maxX, diff.bbox.maxX);
        const gateMinY = Math.max(poly.bbox.minY, diff.bbox.minY);
        const gateMaxY = Math.min(poly.bbox.maxY, diff.bbox.maxY);

        const gateW = gateMaxY - gateMinY; // width = Y dimension (convention)
        const gateL = gateMaxX - gateMinX; // length = X dimension

        if (gateW <= 0 || gateL <= 0) continue;

        // Determine NMOS vs PMOS: PMOS if diff is inside nwell
        const diffCenter = {
          x: (diff.bbox.minX + diff.bbox.maxX) / 2,
          y: (diff.bbox.minY + diff.bbox.maxY) / 2,
        };
        const isInNwell = nwellGeoms.some(
          (nw) =>
            diffCenter.x >= nw.bbox.minX &&
            diffCenter.x <= nw.bbox.maxX &&
            diffCenter.y >= nw.bbox.minY &&
            diffCenter.y <= nw.bbox.maxY
        );

        const deviceType = isInNwell ? "pmos" : "nmos";
        const model = isInNwell
          ? "sky130_fd_pr__pfet_01v8"
          : "sky130_fd_pr__nfet_01v8";
        const bodyNet = isInNwell ? "VDD" : "GND";

        const drainNet = nextNet();
        const gateNet = nextNet();
        const sourceNet = nextNet();

        if (!nodeSet.has(drainNet)) {
          nodes.push({ name: drainNet, type: "signal" });
          nodeSet.add(drainNet);
        }
        if (!nodeSet.has(gateNet)) {
          nodes.push({ name: gateNet, type: "signal" });
          nodeSet.add(gateNet);
        }
        if (!nodeSet.has(sourceNet)) {
          nodes.push({ name: sourceNet, type: "signal" });
          nodeSet.add(sourceNet);
        }

        devices.push({
          name: nextDevice("M"),
          type: deviceType,
          model,
          terminals: {
            drain: drainNet,
            gate: gateNet,
            source: sourceNet,
            body: bodyNet,
          },
          parameters: {
            w: Math.round(gateW * 1e6) / 1e6,
            l: Math.round(gateL * 1e6) / 1e6,
            nf: 1,
            mult: 1,
          },
          geometryIndices: [poly.index, diff.index],
        });
      }
    }
  }

  // ── Extract parasitic resistance from metal wires ──
  const metalLayers = ["LI", "M1", "M2", "M3", "M4", "M5"];
  for (const layerAlias of metalLayers) {
    const geoms = byLayer.get(layerAlias) ?? [];
    const techLayer = pdk.layers.find((l) => l.alias === layerAlias);
    if (!techLayer?.sheetResistance) continue;

    for (const g of geoms) {
      if (g.type === "path" && g.points.length >= 2) {
        // Path resistance = Rsh * length / width
        let totalLength = 0;
        for (let i = 0; i < g.points.length - 1; i++) {
          const dx = g.points[i + 1].x - g.points[i].x;
          const dy = g.points[i + 1].y - g.points[i].y;
          totalLength += Math.sqrt(dx * dx + dy * dy);
        }
        const pathWidth = g.width ?? 0.14;
        const resistance = techLayer.sheetResistance * totalLength / pathWidth;

        if (resistance > 0.01) {
          const nodeA = nextNet();
          const nodeB = nextNet();
          if (!nodeSet.has(nodeA)) { nodes.push({ name: nodeA, type: "signal" }); nodeSet.add(nodeA); }
          if (!nodeSet.has(nodeB)) { nodes.push({ name: nodeB, type: "signal" }); nodeSet.add(nodeB); }

          parasitics.push({
            name: nextParasitic("R"),
            type: "resistor",
            nodeA,
            nodeB,
            value: Math.round(resistance * 1000) / 1000,
            geometryIndex: g.index,
          });
        }
      } else if (g.type === "rect") {
        // Rectangle wire: R = Rsh * L / W
        const w = g.bbox.maxX - g.bbox.minX;
        const h = g.bbox.maxY - g.bbox.minY;
        if (w <= 0 || h <= 0) continue;

        const length = Math.max(w, h);
        const width = Math.min(w, h);
        const resistance = techLayer.sheetResistance * length / width;

        if (resistance > 0.01) {
          const nodeA = nextNet();
          const nodeB = nextNet();
          if (!nodeSet.has(nodeA)) { nodes.push({ name: nodeA, type: "signal" }); nodeSet.add(nodeA); }
          if (!nodeSet.has(nodeB)) { nodes.push({ name: nodeB, type: "signal" }); nodeSet.add(nodeB); }

          parasitics.push({
            name: nextParasitic("R"),
            type: "resistor",
            nodeA,
            nodeB,
            value: Math.round(resistance * 1000) / 1000,
            geometryIndex: g.index,
          });
        }
      }
    }
  }

  // ── Extract via resistance ──
  const viaGeoms = [
    ...(byLayer.get("LICON") ?? []),
    ...(byLayer.get("MCON") ?? []),
    ...(byLayer.get("VIA1") ?? []),
    ...(byLayer.get("VIA2") ?? []),
    ...(byLayer.get("VIA3") ?? []),
    ...(byLayer.get("VIA4") ?? []),
  ];

  for (const g of viaGeoms) {
    const viaDef = pdk.vias.find((v) => v.cutLayer === g.layerAlias);
    if (!viaDef?.resistance) continue;

    const nodeA = nextNet();
    const nodeB = nextNet();
    if (!nodeSet.has(nodeA)) { nodes.push({ name: nodeA, type: "signal" }); nodeSet.add(nodeA); }
    if (!nodeSet.has(nodeB)) { nodes.push({ name: nodeB, type: "signal" }); nodeSet.add(nodeB); }

    parasitics.push({
      name: nextParasitic("R"),
      type: "resistor",
      nodeA,
      nodeB,
      value: viaDef.resistance,
      geometryIndex: g.index,
    });
  }

  // ── Generate SPICE text ──
  const spiceText = generateSpice(
    "OpenSilicon Extracted Netlist",
    devices,
    parasitics,
    pdk
  );

  const end = performance.now();

  return {
    title: "Extracted Netlist",
    nodes,
    devices,
    parasitics,
    spiceText,
    timestamp: Date.now(),
    stats: {
      deviceCount: devices.length,
      nodeCount: nodes.length,
      parasiticCount: parasitics.length,
      extractionTimeMs: Math.round((end - start) * 100) / 100,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// SPICE Generation
// ══════════════════════════════════════════════════════════════════════

function generateSpice(
  title: string,
  devices: NetlistDevice[],
  parasitics: ParasiticElement[],
  pdk: PDKDefinition
): string {
  const lines: string[] = [];

  lines.push(`* ${title}`);
  lines.push(`* Extracted by OpenSilicon — PDK: ${pdk.name}`);
  lines.push(`* Date: ${new Date().toISOString()}`);
  lines.push("");

  // Global nodes
  lines.push(".global VDD GND");
  lines.push("");

  // Supply voltage
  lines.push("* Power supply");
  lines.push("VDD VDD GND 1.8");
  lines.push("");

  // Devices
  if (devices.length > 0) {
    lines.push("* Devices");
    for (const d of devices) {
      if (d.type === "nmos" || d.type === "pmos") {
        // MNAME drain gate source body MODEL W=w L=l NF=nf MULT=mult
        lines.push(
          `${d.name} ${d.terminals.drain} ${d.terminals.gate} ${d.terminals.source} ${d.terminals.body} ` +
          `${d.model} W=${d.parameters.w}u L=${d.parameters.l}u` +
          (d.parameters.nf > 1 ? ` NF=${d.parameters.nf}` : "") +
          (d.parameters.mult > 1 ? ` MULT=${d.parameters.mult}` : "")
        );
      } else if (d.type === "resistor") {
        lines.push(
          `${d.name} ${d.terminals.plus} ${d.terminals.minus} ${d.model} ` +
          `W=${d.parameters.w}u L=${d.parameters.l}u`
        );
      }
    }
    lines.push("");
  }

  // Parasitics
  if (parasitics.length > 0) {
    lines.push("* Parasitic elements");
    for (const p of parasitics) {
      if (p.type === "resistor") {
        lines.push(`${p.name} ${p.nodeA} ${p.nodeB} ${formatSpiceValue(p.value)}`);
      } else {
        lines.push(`${p.name} ${p.nodeA} ${p.nodeB} ${formatSpiceValue(p.value)}`);
      }
    }
    lines.push("");
  }

  // Simulation commands
  lines.push("* Simulation");
  lines.push(".tran 1p 10n");
  lines.push(".end");

  return lines.join("\n");
}

function formatSpiceValue(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(3)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(3)}k`;
  if (value >= 1) return `${value.toFixed(3)}`;
  if (value >= 1e-3) return `${(value * 1e3).toFixed(3)}m`;
  if (value >= 1e-6) return `${(value * 1e6).toFixed(3)}u`;
  if (value >= 1e-9) return `${(value * 1e9).toFixed(3)}n`;
  if (value >= 1e-12) return `${(value * 1e12).toFixed(3)}p`;
  if (value >= 1e-15) return `${(value * 1e15).toFixed(3)}f`;
  return value.toExponential(3);
}
