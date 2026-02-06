/**
 * Netlist Extraction Engine
 *
 * Extracts SPICE netlists from layout geometry by:
 * 1. Identifying device geometries (transistors from overlapping poly+diff)
 * 2. Tracing connectivity through metal/via layers using Union-Find
 * 3. Extracting parasitic RC from wire geometry + PDK sheet resistance
 * 4. Parasitic capacitance from plate capacitance model (PDK layer thickness + height)
 * 5. Generating SPICE-compatible netlist output
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
// Union-Find for net connectivity
// ══════════════════════════════════════════════════════════════════════

class UnionFind {
  private parent: Map<string, string> = new Map();
  private rank: Map<string, number> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    let root = x;
    while (this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression
    let node = x;
    while (node !== root) {
      const next = this.parent.get(node)!;
      this.parent.set(node, root);
      node = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;

    const rankA = this.rank.get(rootA) ?? 0;
    const rankB = this.rank.get(rootB) ?? 0;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }

  /** Get canonical name for a net */
  resolve(x: string): string {
    return this.find(x);
  }
}

// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════

let deviceCounter = 0;
let parasiticCounter = 0;

function nextDevice(prefix: string): string {
  return `${prefix}${deviceCounter++}`;
}

function nextParasitic(prefix: string): string {
  return `${prefix}${parasiticCounter++}`;
}

function bboxOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function bboxArea(bbox: { minX: number; minY: number; maxX: number; maxY: number }): number {
  return Math.max(0, bbox.maxX - bbox.minX) * Math.max(0, bbox.maxY - bbox.minY);
}

/** Compute overlap area between two bounding boxes */
function overlapArea(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): number {
  const ox = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const oy = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  return ox * oy;
}

// Unique net ID for each geometry element
function geomNetId(g: NetlistGeometry): string {
  return `net_${g.layerAlias}_${g.index}`;
}

// ══════════════════════════════════════════════════════════════════════
// Connectivity tracing
// ══════════════════════════════════════════════════════════════════════

/** Adjacent layer pairs connected by vias/contacts */
const VIA_CONNECTIVITY: Array<{ cutLayer: string; bottom: string; top: string }> = [
  { cutLayer: "LICON", bottom: "DIFF", top: "LI" },
  { cutLayer: "LICON", bottom: "POLY", top: "LI" },
  { cutLayer: "LICON", bottom: "TAP", top: "LI" },
  { cutLayer: "MCON", bottom: "LI", top: "M1" },
  { cutLayer: "VIA1", bottom: "M1", top: "M2" },
  { cutLayer: "VIA2", bottom: "M2", top: "M3" },
  { cutLayer: "VIA3", bottom: "M3", top: "M4" },
  { cutLayer: "VIA4", bottom: "M4", top: "M5" },
];

/**
 * Build connectivity using Union-Find:
 * 1. Same-layer overlapping geometries → merge nets
 * 2. Via/contact overlapping geometries on adjacent layers → merge nets
 */
function buildConnectivity(
  geometries: NetlistGeometry[],
  byLayer: Map<string, NetlistGeometry[]>,
  _pdk: PDKDefinition,
): UnionFind {
  const uf = new UnionFind();

  // Initialise every geometry with its own net
  for (const g of geometries) {
    uf.find(geomNetId(g));
  }

  // 1. Same-layer overlap → merge
  const conductingLayers = ["DIFF", "TAP", "POLY", "LI", "M1", "M2", "M3", "M4", "M5", "NW", "PW"];
  for (const layer of conductingLayers) {
    const geoms = byLayer.get(layer) ?? [];
    for (let i = 0; i < geoms.length; i++) {
      for (let j = i + 1; j < geoms.length; j++) {
        if (bboxOverlap(geoms[i].bbox, geoms[j].bbox)) {
          uf.union(geomNetId(geoms[i]), geomNetId(geoms[j]));
        }
      }
    }
  }

  // 2. Via/contact connectivity → merge bottom and top layer geoms it touches
  for (const conn of VIA_CONNECTIVITY) {
    const cutGeoms = byLayer.get(conn.cutLayer) ?? [];
    const bottomGeoms = byLayer.get(conn.bottom) ?? [];
    const topGeoms = byLayer.get(conn.top) ?? [];

    for (const via of cutGeoms) {
      // Find bottom geoms it overlaps
      const touchedBottom: NetlistGeometry[] = [];
      const touchedTop: NetlistGeometry[] = [];

      for (const bg of bottomGeoms) {
        if (bboxOverlap(via.bbox, bg.bbox)) touchedBottom.push(bg);
      }
      for (const tg of topGeoms) {
        if (bboxOverlap(via.bbox, tg.bbox)) touchedTop.push(tg);
      }

      // Merge all touched bottom + top + via into one net
      const allTouched = [...touchedBottom, ...touchedTop, via];
      for (let i = 1; i < allTouched.length; i++) {
        uf.union(geomNetId(allTouched[0]), geomNetId(allTouched[i]));
      }
    }
  }

  return uf;
}

/**
 * Assign human-readable net names based on Union-Find groups.
 */
function assignNetNames(
  geometries: NetlistGeometry[],
  uf: UnionFind,
): Map<string, string> {
  const rootToName = new Map<string, string>();
  let netIdx = 0;

  const nameMap = new Map<string, string>();
  for (const g of geometries) {
    const root = uf.resolve(geomNetId(g));
    if (!rootToName.has(root)) {
      rootToName.set(root, `n${netIdx++}`);
    }
    nameMap.set(geomNetId(g), rootToName.get(root)!);
  }

  return nameMap;
}

// ══════════════════════════════════════════════════════════════════════
// Netlist Extraction
// ══════════════════════════════════════════════════════════════════════

/**
 * Extract a netlist from layout geometries using PDK information.
 */
export function extractNetlist(
  geometries: NetlistGeometry[],
  pdk: PDKDefinition
): ExtractedNetlist {
  const start = performance.now();
  deviceCounter = 0;
  parasiticCounter = 0;

  const devices: NetlistDevice[] = [];
  const parasitics: ParasiticElement[] = [];

  // ── Group by layer ──
  const byLayer = new Map<string, NetlistGeometry[]>();
  for (const g of geometries) {
    const arr = byLayer.get(g.layerAlias) ?? [];
    arr.push(g);
    byLayer.set(g.layerAlias, arr);
  }

  // ── Build connectivity ──
  const uf = buildConnectivity(geometries, byLayer, pdk);
  const netNames = assignNetNames(geometries, uf);

  /** Get the net name for a geometry */
  function netOf(g: NetlistGeometry): string {
    return netNames.get(geomNetId(g)) ?? `unk_${g.index}`;
  }

  const diffGeoms = byLayer.get("DIFF") ?? [];
  const polyGeoms = byLayer.get("POLY") ?? [];
  const nwellGeoms = byLayer.get("NW") ?? [];

  // ── Detect transistors: poly overlapping diff ──
  for (const poly of polyGeoms) {
    for (const diff of diffGeoms) {
      if (bboxOverlap(poly.bbox, diff.bbox)) {
        const gateMinX = Math.max(poly.bbox.minX, diff.bbox.minX);
        const gateMaxX = Math.min(poly.bbox.maxX, diff.bbox.maxX);
        const gateMinY = Math.max(poly.bbox.minY, diff.bbox.minY);
        const gateMaxY = Math.min(poly.bbox.maxY, diff.bbox.maxY);

        const gateW = gateMaxY - gateMinY;
        const gateL = gateMaxX - gateMinX;
        if (gateW <= 0 || gateL <= 0) continue;

        // Determine NMOS vs PMOS
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

        // Use connectivity-traced net names
        const drainNet = netOf(diff);
        const gateNet = netOf(poly);
        const sourceNet = netOf(diff); // Same diff net (simplified)

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
      const net = netOf(g);

      if (g.type === "path" && g.points.length >= 2) {
        let totalLength = 0;
        for (let i = 0; i < g.points.length - 1; i++) {
          const dx = g.points[i + 1].x - g.points[i].x;
          const dy = g.points[i + 1].y - g.points[i].y;
          totalLength += Math.sqrt(dx * dx + dy * dy);
        }
        const pathWidth = g.width ?? 0.14;
        const resistance = techLayer.sheetResistance * totalLength / pathWidth;

        if (resistance > 0.01) {
          parasitics.push({
            name: nextParasitic("R"),
            type: "resistor",
            nodeA: net,
            nodeB: `${net}_end`,
            value: Math.round(resistance * 1000) / 1000,
            geometryIndex: g.index,
          });
        }
      } else if (g.type === "rect") {
        const w = g.bbox.maxX - g.bbox.minX;
        const h = g.bbox.maxY - g.bbox.minY;
        if (w <= 0 || h <= 0) continue;

        const length = Math.max(w, h);
        const width = Math.min(w, h);
        const resistance = techLayer.sheetResistance * length / width;

        if (resistance > 0.01) {
          parasitics.push({
            name: nextParasitic("R"),
            type: "resistor",
            nodeA: net,
            nodeB: `${net}_end`,
            value: Math.round(resistance * 1000) / 1000,
            geometryIndex: g.index,
          });
        }
      }
    }
  }

  // ── Extract via resistance ──
  const viaLayerNames = ["LICON", "MCON", "VIA1", "VIA2", "VIA3", "VIA4"];
  for (const layerAlias of viaLayerNames) {
    const geoms = byLayer.get(layerAlias) ?? [];
    const viaDef = pdk.vias.find((v) => v.cutLayer === layerAlias);
    if (!viaDef?.resistance) continue;

    for (const g of geoms) {
      const net = netOf(g);
      parasitics.push({
        name: nextParasitic("R"),
        type: "resistor",
        nodeA: `${net}_bot`,
        nodeB: `${net}_top`,
        value: viaDef.resistance,
        geometryIndex: g.index,
      });
    }
  }

  // ── Extract parasitic capacitance (plate model) ──
  extractParasiticCapacitance(geometries, byLayer, pdk, netNames, parasitics);

  // ── Collect unique net names as nodes ──
  const nodeSet = new Set<string>();
  nodeSet.add("VDD");
  nodeSet.add("GND");

  for (const d of devices) {
    Object.values(d.terminals).forEach((n) => nodeSet.add(n));
  }
  for (const p of parasitics) {
    nodeSet.add(p.nodeA);
    nodeSet.add(p.nodeB);
  }

  const nodes: NetlistNode[] = [
    { name: "VDD", type: "power" },
    { name: "GND", type: "ground" },
  ];
  for (const n of nodeSet) {
    if (n !== "VDD" && n !== "GND") {
      nodes.push({ name: n, type: "signal" });
    }
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
// Parasitic Capacitance Extraction
// ══════════════════════════════════════════════════════════════════════

// Permittivity of SiO2 ≈ 3.9 × ε₀
const EPSILON_0 = 8.854e-18; // F/µm (since we work in microns)
const EPSILON_OX = 3.9 * EPSILON_0;

/**
 * Extract parasitic capacitance using a plate capacitance model.
 *
 * C = ε × A / d
 *
 * Where:
 *   ε = dielectric permittivity (SiO₂)
 *   A = overlap area between conductors on adjacent layers
 *   d = vertical distance between layers (from PDK height/thickness)
 */
function extractParasiticCapacitance(
  _geometries: NetlistGeometry[],
  byLayer: Map<string, NetlistGeometry[]>,
  pdk: PDKDefinition,
  netNames: Map<string, string>,
  parasitics: ParasiticElement[]
): void {
  // Build ordered metal layer stack with height info
  const metalStack: Array<{ alias: string; height: number; thickness: number }> = [];
  for (const tl of pdk.layers) {
    if (tl.height !== undefined && tl.thickness !== undefined && tl.material === "metal") {
      metalStack.push({ alias: tl.alias, height: tl.height, thickness: tl.thickness });
    }
  }
  metalStack.sort((a, b) => a.height - b.height);

  // Also add poly and diffusion for substrate capacitance
  const substrateCapLayers = ["DIFF", "POLY", "LI"];
  for (const alias of substrateCapLayers) {
    const tl = pdk.layers.find((l) => l.alias === alias);
    if (tl?.height !== undefined && tl?.thickness !== undefined) {
      // Capacitance to substrate (ground plane at height=0)
      const geoms = byLayer.get(alias) ?? [];
      for (const g of geoms) {
        const area = bboxArea(g.bbox);
        if (area <= 0) continue;

        const dist = tl.height + tl.thickness / 2; // distance from center of layer to substrate
        if (dist <= 0) continue;

        const cap = EPSILON_OX * area / dist;
        if (cap > 1e-21) { // Only meaningful capacitances
          const net = netNames.get(geomNetId(g)) ?? `unk_${g.index}`;
          parasitics.push({
            name: nextParasitic("C"),
            type: "capacitor",
            nodeA: net,
            nodeB: "GND",
            value: cap,
            geometryIndex: g.index,
          });
        }
      }
    }
  }

  // Inter-layer capacitance between adjacent metal layers
  for (let i = 0; i < metalStack.length - 1; i++) {
    const lower = metalStack[i];
    const upper = metalStack[i + 1];
    const dist = upper.height - (lower.height + lower.thickness);
    if (dist <= 0) continue;

    const lowerGeoms = byLayer.get(lower.alias) ?? [];
    const upperGeoms = byLayer.get(upper.alias) ?? [];

    for (const lg of lowerGeoms) {
      for (const ug of upperGeoms) {
        const oArea = overlapArea(lg.bbox, ug.bbox);
        if (oArea <= 0) continue;

        const cap = EPSILON_OX * oArea / dist;
        if (cap > 1e-21) {
          const netL = netNames.get(geomNetId(lg)) ?? `unk_${lg.index}`;
          const netU = netNames.get(geomNetId(ug)) ?? `unk_${ug.index}`;

          // Only add cap if they're on different nets
          if (netL !== netU) {
            parasitics.push({
              name: nextParasitic("C"),
              type: "capacitor",
              nodeA: netL,
              nodeB: netU,
              value: cap,
              geometryIndex: lg.index,
            });
          }
        }
      }
    }
  }

  // Substrate capacitance for metal layers
  for (const ml of metalStack) {
    const geoms = byLayer.get(ml.alias) ?? [];
    const distToSub = ml.height + ml.thickness / 2;
    if (distToSub <= 0) continue;

    for (const g of geoms) {
      const area = bboxArea(g.bbox);
      if (area <= 0) continue;

      const cap = EPSILON_OX * area / distToSub;
      if (cap > 1e-21) {
        const net = netNames.get(geomNetId(g)) ?? `unk_${g.index}`;
        parasitics.push({
          name: nextParasitic("C"),
          type: "capacitor",
          nodeA: net,
          nodeB: "GND",
          value: cap,
          geometryIndex: g.index,
        });
      }
    }
  }
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
