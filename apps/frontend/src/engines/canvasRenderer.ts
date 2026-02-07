/**
 * canvasRenderer.ts — Sophisticated VLSI layout rendering engine
 *
 * Professional-grade fill patterns, layer-aware rendering, glow effects,
 * and cached pattern tiles for high-performance Canvas2D drawing.
 *
 * Inspired by Microwind, KLayout, Magic VLSI visual conventions.
 */

import type { LayerDef } from "../stores/layerStore";

// ── Types ────────────────────────────────────────────────────────────

export type FillPatternKind =
  | "solid"
  | "hatch"        // 45° lines
  | "cross"        // 45° + 135° lines
  | "dots"         // dot stipple grid
  | "stipple"      // sparse random dots
  | "horz-stripe"  // horizontal lines (M1 convention)
  | "vert-stripe"  // vertical lines (M2 convention)
  | "diag-45"      // 45° (M3)
  | "diag-135"     // 135° (M4)
  | "brick"        // staggered brick pattern
  | "checker"      // checkerboard
  | "none";

export interface RenderStyle {
  fillColor: string;
  strokeColor: string;
  lineWidth: number;
  pattern: CanvasPattern | null;
  /** Glow for selection / highlight */
  glowColor: string | null;
  glowRadius: number;
}

// ── Pattern tile cache ───────────────────────────────────────────────

const TILE_SIZE = 16;  // px for pattern tile
const patternCache = new Map<string, CanvasPattern>();
const tileCache = new Map<string, OffscreenCanvas>();

/**
 * Generate a unique cache key for a layer's pattern + color combination
 */
function patternKey(color: string, patternKind: string, alpha: number): string {
  return `${color}|${patternKind}|${alpha.toFixed(2)}`;
}

/**
 * Parse hex color to r,g,b tuple
 */
function hexToRgbTuple(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbTuple(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Produce a lighter version of a hex color for highlights
 */
export function lightenHex(hex: string, amount: number): string {
  const [r, g, b] = hexToRgbTuple(hex);
  const lr = Math.min(255, r + (255 - r) * amount);
  const lg = Math.min(255, g + (255 - g) * amount);
  const lb = Math.min(255, b + (255 - b) * amount);
  return `rgb(${lr | 0}, ${lg | 0}, ${lb | 0})`;
}

// ── Tile generators ──────────────────────────────────────────────────

function createPatternTile(
  kind: FillPatternKind,
  color: string,
  alpha: number,
): OffscreenCanvas {
  const S = TILE_SIZE;
  const canvas = new OffscreenCanvas(S, S);
  const ctx = canvas.getContext("2d")!;
  const [r, g, b] = hexToRgbTuple(color);
  const col = `rgba(${r}, ${g}, ${b}, ${alpha})`;

  ctx.clearRect(0, 0, S, S);

  switch (kind) {
    case "hatch": {
      // 45° diagonal lines
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = -S; i < S * 2; i += 5) {
        ctx.moveTo(i, S);
        ctx.lineTo(i + S, 0);
      }
      ctx.stroke();
      break;
    }
    case "cross": {
      // Both diagonal directions
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let i = -S; i < S * 2; i += 5) {
        ctx.moveTo(i, S);
        ctx.lineTo(i + S, 0);
        ctx.moveTo(i, 0);
        ctx.lineTo(i + S, S);
      }
      ctx.stroke();
      break;
    }
    case "dots": {
      // Regular dot grid
      ctx.fillStyle = col;
      for (let x = 2; x < S; x += 4) {
        for (let y = 2; y < S; y += 4) {
          ctx.beginPath();
          ctx.arc(x, y, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case "stipple": {
      // Sparse random-looking dots (deterministic)
      ctx.fillStyle = col;
      const positions = [
        [2, 3], [7, 1], [13, 4], [5, 9], [10, 7], [1, 13],
        [8, 12], [14, 10], [3, 6], [11, 14], [6, 15], [15, 8],
      ];
      for (const [x, y] of positions) {
        ctx.beginPath();
        ctx.arc(x, y, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "horz-stripe": {
      // Horizontal lines — M1 convention
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let y = 2; y < S; y += 4) {
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
      }
      ctx.stroke();
      break;
    }
    case "vert-stripe": {
      // Vertical lines — M2 convention
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let x = 2; x < S; x += 4) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, S);
      }
      ctx.stroke();
      break;
    }
    case "diag-45": {
      // 45° diagonal — M3 convention
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = -S; i < S * 2; i += 6) {
        ctx.moveTo(i, S);
        ctx.lineTo(i + S, 0);
      }
      ctx.stroke();
      break;
    }
    case "diag-135": {
      // 135° diagonal — M4 convention
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = -S; i < S * 2; i += 6) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i + S, S);
      }
      ctx.stroke();
      break;
    }
    case "brick": {
      // Staggered brick pattern
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.5;
      const bw = 8, bh = 4;
      ctx.beginPath();
      // horizontal lines
      for (let y = 0; y <= S; y += bh) {
        ctx.moveTo(0, y);
        ctx.lineTo(S, y);
      }
      // vertical — stagger every other row
      for (let row = 0; row < S / bh; row++) {
        const offset = (row % 2) * (bw / 2);
        for (let x = offset; x <= S; x += bw) {
          ctx.moveTo(x, row * bh);
          ctx.lineTo(x, (row + 1) * bh);
        }
      }
      ctx.stroke();
      break;
    }
    case "checker": {
      const cs = 4;
      ctx.fillStyle = col;
      for (let x = 0; x < S; x += cs) {
        for (let y = 0; y < S; y += cs) {
          if (((x / cs + y / cs) | 0) % 2 === 0) {
            ctx.fillRect(x, y, cs, cs);
          }
        }
      }
      break;
    }
    case "solid":
    case "none":
    default:
      break;
  }

  return canvas;
}

/**
 * Get or create a CanvasPattern for a given layer's fill pattern.
 * Patterns are cached by color + kind + alpha for performance.
 */
export function getLayerPattern(
  ctx: CanvasRenderingContext2D,
  layer: LayerDef,
  patternAlpha?: number,
): CanvasPattern | null {
  const kind = (layer.fillPattern ?? "solid") as FillPatternKind;
  if (kind === "solid" || kind === "none") return null;

  const alpha = patternAlpha ?? Math.min(layer.strokeAlpha, 0.4);
  const key = patternKey(layer.color, kind, alpha);

  let pattern = patternCache.get(key);
  if (pattern) return pattern;

  let tile = tileCache.get(key);
  if (!tile) {
    tile = createPatternTile(kind, layer.color, alpha);
    tileCache.set(key, tile);
  }

  pattern = ctx.createPattern(tile, "repeat") ?? undefined;
  if (pattern) {
    patternCache.set(key, pattern);
  }
  return pattern ?? null;
}

/**
 * Clear all cached patterns. Call when theme/colors change.
 */
export function clearPatternCache(): void {
  patternCache.clear();
  tileCache.clear();
}

// ── Metal layer pattern mapping ──────────────────────────────────────

/**
 * Override pattern kinds for metal layers to give each a distinct identity.
 * Industry convention: alternating horizontal/vertical/diagonal per metal level.
 */
export function getEffectivePattern(layer: LayerDef): FillPatternKind {
  const alias = layer.alias ?? layer.name;
  // Metal layers get directional patterns
  if (alias === "li1")  return "horz-stripe";
  if (alias === "met1") return "horz-stripe";
  if (alias === "met2") return "vert-stripe";
  if (alias === "met3") return "diag-45";
  if (alias === "met4") return "diag-135";
  if (alias === "met5") return "cross";
  // Contacts / vias get cross-hatch
  if (layer.group === "contact" || layer.group === "via") return "cross";
  // Wells get hatch
  if (layer.group === "well") return "hatch";
  // Implants get stipple
  if (layer.group === "implant") return "stipple";
  // Markers get dots
  if (layer.group === "marker") return "dots";
  // Pins get none (solid small)
  if (layer.group === "pin") return "none";
  // Default: use the layer's declared pattern
  return (layer.fillPattern ?? "solid") as FillPatternKind;
}

/**
 * Get the effective pattern object, overriding layer's declared pattern
 * with the industry-standard convention for metal layers etc.
 */
export function getEffectiveLayerPattern(
  ctx: CanvasRenderingContext2D,
  layer: LayerDef,
  patternAlpha?: number,
): CanvasPattern | null {
  const kind = getEffectivePattern(layer);
  if (kind === "solid" || kind === "none") return null;

  const alpha = patternAlpha ?? Math.min(layer.strokeAlpha, 0.4);
  const key = patternKey(layer.color, kind, alpha);

  let pattern = patternCache.get(key);
  if (pattern) return pattern;

  let tile = tileCache.get(key);
  if (!tile) {
    tile = createPatternTile(kind, layer.color, alpha);
    tileCache.set(key, tile);
  }

  pattern = ctx.createPattern(tile, "repeat") ?? undefined;
  if (pattern) {
    patternCache.set(key, pattern);
  }
  return pattern ?? null;
}

// ── Professional geometry rendering ──────────────────────────────────

interface ViewportState {
  centerX: number;
  centerY: number;
  zoom: number;
}

/**
 * Compute the full render style for a geometry, including pattern, glow, etc.
 */
export function computeRenderStyle(
  ctx: CanvasRenderingContext2D,
  layer: LayerDef,
  isSelected: boolean,
  isHighlighted: boolean = false,
): RenderStyle {
  const fillAlpha = isSelected ? 0.45 : layer.fillAlpha;
  const strokeAlpha = isSelected ? 1.0 : layer.strokeAlpha;

  return {
    fillColor: hexToRgba(layer.color, fillAlpha),
    strokeColor: hexToRgba(layer.color, strokeAlpha),
    lineWidth: isSelected ? 2.0 : 1.0,
    pattern: getEffectiveLayerPattern(ctx, layer, isSelected ? 0.3 : undefined),
    glowColor: isSelected
      ? hexToRgba(layer.color, 0.5)
      : isHighlighted
        ? hexToRgba(layer.color, 0.35)
        : null,
    glowRadius: isSelected ? 8 : isHighlighted ? 5 : 0,
  };
}

/**
 * Draw a rect geometry with fill, pattern overlay, stroke, and optional glow.
 */
export function drawRect(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, sw: number, sh: number,
  style: RenderStyle,
  _zoom: number,
) {
  ctx.save();

  // Glow / shadow for selected items
  if (style.glowColor) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glowRadius;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Filled rectangle
  ctx.fillStyle = style.fillColor;
  ctx.fillRect(sx, sy, sw, sh);

  // Clear shadow before pattern and stroke
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Pattern overlay
  if (style.pattern && Math.abs(sw) > 3 && Math.abs(sh) > 3) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy, sw, sh);
    ctx.clip();
    ctx.fillStyle = style.pattern;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();
  }

  // Stroke
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidth;
  ctx.strokeRect(sx, sy, sw, sh);

  ctx.restore();
}

/**
 * Draw a polygon with fill, pattern overlay, stroke, and glow.
 */
export function drawPolygon(
  ctx: CanvasRenderingContext2D,
  screenPoints: { x: number; y: number }[],
  style: RenderStyle,
  _zoom: number,
) {
  if (screenPoints.length < 3) return;

  ctx.save();

  // Build path
  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.closePath();

  // Glow
  if (style.glowColor) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glowRadius;
  }

  // Fill
  ctx.fillStyle = style.fillColor;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Pattern overlay
  if (style.pattern) {
    ctx.save();
    ctx.clip();
    // Fill pattern over bounding area
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of screenPoints) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    ctx.fillStyle = style.pattern;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
  }

  // Re-create path for stroke
  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.closePath();
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidth;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a path (routing wire) with fat fill stroke + thin outline + glow.
 */
export function drawPath(
  ctx: CanvasRenderingContext2D,
  screenPoints: { x: number; y: number }[],
  pathWidth: number,
  style: RenderStyle,
) {
  if (screenPoints.length < 2) return;

  ctx.save();

  // Glow
  if (style.glowColor) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glowRadius;
  }

  // Fat fill stroke
  ctx.strokeStyle = style.fillColor;
  ctx.lineWidth = pathWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.stroke();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Thin outline
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
  for (let i = 1; i < screenPoints.length; i++) {
    ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
  }
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a via/contact with fill, X-cross, glow, and optional ring mark.
 */
export function drawVia(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, size: number,
  style: RenderStyle,
  _zoom: number,
) {
  ctx.save();

  // Glow
  if (style.glowColor) {
    ctx.shadowColor = style.glowColor;
    ctx.shadowBlur = style.glowRadius;
  }

  // Filled square
  ctx.fillStyle = style.fillColor;
  ctx.fillRect(sx, sy, size, size);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // X-cross inside
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = Math.max(0.5, style.lineWidth * 0.7);
  ctx.beginPath();
  const inset = size * 0.1;
  ctx.moveTo(sx + inset, sy + inset);
  ctx.lineTo(sx + size - inset, sy + size - inset);
  ctx.moveTo(sx + size - inset, sy + inset);
  ctx.lineTo(sx + inset, sy + size - inset);
  ctx.stroke();

  // Outer border
  ctx.strokeStyle = style.strokeColor;
  ctx.lineWidth = style.lineWidth;
  ctx.strokeRect(sx, sy, size, size);

  // For larger vias (zoomed in), add a small inner dot
  if (size > 10) {
    ctx.fillStyle = style.strokeColor;
    ctx.beginPath();
    ctx.arc(sx + size / 2, sy + size / 2, Math.max(1, size * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ── Selection handles (upgraded) ─────────────────────────────────────

/**
 * Draw selection handles with a professional look: filled squares with
 * white outline and subtle shadow.
 */
export function drawSelectionHandles(
  ctx: CanvasRenderingContext2D,
  screenPoints: { x: number; y: number }[],
  accentColor: string = "#3b82f6",
) {
  const size = 5;
  ctx.save();

  // Subtle shadow
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;

  ctx.fillStyle = accentColor;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.2;

  for (const p of screenPoints) {
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
  }

  ctx.restore();
}

// ── Grid rendering (upgraded) ────────────────────────────────────────

/**
 * Render grid with dot mode support, subtle depth, and fade at low zoom.
 */
export function renderGrid(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number, h: number,
  spacing: number,
  mode: "lines" | "dots" | "cross-dots" = "lines",
) {
  const left = vp.centerX - w / (2 * vp.zoom);
  const right = vp.centerX + w / (2 * vp.zoom);
  const top = vp.centerY + h / (2 * vp.zoom);
  const bottom = vp.centerY - h / (2 * vp.zoom);

  const startX = Math.floor(left / spacing) * spacing;
  const startY = Math.floor(bottom / spacing) * spacing;
  const major = spacing * 10;
  const mStartX = Math.floor(left / major) * major;
  const mStartY = Math.floor(bottom / major) * major;

  // Fade grid at extreme zoom levels
  const gridAlpha = Math.min(1, Math.max(0.2, vp.zoom / 5));

  if (mode === "dots" || mode === "cross-dots") {
    // ── Dot grid mode (professional EDA look) ──
    // Major dots
    ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * gridAlpha})`;
    for (let x = mStartX; x <= right; x += major) {
      for (let y = mStartY; y <= top; y += major) {
        const sx = (x - vp.centerX) * vp.zoom + w / 2;
        const sy = h / 2 - (y - vp.centerY) * vp.zoom;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Minor dots
    ctx.fillStyle = `rgba(255, 255, 255, ${0.06 * gridAlpha})`;
    for (let x = startX; x <= right; x += spacing) {
      for (let y = startY; y <= top; y += spacing) {
        const sx = (x - vp.centerX) * vp.zoom + w / 2;
        const sy = h / 2 - (y - vp.centerY) * vp.zoom;
        ctx.beginPath();
        ctx.arc(sx, sy, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (mode === "cross-dots") {
      // Small crosses at major intersections
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.12 * gridAlpha})`;
      ctx.lineWidth = 0.5;
      const arm = 3;
      for (let x = mStartX; x <= right; x += major) {
        for (let y = mStartY; y <= top; y += major) {
          const sx = (x - vp.centerX) * vp.zoom + w / 2;
          const sy = h / 2 - (y - vp.centerY) * vp.zoom;
          ctx.beginPath();
          ctx.moveTo(sx - arm, sy); ctx.lineTo(sx + arm, sy);
          ctx.moveTo(sx, sy - arm); ctx.lineTo(sx, sy + arm);
          ctx.stroke();
        }
      }
    }
  } else {
    // ── Line grid mode (upgraded) ──
    // Minor grid
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.04 * gridAlpha})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = startX; x <= right; x += spacing) {
      const sx = (x - vp.centerX) * vp.zoom + w / 2;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let y = startY; y <= top; y += spacing) {
      const sy = h / 2 - (y - vp.centerY) * vp.zoom;
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // Major grid
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * gridAlpha})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let x = mStartX; x <= right; x += major) {
      const sx = (x - vp.centerX) * vp.zoom + w / 2;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let y = mStartY; y <= top; y += major) {
      const sy = h / 2 - (y - vp.centerY) * vp.zoom;
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();
  }
}

/**
 * Render origin axes with a subtle professional look.
 */
export function renderOrigin(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number, h: number,
) {
  const ox = (0 - vp.centerX) * vp.zoom + w / 2;
  const oy = h / 2 - (0 - vp.centerY) * vp.zoom;

  // Axis lines — very subtle dashed
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 0.8;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(ox, 0); ctx.lineTo(ox, h);
  ctx.moveTo(0, oy); ctx.lineTo(w, oy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Origin marker — concentric rings
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ox, oy, 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(ox, oy, 2, 0, Math.PI * 2);
  ctx.fill();

  // Small crosshair at origin
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(ox - 8, oy); ctx.lineTo(ox + 8, oy);
  ctx.moveTo(ox, oy - 8); ctx.lineTo(ox, oy + 8);
  ctx.stroke();

  ctx.restore();
}

// ── Selection box ────────────────────────────────────────────────────

/**
 * Draw selection marquee with animated dashes and subtle fill.
 */
export function drawSelectionBox(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, sw: number, sh: number,
  animOffset?: number,
) {
  ctx.save();

  // Subtle gradient fill
  const grad = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
  grad.addColorStop(0, "rgba(59, 130, 246, 0.06)");
  grad.addColorStop(1, "rgba(59, 130, 246, 0.12)");
  ctx.fillStyle = grad;
  ctx.fillRect(sx, sy, sw, sh);

  // Animated dashed border
  ctx.setLineDash([5, 3]);
  ctx.lineDashOffset = animOffset ?? 0;
  ctx.strokeStyle = "rgba(59, 130, 246, 0.65)";
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, sy, sw, sh);

  // Solid inner glow line
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
  ctx.lineWidth = 3;
  ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sh - 3);

  ctx.restore();
}

// ── Geometry name labels ─────────────────────────────────────────────

/**
 * Draw a geometry label (net name, cell name) when zoomed in enough.
 */
export function drawGeometryLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number, cy: number,
  maxWidth: number,
  color: string,
) {
  ctx.save();

  const fontSize = Math.min(11, Math.max(8, maxWidth * 0.15));
  ctx.font = `${fontSize}px 'JetBrains Mono', 'Consolas', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Text shadow for readability
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillText(text, cx + 0.5, cy + 0.5, maxWidth - 4);

  // Actual text
  ctx.fillStyle = color;
  ctx.fillText(text, cx, cy, maxWidth - 4);

  ctx.restore();
}

// ── DRC violation markers (upgraded) ─────────────────────────────────

const DRC_COLORS = {
  error:   { fill: "rgba(239, 68, 68, 0.12)", stroke: "rgba(239, 68, 68, 0.7)", glow: "rgba(239, 68, 68, 0.3)" },
  warning: { fill: "rgba(245, 158, 11, 0.10)", stroke: "rgba(245, 158, 11, 0.6)", glow: "rgba(245, 158, 11, 0.25)" },
  info:    { fill: "rgba(59, 130, 246, 0.08)", stroke: "rgba(59, 130, 246, 0.5)", glow: "rgba(59, 130, 246, 0.2)" },
};

export function drawDrcMarker(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, sw: number, sh: number,
  severity: "error" | "warning" | "info",
  isSelected: boolean,
  ruleText?: string,
) {
  const colors = DRC_COLORS[severity];
  ctx.save();

  // Glow for selected violations
  if (isSelected) {
    ctx.shadowColor = colors.glow;
    ctx.shadowBlur = 10;
  }

  ctx.fillStyle = isSelected ? colors.fill.replace(/[\d.]+\)$/, "0.25)") : colors.fill;
  ctx.fillRect(sx, sy, sw, sh);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = isSelected ? colors.stroke.replace(/[\d.]+\)$/, "0.9)") : colors.stroke;
  ctx.lineWidth = isSelected ? 1.5 : 1;
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.setLineDash([]);

  // X marker at center
  const cx = sx + sw / 2;
  const cy = sy + sh / 2;
  const arm = isSelected ? 5 : 4;
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy - arm); ctx.lineTo(cx + arm, cy + arm);
  ctx.moveTo(cx + arm, cy - arm); ctx.lineTo(cx - arm, cy + arm);
  ctx.stroke();

  // Rule text label
  if (ruleText) {
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(cx - 20, sy - 14, 40, 12);
    ctx.fillStyle = colors.stroke.replace(/[\d.]+\)$/, "1)");
    ctx.fillText(ruleText, cx, sy - 3);
  }

  ctx.restore();
}

// ── Ruler (upgraded) ─────────────────────────────────────────────────

export function drawRuler(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  distance?: number,
  dx?: number,
  dy?: number,
) {
  ctx.save();

  // Line with glow
  ctx.shadowColor = "rgba(255, 215, 0, 0.3)";
  ctx.shadowBlur = 4;
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Endpoints — filled circles with outline
  for (const [x, y] of [[x1, y1], [x2, y2]]) {
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Distance label (when measurement data provided)
  if (distance !== undefined) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const label = `${distance.toFixed(3)} µm`;
    const lines: string[] = [label];
    if (dx !== undefined) lines.push(`Δx=${Math.abs(dx).toFixed(3)}`);
    if (dy !== undefined) lines.push(`Δy=${Math.abs(dy).toFixed(3)}`);

    ctx.font = "bold 12px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    // Measure widest line for background
    let maxW = 0;
    for (const l of lines) {
      const m = ctx.measureText(l).width;
      if (m > maxW) maxW = m;
    }
    const padH = 6;
    const padW = 10;
    const lineH = 16;
    const totalH = lines.length * lineH + padH * 2;
    const bgW = maxW + padW * 2;
    const bgX = midX - bgW / 2;
    const bgY = midY - totalH - 8;

    // Rounded background
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(bgX + r, bgY);
    ctx.lineTo(bgX + bgW - r, bgY);
    ctx.quadraticCurveTo(bgX + bgW, bgY, bgX + bgW, bgY + r);
    ctx.lineTo(bgX + bgW, bgY + totalH - r);
    ctx.quadraticCurveTo(bgX + bgW, bgY + totalH, bgX + bgW - r, bgY + totalH);
    ctx.lineTo(bgX + r, bgY + totalH);
    ctx.quadraticCurveTo(bgX, bgY + totalH, bgX, bgY + totalH - r);
    ctx.lineTo(bgX, bgY + r);
    ctx.quadraticCurveTo(bgX, bgY, bgX + r, bgY);
    ctx.closePath();
    ctx.fill();

    // Text
    for (let i = 0; i < lines.length; i++) {
      ctx.font = i === 0 ? "bold 12px 'JetBrains Mono', monospace" : "11px 'JetBrains Mono', monospace";
      ctx.fillStyle = i === 0 ? "#FFD700" : "#CCCCCC";
      ctx.fillText(lines[i], midX, bgY + padH + (i + 1) * lineH);
    }
  }

  ctx.restore();
}

// ── Scale bar ────────────────────────────────────────────────────────

/**
 * Draw a scale bar in the bottom-left corner showing the current zoom scale.
 */
export function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  _w: number, h: number,
  zoom: number,
) {
  // Choose a nice round scale value
  const targetPixels = 80;
  const targetUm = targetPixels / zoom;
  const niceValues = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let scaleUm = niceValues[0];
  for (const v of niceValues) {
    if (v <= targetUm * 1.5) scaleUm = v;
    else break;
  }
  const barPx = scaleUm * zoom;

  const x = 60;
  const y = h - 28;

  ctx.save();

  // Bar
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Horizontal bar
  ctx.moveTo(x, y); ctx.lineTo(x + barPx, y);
  // End ticks
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4);
  ctx.moveTo(x + barPx, y - 4); ctx.lineTo(x + barPx, y + 4);
  ctx.stroke();

  // Label
  const labelStr = scaleUm >= 1 ? `${scaleUm} µm` : `${(scaleUm * 1000).toFixed(0)} nm`;
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.fillText(labelStr, x + barPx / 2, y - 5);

  ctx.restore();
}
