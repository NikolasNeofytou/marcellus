/**
 * layoutHitTesting — Pure geometry utilities for hit-testing and
 * box-selection inside the layout canvas.
 *
 * Zero React / store dependencies — these are plain functions that
 * operate on CanvasGeometry / LayerDef arrays.
 */

import type { CanvasGeometry } from "../stores/geometryStore";
import type { LayerDef } from "../stores/layerStore";
import type { ViewportState } from "../hooks/useLayoutViewport";

// ── Point-in-polygon (ray-casting) ──────────────────────────────────

export function pointInPolygon(
  x: number,
  y: number,
  polygon: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Distance from point to line segment ─────────────────────────────

export function distanceToSegment(
  px: number,
  py: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0)
    return Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - a.x - t * dx) ** 2 + (py - a.y - t * dy) ** 2);
}

// ── Compute bounding box of a single geometry ───────────────────────

export function geomBoundingBox(
  geom: CanvasGeometry,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (geom.points.length === 0) return null;

  if (geom.type === "via") {
    const halfW = (geom.width ?? 0.17) / 2;
    return {
      minX: geom.points[0].x - halfW,
      minY: geom.points[0].y - halfW,
      maxX: geom.points[0].x + halfW,
      maxY: geom.points[0].y + halfW,
    };
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of geom.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (geom.type === "path" && geom.width) {
    const halfW = geom.width / 2;
    minX -= halfW;
    minY -= halfW;
    maxX += halfW;
    maxY += halfW;
  }
  return { minX, minY, maxX, maxY };
}

// ── Hit-test geometries (returns highest-layer index, or -1) ────────

export function hitTestGeometries(
  x: number,
  y: number,
  geometries: CanvasGeometry[],
  layers: LayerDef[],
): number {
  for (let i = geometries.length - 1; i >= 0; i--) {
    const geom = geometries[i];
    const layer = layers.find((l) => l.id === geom.layerId);
    if (!layer || !layer.visible || !layer.selectable) continue;

    if (geom.type === "rect" && geom.points.length >= 2) {
      const [p1, p2] = geom.points;
      if (
        x >= Math.min(p1.x, p2.x) &&
        x <= Math.max(p1.x, p2.x) &&
        y >= Math.min(p1.y, p2.y) &&
        y <= Math.max(p1.y, p2.y)
      ) {
        return i;
      }
    }
    if (geom.type === "via") {
      const pos = geom.points[0];
      const halfW = (geom.width ?? 0.17) / 2;
      if (
        x >= pos.x - halfW &&
        x <= pos.x + halfW &&
        y >= pos.y - halfW &&
        y <= pos.y + halfW
      ) {
        return i;
      }
    }
    if (geom.type === "polygon" && geom.points.length >= 3) {
      if (pointInPolygon(x, y, geom.points)) return i;
    }
    if (geom.type === "path" && geom.points.length >= 2) {
      const halfW = (geom.width ?? 0.1) / 2 + 0.05;
      for (let j = 0; j < geom.points.length - 1; j++) {
        if (
          distanceToSegment(x, y, geom.points[j], geom.points[j + 1]) <=
          halfW
        )
          return i;
      }
    }
  }
  return -1;
}

// ── Box selection — returns indices of geometries fully inside ──────

export function boxSelectGeometries(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  geometries: CanvasGeometry[],
  layers: LayerDef[],
): number[] {
  const hits: number[] = [];
  for (let i = 0; i < geometries.length; i++) {
    const geom = geometries[i];
    const layer = layers.find((l) => l.id === geom.layerId);
    if (!layer || !layer.visible || !layer.selectable) continue;
    const bb = geomBoundingBox(geom);
    if (!bb) continue;
    if (
      bb.minX >= minX &&
      bb.maxX <= maxX &&
      bb.minY >= minY &&
      bb.maxY <= maxY
    ) {
      hits.push(i);
    }
  }
  return hits;
}

// ── Selection handle hit-testing (corners / vertices) ───────────────

export function hitTestSelectionHandle(
  x: number,
  y: number,
  geom: CanvasGeometry,
  vp: ViewportState,
): number {
  const handleRadiusLayout = 6 / vp.zoom; // 6 screen pixels

  if (geom.type === "rect" && geom.points.length >= 2) {
    const [p1, p2] = geom.points;
    const corners = [
      { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) }, // 0: bottom-left
      { x: Math.max(p1.x, p2.x), y: Math.min(p1.y, p2.y) }, // 1: bottom-right
      { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) }, // 2: top-right
      { x: Math.min(p1.x, p2.x), y: Math.max(p1.y, p2.y) }, // 3: top-left
    ];
    for (let i = 0; i < corners.length; i++) {
      const c = corners[i];
      if (
        Math.abs(x - c.x) <= handleRadiusLayout &&
        Math.abs(y - c.y) <= handleRadiusLayout
      ) {
        return i;
      }
    }
  } else if (
    (geom.type === "polygon" || geom.type === "path") &&
    geom.points.length >= 2
  ) {
    for (let i = 0; i < geom.points.length; i++) {
      const p = geom.points[i];
      if (
        Math.abs(x - p.x) <= handleRadiusLayout &&
        Math.abs(y - p.y) <= handleRadiusLayout
      ) {
        return i;
      }
    }
  }
  return -1;
}
