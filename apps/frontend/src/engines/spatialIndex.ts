/**
 * Spatial Index — R-tree based spatial indexing for fast geometry queries.
 *
 * Provides O(log n) hit-testing, region queries, and nearest-neighbor lookups
 * for layout geometries. Uses a simple in-memory R-tree implementation
 * (no external dependency).
 *
 * Usage:
 *   const index = new SpatialIndex();
 *   index.rebuild(geometries);
 *   const hits = index.query(bbox);
 *   const nearest = index.hitTest(point, zoom);
 */

import type { CanvasGeometry } from "../stores/geometryStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface IndexEntry {
  /** Index in the geometries array */
  index: number;
  /** Cached bounding box */
  bbox: BBox;
  /** Layer ID for fast filtering */
  layerId: number;
}

// ══════════════════════════════════════════════════════════════════════
// R-tree Node (simplified bulk-loaded R-tree)
// ══════════════════════════════════════════════════════════════════════

interface RTreeNode {
  bbox: BBox;
  children: RTreeNode[];
  entries: IndexEntry[];    // leaf nodes have entries
  isLeaf: boolean;
}

const MAX_ENTRIES = 16;  // max entries per leaf node

/** Create an empty bounding box */
function emptyBBox(): BBox {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

/** Extend bbox to include another bbox */
function extendBBox(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** Check if two bboxes intersect */
function bboxIntersects(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX &&
         a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Check if bbox a contains point */
export function bboxContainsPoint(bbox: BBox, x: number, y: number): boolean {
  return x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY;
}

/** Compute bounding box of a geometry */
function geometryBBox(geom: CanvasGeometry): BBox {
  if (geom.points.length === 0) return emptyBBox();

  const hw = (geom.width ?? 0) / 2;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const p of geom.points) {
    minX = Math.min(minX, p.x - hw);
    minY = Math.min(minY, p.y - hw);
    maxX = Math.max(maxX, p.x + hw);
    maxY = Math.max(maxY, p.y + hw);
  }

  return { minX, minY, maxX, maxY };
}

/** Build R-tree from sorted entries using Sort-Tile-Recursive (STR) bulk loading */
function buildRTree(entries: IndexEntry[]): RTreeNode {
  if (entries.length <= MAX_ENTRIES) {
    // Leaf node
    let bbox = emptyBBox();
    for (const e of entries) bbox = extendBBox(bbox, e.bbox);
    return { bbox, children: [], entries, isLeaf: true };
  }

  // Sort by X center, then split into slices
  const sorted = [...entries].sort(
    (a, b) => (a.bbox.minX + a.bbox.maxX) / 2 - (b.bbox.minX + b.bbox.maxX) / 2,
  );

  const numSlices = Math.ceil(Math.sqrt(entries.length / MAX_ENTRIES));
  const sliceSize = Math.ceil(entries.length / numSlices);

  const children: RTreeNode[] = [];

  for (let i = 0; i < sorted.length; i += sliceSize) {
    const slice = sorted.slice(i, i + sliceSize);
    // Sort each slice by Y center
    slice.sort(
      (a, b) => (a.bbox.minY + a.bbox.maxY) / 2 - (b.bbox.minY + b.bbox.maxY) / 2,
    );

    for (let j = 0; j < slice.length; j += MAX_ENTRIES) {
      const group = slice.slice(j, j + MAX_ENTRIES);
      children.push(buildRTree(group));
    }
  }

  let bbox = emptyBBox();
  for (const c of children) bbox = extendBBox(bbox, c.bbox);

  return { bbox, children, entries: [], isLeaf: false };
}

// ══════════════════════════════════════════════════════════════════════
// SpatialIndex Class
// ══════════════════════════════════════════════════════════════════════

export class SpatialIndex {
  private root: RTreeNode | null = null;
  private entries: IndexEntry[] = [];
  private geometryCount = 0;

  /** Rebuild the index from scratch with a new geometry array */
  rebuild(geometries: CanvasGeometry[]): void {
    this.geometryCount = geometries.length;
    this.entries = geometries.map((geom, index) => ({
      index,
      bbox: geometryBBox(geom),
      layerId: geom.layerId,
    }));

    if (this.entries.length === 0) {
      this.root = null;
      return;
    }

    this.root = buildRTree(this.entries);
  }

  /** Query all entries whose bboxes intersect the given region */
  query(region: BBox, layerFilter?: Set<number>): IndexEntry[] {
    const results: IndexEntry[] = [];
    if (!this.root) return results;
    this._queryNode(this.root, region, layerFilter, results);
    return results;
  }

  private _queryNode(
    node: RTreeNode,
    region: BBox,
    layerFilter: Set<number> | undefined,
    results: IndexEntry[],
  ): void {
    if (!bboxIntersects(node.bbox, region)) return;

    if (node.isLeaf) {
      for (const entry of node.entries) {
        if (bboxIntersects(entry.bbox, region)) {
          if (!layerFilter || layerFilter.has(entry.layerId)) {
            results.push(entry);
          }
        }
      }
    } else {
      for (const child of node.children) {
        this._queryNode(child, region, layerFilter, results);
      }
    }
  }

  /** Hit-test: find entries near a point (within tolerance in layout units) */
  hitTest(x: number, y: number, tolerance: number, layerFilter?: Set<number>): IndexEntry[] {
    const region: BBox = {
      minX: x - tolerance,
      minY: y - tolerance,
      maxX: x + tolerance,
      maxY: y + tolerance,
    };
    return this.query(region, layerFilter);
  }

  /** Find the closest entry to a point */
  nearest(x: number, y: number, maxDistance: number, layerFilter?: Set<number>): IndexEntry | null {
    const candidates = this.hitTest(x, y, maxDistance, layerFilter);
    if (candidates.length === 0) return null;

    let best: IndexEntry | null = null;
    let bestDist = Infinity;

    for (const entry of candidates) {
      const cx = (entry.bbox.minX + entry.bbox.maxX) / 2;
      const cy = (entry.bbox.minY + entry.bbox.maxY) / 2;
      const dist = Math.hypot(cx - x, cy - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = entry;
      }
    }

    return best;
  }

  /** Get all entries on a specific layer */
  queryByLayer(layerId: number): IndexEntry[] {
    return this.entries.filter((e) => e.layerId === layerId);
  }

  /** Get viewport-visible entries for culling */
  queryViewport(viewport: {
    centerX: number;
    centerY: number;
    zoom: number;
    canvasWidth: number;
    canvasHeight: number;
  }): IndexEntry[] {
    const halfW = viewport.canvasWidth / (2 * viewport.zoom);
    const halfH = viewport.canvasHeight / (2 * viewport.zoom);
    const region: BBox = {
      minX: viewport.centerX - halfW,
      minY: viewport.centerY - halfH,
      maxX: viewport.centerX + halfW,
      maxY: viewport.centerY + halfH,
    };
    return this.query(region);
  }

  /** Get total entry count */
  get size(): number {
    return this.geometryCount;
  }

  /** Check if index needs rebuild (geometry count changed) */
  needsRebuild(currentCount: number): boolean {
    return currentCount !== this.geometryCount;
  }
}

// ══════════════════════════════════════════════════════════════════════
// Singleton for global use
// ══════════════════════════════════════════════════════════════════════

/** Global spatial index instance */
export const globalSpatialIndex = new SpatialIndex();

// ══════════════════════════════════════════════════════════════════════
// Utility: Geometry-level hit testing (precise, not just bbox)
// ══════════════════════════════════════════════════════════════════════

/** Check if a point is inside a geometry (precise check, not just bbox) */
export function pointInGeometry(
  x: number,
  y: number,
  geom: CanvasGeometry,
  tolerance = 0,
): boolean {
  switch (geom.type) {
    case "rect": {
      if (geom.points.length < 2) return false;
      const [p0, p1] = geom.points;
      const minX = Math.min(p0.x, p1.x) - tolerance;
      const maxX = Math.max(p0.x, p1.x) + tolerance;
      const minY = Math.min(p0.y, p1.y) - tolerance;
      const maxY = Math.max(p0.y, p1.y) + tolerance;
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    case "via": {
      if (geom.points.length < 1) return false;
      const center = geom.points[0];
      const hw = ((geom.width ?? 0.17) / 2) + tolerance;
      return Math.abs(x - center.x) <= hw && Math.abs(y - center.y) <= hw;
    }

    case "polygon": {
      // Point-in-polygon using ray casting
      if (geom.points.length < 3) return false;
      let inside = false;
      const pts = geom.points;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const yi = pts[i].y, yj = pts[j].y;
        const xi = pts[i].x, xj = pts[j].x;
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }

    case "path": {
      // Distance from point to polyline segments
      const hw = ((geom.width ?? 0.1) / 2) + tolerance;
      for (let i = 0; i < geom.points.length - 1; i++) {
        const a = geom.points[i];
        const b = geom.points[i + 1];
        const dist = pointToSegmentDist(x, y, a.x, a.y, b.x, b.y);
        if (dist <= hw) return true;
      }
      return false;
    }

    case "instance":
      // Instance hit-testing is handled by flattening
      return false;

    default:
      return false;
  }
}

/** Distance from point (px, py) to line segment (ax, ay)-(bx, by) */
function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}
