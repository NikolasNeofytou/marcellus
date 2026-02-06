/**
 * DRC (Design Rule Check) Engine
 *
 * Checks layout geometries against PDK design rules and produces
 * violation markers. Runs client-side for real-time feedback.
 *
 * Supported rule types:
 *  - min_width: minimum dimension of a geometry on a layer
 *  - min_spacing: minimum distance between two geometries on same/different layer
 *  - min_area: minimum area of a geometry
 *  - min_enclosure: minimum overlap between a geometry on one layer enclosing another
 *  - exact_width: geometry must be exactly this width (for contacts/vias)
 */

import type { DesignRule, DesignRuleType, TechLayer } from "../plugins/types";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface DrcGeometry {
  /** Index into the canvas geometry array */
  index: number;
  type: "rect" | "polygon" | "path" | "via";
  /** Layer alias from PDK (e.g. "M1", "POLY") */
  layerAlias: string;
  /** Bounding box */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** All points */
  points: { x: number; y: number }[];
  /** Width for paths/vias */
  width?: number;
}

export interface DrcViolation {
  /** Unique violation id */
  id: string;
  /** Rule that was violated */
  ruleId: string;
  /** Rule description */
  description: string;
  /** Severity */
  severity: "error" | "warning" | "info";
  /** Rule type */
  ruleType: DesignRuleType;
  /** Geometry index(es) involved */
  geometryIndices: number[];
  /** Location of the violation (center of the violation region) */
  location: { x: number; y: number };
  /** Bounding box of the violation region */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  /** The violating value */
  actualValue: number;
  /** The required value */
  requiredValue: number;
  /** Layer(s) involved */
  layers: string[];
}

export interface DrcResult {
  /** All violations found */
  violations: DrcViolation[];
  /** Number of rules checked */
  rulesChecked: number;
  /** Number of geometries checked */
  geometriesChecked: number;
  /** Runtime in milliseconds */
  runtimeMs: number;
  /** Timestamp */
  timestamp: number;
}

// ══════════════════════════════════════════════════════════════════════
// Layer Alias Mapping
// ══════════════════════════════════════════════════════════════════════

/** Map from internal layer IDs to PDK aliases */
const defaultLayerToAlias: Record<number, string> = {
  0: "NW",
  1: "PW",
  2: "DIFF",
  3: "TAP",
  4: "POLY",
  5: "LICON",
  6: "LI",
  7: "MCON",
  8: "M1",
  9: "VIA1",
  10: "M2",
};

// ══════════════════════════════════════════════════════════════════════
// Geometry Helpers
// ══════════════════════════════════════════════════════════════════════

function computeBBox(points: { x: number; y: number }[]): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function bboxWidth(bbox: { minX: number; maxX: number }): number {
  return bbox.maxX - bbox.minX;
}

function bboxHeight(bbox: { minY: number; maxY: number }): number {
  return bbox.maxY - bbox.minY;
}

function bboxArea(bbox: { minX: number; minY: number; maxX: number; maxY: number }): number {
  return (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
}

function bboxCenter(bbox: { minX: number; minY: number; maxX: number; maxY: number }): { x: number; y: number } {
  return { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
}

function bboxOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Minimum distance between two axis-aligned bounding boxes.
 * Returns 0 if they overlap.
 */
function bboxDistance(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): number {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Polygon area using shoelace formula */
function polygonArea(points: { x: number; y: number }[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Compute enclosure: how much bbox `outer` encloses bbox `inner`.
 * Returns the minimum enclosure on any side.
 * Returns negative if inner extends beyond outer.
 */
function minEnclosure(
  outer: { minX: number; minY: number; maxX: number; maxY: number },
  inner: { minX: number; minY: number; maxX: number; maxY: number }
): number {
  const left = inner.minX - outer.minX;
  const right = outer.maxX - inner.maxX;
  const bottom = inner.minY - outer.minY;
  const top = outer.maxY - inner.maxY;
  return Math.min(left, right, bottom, top);
}

// ══════════════════════════════════════════════════════════════════════
// DRC Engine
// ══════════════════════════════════════════════════════════════════════

let violationCounter = 0;

function makeViolationId(): string {
  return `drc_${++violationCounter}`;
}

/**
 * Convert canvas geometries to DRC geometries with layer aliasing.
 */
export function prepareDrcGeometries(
  geometries: Array<{
    type: "rect" | "polygon" | "path" | "via";
    layerId: number;
    points: { x: number; y: number }[];
    width?: number;
  }>,
  layerMap?: Record<number, string>
): DrcGeometry[] {
  const map = layerMap ?? defaultLayerToAlias;
  return geometries.map((g, i) => {
    const alias = map[g.layerId] ?? `L${g.layerId}`;
    let bbox: DrcGeometry["bbox"];

    if (g.type === "via") {
      const halfW = (g.width ?? 0.17) / 2;
      bbox = {
        minX: g.points[0].x - halfW,
        minY: g.points[0].y - halfW,
        maxX: g.points[0].x + halfW,
        maxY: g.points[0].y + halfW,
      };
    } else if (g.type === "path" && g.width) {
      const raw = computeBBox(g.points);
      const halfW = g.width / 2;
      bbox = {
        minX: raw.minX - halfW,
        minY: raw.minY - halfW,
        maxX: raw.maxX + halfW,
        maxY: raw.maxY + halfW,
      };
    } else {
      bbox = computeBBox(g.points);
    }

    return { index: i, type: g.type, layerAlias: alias, bbox, points: g.points, width: g.width };
  });
}

/**
 * Run a full DRC check against the given rules.
 */
export function runDrc(
  geometries: DrcGeometry[],
  rules: DesignRule[],
  _techLayers?: TechLayer[]
): DrcResult {
  const start = performance.now();
  violationCounter = 0;
  const violations: DrcViolation[] = [];
  let rulesChecked = 0;

  const enabledRules = rules.filter((r) => r.enabled);

  // Group geometries by layer alias
  const byLayer = new Map<string, DrcGeometry[]>();
  for (const g of geometries) {
    const arr = byLayer.get(g.layerAlias) ?? [];
    arr.push(g);
    byLayer.set(g.layerAlias, arr);
  }

  for (const rule of enabledRules) {
    rulesChecked++;

    switch (rule.type) {
      case "min_width":
        checkMinWidth(rule, byLayer, violations);
        break;
      case "max_width":
        checkMaxWidth(rule, byLayer, violations);
        break;
      case "exact_width":
        checkExactWidth(rule, byLayer, violations);
        break;
      case "min_spacing":
        if (rule.otherLayer) {
          checkMinSpacingBetweenLayers(rule, byLayer, violations);
        } else {
          checkMinSpacingSameLayer(rule, byLayer, violations);
        }
        break;
      case "min_area":
        checkMinArea(rule, byLayer, violations);
        break;
      case "min_enclosure":
        checkMinEnclosure(rule, byLayer, violations);
        break;
      default:
        // Rule types not yet implemented
        break;
    }
  }

  const end = performance.now();
  return {
    violations,
    rulesChecked,
    geometriesChecked: geometries.length,
    runtimeMs: Math.round((end - start) * 100) / 100,
    timestamp: Date.now(),
  };
}

// ══════════════════════════════════════════════════════════════════════
// Rule Checkers
// ══════════════════════════════════════════════════════════════════════

function checkMinWidth(
  rule: DesignRule,
  byLayer: Map<string, DrcGeometry[]>,
  violations: DrcViolation[]
) {
  for (const layerAlias of rule.layers) {
    const geoms = byLayer.get(layerAlias) ?? [];
    for (const g of geoms) {
      const w = bboxWidth(g.bbox);
      const h = bboxHeight(g.bbox);
      const minDim = Math.min(w, h);

      if (minDim < rule.value - 1e-6) {
        violations.push({
          id: makeViolationId(),
          ruleId: rule.id,
          description: `${rule.description}: ${minDim.toFixed(3)}µm < ${rule.value}µm`,
          severity: rule.severity,
          ruleType: rule.type,
          geometryIndices: [g.index],
          location: bboxCenter(g.bbox),
          bbox: g.bbox,
          actualValue: minDim,
          requiredValue: rule.value,
          layers: [layerAlias],
        });
      }
    }
  }
}

function checkMaxWidth(
  rule: DesignRule,
  byLayer: Map<string, DrcGeometry[]>,
  violations: DrcViolation[]
) {
  for (const layerAlias of rule.layers) {
    const geoms = byLayer.get(layerAlias) ?? [];
    for (const g of geoms) {
      const w = bboxWidth(g.bbox);
      const h = bboxHeight(g.bbox);
      const maxDim = Math.max(w, h);

      if (maxDim > rule.value + 1e-6) {
        violations.push({
          id: makeViolationId(),
          ruleId: rule.id,
          description: `${rule.description}: ${maxDim.toFixed(3)}µm > ${rule.value}µm`,
          severity: rule.severity,
          ruleType: rule.type,
          geometryIndices: [g.index],
          location: bboxCenter(g.bbox),
          bbox: g.bbox,
          actualValue: maxDim,
          requiredValue: rule.value,
          layers: [layerAlias],
        });
      }
    }
  }
}

function checkExactWidth(
  rule: DesignRule,
  byLayer: Map<string, DrcGeometry[]>,
  violations: DrcViolation[]
) {
  for (const layerAlias of rule.layers) {
    const geoms = byLayer.get(layerAlias) ?? [];
    for (const g of geoms) {
      const w = bboxWidth(g.bbox);
      const h = bboxHeight(g.bbox);
      // For exact_width contacts, both dims should be the exact value
      const minDim = Math.min(w, h);
      const maxDim = Math.max(w, h);

      if (Math.abs(minDim - rule.value) > 1e-6 || Math.abs(maxDim - rule.value) > 1e-6) {
        violations.push({
          id: makeViolationId(),
          ruleId: rule.id,
          description: `${rule.description}: ${w.toFixed(3)} × ${h.toFixed(3)}µm ≠ ${rule.value}µm`,
          severity: rule.severity,
          ruleType: rule.type,
          geometryIndices: [g.index],
          location: bboxCenter(g.bbox),
          bbox: g.bbox,
          actualValue: minDim,
          requiredValue: rule.value,
          layers: [layerAlias],
        });
      }
    }
  }
}

function checkMinSpacingSameLayer(
  rule: DesignRule,
  byLayer: Map<string, DrcGeometry[]>,
  violations: DrcViolation[]
) {
  for (const layerAlias of rule.layers) {
    const geoms = byLayer.get(layerAlias) ?? [];
    for (let i = 0; i < geoms.length; i++) {
      for (let j = i + 1; j < geoms.length; j++) {
        const a = geoms[i];
        const b = geoms[j];

        // Skip if they overlap (that's not a spacing violation)
        if (bboxOverlap(a.bbox, b.bbox)) continue;

        const dist = bboxDistance(a.bbox, b.bbox);
        if (dist < rule.value - 1e-6) {
          const center = {
            x: (bboxCenter(a.bbox).x + bboxCenter(b.bbox).x) / 2,
            y: (bboxCenter(a.bbox).y + bboxCenter(b.bbox).y) / 2,
          };
          violations.push({
            id: makeViolationId(),
            ruleId: rule.id,
            description: `${rule.description}: ${dist.toFixed(3)}µm < ${rule.value}µm`,
            severity: rule.severity,
            ruleType: rule.type,
            geometryIndices: [a.index, b.index],
            location: center,
            bbox: {
              minX: Math.min(a.bbox.minX, b.bbox.minX),
              minY: Math.min(a.bbox.minY, b.bbox.minY),
              maxX: Math.max(a.bbox.maxX, b.bbox.maxX),
              maxY: Math.max(a.bbox.maxY, b.bbox.maxY),
            },
            actualValue: dist,
            requiredValue: rule.value,
            layers: [layerAlias],
          });
        }
      }
    }
  }
}

function checkMinSpacingBetweenLayers(
  rule: DesignRule,
  byLayer: Map<string, DrcGeometry[]>,
  violations: DrcViolation[]
) {
  for (const layerAlias of rule.layers) {
    const geomsA = byLayer.get(layerAlias) ?? [];
    const geomsB = byLayer.get(rule.otherLayer!) ?? [];

    for (const a of geomsA) {
      for (const b of geomsB) {
        if (bboxOverlap(a.bbox, b.bbox)) continue;

        const dist = bboxDistance(a.bbox, b.bbox);
        if (dist < rule.value - 1e-6) {
          const center = {
            x: (bboxCenter(a.bbox).x + bboxCenter(b.bbox).x) / 2,
            y: (bboxCenter(a.bbox).y + bboxCenter(b.bbox).y) / 2,
          };
          violations.push({
            id: makeViolationId(),
            ruleId: rule.id,
            description: `${rule.description}: ${dist.toFixed(3)}µm < ${rule.value}µm between ${layerAlias} and ${rule.otherLayer}`,
            severity: rule.severity,
            ruleType: rule.type,
            geometryIndices: [a.index, b.index],
            location: center,
            bbox: {
              minX: Math.min(a.bbox.minX, b.bbox.minX),
              minY: Math.min(a.bbox.minY, b.bbox.minY),
              maxX: Math.max(a.bbox.maxX, b.bbox.maxX),
              maxY: Math.max(a.bbox.maxY, b.bbox.maxY),
            },
            actualValue: dist,
            requiredValue: rule.value,
            layers: [layerAlias, rule.otherLayer!],
          });
        }
      }
    }
  }
}

function checkMinArea(
  rule: DesignRule,
  byLayer: Map<string, DrcGeometry[]>,
  violations: DrcViolation[]
) {
  for (const layerAlias of rule.layers) {
    const geoms = byLayer.get(layerAlias) ?? [];
    for (const g of geoms) {
      let area: number;
      if (g.type === "rect") {
        area = bboxArea(g.bbox);
      } else if (g.type === "polygon" && g.points.length >= 3) {
        area = polygonArea(g.points);
      } else if (g.type === "via") {
        area = bboxArea(g.bbox);
      } else {
        // Path area approximation
        area = bboxArea(g.bbox);
      }

      if (area < rule.value - 1e-9) {
        violations.push({
          id: makeViolationId(),
          ruleId: rule.id,
          description: `${rule.description}: ${area.toFixed(4)}µm² < ${rule.value}µm²`,
          severity: rule.severity,
          ruleType: rule.type,
          geometryIndices: [g.index],
          location: bboxCenter(g.bbox),
          bbox: g.bbox,
          actualValue: area,
          requiredValue: rule.value,
          layers: [layerAlias],
        });
      }
    }
  }
}

function checkMinEnclosure(
  rule: DesignRule,
  byLayer: Map<string, DrcGeometry[]>,
  violations: DrcViolation[]
) {
  if (!rule.otherLayer) return;

  // rule.layers[0] is the enclosing layer, rule.otherLayer is the enclosed layer
  for (const enclosingAlias of rule.layers) {
    const enclosingGeoms = byLayer.get(enclosingAlias) ?? [];
    const enclosedGeoms = byLayer.get(rule.otherLayer) ?? [];

    for (const inner of enclosedGeoms) {
      // Find the enclosing geometry that contains this inner geometry
      let bestEnclosure = -Infinity;
      let bestOuter: DrcGeometry | null = null;

      for (const outer of enclosingGeoms) {
        if (bboxOverlap(outer.bbox, inner.bbox)) {
          const enc = minEnclosure(outer.bbox, inner.bbox);
          if (enc > bestEnclosure) {
            bestEnclosure = enc;
            bestOuter = outer;
          }
        }
      }

      if (bestOuter !== null && bestEnclosure < rule.value - 1e-6) {
        violations.push({
          id: makeViolationId(),
          ruleId: rule.id,
          description: `${rule.description}: ${bestEnclosure.toFixed(3)}µm < ${rule.value}µm`,
          severity: rule.severity,
          ruleType: rule.type,
          geometryIndices: [bestOuter.index, inner.index],
          location: bboxCenter(inner.bbox),
          bbox: {
            minX: Math.min(bestOuter.bbox.minX, inner.bbox.minX),
            minY: Math.min(bestOuter.bbox.minY, inner.bbox.minY),
            maxX: Math.max(bestOuter.bbox.maxX, inner.bbox.maxX),
            maxY: Math.max(bestOuter.bbox.maxY, inner.bbox.maxY),
          },
          actualValue: bestEnclosure,
          requiredValue: rule.value,
          layers: [enclosingAlias, rule.otherLayer],
        });
      }
    }
  }
}
