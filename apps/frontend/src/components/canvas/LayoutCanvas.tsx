/**
 * LayoutCanvas — thin orchestrator that composes:
 *   • useLayoutViewport  — zoom, pan, coordinate conversion
 *   • useLayoutInput     — mouse/keyboard interaction, tool dispatch
 *   • useLayoutRenderer  — Canvas2D render pipeline
 *
 * Previously a 1 300-line god-component, now ~100 lines.
 */

import { useRef, useEffect, useMemo } from "react";
import { useToolStore } from "../../stores/toolStore";
import { useLayerStore } from "../../stores/layerStore";
import { useDrcStore } from "../../stores/drcStore";
import { useCrossProbeStore } from "../../stores/crossProbeStore";
import { useGeometryStore } from "../../stores/geometryStore";
import { useCellStore } from "../../stores/cellStore";
import { useLayoutViewport } from "../../hooks/useLayoutViewport";
import { useLayoutInput } from "../../hooks/useLayoutInput";
import { useLayoutRenderer } from "../../hooks/useLayoutRenderer";
import "./LayoutCanvas.css";

export function LayoutCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Store subscriptions ──
  const geometries       = useGeometryStore((s) => s.geometries);
  const cellInstances    = useCellStore((s) => s.instances);
  const cellLibrary      = useCellStore((s) => s.cellLibrary);
  const selectedInstances = useCellStore((s) => s.selectedInstances);
  const getFlattenedGeometries = useCellStore((s) => s.getFlattenedGeometries);

  const activeTool       = useToolStore((s) => s.activeTool);
  const drawingPreview   = useToolStore((s) => s.drawingPreview);
  const selectedItems    = useToolStore((s) => s.selectedItems);
  const selectionBox     = useToolStore((s) => s.selectionBox);

  const layers           = useLayerStore((s) => s.layers);
  const activeLayerId    = useLayerStore((s) => s.activeLayerId);

  const drcViolations      = useDrcStore((s) => s.violations);
  const showDrcOverlay     = useDrcStore((s) => s.showOverlay);
  const selectedViolationId = useDrcStore((s) => s.selectedViolationId);

  const crossProbeHighlights = useCrossProbeStore((s) => s.highlights);

  // ── Merged geometries (own + flattened cell instances) ──
  const mergedGeometries = useMemo(() => {
    const flatInstGeoms = getFlattenedGeometries();
    return [...geometries, ...flatInstGeoms];
  }, [geometries, getFlattenedGeometries, cellInstances, cellLibrary]);

  // ── Viewport hook ──
  const {
    viewport, viewportRef, screenToLayout, handleWheel,
    isPanning, startPan, updatePan, endPan,
  } = useLayoutViewport(canvasRef);

  // ── Input hook ──
  const {
    cursorPos, cursorStyle,
    rulerMeasurements, rulerPreview,
    effectiveGeometries,
    handleMouseDown, handleMouseMove, handleMouseUp, handleDoubleClick, handleMouseLeave,
  } = useLayoutInput({
    canvasRef, viewportRef,
    renderGeometries: mergedGeometries,
    screenToLayout, isPanning, startPan, updatePan, endPan,
  });

  // ── Renderer hook ──
  const { render } = useLayoutRenderer({
    canvasRef, containerRef, viewportRef,
    renderGeometries: effectiveGeometries,
    layers, activeLayerId, activeTool,
    selectedItems, drawingPreview, selectionBox,
    drcViolations, showDrcOverlay, selectedViolationId,
    rulerMeasurements, rulerPreview, crossProbeHighlights,
    cellInstances, cellLibrary, selectedInstances,
  });

  // Re-render on viewport / state changes
  useEffect(() => { render(); }, [viewport, render]);

  // ── JSX ──
  return (
    <div className="layout-canvas" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="layout-canvas__canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: cursorStyle }}
      />
      <div className="layout-canvas__coords">
        X: {cursorPos.x.toFixed(3)} &mu;m &nbsp; Y: {cursorPos.y.toFixed(3)} &mu;m
      </div>
    </div>
  );
}
