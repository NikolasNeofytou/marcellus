/**
 * Grid snapping utilities for the layout canvas.
 * All coordinates are in layout space (μm).
 */

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
