/**
 * Tests for engines/drc.ts
 */

import { describe, it, expect } from "vitest";
import { prepareDrcGeometries, runDrc } from "../engines/drc";
import type { DesignRule } from "../plugins/types";

// Helper to build a simple rect geometry
function rect(layerId: number, x1: number, y1: number, x2: number, y2: number) {
  return {
    type: "rect" as const,
    layerId,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════
// prepareDrcGeometries
// ══════════════════════════════════════════════════════════════════════

describe("prepareDrcGeometries", () => {
  it("converts raw geometries to DrcGeometry[]", () => {
    const geoms = [rect(1, 0, 0, 1, 1)];
    const result = prepareDrcGeometries(geoms);
    expect(result.length).toBe(1);
    expect(result[0].bbox).toBeDefined();
  });

  it("computes bounding box correctly for rects", () => {
    const geoms = [rect(1, -1, -2, 3, 4)];
    const result = prepareDrcGeometries(geoms);
    expect(result[0].bbox.minX).toBeCloseTo(-1);
    expect(result[0].bbox.minY).toBeCloseTo(-2);
    expect(result[0].bbox.maxX).toBeCloseTo(3);
    expect(result[0].bbox.maxY).toBeCloseTo(4);
  });

  it("applies layer alias mapping", () => {
    const geoms = [rect(8, 0, 0, 1, 1)];
    const result = prepareDrcGeometries(geoms, { 8: "M1" });
    expect(result[0].layerAlias).toBe("M1");
  });

  it("uses default alias for unknown layers", () => {
    const geoms = [rect(99, 0, 0, 1, 1)];
    const result = prepareDrcGeometries(geoms);
    // Should default to something like "L99"
    expect(result[0].layerAlias).toContain("99");
  });

  it("handles via geometries", () => {
    const via = {
      type: "via" as const,
      layerId: 1,
      points: [{ x: 0.5, y: 0.5 }],
      width: 0.17,
    };
    const result = prepareDrcGeometries([via]);
    expect(result.length).toBe(1);
    // Bbox should expand around the center point
    expect(result[0].bbox.minX).toBeLessThan(0.5);
    expect(result[0].bbox.maxX).toBeGreaterThan(0.5);
  });
});

// ══════════════════════════════════════════════════════════════════════
// runDrc
// ══════════════════════════════════════════════════════════════════════

describe("runDrc", () => {
  const minWidthRule: DesignRule = {
    id: "min_width_M1",
    type: "min_width",
    description: "Minimum width for M1",
    severity: "error",
    layers: ["M1"],
    value: 0.5,
    enabled: true,
  };

  const spacingRule: DesignRule = {
    id: "min_spacing_M1",
    type: "min_spacing",
    description: "Minimum spacing for M1",
    severity: "error",
    layers: ["M1"],
    value: 0.3,
    enabled: true,
  };

  it("returns no violations when all rules pass", () => {
    const geoms = prepareDrcGeometries([rect(1, 0, 0, 2, 2)], { 1: "M1" });
    const result = runDrc(geoms, [minWidthRule]);
    expect(result.violations.length).toBe(0);
  });

  it("detects min_width violation", () => {
    // A rect 0.2 wide — violates 0.5 minimum
    const geoms = prepareDrcGeometries([rect(1, 0, 0, 0.2, 2)], { 1: "M1" });
    const result = runDrc(geoms, [minWidthRule]);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0].ruleId).toBe("min_width_M1");
  });

  it("detects min_spacing violation", () => {
    // Two rects 0.1 apart — violates 0.3 spacing
    const geoms = prepareDrcGeometries(
      [rect(1, 0, 0, 1, 1), rect(1, 1.1, 0, 2, 1)],
      { 1: "M1" },
    );
    const result = runDrc(geoms, [spacingRule]);
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
  });

  it("skips disabled rules", () => {
    const disabledRule: DesignRule = { ...minWidthRule, enabled: false };
    const geoms = prepareDrcGeometries([rect(1, 0, 0, 0.2, 2)], { 1: "M1" });
    const result = runDrc(geoms, [disabledRule]);
    expect(result.violations.length).toBe(0);
  });

  it("reports correct violation severity", () => {
    const geoms = prepareDrcGeometries([rect(1, 0, 0, 0.2, 2)], { 1: "M1" });
    const result = runDrc(geoms, [minWidthRule]);
    if (result.violations.length > 0) {
      expect(result.violations[0].severity).toBe("error");
    }
  });
});
