/**
 * Layout Generators Engine — Sprint 19-20
 *
 * Provides automated layout generation utilities:
 * 1. Guard Ring Generator — substrate/well contact rings for noise isolation
 * 2. Common-Centroid Wizard — matched device placement in common-centroid pattern
 * 3. Interdigitation Pattern — interleaved finger placement for matching
 * 4. Auto-Dummy Insertion — dummy structures at array boundaries
 *
 * Each generator produces CanvasGeometry[] ready for commit to geometryStore.
 */

import type { CanvasGeometry } from "../stores/geometryStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface GuardRingParams {
  /** Center X of the region to protect (µm) */
  centerX: number;
  /** Center Y of the region to protect (µm) */
  centerY: number;
  /** Width of the protected region (µm) */
  innerWidth: number;
  /** Height of the protected region (µm) */
  innerHeight: number;
  /** Ring type — determines well/tap layers */
  ringType: "psubstrate" | "nwell";
  /** Width of the ring contacts (µm) */
  contactWidth: number;
  /** Spacing between ring and inner region (µm) */
  spacing: number;
  /** Whether to add well underneath */
  includeWell: boolean;
  /** Contact pitch along ring (µm) */
  contactPitch: number;
}

export interface CommonCentroidParams {
  /** Number of unit cells for device A */
  unitsA: number;
  /** Number of unit cells for device B */
  unitsB: number;
  /** Width of each unit cell (µm) */
  unitWidth: number;
  /** Height of each unit cell (µm) */
  unitHeight: number;
  /** Spacing between unit cells (µm) */
  spacing: number;
  /** Origin X (µm) */
  originX: number;
  /** Origin Y (µm) */
  originY: number;
  /** Number of columns in the array */
  columns: number;
  /** Device type */
  deviceType: "nmos" | "pmos" | "resistor" | "capacitor";
  /** Layer for device A */
  layerIdA: number;
  /** Layer for device B */
  layerIdB: number;
}

export interface InterdigitationParams {
  /** Number of fingers for device A */
  fingersA: number;
  /** Number of fingers for device B */
  fingersB: number;
  /** Finger width (µm) */
  fingerWidth: number;
  /** Finger height / length (µm) */
  fingerLength: number;
  /** Spacing between fingers (µm) */
  spacing: number;
  /** Origin X (µm) */
  originX: number;
  /** Origin Y (µm) */
  originY: number;
  /** Layer for device A fingers */
  layerIdA: number;
  /** Layer for device B fingers */
  layerIdB: number;
  /** Interdigitation pattern */
  pattern: "ABAB" | "ABBA" | "AABB";
  /** Include poly gate over fingers (for MOS) */
  includeGate: boolean;
  /** Gate layer ID */
  gateLayerId: number;
}

export interface DummyInsertionParams {
  /** Bounding box of the device array (µm) */
  arrayLeft: number;
  arrayTop: number;
  arrayRight: number;
  arrayBottom: number;
  /** Dummy cell width (µm) */
  dummyWidth: number;
  /** Dummy cell height (µm) */
  dummyHeight: number;
  /** Spacing between array and dummies (µm) */
  spacing: number;
  /** Layer for dummy structures */
  layerId: number;
  /** Which sides to add dummies */
  sides: ("left" | "right" | "top" | "bottom")[];
  /** Number of dummy rows/columns per side */
  count: number;
  /** Layer for dummy gate (poly) — if applicable */
  gateLayerId?: number;
  /** Whether dummies get a gate stripe */
  includeGate: boolean;
}

export interface GeneratorResult {
  /** Generated geometries */
  geometries: CanvasGeometry[];
  /** Human-readable description of what was generated */
  description: string;
  /** Bounding box of all generated geometry */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** Statistics */
  stats: {
    totalShapes: number;
    layersUsed: number[];
  };
}

// ══════════════════════════════════════════════════════════════════════
// Guard Ring Generator
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate a guard ring around a specified region.
 * Creates well, tap (diffusion contact), and contact/via shapes.
 */
export function generateGuardRing(params: GuardRingParams): GeneratorResult {
  const {
    centerX, centerY, innerWidth, innerHeight,
    ringType, contactWidth, spacing, includeWell, contactPitch,
  } = params;

  const geoms: CanvasGeometry[] = [];
  const layersUsed = new Set<number>();

  // Layer mapping (SKY130-based)
  const wellLayerId = ringType === "nwell" ? 0 : 1;       // nwell=0, pwell=1
  const tapLayerId = 3;                                     // tap
  const contactLayerId = 5;                                 // licon
  const metalLayerId = 6;                                   // li1

  const halfW = innerWidth / 2 + spacing;
  const halfH = innerHeight / 2 + spacing;
  const outerHalfW = halfW + contactWidth;
  const outerHalfH = halfH + contactWidth;

  // Well rectangle (covers entire ring + interior if needed)
  if (includeWell) {
    geoms.push({
      type: "rect",
      layerId: wellLayerId,
      points: [
        { x: centerX - outerHalfW - 0.2, y: centerY - outerHalfH - 0.2 },
        { x: centerX + outerHalfW + 0.2, y: centerY + outerHalfH + 0.2 },
      ],
    });
    layersUsed.add(wellLayerId);
  }

  // Four sides of the tap ring
  const sides = [
    // Bottom
    { x1: centerX - outerHalfW, y1: centerY - outerHalfH, x2: centerX + outerHalfW, y2: centerY - halfH },
    // Top
    { x1: centerX - outerHalfW, y1: centerY + halfH, x2: centerX + outerHalfW, y2: centerY + outerHalfH },
    // Left
    { x1: centerX - outerHalfW, y1: centerY - halfH, x2: centerX - halfW, y2: centerY + halfH },
    // Right
    { x1: centerX + halfW, y1: centerY - halfH, x2: centerX + outerHalfW, y2: centerY + halfH },
  ];

  for (const side of sides) {
    // Tap diffusion
    geoms.push({
      type: "rect",
      layerId: tapLayerId,
      points: [{ x: side.x1, y: side.y1 }, { x: side.x2, y: side.y2 }],
    });
    layersUsed.add(tapLayerId);

    // Metal strap over tap
    geoms.push({
      type: "rect",
      layerId: metalLayerId,
      points: [{ x: side.x1, y: side.y1 }, { x: side.x2, y: side.y2 }],
    });
    layersUsed.add(metalLayerId);

    // Contacts along the ring
    const isHorizontal = Math.abs(side.x2 - side.x1) > Math.abs(side.y2 - side.y1);
    if (isHorizontal) {
      const y = (side.y1 + side.y2) / 2;
      const contactSize = Math.min(contactWidth * 0.6, 0.17);
      for (let x = side.x1 + contactPitch / 2; x < side.x2; x += contactPitch) {
        geoms.push({
          type: "via",
          layerId: contactLayerId,
          points: [{ x, y }],
          width: contactSize,
        });
        layersUsed.add(contactLayerId);
      }
    } else {
      const x = (side.x1 + side.x2) / 2;
      const contactSize = Math.min(contactWidth * 0.6, 0.17);
      for (let y = side.y1 + contactPitch / 2; y < side.y2; y += contactPitch) {
        geoms.push({
          type: "via",
          layerId: contactLayerId,
          points: [{ x, y }],
          width: contactSize,
        });
        layersUsed.add(contactLayerId);
      }
    }
  }

  // Corner pieces (fill the four corners of the ring)
  const corners = [
    { x1: centerX - outerHalfW, y1: centerY - outerHalfH, x2: centerX - halfW, y2: centerY - halfH },
    { x1: centerX + halfW, y1: centerY - outerHalfH, x2: centerX + outerHalfW, y2: centerY - halfH },
    { x1: centerX - outerHalfW, y1: centerY + halfH, x2: centerX - halfW, y2: centerY + outerHalfH },
    { x1: centerX + halfW, y1: centerY + halfH, x2: centerX + outerHalfW, y2: centerY + outerHalfH },
  ];

  for (const corner of corners) {
    geoms.push({
      type: "rect",
      layerId: tapLayerId,
      points: [{ x: corner.x1, y: corner.y1 }, { x: corner.x2, y: corner.y2 }],
    });
  }

  return {
    geometries: geoms,
    description: `${ringType} guard ring: ${innerWidth}×${innerHeight}µm region, ${contactWidth}µm ring width`,
    bbox: {
      minX: centerX - outerHalfW - 0.2,
      minY: centerY - outerHalfH - 0.2,
      maxX: centerX + outerHalfW + 0.2,
      maxY: centerY + outerHalfH + 0.2,
    },
    stats: {
      totalShapes: geoms.length,
      layersUsed: [...layersUsed],
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// Common-Centroid Generator
// ══════════════════════════════════════════════════════════════════════

/**
 * Optimal common-centroid sequence using balanced interleaving.
 * For 2 devices A and B with nA and nB units, produces a 2D assignment
 * that minimises gradient sensitivity.
 */
function generateCommonCentroidSequence(
  nA: number,
  nB: number,
  cols: number,
): ("A" | "B")[] {
  const total = nA + nB;
  const rows = Math.ceil(total / cols);
  const grid: ("A" | "B")[] = new Array(rows * cols).fill("A");

  // Balanced interleaving: place A and B units to maximise symmetry
  // Use a centroid-distance-based greedy approach
  const positions: { idx: number; cx: number; cy: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        idx: r * cols + c,
        cx: c - (cols - 1) / 2,
        cy: r - (rows - 1) / 2,
      });
    }
  }

  // Sort by distance to center (alternating assignment preserves centroid)
  positions.sort((a, b) => {
    const dA = Math.sqrt(a.cx * a.cx + a.cy * a.cy);
    const dB = Math.sqrt(b.cx * b.cx + b.cy * b.cy);
    return dA - dB;
  });

  // Assign alternating from center outward
  let countA = 0;
  let countB = 0;
  let assignA = true;

  for (const pos of positions) {
    if (pos.idx >= total) {
      grid[pos.idx] = "A"; // padding
      continue;
    }

    if (assignA && countA < nA) {
      grid[pos.idx] = "A";
      countA++;
      assignA = !assignA;
    } else if (!assignA && countB < nB) {
      grid[pos.idx] = "B";
      countB++;
      assignA = !assignA;
    } else if (countA < nA) {
      grid[pos.idx] = "A";
      countA++;
    } else {
      grid[pos.idx] = "B";
      countB++;
    }
  }

  return grid.slice(0, total);
}

/**
 * Generate common-centroid layout placement.
 * Places unit cells of two devices in a pattern that minimises
 * systematic gradient errors.
 */
export function generateCommonCentroid(params: CommonCentroidParams): GeneratorResult {
  const {
    unitsA, unitsB, unitWidth, unitHeight, spacing,
    originX, originY, columns, layerIdA, layerIdB,
  } = params;

  const sequence = generateCommonCentroidSequence(unitsA, unitsB, columns);
  const geoms: CanvasGeometry[] = [];
  const layersUsed = new Set<number>();
  const rows = Math.ceil((unitsA + unitsB) / columns);

  const totalWidth = columns * unitWidth + (columns - 1) * spacing;
  const totalHeight = rows * unitHeight + (rows - 1) * spacing;

  for (let i = 0; i < sequence.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = originX + col * (unitWidth + spacing);
    const y = originY + row * (unitHeight + spacing);
    const layerId = sequence[i] === "A" ? layerIdA : layerIdB;

    geoms.push({
      type: "rect",
      layerId,
      points: [
        { x, y },
        { x: x + unitWidth, y: y + unitHeight },
      ],
    });
    layersUsed.add(layerId);
  }

  return {
    geometries: geoms,
    description: `Common-centroid: ${unitsA}×A + ${unitsB}×B in ${columns}-column array`,
    bbox: {
      minX: originX,
      minY: originY,
      maxX: originX + totalWidth,
      maxY: originY + totalHeight,
    },
    stats: {
      totalShapes: geoms.length,
      layersUsed: [...layersUsed],
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// Interdigitation Generator
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate interdigitated finger pattern.
 * Creates alternating fingers of two devices with optional gate overlay.
 */
export function generateInterdigitation(params: InterdigitationParams): GeneratorResult {
  const {
    fingersA, fingersB, fingerWidth, fingerLength, spacing,
    originX, originY, layerIdA, layerIdB, pattern, includeGate, gateLayerId,
  } = params;

  const geoms: CanvasGeometry[] = [];
  const layersUsed = new Set<number>();

  // Build finger sequence based on pattern
  const sequence: ("A" | "B")[] = [];
  const totalFingers = fingersA + fingersB;

  switch (pattern) {
    case "ABAB":
      for (let i = 0; i < totalFingers; i++) {
        sequence.push(i % 2 === 0 ? "A" : "B");
      }
      break;
    case "ABBA": {
      // Mirrored pattern: ABBA ABBA...
      const unit = ["A", "B", "B", "A"] as ("A" | "B")[];
      for (let i = 0; i < totalFingers; i++) {
        sequence.push(unit[i % 4]);
      }
      break;
    }
    case "AABB": {
      // Grouped: AA BB AA BB...
      let a = 0, b = 0;
      let placing: "A" | "B" = "A";
      let groupCount = 0;
      for (let i = 0; i < totalFingers; i++) {
        if (placing === "A" && a < fingersA) {
          sequence.push("A");
          a++;
          groupCount++;
          if (groupCount >= 2) { placing = "B"; groupCount = 0; }
        } else if (placing === "B" && b < fingersB) {
          sequence.push("B");
          b++;
          groupCount++;
          if (groupCount >= 2) { placing = "A"; groupCount = 0; }
        } else if (a < fingersA) {
          sequence.push("A");
          a++;
        } else {
          sequence.push("B");
          b++;
        }
      }
      break;
    }
  }

  // Place fingers
  for (let i = 0; i < sequence.length; i++) {
    const x = originX + i * (fingerWidth + spacing);
    const layerId = sequence[i] === "A" ? layerIdA : layerIdB;

    // Diffusion finger
    geoms.push({
      type: "rect",
      layerId,
      points: [
        { x, y: originY },
        { x: x + fingerWidth, y: originY + fingerLength },
      ],
    });
    layersUsed.add(layerId);

    // Gate over finger (poly stripe between fingers)
    if (includeGate && i < sequence.length - 1) {
      const gateX = x + fingerWidth;
      const gateWidth = spacing;
      geoms.push({
        type: "rect",
        layerId: gateLayerId,
        points: [
          { x: gateX, y: originY - fingerWidth * 0.2 },
          { x: gateX + gateWidth, y: originY + fingerLength + fingerWidth * 0.2 },
        ],
      });
      layersUsed.add(gateLayerId);
    }
  }

  const totalWidth = sequence.length * (fingerWidth + spacing) - spacing;

  return {
    geometries: geoms,
    description: `Interdigitated ${pattern}: ${fingersA}×A + ${fingersB}×B, ${fingerWidth}µm fingers`,
    bbox: {
      minX: originX,
      minY: originY - fingerWidth * 0.2,
      maxX: originX + totalWidth,
      maxY: originY + fingerLength + fingerWidth * 0.2,
    },
    stats: {
      totalShapes: geoms.length,
      layersUsed: [...layersUsed],
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// Auto-Dummy Insertion
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate dummy structures at array boundaries.
 * Dummies improve uniformity of etching and lithography
 * at the edges of regular device arrays.
 */
export function generateDummies(params: DummyInsertionParams): GeneratorResult {
  const {
    arrayLeft, arrayTop, arrayRight, arrayBottom,
    dummyWidth, dummyHeight, spacing, layerId, sides, count,
    gateLayerId, includeGate,
  } = params;

  const geoms: CanvasGeometry[] = [];
  const layersUsed = new Set<number>([layerId]);

  const arrayWidth = arrayRight - arrayLeft;
  const arrayHeight = arrayBottom - arrayTop;

  for (const side of sides) {
    for (let row = 0; row < count; row++) {
      switch (side) {
        case "left": {
          const cols = Math.floor(arrayHeight / (dummyHeight + spacing));
          for (let c = 0; c < cols; c++) {
            const x = arrayLeft - (row + 1) * (dummyWidth + spacing);
            const y = arrayTop + c * (dummyHeight + spacing);
            geoms.push({
              type: "rect",
              layerId,
              points: [{ x, y }, { x: x + dummyWidth, y: y + dummyHeight }],
            });
            if (includeGate && gateLayerId !== undefined) {
              geoms.push({
                type: "rect",
                layerId: gateLayerId,
                points: [
                  { x: x + dummyWidth * 0.3, y: y - 0.05 },
                  { x: x + dummyWidth * 0.7, y: y + dummyHeight + 0.05 },
                ],
              });
              layersUsed.add(gateLayerId);
            }
          }
          break;
        }
        case "right": {
          const cols = Math.floor(arrayHeight / (dummyHeight + spacing));
          for (let c = 0; c < cols; c++) {
            const x = arrayRight + spacing + row * (dummyWidth + spacing);
            const y = arrayTop + c * (dummyHeight + spacing);
            geoms.push({
              type: "rect",
              layerId,
              points: [{ x, y }, { x: x + dummyWidth, y: y + dummyHeight }],
            });
            if (includeGate && gateLayerId !== undefined) {
              geoms.push({
                type: "rect",
                layerId: gateLayerId,
                points: [
                  { x: x + dummyWidth * 0.3, y: y - 0.05 },
                  { x: x + dummyWidth * 0.7, y: y + dummyHeight + 0.05 },
                ],
              });
              layersUsed.add(gateLayerId);
            }
          }
          break;
        }
        case "top": {
          const rowCount = Math.floor(arrayWidth / (dummyWidth + spacing));
          for (let c = 0; c < rowCount; c++) {
            const x = arrayLeft + c * (dummyWidth + spacing);
            const y = arrayTop - (row + 1) * (dummyHeight + spacing);
            geoms.push({
              type: "rect",
              layerId,
              points: [{ x, y }, { x: x + dummyWidth, y: y + dummyHeight }],
            });
            if (includeGate && gateLayerId !== undefined) {
              geoms.push({
                type: "rect",
                layerId: gateLayerId,
                points: [
                  { x: x + dummyWidth * 0.3, y: y - 0.05 },
                  { x: x + dummyWidth * 0.7, y: y + dummyHeight + 0.05 },
                ],
              });
              layersUsed.add(gateLayerId);
            }
          }
          break;
        }
        case "bottom": {
          const rowCount = Math.floor(arrayWidth / (dummyWidth + spacing));
          for (let c = 0; c < rowCount; c++) {
            const x = arrayLeft + c * (dummyWidth + spacing);
            const y = arrayBottom + spacing + row * (dummyHeight + spacing);
            geoms.push({
              type: "rect",
              layerId,
              points: [{ x, y }, { x: x + dummyWidth, y: y + dummyHeight }],
            });
            if (includeGate && gateLayerId !== undefined) {
              geoms.push({
                type: "rect",
                layerId: gateLayerId,
                points: [
                  { x: x + dummyWidth * 0.3, y: y - 0.05 },
                  { x: x + dummyWidth * 0.7, y: y + dummyHeight + 0.05 },
                ],
              });
              layersUsed.add(gateLayerId);
            }
          }
          break;
        }
      }
    }
  }

  const margin = count * (Math.max(dummyWidth, dummyHeight) + spacing);

  return {
    geometries: geoms,
    description: `Auto-dummy: ${count} row(s) on ${sides.join(", ")} sides`,
    bbox: {
      minX: sides.includes("left") ? arrayLeft - margin : arrayLeft,
      minY: sides.includes("top") ? arrayTop - margin : arrayTop,
      maxX: sides.includes("right") ? arrayRight + margin : arrayRight,
      maxY: sides.includes("bottom") ? arrayBottom + margin : arrayBottom,
    },
    stats: {
      totalShapes: geoms.length,
      layersUsed: [...layersUsed],
    },
  };
}
