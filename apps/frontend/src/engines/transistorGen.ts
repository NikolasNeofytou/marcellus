/**
 * Transistor & Passive Device Layout Generator
 *
 * Generates SKY130-compliant layout geometries for:
 * - NMOS / PMOS transistors (single & multi-finger)
 * - Poly resistors, diffusion resistors
 * - MIM capacitors, MOM capacitors
 * - Guard rings
 * - Contact / via arrays
 *
 * All dimensions in µm, coordinates relative to (0, 0) origin.
 * Generated geometries can be registered as CellDefinitions.
 */

import type { CanvasGeometry } from "../stores/geometryStore";
import { generateGeomId } from "../stores/geometryStore";
import type { CellPin } from "../stores/cellStore";

// ══════════════════════════════════════════════════════════════════════
// SKY130 Layer ID Mapping (matches layerStore.ts expanded layer IDs)
// ══════════════════════════════════════════════════════════════════════

export const SKY130_LAYERS = {
  NWELL:  0,
  PWELL:  1,
  DIFF:   2,
  TAP:    3,
  POLY:   4,
  LICON:  5,
  LI1:    6,
  MCON:   7,
  MET1:   8,
  VIA1:   9,
  MET2:  10,
  VIA2:  11,
  MET3:  12,
  VIA3:  13,
  MET4:  14,
  VIA4:  15,
  MET5:  16,
  NSDM:  17,
  PSDM:  18,
  NPC:   19,
  HVI:   20,
} as const;

// ══════════════════════════════════════════════════════════════════════
// SKY130 Design Rule Constants (µm)
// ══════════════════════════════════════════════════════════════════════

const RULES = {
  // Poly
  POLY_WIDTH_MIN:      0.15,
  POLY_SPACING:        0.21,
  POLY_EXT_DIFF:       0.13,   // poly extension past diffusion
  POLY_DIFF_SPACING:   0.075,  // poly-to-diff spacing (non-gate)

  // Diffusion
  DIFF_WIDTH_MIN:      0.15,
  DIFF_SPACING:        0.27,
  DIFF_POLY_ENC:       0.075,  // diff enclosure of gate (S/D extension)
  DIFF_CONTACT_ENC:    0.06,   // diff enclosure of licon

  // Contacts (LICON)
  LICON_SIZE:          0.17,
  LICON_SPACING:       0.17,
  LICON_DIFF_ENC:      0.04,
  LICON_POLY_ENC:      0.05,
  LI_ENC_LICON:        0.08,

  // LI
  LI_WIDTH_MIN:        0.17,
  LI_SPACING:          0.17,

  // MCON
  MCON_SIZE:           0.17,
  MCON_SPACING:        0.19,
  M1_ENC_MCON:         0.06,

  // Metal 1
  M1_WIDTH_MIN:        0.14,
  M1_SPACING:          0.14,

  // VIA1
  VIA1_SIZE:           0.15,
  VIA1_SPACING:        0.17,
  M1_ENC_VIA1:         0.055,
  M2_ENC_VIA1:         0.055,

  // NWELL
  NWELL_DIFF_ENC:      0.18,   // nwell enclosure of p-diff
  NWELL_WIDTH_MIN:     0.84,

  // Guard ring
  TAP_WIDTH_MIN:       0.15,
  TAP_NWELL_ENC:       0.18,

  // Implant
  NSDM_DIFF_ENC:       0.125,
  PSDM_DIFF_ENC:       0.125,
} as const;

// ══════════════════════════════════════════════════════════════════════
// Helper: Create geometry
// ══════════════════════════════════════════════════════════════════════

function rect(
  layerId: number,
  x1: number, y1: number,
  x2: number, y2: number,
  props?: Record<string, string | number | boolean>,
): CanvasGeometry {
  return {
    id: generateGeomId(),
    type: "rect",
    layerId,
    points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
    properties: props,
  };
}

function via(
  layerId: number,
  cx: number, cy: number,
  size: number,
): CanvasGeometry {
  return {
    id: generateGeomId(),
    type: "via",
    layerId,
    points: [{ x: cx, y: cy }],
    width: size,
  };
}

export function path(
  layerId: number,
  pts: { x: number; y: number }[],
  width: number,
): CanvasGeometry {
  return {
    id: generateGeomId(),
    type: "path",
    layerId,
    points: pts.map((p) => ({ ...p })),
    width,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Contact Array Generator
// ══════════════════════════════════════════════════════════════════════

export interface ContactArrayParams {
  /** Contact layer ID */
  contactLayerId: number;
  /** Contact size (µm) */
  contactSize: number;
  /** Contact spacing (µm) */
  contactSpacing: number;
  /** Available region (x1, y1, x2, y2) */
  region: { x1: number; y1: number; x2: number; y2: number };
}

/** Generate a grid of contacts fitting within a region */
export function generateContactArray(params: ContactArrayParams): CanvasGeometry[] {
  const { contactLayerId, contactSize, contactSpacing, region } = params;
  const results: CanvasGeometry[] = [];

  const pitch = contactSize + contactSpacing;
  const regionW = region.x2 - region.x1;
  const regionH = region.y2 - region.y1;

  const nx = Math.max(1, Math.floor((regionW - contactSize) / pitch) + 1);
  const ny = Math.max(1, Math.floor((regionH - contactSize) / pitch) + 1);

  // Center the array within the region
  const arrayW = (nx - 1) * pitch + contactSize;
  const arrayH = (ny - 1) * pitch + contactSize;
  const offsetX = region.x1 + (regionW - arrayW) / 2 + contactSize / 2;
  const offsetY = region.y1 + (regionH - arrayH) / 2 + contactSize / 2;

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      results.push(via(contactLayerId, offsetX + i * pitch, offsetY + j * pitch, contactSize));
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════
// Stacked Via Generator
// ══════════════════════════════════════════════════════════════════════

export interface StackedViaParams {
  /** Center position */
  x: number;
  y: number;
  /** Bottom metal layer name (e.g. "MET1") */
  fromMetal: number;
  /** Top metal layer name (e.g. "MET2") */
  toMetal: number;
  /** Width of metal pads */
  metalWidth: number;
}

/** Metal layer ordering for stacking */
const METAL_STACK = [
  { metal: SKY130_LAYERS.LI1,  via: SKY130_LAYERS.MCON, viaSize: 0.17, enc: 0.06,  spacing: 0.19 },
  { metal: SKY130_LAYERS.MET1, via: SKY130_LAYERS.VIA1, viaSize: 0.15, enc: 0.055, spacing: 0.17 },
  { metal: SKY130_LAYERS.MET2, via: SKY130_LAYERS.VIA2, viaSize: 0.20, enc: 0.065, spacing: 0.20 },
  { metal: SKY130_LAYERS.MET3, via: SKY130_LAYERS.VIA3, viaSize: 0.20, enc: 0.065, spacing: 0.20 },
  { metal: SKY130_LAYERS.MET4, via: SKY130_LAYERS.VIA4, viaSize: 0.80, enc: 0.19,  spacing: 0.80 },
  { metal: SKY130_LAYERS.MET5, via: -1,                 viaSize: 0,    enc: 0,     spacing: 0    },
];

export function generateStackedVia(params: StackedViaParams): CanvasGeometry[] {
  const { x, y, fromMetal, toMetal, metalWidth } = params;
  const results: CanvasGeometry[] = [];

  const fromIdx = METAL_STACK.findIndex((s) => s.metal === fromMetal);
  const toIdx = METAL_STACK.findIndex((s) => s.metal === toMetal);
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= toIdx) return results;

  const hw = metalWidth / 2;

  for (let i = fromIdx; i <= toIdx; i++) {
    // Metal pad
    results.push(rect(METAL_STACK[i].metal, x - hw, y - hw, x + hw, y + hw));

    // Via between this metal and next
    if (i < toIdx) {
      const viaInfo = METAL_STACK[i];
      results.push(via(viaInfo.via, x, y, viaInfo.viaSize));
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════
// MOSFET Generator
// ══════════════════════════════════════════════════════════════════════

export interface MosfetParams {
  /** Device type */
  type: "nmos" | "pmos";
  /** Channel width in µm */
  W: number;
  /** Channel length in µm */
  L: number;
  /** Number of fingers */
  nf: number;
  /** Include contacts on source/drain? */
  contacts: boolean;
  /** Include guard ring? */
  guardRing: boolean;
  /** Include well (nwell for PMOS)? */
  includeWell: boolean;
  /** Include implant layers? */
  includeImplant: boolean;
}

export interface MosfetResult {
  geometries: CanvasGeometry[];
  pins: CellPin[];
  /** Computed bounding box */
  bbox: { x1: number; y1: number; x2: number; y2: number };
  /** Effective W/L */
  effectiveW: number;
  effectiveL: number;
}

/**
 * Generate MOSFET layout with multi-finger support.
 *
 * Layout structure (single finger, nf=1):
 *
 *   ┌─────────────────────────────────┐  ← poly extension
 *   │              POLY               │
 *   │    ┌──────┬──────┬──────┐       │
 *   │    │  S   │ GATE │  D   │       │
 *   │    │ diff │      │ diff │       │
 *   │    │ [ct] │      │ [ct] │       │
 *   │    └──────┴──────┴──────┘       │
 *   │              POLY               │
 *   └─────────────────────────────────┘  ← poly extension
 *
 * For multi-finger (nf>1), source/drain regions are shared:
 *   S G D G S G D ...
 */
export function generateMosfet(params: MosfetParams): MosfetResult {
  const { type, W, L, nf, contacts, guardRing, includeWell, includeImplant } = params;
  const geoms: CanvasGeometry[] = [];
  const pins: CellPin[] = [];

  // Clamp to min dimensions
  const gateW = Math.max(W, RULES.DIFF_WIDTH_MIN);
  const gateL = Math.max(L, RULES.POLY_WIDTH_MIN);

  // Source/Drain extension beyond gate
  const sdExt = contacts
    ? RULES.DIFF_CONTACT_ENC + RULES.LICON_SIZE + RULES.DIFF_CONTACT_ENC
    : RULES.DIFF_POLY_ENC + 0.05;

  // Contact area width within S/D
  const contactAreaW = RULES.LICON_SIZE + 2 * RULES.LICON_DIFF_ENC;
  const sdWidth = Math.max(sdExt, contactAreaW);

  // Gate pitch = gate length + S/D width
  const gatePitch = gateL + sdWidth;

  // Total diffusion width (X direction)
  const totalDiffW = sdWidth + nf * gateL + nf * sdWidth;

  // Diffusion origin at (0, 0) = bottom-left of diffusion
  const diffX1 = 0;
  const diffY1 = 0;
  const diffX2 = totalDiffW;
  const diffY2 = gateW;

  // ── Diffusion ──
  geoms.push(rect(SKY130_LAYERS.DIFF, diffX1, diffY1, diffX2, diffY2, {
    device: type,
    role: "diffusion",
  }));

  // ── Poly gates ──
  const polyExt = RULES.POLY_EXT_DIFF;
  for (let f = 0; f < nf; f++) {
    const polyX1 = sdWidth + f * gatePitch;
    const polyX2 = polyX1 + gateL;
    const polyY1 = diffY1 - polyExt;
    const polyY2 = diffY2 + polyExt;

    geoms.push(rect(SKY130_LAYERS.POLY, polyX1, polyY1, polyX2, polyY2, {
      device: type,
      role: "gate",
      finger: f,
    }));

    // Gate pin (on first finger)
    if (f === 0) {
      pins.push({
        name: "gate",
        direction: "input",
        position: { x: (polyX1 + polyX2) / 2, y: polyY2 + 0.05 },
        layerId: SKY130_LAYERS.POLY,
        size: { w: gateL, h: 0.1 },
      });
    }
  }

  // ── Source/Drain contacts ──
  if (contacts) {
    for (let i = 0; i <= nf; i++) {
      const isSource = i % 2 === 0;
      const sdCenterX = i * gatePitch + sdWidth / 2;

      // Contact region
      const cRegion = {
        x1: sdCenterX - sdWidth / 2 + RULES.LICON_DIFF_ENC,
        y1: diffY1 + RULES.LICON_DIFF_ENC,
        x2: sdCenterX + sdWidth / 2 - RULES.LICON_DIFF_ENC,
        y2: diffY2 - RULES.LICON_DIFF_ENC,
      };

      // LICON contacts
      const licons = generateContactArray({
        contactLayerId: SKY130_LAYERS.LICON,
        contactSize: RULES.LICON_SIZE,
        contactSpacing: RULES.LICON_SPACING,
        region: cRegion,
      });
      geoms.push(...licons);

      // LI pad over contacts
      const liPadX1 = sdCenterX - sdWidth / 2 + RULES.LICON_DIFF_ENC - RULES.LI_ENC_LICON;
      const liPadX2 = sdCenterX + sdWidth / 2 - RULES.LICON_DIFF_ENC + RULES.LI_ENC_LICON;
      const liW = Math.max(liPadX2 - liPadX1, RULES.LI_WIDTH_MIN);
      const liCx = sdCenterX;
      geoms.push(rect(SKY130_LAYERS.LI1,
        liCx - liW / 2, diffY1 + RULES.LICON_DIFF_ENC - RULES.LI_ENC_LICON,
        liCx + liW / 2, diffY2 - RULES.LICON_DIFF_ENC + RULES.LI_ENC_LICON,
        { role: isSource ? "source_li" : "drain_li" },
      ));

      // Pin definitions
      if (i === 0) {
        pins.push({
          name: "source",
          direction: "inout",
          position: { x: sdCenterX, y: (diffY1 + diffY2) / 2 },
          layerId: SKY130_LAYERS.LI1,
        });
      }
      if (i === 1 || (i === nf && nf === 1)) {
        pins.push({
          name: "drain",
          direction: "inout",
          position: { x: sdCenterX, y: (diffY1 + diffY2) / 2 },
          layerId: SKY130_LAYERS.LI1,
        });
      }
    }
  }

  // ── Well (PMOS gets NWELL) ──
  if (includeWell && type === "pmos") {
    const nwEnc = RULES.NWELL_DIFF_ENC;
    geoms.push(rect(SKY130_LAYERS.NWELL,
      diffX1 - nwEnc, diffY1 - nwEnc,
      diffX2 + nwEnc, diffY2 + nwEnc,
      { role: "well" },
    ));
  }

  // ── Implant layers ──
  if (includeImplant) {
    const impEnc = type === "nmos" ? RULES.NSDM_DIFF_ENC : RULES.PSDM_DIFF_ENC;
    const impLayer = type === "nmos" ? SKY130_LAYERS.NSDM : SKY130_LAYERS.PSDM;
    geoms.push(rect(impLayer,
      diffX1 - impEnc, diffY1 - impEnc,
      diffX2 + impEnc, diffY2 + impEnc,
      { role: "implant" },
    ));
  }

  // ── Guard Ring ──
  if (guardRing) {
    const grGeoms = generateGuardRing({
      type: type === "nmos" ? "p-sub" : "n-well",
      innerBbox: {
        x1: diffX1 - 0.3,
        y1: diffY1 - polyExt - 0.2,
        x2: diffX2 + 0.3,
        y2: diffY2 + polyExt + 0.2,
      },
      ringWidth: 0.27,
      contacts: true,
    });
    geoms.push(...grGeoms);
  }

  // Compute bbox
  let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
  for (const g of geoms) {
    for (const p of g.points) {
      const hw = (g.width ?? 0) / 2;
      bx1 = Math.min(bx1, p.x - hw);
      by1 = Math.min(by1, p.y - hw);
      bx2 = Math.max(bx2, p.x + hw);
      by2 = Math.max(by2, p.y + hw);
    }
  }

  return {
    geometries: geoms,
    pins,
    bbox: { x1: bx1, y1: by1, x2: bx2, y2: by2 },
    effectiveW: gateW,
    effectiveL: gateL,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Guard Ring Generator
// ══════════════════════════════════════════════════════════════════════

export interface GuardRingParams {
  /** Guard ring type */
  type: "p-sub" | "n-well";
  /** Inner bounding box to surround */
  innerBbox: { x1: number; y1: number; x2: number; y2: number };
  /** Ring width (µm) */
  ringWidth: number;
  /** Include contacts in ring */
  contacts: boolean;
}

export function generateGuardRing(params: GuardRingParams): CanvasGeometry[] {
  const { type, innerBbox, ringWidth, contacts: includeContacts } = params;
  const geoms: CanvasGeometry[] = [];

  const gap = 0.1; // gap between inner bbox and ring
  const ox1 = innerBbox.x1 - gap;
  const oy1 = innerBbox.y1 - gap;
  const ox2 = innerBbox.x2 + gap;
  const oy2 = innerBbox.y2 + gap;

  // Tap layer for the ring (4 rectangles forming a frame)
  const tapLayer = SKY130_LAYERS.TAP;

  // Bottom
  geoms.push(rect(tapLayer, ox1 - ringWidth, oy1 - ringWidth, ox2 + ringWidth, oy1));
  // Top
  geoms.push(rect(tapLayer, ox1 - ringWidth, oy2, ox2 + ringWidth, oy2 + ringWidth));
  // Left
  geoms.push(rect(tapLayer, ox1 - ringWidth, oy1, ox1, oy2));
  // Right
  geoms.push(rect(tapLayer, ox2, oy1, ox2 + ringWidth, oy2));

  // Well layer
  if (type === "n-well") {
    const wellEnc = RULES.TAP_NWELL_ENC;
    geoms.push(rect(SKY130_LAYERS.NWELL,
      ox1 - ringWidth - wellEnc, oy1 - ringWidth - wellEnc,
      ox2 + ringWidth + wellEnc, oy2 + ringWidth + wellEnc,
      { role: "guard_ring_well" },
    ));
  }

  // Contacts along the ring
  if (includeContacts) {
    const sides = [
      // Bottom
      { x1: ox1 - ringWidth + 0.04, y1: oy1 - ringWidth + 0.04, x2: ox2 + ringWidth - 0.04, y2: oy1 - 0.04 },
      // Top
      { x1: ox1 - ringWidth + 0.04, y1: oy2 + 0.04, x2: ox2 + ringWidth - 0.04, y2: oy2 + ringWidth - 0.04 },
      // Left
      { x1: ox1 - ringWidth + 0.04, y1: oy1 + 0.04, x2: ox1 - 0.04, y2: oy2 - 0.04 },
      // Right
      { x1: ox2 + 0.04, y1: oy1 + 0.04, x2: ox2 + ringWidth - 0.04, y2: oy2 - 0.04 },
    ];

    for (const side of sides) {
      if (side.x2 - side.x1 >= RULES.LICON_SIZE && side.y2 - side.y1 >= RULES.LICON_SIZE) {
        const cts = generateContactArray({
          contactLayerId: SKY130_LAYERS.LICON,
          contactSize: RULES.LICON_SIZE,
          contactSpacing: RULES.LICON_SPACING,
          region: side,
        });
        geoms.push(...cts);
      }
    }
  }

  // Implant
  const impEnc = type === "p-sub" ? RULES.PSDM_DIFF_ENC : RULES.NSDM_DIFF_ENC;
  const impLayer = type === "p-sub" ? SKY130_LAYERS.PSDM : SKY130_LAYERS.NSDM;
  geoms.push(rect(impLayer,
    ox1 - ringWidth - impEnc, oy1 - ringWidth - impEnc,
    ox2 + ringWidth + impEnc, oy2 + ringWidth + impEnc,
    { role: "guard_ring_implant" },
  ));

  return geoms;
}

// ══════════════════════════════════════════════════════════════════════
// Resistor Generator
// ══════════════════════════════════════════════════════════════════════

export interface ResistorParams {
  /** Resistor type */
  type: "poly" | "ndiff" | "pdiff";
  /** Width in µm */
  W: number;
  /** Length in µm (resistance direction) */
  L: number;
  /** Include head/tail contacts */
  contacts: boolean;
}

export interface ResistorResult {
  geometries: CanvasGeometry[];
  pins: CellPin[];
  bbox: { x1: number; y1: number; x2: number; y2: number };
  /** Estimated resistance in ohms */
  resistance: number;
}

export function generateResistor(params: ResistorParams): ResistorResult {
  const { type, W, L, contacts: includeContacts } = params;
  const geoms: CanvasGeometry[] = [];
  const pins: CellPin[] = [];

  const bodyLayer = type === "poly" ? SKY130_LAYERS.POLY : SKY130_LAYERS.DIFF;
  const sheetRes = type === "poly" ? 48 : 100; // ohms/sq approximate

  // Body of resistor
  geoms.push(rect(bodyLayer, 0, 0, L, W, { role: "resistor_body", type }));

  // Contact heads
  if (includeContacts) {
    const contactW = RULES.LICON_SIZE + 2 * 0.06;
    // Left contact head
    const headRegion = {
      x1: -contactW,
      y1: 0.04,
      x2: 0,
      y2: W - 0.04,
    };
    const leftContacts = generateContactArray({
      contactLayerId: SKY130_LAYERS.LICON,
      contactSize: RULES.LICON_SIZE,
      contactSpacing: RULES.LICON_SPACING,
      region: headRegion,
    });
    geoms.push(...leftContacts);

    // LI pad for left
    geoms.push(rect(SKY130_LAYERS.LI1,
      headRegion.x1 - RULES.LI_ENC_LICON,
      headRegion.y1 - RULES.LI_ENC_LICON,
      headRegion.x2 + RULES.LI_ENC_LICON,
      headRegion.y2 + RULES.LI_ENC_LICON,
    ));

    // Right contact head
    const tailRegion = {
      x1: L,
      y1: 0.04,
      x2: L + contactW,
      y2: W - 0.04,
    };
    const rightContacts = generateContactArray({
      contactLayerId: SKY130_LAYERS.LICON,
      contactSize: RULES.LICON_SIZE,
      contactSpacing: RULES.LICON_SPACING,
      region: tailRegion,
    });
    geoms.push(...rightContacts);

    // LI pad for right
    geoms.push(rect(SKY130_LAYERS.LI1,
      tailRegion.x1 - RULES.LI_ENC_LICON,
      tailRegion.y1 - RULES.LI_ENC_LICON,
      tailRegion.x2 + RULES.LI_ENC_LICON,
      tailRegion.y2 + RULES.LI_ENC_LICON,
    ));

    pins.push(
      { name: "plus", direction: "inout", position: { x: -contactW / 2, y: W / 2 }, layerId: SKY130_LAYERS.LI1 },
      { name: "minus", direction: "inout", position: { x: L + contactW / 2, y: W / 2 }, layerId: SKY130_LAYERS.LI1 },
    );
  }

  // Well for pdiff resistor
  if (type === "pdiff") {
    geoms.push(rect(SKY130_LAYERS.NWELL,
      -0.3, -RULES.NWELL_DIFF_ENC,
      L + 0.3, W + RULES.NWELL_DIFF_ENC,
    ));
  }

  // Compute bbox
  let bx1 = Infinity, by1 = Infinity, bx2 = -Infinity, by2 = -Infinity;
  for (const g of geoms) {
    for (const p of g.points) {
      const hw = (g.width ?? 0) / 2;
      bx1 = Math.min(bx1, p.x - hw);
      by1 = Math.min(by1, p.y - hw);
      bx2 = Math.max(bx2, p.x + hw);
      by2 = Math.max(by2, p.y + hw);
    }
  }

  const squares = L / W;
  const resistance = sheetRes * squares;

  return { geometries: geoms, pins, bbox: { x1: bx1, y1: by1, x2: bx2, y2: by2 }, resistance };
}

// ══════════════════════════════════════════════════════════════════════
// Capacitor Generator
// ══════════════════════════════════════════════════════════════════════

export interface CapacitorParams {
  /** Capacitor type */
  type: "mim" | "mom";
  /** Width in µm */
  W: number;
  /** Length in µm */
  L: number;
  /** For MOM: number of interdigitated fingers */
  fingers?: number;
}

export interface CapacitorResult {
  geometries: CanvasGeometry[];
  pins: CellPin[];
  bbox: { x1: number; y1: number; x2: number; y2: number };
  /** Estimated capacitance in fF */
  capacitance: number;
}

export function generateCapacitor(params: CapacitorParams): CapacitorResult {
  const { type, W, L, fingers = 10 } = params;
  const geoms: CanvasGeometry[] = [];
  const pins: CellPin[] = [];

  if (type === "mim") {
    // MIM cap: MET3-MET4 parallel plate
    // Bottom plate (M3)
    geoms.push(rect(SKY130_LAYERS.MET3, 0, 0, L, W, { role: "bottom_plate" }));
    // Top plate (M4) slightly inset
    const inset = 0.1;
    geoms.push(rect(SKY130_LAYERS.MET4, inset, inset, L - inset, W - inset, { role: "top_plate" }));

    // Via3 to connect bottom plate
    geoms.push(via(SKY130_LAYERS.VIA3, -0.2, W / 2, 0.2));
    geoms.push(rect(SKY130_LAYERS.MET3, -0.4, W / 2 - 0.15, 0, W / 2 + 0.15));

    pins.push(
      { name: "plus", direction: "inout", position: { x: L / 2, y: W + 0.1 }, layerId: SKY130_LAYERS.MET4 },
      { name: "minus", direction: "inout", position: { x: -0.2, y: W / 2 }, layerId: SKY130_LAYERS.MET3 },
    );

    // ~2 fF/µm² for SKY130 MIM
    const capacitance = 2.0 * (L - 2 * inset) * (W - 2 * inset);

    const bx1 = -0.4, by1 = 0, bx2 = L, by2 = W;
    return { geometries: geoms, pins, bbox: { x1: bx1, y1: by1, x2: bx2, y2: by2 }, capacitance };
  }

  // MOM cap: interdigitated fingers on M1/M2
  const fingerW = RULES.M1_WIDTH_MIN;
  const fingerSpacing = RULES.M1_SPACING;
  const fingerPitch = fingerW + fingerSpacing;
  const totalW = fingers * fingerPitch - fingerSpacing;
  const fingerL = L;

  for (let i = 0; i < fingers; i++) {
    const fx = i * fingerPitch;
    const layer = i % 2 === 0 ? SKY130_LAYERS.MET1 : SKY130_LAYERS.MET2;
    geoms.push(rect(layer, fx, 0, fx + fingerW, fingerL, {
      role: "finger",
      electrode: i % 2 === 0 ? "plus" : "minus",
    }));
  }

  // Bus bars
  geoms.push(rect(SKY130_LAYERS.MET1, 0, -0.2, totalW, 0, { role: "bus_plus" }));
  geoms.push(rect(SKY130_LAYERS.MET2, 0, fingerL, totalW, fingerL + 0.2, { role: "bus_minus" }));

  pins.push(
    { name: "plus", direction: "inout", position: { x: totalW / 2, y: -0.1 }, layerId: SKY130_LAYERS.MET1 },
    { name: "minus", direction: "inout", position: { x: totalW / 2, y: fingerL + 0.1 }, layerId: SKY130_LAYERS.MET2 },
  );

  // Rough MOM capacitance: ~1 fF/µm lateral, area-dependent
  const capacitance = 0.1 * fingers * fingerL;

  return {
    geometries: geoms,
    pins,
    bbox: { x1: 0, y1: -0.2, x2: totalW, y2: fingerL + 0.2 },
    capacitance,
  };
}

// ══════════════════════════════════════════════════════════════════════
// ESD Diode Generator
// ══════════════════════════════════════════════════════════════════════

export interface EsdDiodeParams {
  /** Width in µm */
  W: number;
  /** Length in µm */
  L: number;
  /** Include nwell for p+/nwell diode? */
  pnType: "p+/nwell" | "n+/psub";
}

export function generateEsdDiode(params: EsdDiodeParams): { geometries: CanvasGeometry[]; pins: CellPin[] } {
  const { W, L, pnType } = params;
  const geoms: CanvasGeometry[] = [];
  const pins: CellPin[] = [];

  // Anode: diffusion
  geoms.push(rect(SKY130_LAYERS.DIFF, 0, 0, L, W, { role: "diode_anode" }));

  // Cathode: tap (body contact)
  const catX = L + 0.3;
  geoms.push(rect(SKY130_LAYERS.TAP, catX, 0, catX + 0.3, W, { role: "diode_cathode" }));

  if (pnType === "p+/nwell") {
    // NWELL under both
    geoms.push(rect(SKY130_LAYERS.NWELL, -0.2, -0.2, catX + 0.5, W + 0.2));
    geoms.push(rect(SKY130_LAYERS.PSDM, -0.125, -0.125, L + 0.125, W + 0.125));
    geoms.push(rect(SKY130_LAYERS.NSDM, catX - 0.125, -0.125, catX + 0.3 + 0.125, W + 0.125));
  } else {
    geoms.push(rect(SKY130_LAYERS.NSDM, -0.125, -0.125, L + 0.125, W + 0.125));
    geoms.push(rect(SKY130_LAYERS.PSDM, catX - 0.125, -0.125, catX + 0.3 + 0.125, W + 0.125));
  }

  // Contacts
  const anodeContacts = generateContactArray({
    contactLayerId: SKY130_LAYERS.LICON,
    contactSize: RULES.LICON_SIZE,
    contactSpacing: RULES.LICON_SPACING,
    region: { x1: 0.04, y1: 0.04, x2: L - 0.04, y2: W - 0.04 },
  });
  geoms.push(...anodeContacts);

  pins.push(
    { name: "anode", direction: "inout", position: { x: L / 2, y: W / 2 }, layerId: SKY130_LAYERS.LI1 },
    { name: "cathode", direction: "inout", position: { x: catX + 0.15, y: W / 2 }, layerId: SKY130_LAYERS.LI1 },
  );

  return { geometries: geoms, pins };
}

// ══════════════════════════════════════════════════════════════════════
// Convenience: Generate MOSFET as cell-ready data
// ══════════════════════════════════════════════════════════════════════

/** Default NMOS parameters */
export const DEFAULT_NMOS: MosfetParams = {
  type: "nmos",
  W: 0.42,
  L: 0.15,
  nf: 1,
  contacts: true,
  guardRing: false,
  includeWell: false,
  includeImplant: true,
};

/** Default PMOS parameters */
export const DEFAULT_PMOS: MosfetParams = {
  type: "pmos",
  W: 0.42,
  L: 0.15,
  nf: 1,
  contacts: true,
  guardRing: false,
  includeWell: true,
  includeImplant: true,
};

/** Default poly resistor parameters */
export const DEFAULT_RESISTOR: ResistorParams = {
  type: "poly",
  W: 0.33,
  L: 2.0,
  contacts: true,
};

/** Default MIM capacitor parameters */
export const DEFAULT_MIM_CAP: CapacitorParams = {
  type: "mim",
  W: 5.0,
  L: 5.0,
};

/** Default MOM capacitor parameters */
export const DEFAULT_MOM_CAP: CapacitorParams = {
  type: "mom",
  W: 0, // computed from fingers
  L: 5.0,
  fingers: 10,
};
