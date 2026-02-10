/**
 * useLayoutRenderer — the Canvas2D rendering pipeline.
 *
 * Extracted from LayoutCanvas to isolate *all* drawing logic: grid, geometries,
 * drawing previews, selection boxes, DRC overlays, cross-probe highlights,
 * rulers, scale bar, and status text.  The hook owns only the render() function
 * and the ResizeObserver; it reads state from stores / props.
 */

import { useCallback, useEffect } from "react";
import type { ViewportState } from "./useLayoutViewport";
import type { CanvasGeometry } from "../stores/geometryStore";
import type { LayerDef } from "../stores/layerStore";
import type { DrawingPreview, ToolPoint } from "../stores/toolStore";
import type { DrcViolation } from "../engines/drc";
import type { CellInstance, CellDefinition } from "../stores/cellStore";
import type { CrossProbeHighlight } from "../stores/crossProbeStore";
import { getAdaptiveGridSpacing } from "../utils/gridSnap";
import {
  hexToRgba,
  computeRenderStyle,
  drawRect,
  drawPolygon,
  drawPath,
  drawVia,
  drawSelectionHandles,
  drawGeometryLabel,
  drawScaleBar,
  drawSelectionBox as drawSelectionBoxPrimitive,
  drawDrcMarker,
  drawRuler as drawRulerPrimitive,
  renderGrid as renderGridPrimitive,
  renderOrigin as renderOriginPrimitive,
} from "../engines/canvasRenderer";

// ── Types ──

export interface RulerMeasurement {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface SelectedItem {
  cellId: string;
  geometryIndex: number;
  type: string;
}

interface RendererInputs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.MutableRefObject<ViewportState>;
  /** Geometries to render (may include drag-preview override). */
  renderGeometries: CanvasGeometry[];
  layers: LayerDef[];
  activeLayerId: number;
  activeTool: string;
  selectedItems: SelectedItem[];
  drawingPreview: DrawingPreview | null;
  selectionBox: { start: ToolPoint; end: ToolPoint } | null;
  drcViolations: DrcViolation[];
  showDrcOverlay: boolean;
  selectedViolationId: string | null;
  rulerMeasurements: RulerMeasurement[];
  rulerPreview: RulerMeasurement | null;
  crossProbeHighlights: CrossProbeHighlight[];
  cellInstances: CellInstance[];
  cellLibrary: Map<string, CellDefinition>;
  selectedInstances: string[];
}

export function useLayoutRenderer(inputs: RendererInputs) {
  const {
    canvasRef,
    containerRef,
    viewportRef,
    renderGeometries,
    layers,
    activeLayerId,
    activeTool,
    selectedItems,
    drawingPreview,
    selectionBox,
    drcViolations,
    showDrcOverlay,
    selectedViolationId,
    rulerMeasurements,
    rulerPreview,
    crossProbeHighlights,
    cellInstances,
    cellLibrary,
    selectedInstances,
  } = inputs;

  // ── Main render pass ──

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vp = viewportRef.current;
    const dpr = window.devicePixelRatio;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Clear
    ctx.fillStyle =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--os-bg-canvas")
        .trim() || "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    // Grid
    const gridSpacing = getAdaptiveGridSpacing(vp.zoom);
    renderGridPrimitive(ctx, vp, w, h, gridSpacing, "lines");
    renderOriginPrimitive(ctx, vp, w, h);

    // Helper closures
    const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
    const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;

    // ── Layout geometries (sorted by layer order) ──
    const sortedGeoms = [...renderGeometries].sort((a, b) => {
      const la = layers.find((l) => l.id === a.layerId);
      const lb = layers.find((l) => l.id === b.layerId);
      return (la?.order ?? 0) - (lb?.order ?? 0);
    });

    for (const geom of sortedGeoms) {
      const layer = layers.find((l) => l.id === geom.layerId);
      if (!layer || !layer.visible) continue;

      const isSelected = selectedItems.some(
        (s) => s.geometryIndex === renderGeometries.indexOf(geom),
      );
      renderGeometry(ctx, vp, w, h, geom, layer, isSelected);
    }

    // ── Cell instance bounding boxes ──
    renderCellInstances(ctx, vp, w, h, toSX, toSY, cellInstances, cellLibrary, selectedInstances);

    // Scale bar
    drawScaleBar(ctx, w, h, vp.zoom);

    // Drawing preview
    if (drawingPreview) {
      renderDrawingPreview(ctx, vp, w, h, drawingPreview, layers);
    }

    // Selection box
    if (selectionBox) {
      renderSelectionBox(ctx, vp, w, h, selectionBox);
    }

    // Rulers
    for (const ruler of rulerMeasurements) {
      renderRuler(ctx, vp, w, h, ruler);
    }
    if (rulerPreview) {
      renderRuler(ctx, vp, w, h, rulerPreview);
    }

    // DRC overlay
    if (showDrcOverlay && drcViolations.length > 0) {
      renderDrcViolations(ctx, vp, w, h, drcViolations, selectedViolationId);
    }

    // Cross-probe highlights
    if (crossProbeHighlights.length > 0) {
      renderCrossProbeHighlights(ctx, vp, w, h, crossProbeHighlights, renderGeometries);
    }

    // Status text
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px 'JetBrains Mono', monospace";
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    const drcInfo = drcViolations.length > 0 ? ` | DRC: ${drcViolations.length} violations` : "";
    ctx.fillText(
      `Tool: ${activeTool} | Layer: ${activeLayer?.name ?? "?"} | Zoom: ${vp.zoom.toFixed(1)}x | Grid: ${gridSpacing}\u00B5m${drcInfo}`,
      8,
      h - 8,
    );
  }, [
    canvasRef, viewportRef,
    renderGeometries, layers, activeLayerId, activeTool,
    drawingPreview, selectedItems, selectionBox,
    drcViolations, showDrcOverlay, selectedViolationId,
    rulerMeasurements, rulerPreview, crossProbeHighlights,
    cellInstances, cellLibrary, selectedInstances,
  ]);

  // ── ResizeObserver – auto-resize canvas + re-render ──

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      render();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [render, canvasRef, containerRef]);

  return { render };
}

// ══════════════════════════════════════════════════════════════════════
// Private render helpers (pure functions — no React)
// ══════════════════════════════════════════════════════════════════════

function renderGeometry(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  geom: CanvasGeometry,
  layer: LayerDef,
  isSelected: boolean,
) {
  const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
  const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;
  const style = computeRenderStyle(ctx, layer, isSelected);

  if (geom.type === "rect" && geom.points.length >= 2) {
    const p1 = geom.points[0];
    const p2 = geom.points[1];
    const sx = toSX(p1.x);
    const sy = toSY(p2.y);
    const sw = (p2.x - p1.x) * vp.zoom;
    const sh = (p2.y - p1.y) * vp.zoom;
    drawRect(ctx, sx, sy, sw, sh, style, vp.zoom);

    if (geom.name && Math.abs(sw) > 30 && Math.abs(sh) > 14) {
      drawGeometryLabel(ctx, geom.name, sx + sw / 2, sy + sh / 2, Math.abs(sw), hexToRgba(layer.color, 0.8));
    }
    if (isSelected) {
      drawSelectionHandles(ctx, [
        { x: sx, y: sy }, { x: sx + sw, y: sy },
        { x: sx + sw, y: sy + sh }, { x: sx, y: sy + sh },
      ], layer.color);
    }
  }

  if (geom.type === "polygon" && geom.points.length >= 3) {
    const screenPoints = geom.points.map((p) => ({ x: toSX(p.x), y: toSY(p.y) }));
    drawPolygon(ctx, screenPoints, style, vp.zoom);
    if (isSelected) drawSelectionHandles(ctx, screenPoints, layer.color);
  }

  if (geom.type === "path" && geom.points.length >= 2) {
    const screenPoints = geom.points.map((p) => ({ x: toSX(p.x), y: toSY(p.y) }));
    const pathWidth = (geom.width ?? 0.1) * vp.zoom;
    drawPath(ctx, screenPoints, pathWidth, style);
  }

  if (geom.type === "via") {
    const pos = geom.points[0];
    const viaSize = (geom.width ?? 0.17) * vp.zoom;
    const sx = toSX(pos.x) - viaSize / 2;
    const sy = toSY(pos.y) - viaSize / 2;
    drawVia(ctx, sx, sy, viaSize, style, vp.zoom);
  }
}

function renderCellInstances(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  _w: number,
  _h: number,
  toSX: (x: number) => number,
  toSY: (y: number) => number,
  cellInstances: CellInstance[],
  cellLibrary: Map<string, CellDefinition>,
  selectedInstances: string[],
) {
  for (const inst of cellInstances) {
    const cellDef = cellLibrary.get(inst.cellId);
    if (!cellDef) continue;
    const bb = cellDef.bbox;
    const isInstSelected = selectedInstances.includes(inst.id);

    const rad = (inst.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
      { x: bb.x1, y: bb.y1 }, { x: bb.x2, y: bb.y1 },
      { x: bb.x2, y: bb.y2 }, { x: bb.x1, y: bb.y2 },
    ].map((p) => {
      const { y } = p;
      let { x } = p;
      if (inst.mirror) x = -x;
      return { x: x * cos - y * sin + inst.position.x, y: x * sin + y * cos + inst.position.y };
    });

    const minX = Math.min(...corners.map((c) => c.x));
    const maxX = Math.max(...corners.map((c) => c.x));
    const minY = Math.min(...corners.map((c) => c.y));
    const maxY = Math.max(...corners.map((c) => c.y));

    const sx = toSX(minX);
    const sy = toSY(maxY);
    const sw = (maxX - minX) * vp.zoom;
    const sh = (maxY - minY) * vp.zoom;

    ctx.save();
    ctx.setLineDash(isInstSelected ? [] : [4, 3]);
    ctx.strokeStyle = isInstSelected ? "rgba(129, 140, 248, 0.8)" : "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = isInstSelected ? 1.5 : 0.8;
    if (isInstSelected) {
      ctx.shadowColor = "rgba(129, 140, 248, 0.3)";
      ctx.shadowBlur = 6;
    }
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.setLineDash([]);

    if (sw > 24 && sh > 12) {
      ctx.font = "bold 10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillText(inst.instanceName, sx + 4, sy + 3);
      ctx.fillStyle = isInstSelected ? "rgba(129, 140, 248, 0.9)" : "rgba(255, 255, 255, 0.45)";
      ctx.fillText(inst.instanceName, sx + 3, sy + 2);
    }
    ctx.restore();
  }
}

function renderDrawingPreview(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  preview: DrawingPreview,
  layers: LayerDef[],
) {
  const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
  const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;
  const layer = layers.find((l) => l.id === preview.layerId);
  const color = layer?.color ?? "#ffffff";

  ctx.save();
  ctx.setLineDash([6, 4]);

  if (preview.tool === "rect" && preview.points.length >= 1 && preview.cursorPos) {
    const p1 = preview.points[0];
    const p2 = preview.cursorPos;
    const sx = toSX(Math.min(p1.x, p2.x));
    const sy = toSY(Math.max(p1.y, p2.y));
    const sw = Math.abs(p2.x - p1.x) * vp.zoom;
    const sh = Math.abs(p2.y - p1.y) * vp.zoom;

    ctx.shadowColor = hexToRgba(color, 0.25);
    ctx.shadowBlur = 6;
    ctx.fillStyle = hexToRgba(color, 0.15);
    ctx.fillRect(sx, sy, sw, sh);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, sy, sw, sh);

    const dimW = Math.abs(p2.x - p1.x).toFixed(3);
    const dimH = Math.abs(p2.y - p1.y).toFixed(3);
    const dimText = `${dimW} \u00D7 ${dimH} \u00B5m`;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillText(dimText, sx + sw / 2 + 1, sy - 5);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText(dimText, sx + sw / 2, sy - 6);
  }

  if ((preview.tool === "polygon" || preview.tool === "path") && preview.points.length >= 1) {
    ctx.shadowColor = hexToRgba(color, 0.3);
    ctx.shadowBlur = 4;
    ctx.strokeStyle = color;
    ctx.lineWidth = preview.tool === "path" ? (preview.width ?? 0.1) * vp.zoom : 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(toSX(preview.points[0].x), toSY(preview.points[0].y));
    for (let i = 1; i < preview.points.length; i++) {
      ctx.lineTo(toSX(preview.points[i].x), toSY(preview.points[i].y));
    }
    if (preview.cursorPos) {
      ctx.lineTo(toSX(preview.cursorPos.x), toSY(preview.cursorPos.y));
    }
    if (preview.tool === "polygon" && preview.points.length >= 2) {
      ctx.setLineDash([3, 3]);
      ctx.lineTo(toSX(preview.points[0].x), toSY(preview.points[0].y));
    }
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    for (const pt of preview.points) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toSX(pt.x), toSY(pt.y), 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function renderSelectionBox(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  box: { start: ToolPoint; end: ToolPoint },
) {
  const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
  const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;
  const sx = toSX(Math.min(box.start.x, box.end.x));
  const sy = toSY(Math.max(box.start.y, box.end.y));
  const sw = Math.abs(box.end.x - box.start.x) * vp.zoom;
  const sh = Math.abs(box.end.y - box.start.y) * vp.zoom;
  drawSelectionBoxPrimitive(ctx, sx, sy, sw, sh);
}

function renderDrcViolations(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  _w: number,
  _h: number,
  violations: DrcViolation[],
  selectedId: string | null,
) {
  const toSX = (x: number) => (x - vp.centerX) * vp.zoom + _w / 2;
  const toSY = (y: number) => _h / 2 - (y - vp.centerY) * vp.zoom;

  for (const v of violations) {
    const isSelected = v.id === selectedId;
    const sx = toSX(v.bbox.minX);
    const sy = toSY(v.bbox.maxY);
    const sw = (v.bbox.maxX - v.bbox.minX) * vp.zoom;
    const sh = (v.bbox.maxY - v.bbox.minY) * vp.zoom;
    drawDrcMarker(ctx, sx, sy, sw, sh, v.severity, isSelected, v.ruleId);
  }
}

function renderCrossProbeHighlights(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  highlights: CrossProbeHighlight[],
  renderGeometries: CanvasGeometry[],
) {
  const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
  const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;

  for (const hl of highlights) {
    for (const gi of hl.geometryIndices) {
      const geom = renderGeometries[gi];
      if (!geom) continue;
      ctx.save();
      ctx.globalAlpha = 0.6;
      const pts = geom.points;
      if (pts.length === 0) { ctx.restore(); continue; }
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = 0.1;
      const sx = toSX(minX - pad);
      const sy = toSY(maxY + pad);
      const sw = (maxX - minX + 2 * pad) * vp.zoom;
      const sh = (maxY - minY + 2 * pad) * vp.zoom;
      ctx.fillStyle = hl.color;
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = hl.color.replace(/[\d.]+\)$/, "0.8)");
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.restore();
    }
  }
}

function renderRuler(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  ruler: RulerMeasurement,
) {
  const toScreen = (lx: number, ly: number) => ({
    sx: (lx - vp.centerX) * vp.zoom + w / 2,
    sy: -(ly - vp.centerY) * vp.zoom + h / 2,
  });
  const start = toScreen(ruler.start.x, ruler.start.y);
  const end = toScreen(ruler.end.x, ruler.end.y);
  const dx = ruler.end.x - ruler.start.x;
  const dy = ruler.end.y - ruler.start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  drawRulerPrimitive(ctx, start.sx, start.sy, end.sx, end.sy, distance, dx, dy);
}
