/**
 * Tests for utils/layoutHitTesting.ts — pure geometry utilities.
 */

import { describe, it, expect } from "vitest";
import {
  pointInPolygon,
  distanceToSegment,
  geomBoundingBox,
  hitTestGeometries,
  boxSelectGeometries,
  hitTestSelectionHandle,
} from "../utils/layoutHitTesting";
import type { CanvasGeometry } from "../stores/geometryStore";
import type { LayerDef } from "../stores/layerStore";

// ── Helpers ──

const layer: LayerDef = {
  id: 1,
  name: "M1",
  color: "#ff0000",
  fillAlpha: 0.6,
  strokeAlpha: 1,
  visible: true,
  selectable: true,
  locked: false,
  fillPattern: "solid",
  order: 0,
  group: "metal",
};

function makeRect(x1: number, y1: number, x2: number, y2: number): CanvasGeometry {
  return { type: "rect", layerId: 1, points: [{ x: x1, y: y1 }, { x: x2, y: y2 }] };
}

function makeVia(cx: number, cy: number, w = 0.17): CanvasGeometry {
  return { type: "via", layerId: 1, points: [{ x: cx, y: cy }], width: w };
}

// ══════════════════════════════════════════════════════════════════════
// pointInPolygon
// ══════════════════════════════════════════════════════════════════════

describe("pointInPolygon", () => {
  const square = [
    { x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 },
  ];

  it("returns true for point inside", () => {
    expect(pointInPolygon(1, 1, square)).toBe(true);
  });

  it("returns false for point outside", () => {
    expect(pointInPolygon(3, 3, square)).toBe(false);
  });

  it("works with a triangle", () => {
    const tri = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }];
    expect(pointInPolygon(2, 1, tri)).toBe(true);
    expect(pointInPolygon(0, 3, tri)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// distanceToSegment
// ══════════════════════════════════════════════════════════════════════

describe("distanceToSegment", () => {
  it("returns 0 when point is on the segment", () => {
    expect(distanceToSegment(1, 0, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0);
  });

  it("returns perpendicular distance", () => {
    expect(distanceToSegment(1, 1, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(1);
  });

  it("returns distance to nearest endpoint when beyond segment", () => {
    expect(distanceToSegment(3, 0, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(1);
  });

  it("handles zero-length segment", () => {
    expect(distanceToSegment(1, 1, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(Math.SQRT2);
  });
});

// ══════════════════════════════════════════════════════════════════════
// geomBoundingBox
// ══════════════════════════════════════════════════════════════════════

describe("geomBoundingBox", () => {
  it("computes bbox for a rect", () => {
    const bb = geomBoundingBox(makeRect(1, 2, 5, 8));
    expect(bb).toEqual({ minX: 1, minY: 2, maxX: 5, maxY: 8 });
  });

  it("computes bbox for a via", () => {
    const bb = geomBoundingBox(makeVia(1, 1, 0.2));
    expect(bb!.minX).toBeCloseTo(0.9);
    expect(bb!.maxX).toBeCloseTo(1.1);
  });

  it("returns null for empty points", () => {
    expect(geomBoundingBox({ type: "rect", layerId: 1, points: [] })).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// hitTestGeometries
// ══════════════════════════════════════════════════════════════════════

describe("hitTestGeometries", () => {
  const geoms = [makeRect(0, 0, 2, 2), makeRect(3, 3, 5, 5)];

  it("returns index when clicking inside a rect", () => {
    expect(hitTestGeometries(1, 1, geoms, [layer])).toBe(0);
    expect(hitTestGeometries(4, 4, geoms, [layer])).toBe(1);
  });

  it("returns -1 when clicking empty space", () => {
    expect(hitTestGeometries(10, 10, geoms, [layer])).toBe(-1);
  });

  it("returns top-most (last) geometry when overlapping", () => {
    const overlapping = [makeRect(0, 0, 3, 3), makeRect(1, 1, 4, 4)];
    expect(hitTestGeometries(2, 2, overlapping, [layer])).toBe(1);
  });

  it("skips invisible layers", () => {
    const hiddenLayer = { ...layer, visible: false };
    expect(hitTestGeometries(1, 1, geoms, [hiddenLayer])).toBe(-1);
  });

  it("skips non-selectable layers", () => {
    const nonSel = { ...layer, selectable: false };
    expect(hitTestGeometries(1, 1, geoms, [nonSel])).toBe(-1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// boxSelectGeometries
// ══════════════════════════════════════════════════════════════════════

describe("boxSelectGeometries", () => {
  const geoms = [makeRect(0, 0, 1, 1), makeRect(2, 2, 3, 3), makeRect(10, 10, 11, 11)];

  it("selects geometries fully inside the box", () => {
    const hits = boxSelectGeometries(-1, -1, 4, 4, geoms, [layer]);
    expect(hits).toContain(0);
    expect(hits).toContain(1);
    expect(hits).not.toContain(2);
  });

  it("returns empty when no geometry inside", () => {
    expect(boxSelectGeometries(5, 5, 6, 6, geoms, [layer])).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════
// hitTestSelectionHandle
// ══════════════════════════════════════════════════════════════════════

describe("hitTestSelectionHandle", () => {
  const vp = { centerX: 0, centerY: 0, zoom: 20 };

  it("detects corner handle click on a rect", () => {
    const r = makeRect(0, 0, 2, 2);
    // bottom-left corner is (0, 0) — handle 0
    expect(hitTestSelectionHandle(0, 0, r, vp)).toBe(0);
  });

  it("returns -1 when clicking away from handles", () => {
    const r = makeRect(0, 0, 2, 2);
    expect(hitTestSelectionHandle(1, 1, r, vp)).toBe(-1);
  });
});
