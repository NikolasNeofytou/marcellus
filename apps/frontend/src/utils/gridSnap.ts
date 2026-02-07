/**
 * Grid snapping utilities for the layout canvas.
 * All coordinates are in layout space (μm).
 */

import type { DesignRule } from "../plugins/types";

export interface GridConfig {
  /** Main grid spacing in μm. */
  gridSpacing: number;
  /** Whether snap-to-grid is enabled. */
  snapEnabled: boolean;
  /** Fine grid subdivisions (e.g. 5 means grid/5). */
  fineSubdivisions: number;
  /** Show grid dots vs lines. */
  displayMode: "lines" | "dots";
}

const DEFAULT_GRID: GridConfig = {
  gridSpacing: 0.1,  // 100nm
  snapEnabled: true,
  fineSubdivisions: 5,
  displayMode: "lines",
};

let currentGrid: GridConfig = { ...DEFAULT_GRID };

/** Get the current grid configuration. */
export function getGridConfig(): GridConfig {
  return { ...currentGrid };
}

/** Update grid configuration. */
export function setGridConfig(config: Partial<GridConfig>) {
  currentGrid = { ...currentGrid, ...config };
}

/** Snap a coordinate value to the nearest grid point. */
export function snapToGrid(value: number, gridSpacing?: number): number {
  if (!currentGrid.snapEnabled) return value;
  const spacing = gridSpacing ?? currentGrid.gridSpacing;
  return Math.round(value / spacing) * spacing;
}

/** Snap a point to the nearest grid intersection. */
export function snapPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: snapToGrid(x),
    y: snapToGrid(y),
  };
}

/** Snap to the fine grid (subdivisions of the main grid). */
export function snapToFineGrid(value: number): number {
  if (!currentGrid.snapEnabled) return value;
  const fineSpacing = currentGrid.gridSpacing / currentGrid.fineSubdivisions;
  return Math.round(value / fineSpacing) * fineSpacing;
}

/** Snap a point to the fine grid. */
export function snapPointFine(x: number, y: number): { x: number; y: number } {
  return {
    x: snapToFineGrid(x),
    y: snapToFineGrid(y),
  };
}

/**
 * Get the adaptive grid spacing for the current zoom level.
 * Ensures grid lines are always ~40px apart on screen.
 */
export function getAdaptiveGridSpacing(zoom: number): number {
  const targets = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100];
  const pixelTarget = 40;
  const idealSpacing = pixelTarget / zoom;
  let best = targets[0];
  for (const t of targets) {
    if (Math.abs(t - idealSpacing) < Math.abs(best - idealSpacing)) {
      best = t;
    }
  }
  return best;
}

/**
 * Constrain a line to 45-degree angles from a start point.
 * Useful for orthogonal/diagonal routing.
 */
export function constrainAngle(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  allowDiagonal: boolean = true
): { x: number; y: number } {
  const dx = endX - startX;
  const dy = endY - startY;

  if (!allowDiagonal) {
    // Manhattan routing: snap to horizontal or vertical
    if (Math.abs(dx) > Math.abs(dy)) {
      return { x: endX, y: startY };
    } else {
      return { x: startX, y: endY };
    }
  }

  // 45-degree snapping
  const angle = Math.atan2(dy, dx);
  const snapAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -(3 * Math.PI) / 4, -Math.PI / 2, -Math.PI / 4];

  let closest = snapAngles[0];
  let minDiff = Math.abs(angle - closest);
  for (const sa of snapAngles) {
    const diff = Math.abs(angle - sa);
    if (diff < minDiff) {
      minDiff = diff;
      closest = sa;
    }
  }

  const dist = Math.sqrt(dx * dx + dy * dy);
  return {
    x: startX + dist * Math.cos(closest),
    y: startY + dist * Math.sin(closest),
  };
}

// ══════════════════════════════════════════════════════════════════════
// DRC-Aware Editing Guides
// ══════════════════════════════════════════════════════════════════════

/** Axis-aligned bounding box used for proximity checks. */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** A visual guide line produced by DRC rule analysis. */
export interface DrcSnapGuide {
  /** Axis of the guide ("h" = horizontal, "v" = vertical). */
  axis: "h" | "v";
  /** Position in layout space (y for horizontal, x for vertical). */
  position: number;
  /** Design rule that generated this guide. */
  ruleId: string;
  /** The rule value (distance in μm). */
  ruleValue: number;
  /** Kind of guide. */
  kind: "min_spacing" | "min_width";
  /** Human-readable tooltip. */
  label: string;
}

/** A simplified geometry used for DRC guide proximity computation. */
export interface GuideGeometry {
  layerAlias: string;
  bbox: BBox;
}

/**
 * Compute DRC-aware snap guides around the cursor position for the
 * active drawing layer.  The guides show where minimum-spacing and
 * minimum-width rules are satisfied.
 *
 * @param cursorX       Current cursor X in layout space
 * @param cursorY       Current cursor Y in layout space
 * @param activeLayer   Alias of the layer being drawn on
 * @param geometries    Nearby geometries to check against
 * @param designRules   PDK design rules
 * @param viewRadius    Only consider geometries within this radius (perf)
 * @returns             Array of guide lines to render on-canvas
 */
export function getDrcSnapGuides(
  cursorX: number,
  cursorY: number,
  activeLayer: string,
  geometries: GuideGeometry[],
  designRules: DesignRule[],
  viewRadius: number = 10
): DrcSnapGuide[] {
  const guides: DrcSnapGuide[] = [];

  // Collect relevant rules for this layer
  const spacingRules = designRules.filter(
    (r) => r.enabled && r.type === "min_spacing" && r.layers.includes(activeLayer)
  );
  const widthRules = designRules.filter(
    (r) => r.enabled && r.type === "min_width" && r.layers.includes(activeLayer)
  );

  // Nearby geometries on the same layer
  const nearby = geometries.filter(
    (g) =>
      g.layerAlias === activeLayer &&
      g.bbox.minX - viewRadius <= cursorX &&
      g.bbox.maxX + viewRadius >= cursorX &&
      g.bbox.minY - viewRadius <= cursorY &&
      g.bbox.maxY + viewRadius >= cursorY
  );

  // ── Min-spacing guides: lines offset from existing geometry edges ──

  for (const rule of spacingRules) {
    const d = rule.value;
    for (const geo of nearby) {
      // Vertical guides (x positions)
      guides.push({
        axis: "v",
        position: geo.bbox.minX - d,
        ruleId: rule.id,
        ruleValue: d,
        kind: "min_spacing",
        label: `${rule.id}: ${d}μm spacing`,
      });
      guides.push({
        axis: "v",
        position: geo.bbox.maxX + d,
        ruleId: rule.id,
        ruleValue: d,
        kind: "min_spacing",
        label: `${rule.id}: ${d}μm spacing`,
      });
      // Horizontal guides (y positions)
      guides.push({
        axis: "h",
        position: geo.bbox.minY - d,
        ruleId: rule.id,
        ruleValue: d,
        kind: "min_spacing",
        label: `${rule.id}: ${d}μm spacing`,
      });
      guides.push({
        axis: "h",
        position: geo.bbox.maxY + d,
        ruleId: rule.id,
        ruleValue: d,
        kind: "min_spacing",
        label: `${rule.id}: ${d}μm spacing`,
      });
    }
  }

  // ── Min-width guides: lines at min-width offset from drawing origin ──

  for (const rule of widthRules) {
    const w = rule.value;
    // Guides from cursor position to ensure drawn rect meets min-width
    guides.push({
      axis: "v",
      position: cursorX + w,
      ruleId: rule.id,
      ruleValue: w,
      kind: "min_width",
      label: `${rule.id}: min width ${w}μm`,
    });
    guides.push({
      axis: "v",
      position: cursorX - w,
      ruleId: rule.id,
      ruleValue: w,
      kind: "min_width",
      label: `${rule.id}: min width ${w}μm`,
    });
    guides.push({
      axis: "h",
      position: cursorY + w,
      ruleId: rule.id,
      ruleValue: w,
      kind: "min_width",
      label: `${rule.id}: min width ${w}μm`,
    });
    guides.push({
      axis: "h",
      position: cursorY - w,
      ruleId: rule.id,
      ruleValue: w,
      kind: "min_width",
      label: `${rule.id}: min width ${w}μm`,
    });
  }

  return guides;
}

/**
 * Snap a coordinate to the nearest DRC guide if within a tolerance.
 * Falls back to normal grid snap.
 */
export function snapToDrcGuide(
  value: number,
  axis: "h" | "v",
  guides: DrcSnapGuide[],
  tolerance: number = 0.05
): { value: number; snappedToGuide: boolean; guide?: DrcSnapGuide } {
  const relevantGuides = guides.filter((g) => g.axis === axis);

  let closest: DrcSnapGuide | undefined;
  let closestDist = tolerance;

  for (const g of relevantGuides) {
    const dist = Math.abs(value - g.position);
    if (dist < closestDist) {
      closestDist = dist;
      closest = g;
    }
  }

  if (closest) {
    return { value: closest.position, snappedToGuide: true, guide: closest };
  }

  return { value: snapToGrid(value), snappedToGuide: false };
}
