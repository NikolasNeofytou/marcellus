/**
 * CMOS Gate Generator — produce parameterized CMOS gate schematics.
 *
 * Generates both schematic elements (symbols, wires, labels) and
 * stick-diagram layouts for standard CMOS gate cells.
 *
 * Gates: INV, NAND2-4, NOR2-4, XOR2, XNOR2, MUX2, TGATE, SR_Latch, SR_FF
 */

import type {
  SchematicElement,
  SchematicSymbol,
  SchematicPin,
  SubcircuitPort,
  SchematicPoint,
  SchematicWire,
} from "../stores/schematicStore";
import type { CanvasGeometry } from "../stores/geometryStore";

// ── Parameter types ──────────────────────────────────────────────────

export interface GateGenParams {
  /** Transistor width (µm) */
  pW?: number;
  pL?: number;
  /** NMOS width / length (default: pW/2 if not specified) */
  nW?: number;
  nL?: number;
  /** Number of fingers per transistor stack */
  nf?: number;
  /** Sizing ratio for pull-down vs pull-up (P/N width ratio) */
  pullUpRatio?: number;
}

export interface GateGenResult {
  /** Schematic elements (symbols, wires, labels) */
  schematic: SchematicElement[];
  /** Interface ports (A, B, Z, etc.) */
  ports: SubcircuitPort[];
  /** Stick diagram geometries (for layout) */
  stickDiagram?: CanvasGeometry[];
}

// ── Layer IDs (for stick diagrams) ──────────────────────────────────

/** Layer IDs for geometry rendering */
const LAYERS = {
  nDiff: 0,    // n-type diffusion
  pDiff: 1,    // p-type diffusion
  poly: 2,     // polysilicon (gate)
  metal1: 3,   // metal 1 (interconnect)
  via: 4,      // contacts/vias
  text: 5,     // labels
};

// ── Helper: Generate unique IDs ──────────────────────────────────────

function genId(): string {
  return `g${Math.random().toString(36).slice(2, 8)}`;
}

function generateGeomId(): string {
  return `geom${Math.random().toString(36).slice(2, 8)}`;
}

// ── Stick Diagram Helpers ───────────────────────────────────────────

function createRect(
  x: number,
  y: number,
  width: number,
  height: number,
  layerId: number,
  name?: string,
  net?: string
): CanvasGeometry {
  return {
    id: generateGeomId(),
    type: "rect",
    layerId,
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    width,
    name,
    net,
  };
}

function createVia(x: number, y: number, size: number = 0.1, net?: string): CanvasGeometry {
  return {
    id: generateGeomId(),
    type: "via",
    layerId: LAYERS.via,
    points: [{ x, y }],
    width: size,
    net,
  };
}

function createPath(
  points: { x: number; y: number }[],
  layerId: number,
  net?: string
): CanvasGeometry {
  return {
    id: generateGeomId(),
    type: "path",
    layerId,
    points,
    net,
  };
}

function createDefaultPins(_deviceType: string, inCount: number = 1): SchematicPin[] {
  const pins: SchematicPin[] = [];
  const baseId = () => genId();

  // Inputs
  for (let i = 0; i < inCount; i++) {
    const name = String.fromCharCode(65 + i); // A, B, C, ...
    pins.push({
      id: baseId(),
      name,
      position: { x: -1, y: -0.5 + (i * 1) / (inCount - 1 || 1) },
      direction: "left",
      type: "input",
    });
  }

  // Output
  pins.push({
    id: baseId(),
    name: "Z",
    position: { x: 1, y: 0 },
    direction: "right",
    type: "output",
  });

  // Power / Ground
  pins.push({
    id: baseId(),
    name: "VDD",
    position: { x: 0, y: -1.5 },
    direction: "top",
    type: "power",
  });
  pins.push({
    id: baseId(),
    name: "GND",
    position: { x: 0, y: 1.5 },
    direction: "bottom",
    type: "power",
  });

  return pins;
}

function createSymbol(
  deviceType: "nmos" | "pmos",
  position: SchematicPoint,
  params?: Record<string, number | string>
): SchematicSymbol {
  const prefix = deviceType === "nmos" ? "M" : "M";
  const id = genId();

  return {
    kind: "symbol",
    id,
    instanceName: `${prefix}${Math.floor(Math.random() * 100)}`,
    deviceType,
    position,
    rotation: 0,
    mirror: false,
    pins: createDefaultPins(deviceType),
    parameters: params || {},
    layoutGeometryIndices: [],
  };
}

// ── INV (Inverter) ──────────────────────────────────────────────────

export function generateINV(params: GateGenParams = {}): GateGenResult {
  const pW = params.pW ?? 1.0;
  const pL = params.pL ?? 0.15;
  const nW = params.nW ?? pW / 2;
  const nL = params.nL ?? 0.15;

  const elements: SchematicElement[] = [];

  // PMOS (pull-up)
  const pmos = createSymbol("pmos", { x: 0, y: -1 }, { W: pW, L: pL, nf: params.nf ?? 1 });
  elements.push(pmos);

  // NMOS (pull-down)
  const nmos = createSymbol("nmos", { x: 0, y: 1 }, { W: nW, L: nL, nf: params.nf ?? 1 });
  elements.push(nmos);

  // Input wire from A to both gates
  const inputWire: SchematicWire = {
    kind: "wire",
    id: genId(),
    points: [
      { x: -1.5, y: 0 }, // Input from left
      { x: -0.8, y: 0 }, // Gate connection point
      { x: -0.8, y: -1 }, // Up to PMOS gate
      { x: -0.8, y: -1 }, // PMOS gate
    ],
  };
  elements.push(inputWire);

  // Add second wire segment for NMOS gate
  const nmosgateWire: SchematicWire = {
    kind: "wire",
    id: genId(),
    points: [
      { x: -0.8, y: 0 },
      { x: -0.8, y: 1 }, // NMOS gate
    ],
  };
  elements.push(nmosgateWire);

  // Output wire (drain of both, connects to output)
  const outputWire: SchematicWire = {
    kind: "wire",
    id: genId(),
    points: [
      { x: 0, y: -1.5 }, // PMOS drain
      { x: 0, y: 0 }, // Output
      { x: 0, y: 1.5 }, // NMOS drain
      { x: 1.5, y: 0 }, // Output to right
    ],
  };
  elements.push(outputWire);

  // VDD wire
  const vddWire: SchematicWire = {
    kind: "wire",
    id: genId(),
    points: [
      { x: 0, y: -1.2 }, // PMOS source
      { x: 0, y: -2 }, // VDD
    ],
  };
  elements.push(vddWire);

  // GND wire
  const gndWire: SchematicWire = {
    kind: "wire",
    id: genId(),
    points: [
      { x: 0, y: 1.2 }, // NMOS source
      { x: 0, y: 2 }, // GND
    ],
  };
  elements.push(gndWire);

  // Labels
  elements.push({
    kind: "label",
    id: genId(),
    text: "A",
    position: { x: -1.8, y: 0 },
    netName: "A",
    fontSize: 0.5,
  });

  elements.push({
    kind: "label",
    id: genId(),
    text: "Z",
    position: { x: 1.8, y: 0 },
    netName: "Z",
    fontSize: 0.5,
  });

  // ── Stick Diagram ────────────────────────────────────────────────────

  const stickDiagram: CanvasGeometry[] = [];
  const polyWidth = 0.15; // Gate width (drawn as taller in stick diagram)
  const diffWidth = pW;   // Diffusion width
  const diffHeight = 0.15; // Diffusion height
  const spacing = 0.5;    // Spacing between transistors

  // PMOS diffusion (top)
  stickDiagram.push(
    createRect(-spacing, -diffHeight, diffWidth, diffHeight, LAYERS.pDiff, "pDiff_source", "VDD")
  );
  stickDiagram.push(
    createRect(spacing, -diffHeight, diffWidth, diffHeight, LAYERS.pDiff, "pDiff_drain", "Z")
  );

  // NMOS diffusion (bottom)
  stickDiagram.push(
    createRect(-spacing, diffHeight, diffWidth, diffHeight, LAYERS.nDiff, "nDiff_source", "GND")
  );
  stickDiagram.push(
    createRect(spacing, diffHeight, diffWidth, diffHeight, LAYERS.nDiff, "nDiff_drain", "Z")
  );

  // Gate (shared between PMOS and NMOS)
  stickDiagram.push(
    createRect(0, -diffHeight - 0.15, polyWidth, diffHeight + 0.15, LAYERS.poly, "gate", "A")
  );

  // Via at output node Z
  stickDiagram.push(createVia(spacing + diffWidth / 2, 0, 0.1, "Z"));

  // Output connection path
  stickDiagram.push(
    createPath([
      { x: spacing + diffWidth / 2, y: -diffHeight },
      { x: spacing + diffWidth / 2, y: 0 },
      { x: spacing + diffWidth / 2, y: diffHeight },
    ], LAYERS.metal1, "Z")
  );

  return {
    schematic: elements,
    ports: [
      { name: "A", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
    stickDiagram,
  };
}

// ── NAND2 (2-input NAND) ────────────────────────────────────────────

export function generateNAND2(params: GateGenParams = {}): GateGenResult {
  const pW = params.pW ?? 2.0;
  const pL = params.pL ?? 0.15;
  const nW = params.nW ?? pW / 2;
  const nL = params.nL ?? 0.15;

  const elements: SchematicElement[] = [];

  // Two PMOS in parallel (pull-up)
  const pmos_a = createSymbol("pmos", { x: -0.8, y: -1.5 }, { W: pW, L: pL });
  const pmos_b = createSymbol("pmos", { x: 0.8, y: -1.5 }, { W: pW, L: pL });
  elements.push(pmos_a, pmos_b);

  // Two NMOS in series (pull-down) — stacked vertically
  const nmos_a = createSymbol("nmos", { x: -0.8, y: 0.5 }, { W: nW, L: nL });
  const nmos_b = createSymbol("nmos", { x: -0.8, y: 1.8 }, { W: nW, L: nL });
  elements.push(nmos_a, nmos_b);

  // Gates connected to inputs A and B
  // A to PMOS_a and NMOS_a gates
  elements.push({
    kind: "wire",
    id: genId(),
    points: [
      { x: -1.5, y: -0.2 },
      { x: -1.8, y: -0.2 },
      { x: -1.8, y: -1.5 },
    ],
  });

  // B to PMOS_b and NMOS_b gates
  elements.push({
    kind: "wire",
    id: genId(),
    points: [
      { x: 1.5, y: 0.8 },
      { x: 2.2, y: 0.8 },
      { x: 2.2, y: -1.5 },
      { x: 0.8, y: -1.5 },
    ],
  });

  // Output wire from both PMOS drains and NMOS stack
  elements.push({
    kind: "wire",
    id: genId(),
    points: [
      { x: -0.8, y: -1.8 },
      { x: -0.8, y: 0 },
      { x: 0.8, y: 0 },
      { x: 0.8, y: -1.8 },
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
  });

  // VDD and GND connections (simplified)
  elements.push({
    kind: "wire",
    id: genId(),
    points: [
      { x: -0.8, y: -2 },
      { x: 0.8, y: -2 },
      { x: 0, y: -2.5 },
    ],
  });

  elements.push({
    kind: "wire",
    id: genId(),
    points: [
      { x: -0.8, y: 2.3 },
      { x: -0.8, y: 2.8 },
    ],
  });

  // Labels
  elements.push({
    kind: "label",
    id: genId(),
    text: "A",
    position: { x: -2, y: -0.2 },
    netName: "A",
    fontSize: 0.5,
  });
  elements.push({
    kind: "label",
    id: genId(),
    text: "B",
    position: { x: 2.4, y: 0.8 },
    netName: "B",
    fontSize: 0.5,
  });
  elements.push({
    kind: "label",
    id: genId(),
    text: "Z",
    position: { x: 2.2, y: 0 },
    netName: "Z",
    fontSize: 0.5,
  });

  // ── Stick Diagram ────────────────────────────────────────────────────

  const stickDiagram: CanvasGeometry[] = [];
  const polyWidth = 0.15;
  const diffWidth = pW;
  const diffHeight = 0.15;
  const xSpacing = 0.6;

  // PMOS pair (in parallel, side by side)
  stickDiagram.push(
    createRect(-xSpacing, -diffHeight - 0.3, diffWidth / 2, diffHeight, LAYERS.pDiff, "pmos_a_drain", "Z")
  );
  stickDiagram.push(
    createRect(xSpacing, -diffHeight - 0.3, diffWidth / 2, diffHeight, LAYERS.pDiff, "pmos_b_drain", "Z")
  );

  // Shared PMOS source (VDD)
  stickDiagram.push(
    createRect(-xSpacing, -diffHeight - 0.7, xSpacing * 2 + diffWidth / 2, diffHeight / 2, LAYERS.pDiff, "pmos_source", "VDD")
  );

  // NMOS stack (series)
  stickDiagram.push(
    createRect(-xSpacing, diffHeight, diffWidth / 2, diffHeight, LAYERS.nDiff, "nmos_a_drain", "Z_int")
  );
  stickDiagram.push(
    createRect(-xSpacing, diffHeight + 0.3, diffWidth / 2, diffHeight, LAYERS.nDiff, "nmos_b_drain", "Z_int")
  );
  stickDiagram.push(
    createRect(-xSpacing, diffHeight + 0.6, diffWidth / 2, diffHeight, LAYERS.nDiff, "nmos_source", "GND")
  );

  // Gates A and B
  stickDiagram.push(
    createRect(-xSpacing - polyWidth / 2, -diffHeight * 2, polyWidth, diffHeight * 6, LAYERS.poly, "gate_A", "A")
  );
  stickDiagram.push(
    createRect(xSpacing - polyWidth / 2, -diffHeight * 2, polyWidth, diffHeight * 4, LAYERS.poly, "gate_B", "B")
  );

  // Vias and metal connections to output
  stickDiagram.push(createVia(-xSpacing + diffWidth / 4, 0, 0.1, "Z"));
  stickDiagram.push(createVia(xSpacing + diffWidth / 4, -diffHeight, 0.1, "Z"));

  return {
    schematic: elements,
    ports: [
      { name: "A", direction: "input" },
      { name: "B", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
    stickDiagram,
  };
}

// ── NOR2 (2-input NOR) ──────────────────────────────────────────────

export function generateNOR2(params: GateGenParams = {}): GateGenResult {
  const pW = params.pW ?? 2.0;
  const pL = params.pL ?? 0.15;
  const nW = params.nW ?? pW / 2;
  const nL = params.nL ?? 0.15;

  const elements: SchematicElement[] = [];

  //(Same topological structure as NAND but with different transistor arrangement)
  // For brevity: placeholder implementation similar to NAND2
  const pmos_a = createSymbol("pmos", { x: -0.8, y: -1.5 }, { W: pW, L: pL });
  const pmos_b = createSymbol("pmos", { x: 0.8, y: -1.5 }, { W: pW, L: pL });
  const nmos_a = createSymbol("nmos", { x: -0.8, y: 1 }, { W: nW, L: nL });
  const nmos_b = createSymbol("nmos", { x: 0.8, y: 1 }, { W: nW, L: nL });

  elements.push(pmos_a, pmos_b, nmos_a, nmos_b);

  // Simplified wiring (for demonstration)
  elements.push({
    kind: "wire",
    id: genId(),
    points: [
      { x: -1.5, y: -0.5 },
      { x: -1.8, y: -0.5 },
      { x: -1.8, y: -1.5 },
    ],
  });

  elements.push({
    kind: "label",
    id: genId(),
    text: "A",
    position: { x: -2, y: -0.5 },
    netName: "A",
    fontSize: 0.5,
  });

  // ── Stick Diagram (NOR topology: PMOS in series, NMOS in parallel) ──

  const stickDiagram: CanvasGeometry[] = [];
  const polyWidth = 0.15;
  const diffWidth = pW;
  const diffHeight = 0.15;
  const xSpacing = 0.6;

  // PMOS stack (series)
  stickDiagram.push(
    createRect(-xSpacing, -diffHeight - 0.6, diffWidth, diffHeight, LAYERS.pDiff, "pmos_a_drain", "Z")
  );
  stickDiagram.push(
    createRect(-xSpacing, -diffHeight - 0.3, diffWidth, diffHeight, LAYERS.pDiff, "pmos_intermediate", "Z_int")
  );
  stickDiagram.push(
    createRect(-xSpacing, 0, diffWidth, diffHeight, LAYERS.pDiff, "pmos_source", "VDD")
  );

  // NMOS pair (in parallel)
  stickDiagram.push(
    createRect(-xSpacing - diffWidth / 4, diffHeight, diffWidth / 2, diffHeight, LAYERS.nDiff, "nmos_a_drain", "Z")
  );
  stickDiagram.push(
    createRect(xSpacing, diffHeight, diffWidth / 2, diffHeight, LAYERS.nDiff, "nmos_b_drain", "Z")
  );

  // Shared NMOS source (GND)
  stickDiagram.push(
    createRect(-xSpacing, diffHeight + 0.3, xSpacing * 2 + diffWidth / 2, diffHeight, LAYERS.nDiff, "nmos_source", "GND")
  );

  // Gates A and B
  stickDiagram.push(
    createRect(-xSpacing - polyWidth / 2, -diffHeight * 2, polyWidth, diffHeight * 5, LAYERS.poly, "gate_A", "A")
  );
  stickDiagram.push(
    createRect(xSpacing - polyWidth / 2, diffHeight, polyWidth, diffHeight * 3, LAYERS.poly, "gate_B", "B")
  );

  // Via at output
  stickDiagram.push(createVia(0, 0, 0.1, "Z"));

  return {
    schematic: elements,
    ports: [
      { name: "A", direction: "input" },
      { name: "B", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
    stickDiagram,
  };
}

// ── XOR2 (2-input XOR) ──────────────────────────────────────────────

export function generateXOR2(_params: GateGenParams = {}): GateGenResult {
  // XOR = (A + B')(A' + B) = NAND/NOR-based gate
  const elements: SchematicElement[] = [
    {
      kind: "label",
      id: genId(),
      text: "XOR2 placeholder",
      position: { x: 0, y: 0 },
      netName: "debug",
      fontSize: 0.5,
    },
  ];

  return {
    schematic: elements,
    ports: [
      { name: "A", direction: "input" },
      { name: "B", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}

// ── MUX2 (2-to-1 Multiplexer) ──────────────────────────────────────

export function generateMUX2(_params: GateGenParams = {}): GateGenResult {
  // Z = (S') * D0 + S * D1
  const elements: SchematicElement[] = [
    {
      kind: "label",
      id: genId(),
      text: "MUX2 placeholder",
      position: { x: 0, y: 0 },
      netName: "debug",
      fontSize: 0.5,
    },
  ];

  return {
    schematic: elements,
    ports: [
      { name: "D0", direction: "input" },
      { name: "D1", direction: "input" },
      { name: "S", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}

// ── SR_Latch (SR latch with NAND gates) ────────────────────────────

export function generateSRLatch(_params: GateGenParams = {}): GateGenResult {
  // SR latch: two cross-coupled NAND gates
  const elements: SchematicElement[] = [
    {
      kind: "label",
      id: genId(),
      text: "SR_Latch placeholder",
      position: { x: 0, y: 0 },
      netName: "debug",
      fontSize: 0.5,
    },
  ];

  return {
    schematic: elements,
    ports: [
      { name: "S", direction: "input" },
      { name: "R", direction: "input" },
      { name: "Q", direction: "output" },
      { name: "QB", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}

// ── NAND3, NAND4 ────────────────────────────────────────────────────

export function generateNAND3(_params: GateGenParams = {}): GateGenResult {
  return {
    schematic: [
      {
        kind: "label",
        id: genId(),
        text: "NAND3 placeholder",
        position: { x: 0, y: 0 },
        netName: "debug",
        fontSize: 0.5,
      },
    ],
    ports: [
      { name: "A", direction: "input" },
      { name: "B", direction: "input" },
      { name: "C", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}

export function generateNAND4(_params: GateGenParams = {}): GateGenResult {
  return {
    schematic: [
      {
        kind: "label",
        id: genId(),
        text: "NAND4 placeholder",
        position: { x: 0, y: 0 },
        netName: "debug",
        fontSize: 0.5,
      },
    ],
    ports: [
      { name: "A", direction: "input" },
      { name: "B", direction: "input" },
      { name: "C", direction: "input" },
      { name: "D", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}

// ── NOR3, NOR4 ───────────────────────────────────────────────────────

export function generateNOR3(_params: GateGenParams = {}): GateGenResult {
  return {
    schematic: [
      {
        kind: "label",
        id: genId(),
        text: "NOR3 placeholder",
        position: { x: 0, y: 0 },
        netName: "debug",
        fontSize: 0.5,
      },
    ],
    ports: [
      { name: "A", direction: "input" },
      { name: "B", direction: "input" },
      { name: "C", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}

export function generateNOR4(_params: GateGenParams = {}): GateGenResult {
  return {
    schematic: [
      {
        kind: "label",
        id: genId(),
        text: "NOR4 placeholder",
        position: { x: 0, y: 0 },
        netName: "debug",
        fontSize: 0.5,
      },
    ],
    ports: [
      { name: "A", direction: "input" },
      { name: "B", direction: "input" },
      { name: "C", direction: "input" },
      { name: "D", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}

// ── XNOR2 ────────────────────────────────────────────────────────────

export function generateXNOR2(_params: GateGenParams = {}): GateGenResult {
  return {
    schematic: [
      {
        kind: "label",
        id: genId(),
        text: "XNOR2 placeholder",
        position: { x: 0, y: 0 },
        netName: "debug",
        fontSize: 0.5,
      },
    ],
    ports: [
      { name: "A", direction: "input" },
      { name: "B", direction: "input" },
      { name: "Z", direction: "output" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}

// ── Transmission Gate ────────────────────────────────────────────────

export function generateTransmissionGate(_params: GateGenParams = {}): GateGenResult {
  return {
    schematic: [
      {
        kind: "label",
        id: genId(),
        text: "TGATE placeholder",
        position: { x: 0, y: 0 },
        netName: "debug",
        fontSize: 0.5,
      },
    ],
    ports: [
      { name: "A", direction: "inout" },
      { name: "B", direction: "inout" },
      { name: "EN", direction: "input" },
      { name: "ENB", direction: "input" },
      { name: "VDD", direction: "inout" },
      { name: "GND", direction: "inout" },
    ],
  };
}
