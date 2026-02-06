import { useRef, useEffect, useCallback, useState } from "react";
import { useToolStore, type DrawingPreview } from "../../stores/toolStore";
import { useLayerStore, type LayerDef } from "../../stores/layerStore";
import { useDrcStore } from "../../stores/drcStore";
import { useGeometryStore, type CanvasGeometry } from "../../stores/geometryStore";
import { snapPoint, getAdaptiveGridSpacing, constrainAngle } from "../../utils/gridSnap";
import type { ToolPoint } from "../../stores/toolStore";
import type { DrcViolation } from "../../engines/drc";
import "./LayoutCanvas.css";

// ── Ruler measurement state ──
interface RulerMeasurement {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

// ── Move/stretch drag state ──
interface DragState {
  mode: "move" | "stretch";
  /** Screen position at drag start */
  startLayout: { x: number; y: number };
  /** Handle index for stretch, -1 for move */
  handleIndex: number;
  /** Original geometries before drag (for non-destructive update) */
  originalGeometries: CanvasGeometry[];
}

// ── Types ─────────────────────────────────────────────────────────────

interface ViewportState {
  centerX: number;
  centerY: number;
  zoom: number;
}

// CanvasGeometry is now imported from geometryStore

// ── Component ─────────────────────────────────────────────────────────

export function LayoutCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    centerX: 0,
    centerY: 0,
    zoom: 20,
  });
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  // Geometry from central store (with undo/redo)
  const geometries = useGeometryStore((s) => s.geometries);
  const commitGeometries = useGeometryStore((s) => s.commit);
  const addGeometry = useGeometryStore((s) => s.addGeometry);
  const removeGeometries = useGeometryStore((s) => s.removeGeometries);

  // Ruler state
  const [rulerMeasurements, setRulerMeasurements] = useState<RulerMeasurement[]>([]);
  const [rulerPreview, setRulerPreview] = useState<RulerMeasurement | null>(null);

  // Move/stretch drag state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  /** During drag, holds the modified geometry array for live preview (not yet committed). */
  const [dragPreview, setDragPreview] = useState<CanvasGeometry[] | null>(null);

  /** The geometries to actually render — drag preview overrides store during drag. */
  const renderGeometries = dragPreview ?? geometries;

  // Geometry ref for access in callbacks
  const geometriesRef = useRef(geometries);
  geometriesRef.current = geometries;

  // Tool & layer state
  const activeTool = useToolStore((s) => s.activeTool);
  const toolState = useToolStore((s) => s.toolState);
  const drawingPreview = useToolStore((s) => s.drawingPreview);
  const selectedItems = useToolStore((s) => s.selectedItems);
  const selectionBox = useToolStore((s) => s.selectionBox);
  const beginDrawing = useToolStore((s) => s.beginDrawing);
  const addDrawingPoint = useToolStore((s) => s.addDrawingPoint);
  const updateCursorPos = useToolStore((s) => s.updateCursorPos);
  const finishDrawing = useToolStore((s) => s.finishDrawing);
  const cancelDrawing = useToolStore((s) => s.cancelDrawing);
  const select = useToolStore((s) => s.select);
  const clearSelection = useToolStore((s) => s.clearSelection);
  const setSelectionBox = useToolStore((s) => s.setSelectionBox);
  const clearSelectionBox = useToolStore((s) => s.clearSelectionBox);

  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);

  // DRC state
  const drcViolations = useDrcStore((s) => s.violations);
  const showDrcOverlay = useDrcStore((s) => s.showOverlay);
  const selectedViolationId = useDrcStore((s) => s.selectedViolationId);

  // ── Coordinate conversion ────────────────────────────────────────

  const screenToLayout = useCallback(
    (screenX: number, screenY: number, vp: ViewportState) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const dpr = window.devicePixelRatio;
      const canvasW = canvas.width / dpr;
      const canvasH = canvas.height / dpr;
      return {
        x: (screenX - canvasW / 2) / vp.zoom + vp.centerX,
        y: -(screenY - canvasH / 2) / vp.zoom + vp.centerY,
      };
    },
    []
  );

  // ── Rendering ────────────────────────────────────────────────────

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
    renderGrid(ctx, vp, w, h, gridSpacing);
    renderOrigin(ctx, vp, w, h);

    // Layout geometries — sorted by layer order
    const sortedGeoms = [...renderGeometries].sort((a, b) => {
      const la = layers.find((l) => l.id === a.layerId);
      const lb = layers.find((l) => l.id === b.layerId);
      return (la?.order ?? 0) - (lb?.order ?? 0);
    });

    for (const geom of sortedGeoms) {
      const layer = layers.find((l) => l.id === geom.layerId);
      if (!layer || !layer.visible) continue;

      const isSelected = selectedItems.some(
        (s) => s.geometryIndex === renderGeometries.indexOf(geom)
      );

      renderGeometry(ctx, vp, w, h, geom, layer, isSelected);
    }

    // Drawing preview
    if (drawingPreview) {
      renderDrawingPreview(ctx, vp, w, h, drawingPreview, layers);
    }

    // Selection box
    if (selectionBox) {
      renderSelectionBox(ctx, vp, w, h, selectionBox);
    }

    // Ruler measurements
    for (const ruler of rulerMeasurements) {
      renderRuler(ctx, vp, w, h, ruler);
    }
    if (rulerPreview) {
      renderRuler(ctx, vp, w, h, rulerPreview);
    }

    // DRC violation overlay
    if (showDrcOverlay && drcViolations.length > 0) {
      renderDrcViolations(ctx, vp, w, h, drcViolations, selectedViolationId);
    }

    // Status line
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "11px 'JetBrains Mono', monospace";
    const activeLayer = layers.find((l) => l.id === activeLayerId);
    const drcInfo = drcViolations.length > 0 ? ` | DRC: ${drcViolations.length} violations` : "";
    ctx.fillText(
      `Tool: ${activeTool} | Layer: ${activeLayer?.name ?? "?"} | Zoom: ${vp.zoom.toFixed(1)}x | Grid: ${gridSpacing}\u00B5m${drcInfo}`,
      8,
      h - 8
    );
  }, [renderGeometries, layers, activeLayerId, activeTool, drawingPreview, selectedItems, selectionBox, drcViolations, showDrcOverlay, selectedViolationId, rulerMeasurements, rulerPreview]);

  // ── Resize observer ──────────────────────────────────────────────

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
  }, [render]);

  // Re-render on state changes
  useEffect(() => {
    render();
  }, [viewport, render]);

  // ── Mouse: Wheel zoom ────────────────────────────────────────────

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setViewport((vp) => {
        const canvas = canvasRef.current;
        if (!canvas) return vp;
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        // Zoom towards cursor
        const layoutBefore = screenToLayout(screenX, screenY, vp);
        const newZoom = Math.max(0.01, Math.min(100000, vp.zoom * factor));
        const newVp = { ...vp, zoom: newZoom };
        const layoutAfter = screenToLayout(screenX, screenY, newVp);
        return {
          ...newVp,
          centerX: vp.centerX + (layoutBefore.x - layoutAfter.x),
          centerY: vp.centerY + (layoutBefore.y - layoutAfter.y),
        };
      });
    },
    [screenToLayout]
  );

  // ── Mouse: Down ──────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const layoutPos = screenToLayout(screenX, screenY, viewportRef.current);
      const snapped = snapPoint(layoutPos.x, layoutPos.y);

      // Middle click or shift+left = pan
      if (e.button === 1 || (e.button === 0 && e.shiftKey && activeTool === "select")) {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (e.button !== 0) return;

      if (activeTool === "pan") {
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // ── Select tool ──
      if (activeTool === "select") {
        // Check if clicking on a selection handle (stretch)
        if (selectedItems.length === 1) {
          const selGeom = renderGeometries[selectedItems[0].geometryIndex];
          if (selGeom) {
            const handleIdx = hitTestSelectionHandle(layoutPos.x, layoutPos.y, selGeom, viewportRef.current);
            if (handleIdx >= 0) {
              setDragState({
                mode: "stretch",
                startLayout: snapped,
                handleIndex: handleIdx,
                originalGeometries: renderGeometries.map((g) => ({ ...g, points: [...g.points] })),
              });
              useToolStore.getState().setToolState("resizing");
              return;
            }
          }
        }

        const hitIdx = hitTestGeometries(layoutPos.x, layoutPos.y, renderGeometries, layers);
        if (hitIdx >= 0) {
          const geom = renderGeometries[hitIdx];
          if (e.ctrlKey) {
            // Add/remove from selection with Ctrl
            const alreadySelected = selectedItems.findIndex((s) => s.geometryIndex === hitIdx);
            if (alreadySelected >= 0) {
              useToolStore.getState().removeFromSelection(alreadySelected);
            } else {
              useToolStore.getState().addToSelection({ cellId: "local", geometryIndex: hitIdx, type: geom.type });
            }
          } else {
            select({ cellId: "local", geometryIndex: hitIdx, type: geom.type });
          }
          // Start move drag
          setDragState({
            mode: "move",
            startLayout: snapped,
            handleIndex: -1,
            originalGeometries: renderGeometries.map((g) => ({ ...g, points: [...g.points] })),
          });
          useToolStore.getState().setToolState("dragging");
        } else {
          clearSelection();
          setSelectionBox(layoutPos, layoutPos);
        }
        return;
      }

      // ── Drawing tools ──
      if (activeTool === "rect") {
        if (toolState === "idle") {
          beginDrawing("rect", activeLayerId, snapped);
        }
        return;
      }

      if (activeTool === "polygon") {
        if (toolState === "idle") {
          beginDrawing("polygon", activeLayerId, snapped);
        } else if (toolState === "drawing") {
          addDrawingPoint(snapped);
        }
        return;
      }

      if (activeTool === "path") {
        if (toolState === "idle") {
          beginDrawing("path", activeLayerId, snapped);
        } else if (toolState === "drawing") {
          addDrawingPoint(snapped);
        }
        return;
      }

      if (activeTool === "via") {
        const via: CanvasGeometry = {
          type: "via",
          layerId: activeLayerId,
          points: [{ x: snapped.x, y: snapped.y }],
          width: 0.17,
        };
        addGeometry(via);
        return;
      }

      // ── Ruler tool ──
      if (activeTool === "ruler") {
        if (!rulerPreview) {
          setRulerPreview({ start: snapped, end: snapped });
        } else {
          setRulerMeasurements((prev) => [...prev, { start: rulerPreview.start, end: snapped }]);
          setRulerPreview(null);
        }
        return;
      }
    },
    [activeTool, toolState, activeLayerId, renderGeometries, layers, screenToLayout, beginDrawing, addDrawingPoint, select, clearSelection, setSelectionBox, selectedItems, rulerPreview]
  );

  // ── Mouse: Move ──────────────────────────────────────────────────

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const layoutPos = screenToLayout(screenX, screenY, viewportRef.current);
      const snapped = snapPoint(layoutPos.x, layoutPos.y);
      setCursorPos(snapped);

      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        setViewport((vp) => ({
          ...vp,
          centerX: vp.centerX - dx / vp.zoom,
          centerY: vp.centerY + dy / vp.zoom,
        }));
        return;
      }

      if (toolState === "drawing" && drawingPreview) {
        if (activeTool === "rect") {
          updateCursorPos(snapped);
        } else if (activeTool === "polygon" || activeTool === "path") {
          if (e.ctrlKey && drawingPreview.points.length > 0) {
            const last = drawingPreview.points[drawingPreview.points.length - 1];
            const constrained = constrainAngle(last.x, last.y, snapped.x, snapped.y, false);
            updateCursorPos(constrained);
          } else {
            updateCursorPos(snapped);
          }
        }
      }

      if (selectionBox && activeTool === "select") {
        setSelectionBox(selectionBox.start, layoutPos);
      }

      // Move/stretch drag
      if (dragState && activeTool === "select") {
        const dx = snapped.x - dragState.startLayout.x;
        const dy = snapped.y - dragState.startLayout.y;

        if (dragState.mode === "move" && selectedItems.length > 0) {
          const updated = dragState.originalGeometries.map((g) => ({ ...g, points: [...g.points.map((p) => ({ ...p }))] }));
          for (const sel of selectedItems) {
            const geom = updated[sel.geometryIndex];
            if (geom) {
              geom.points = dragState.originalGeometries[sel.geometryIndex].points.map((p) => ({
                x: p.x + dx,
                y: p.y + dy,
              }));
            }
          }
          setDragPreview(updated);
        }

        if (dragState.mode === "stretch" && selectedItems.length === 1) {
          const selIdx = selectedItems[0].geometryIndex;
          const updated = dragState.originalGeometries.map((g) => ({ ...g, points: [...g.points.map((p) => ({ ...p }))] }));
          const geom = updated[selIdx];
          const orig = dragState.originalGeometries[selIdx];
          if (geom && orig && geom.type === "rect" && geom.points.length === 2) {
            const hi = dragState.handleIndex;
            const p = [{ ...orig.points[0] }, { ...orig.points[1] }];
            // Handles: 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left
            if (hi === 0 || hi === 3) p[0].x += dx;
            if (hi === 1 || hi === 2) p[1].x += dx;
            if (hi === 0 || hi === 1) p[0].y += dy;
            if (hi === 2 || hi === 3) p[1].y += dy;
            geom.points = [
              { x: Math.min(p[0].x, p[1].x), y: Math.min(p[0].y, p[1].y) },
              { x: Math.max(p[0].x, p[1].x), y: Math.max(p[0].y, p[1].y) },
            ];
          } else if (geom && orig && (geom.type === "polygon" || geom.type === "path")) {
            // Move the specific vertex
            const vi = dragState.handleIndex;
            if (vi >= 0 && vi < orig.points.length) {
              geom.points[vi] = { x: orig.points[vi].x + dx, y: orig.points[vi].y + dy };
            }
          }
          setDragPreview(updated);
        }
      }

      // Ruler preview
      if (rulerPreview && activeTool === "ruler") {
        setRulerPreview({ start: rulerPreview.start, end: snapped });
      }
    },
    [isPanning, toolState, activeTool, drawingPreview, selectionBox, screenToLayout, updateCursorPos, setSelectionBox, dragState, selectedItems, rulerPreview]
  );

  // ── Mouse: Up ────────────────────────────────────────────────────

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setIsPanning(false);
        return;
      }

      if (activeTool === "rect" && toolState === "drawing" && drawingPreview) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const layoutPos = screenToLayout(screenX, screenY, viewportRef.current);
        const snapped = snapPoint(layoutPos.x, layoutPos.y);

        addDrawingPoint(snapped);
        const preview = finishDrawing();
        if (preview && preview.points.length >= 2) {
          const p1 = preview.points[0];
          const p2 = preview.points[preview.points.length - 1];
          const newGeom: CanvasGeometry = {
            type: "rect",
            layerId: preview.layerId,
            points: [
              { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
              { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
            ],
          };
          addGeometry(newGeom);
        }
      }

      if (selectionBox && activeTool === "select") {
        // Drag-box selection: select all geometries inside the box
        const box = selectionBox;
        const minX = Math.min(box.start.x, box.end.x);
        const maxX = Math.max(box.start.x, box.end.x);
        const minY = Math.min(box.start.y, box.end.y);
        const maxY = Math.max(box.start.y, box.end.y);

        // Only count if box has non-trivial area
        if (Math.abs(maxX - minX) > 0.001 || Math.abs(maxY - minY) > 0.001) {
          const hits = boxSelectGeometries(minX, minY, maxX, maxY, renderGeometries, layers);
          if (hits.length > 0) {
            const items = hits.map((idx) => ({
              cellId: "local" as const,
              geometryIndex: idx,
              type: renderGeometries[idx].type,
            }));
            // Set selection to all found items
            useToolStore.getState().clearSelection();
            for (const item of items) {
              useToolStore.getState().addToSelection(item);
            }
          } else {
            clearSelection();
          }
        }
        clearSelectionBox();
      }

      // End move/stretch drag — commit to geometry store
      if (dragState && dragPreview) {
        useGeometryStore.getState().replaceAll(dragPreview);
        setDragPreview(null);
        setDragState(null);
        useToolStore.getState().setToolState("idle");
      } else if (dragState) {
        setDragState(null);
        useToolStore.getState().setToolState("idle");
      }
    },
    [isPanning, activeTool, toolState, drawingPreview, selectionBox, screenToLayout, addDrawingPoint, finishDrawing, clearSelectionBox, clearSelection, renderGeometries, layers, dragState, dragPreview]
  );

  // ── Mouse: Double-click (finish polygon/path) ────────────────────

  const handleDoubleClick = useCallback(
    () => {
      if (
        (activeTool === "polygon" || activeTool === "path") &&
        toolState === "drawing"
      ) {
        const preview = finishDrawing();
        if (preview) {
          if (preview.tool === "polygon" && preview.points.length >= 3) {
            addGeometry({ type: "polygon", layerId: preview.layerId, points: preview.points });
          } else if (preview.tool === "path" && preview.points.length >= 2) {
            addGeometry({ type: "path", layerId: preview.layerId, points: preview.points, width: preview.width ?? 0.1 });
          }
        }
      }
    },
    [activeTool, toolState, finishDrawing]
  );

  // ── Keyboard shortcuts ───────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (toolState === "drawing") {
          cancelDrawing();
        } else {
          clearSelection();
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedItems.length > 0) {
          removeGeometries(selectedItems.map((s) => s.geometryIndex));
          clearSelection();
        }
      }

      // Copy (Ctrl+C)
      if (e.key === "c" && (e.ctrlKey || e.metaKey) && selectedItems.length > 0) {
        e.preventDefault();
        const currentGeoms = geometriesRef.current;
        const entries = selectedItems
          .map((s) => currentGeoms[s.geometryIndex])
          .filter(Boolean)
          .map((g) => ({ type: g.type, layerId: g.layerId, points: g.points, width: g.width }));
        useToolStore.getState().copyGeometries(entries);
      }

      // Cut (Ctrl+X)
      if (e.key === "x" && (e.ctrlKey || e.metaKey) && selectedItems.length > 0) {
        e.preventDefault();
        const currentGeoms = geometriesRef.current;
        const entries = selectedItems
          .map((s) => currentGeoms[s.geometryIndex])
          .filter(Boolean)
          .map((g) => ({ type: g.type, layerId: g.layerId, points: g.points, width: g.width }));
        useToolStore.getState().copyGeometries(entries);
        removeGeometries(selectedItems.map((s) => s.geometryIndex));
        clearSelection();
      }

      // Paste (Ctrl+V)
      if (e.key === "v" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const pasted = useToolStore.getState().paste();
        if (pasted.length > 0) {
          const pasteOffset = 0.5; // offset in µm
          const newGeoms: CanvasGeometry[] = pasted.map((entry) => ({
            type: entry.type,
            layerId: entry.layerId,
            points: entry.points.map((p) => ({ x: p.x + pasteOffset, y: p.y + pasteOffset })),
            width: entry.width,
          }));
          const baseIndex = geometriesRef.current.length;
          commitGeometries((prev) => [...prev, ...newGeoms]);
          const newItems = newGeoms.map((g, i) => ({
            cellId: "local" as const,
            geometryIndex: baseIndex + i,
            type: g.type,
          }));
          setTimeout(() => {
            useToolStore.getState().clearSelection();
            for (const item of newItems) {
              useToolStore.getState().addToSelection(item);
            }
          }, 0);
        }
      }

      // Clear ruler measurements (Ctrl+Shift+R)
      if (e.key === "R" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        setRulerMeasurements([]);
        setRulerPreview(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toolState, selectedItems, cancelDrawing, clearSelection]);

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="layout-canvas" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="layout-canvas__canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setIsPanning(false)}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          cursor:
            dragState
              ? dragState.mode === "stretch" ? "nwse-resize" : "move"
              : isPanning
              ? "grabbing"
              : activeTool === "pan"
              ? "grab"
              : activeTool === "select"
              ? "default"
              : activeTool === "ruler"
              ? "crosshair"
              : "crosshair",
        }}
      />
      <div className="layout-canvas__coords">
        X: {cursorPos.x.toFixed(3)} &mu;m &nbsp; Y: {cursorPos.y.toFixed(3)} &mu;m
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Rendering helpers
// ══════════════════════════════════════════════════════════════════════

function renderGrid(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  spacing: number
) {
  const left = vp.centerX - w / (2 * vp.zoom);
  const right = vp.centerX + w / (2 * vp.zoom);
  const top = vp.centerY + h / (2 * vp.zoom);
  const bottom = vp.centerY - h / (2 * vp.zoom);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  const startX = Math.floor(left / spacing) * spacing;
  for (let x = startX; x <= right; x += spacing) {
    const sx = (x - vp.centerX) * vp.zoom + w / 2;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  const startY = Math.floor(bottom / spacing) * spacing;
  for (let y = startY; y <= top; y += spacing) {
    const sy = h / 2 - (y - vp.centerY) * vp.zoom;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.stroke();

  const major = spacing * 10;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  const mStartX = Math.floor(left / major) * major;
  for (let x = mStartX; x <= right; x += major) {
    const sx = (x - vp.centerX) * vp.zoom + w / 2;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  const mStartY = Math.floor(bottom / major) * major;
  for (let y = mStartY; y <= top; y += major) {
    const sy = h / 2 - (y - vp.centerY) * vp.zoom;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.stroke();
}

function renderOrigin(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number
) {
  const ox = (0 - vp.centerX) * vp.zoom + w / 2;
  const oy = h / 2 - (0 - vp.centerY) * vp.zoom;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, h);
  ctx.moveTo(0, oy);
  ctx.lineTo(w, oy);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.arc(ox, oy, 3, 0, Math.PI * 2);
  ctx.fill();
}

function renderGeometry(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  geom: CanvasGeometry,
  layer: LayerDef,
  isSelected: boolean
) {
  const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
  const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;

  const fillColor = hexToRgba(layer.color, isSelected ? 0.5 : layer.fillAlpha);
  const strokeColor = hexToRgba(layer.color, isSelected ? 1.0 : layer.strokeAlpha);

  if (geom.type === "rect" && geom.points.length >= 2) {
    const p1 = geom.points[0];
    const p2 = geom.points[1];
    const sx = toSX(p1.x);
    const sy = toSY(p2.y);
    const sw = (p2.x - p1.x) * vp.zoom;
    const sh = (p2.y - p1.y) * vp.zoom;

    ctx.fillStyle = fillColor;
    ctx.fillRect(sx, sy, sw, sh);

    if (layer.fillPattern === "hatch" || layer.fillPattern === "cross") {
      renderFillPattern(ctx, sx, sy, sw, sh, layer);
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(sx, sy, sw, sh);

    if (isSelected) {
      renderSelectionHandles(ctx, [
        { x: sx, y: sy },
        { x: sx + sw, y: sy },
        { x: sx + sw, y: sy + sh },
        { x: sx, y: sy + sh },
      ]);
    }
  }

  if (geom.type === "polygon" && geom.points.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(toSX(geom.points[0].x), toSY(geom.points[0].y));
    for (let i = 1; i < geom.points.length; i++) {
      ctx.lineTo(toSX(geom.points[i].x), toSY(geom.points[i].y));
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.stroke();

    if (isSelected) {
      renderSelectionHandles(ctx, geom.points.map((p) => ({ x: toSX(p.x), y: toSY(p.y) })));
    }
  }

  if (geom.type === "path" && geom.points.length >= 2) {
    const pathWidth = (geom.width ?? 0.1) * vp.zoom;
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = pathWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(toSX(geom.points[0].x), toSY(geom.points[0].y));
    for (let i = 1; i < geom.points.length; i++) {
      ctx.lineTo(toSX(geom.points[i].x), toSY(geom.points[i].y));
    }
    ctx.stroke();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(toSX(geom.points[0].x), toSY(geom.points[0].y));
    for (let i = 1; i < geom.points.length; i++) {
      ctx.lineTo(toSX(geom.points[i].x), toSY(geom.points[i].y));
    }
    ctx.stroke();
  }

  if (geom.type === "via") {
    const pos = geom.points[0];
    const viaSize = (geom.width ?? 0.17) * vp.zoom;
    const sx = toSX(pos.x) - viaSize / 2;
    const sy = toSY(pos.y) - viaSize / 2;

    ctx.fillStyle = fillColor;
    ctx.fillRect(sx, sy, viaSize, viaSize);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(sx, sy, viaSize, viaSize);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + viaSize, sy + viaSize);
    ctx.moveTo(sx + viaSize, sy);
    ctx.lineTo(sx, sy + viaSize);
    ctx.stroke();
  }
}

function renderFillPattern(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  layer: LayerDef
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(sx, sy, sw, sh);
  ctx.clip();
  ctx.strokeStyle = hexToRgba(layer.color, 0.15);
  ctx.lineWidth = 0.5;
  const spacing = 6;

  if (layer.fillPattern === "hatch" || layer.fillPattern === "cross") {
    ctx.beginPath();
    for (let offset = -Math.abs(sh); offset < Math.abs(sw) + Math.abs(sh); offset += spacing) {
      ctx.moveTo(sx + offset, sy + Math.abs(sh));
      ctx.lineTo(sx + offset + Math.abs(sh), sy);
    }
    ctx.stroke();
  }
  if (layer.fillPattern === "cross") {
    ctx.beginPath();
    for (let offset = -Math.abs(sh); offset < Math.abs(sw) + Math.abs(sh); offset += spacing) {
      ctx.moveTo(sx + offset, sy);
      ctx.lineTo(sx + offset + Math.abs(sh), sy + Math.abs(sh));
    }
    ctx.stroke();
  }
  ctx.restore();
}

function renderDrawingPreview(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  preview: DrawingPreview,
  layers: LayerDef[]
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

    ctx.fillStyle = hexToRgba(color, 0.2);
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, sy, sw, sh);

    const dimW = Math.abs(p2.x - p1.x).toFixed(3);
    const dimH = Math.abs(p2.y - p1.y).toFixed(3);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${dimW} \u00D7 ${dimH} \u00B5m`, sx + sw / 2, sy - 6);
  }

  if ((preview.tool === "polygon" || preview.tool === "path") && preview.points.length >= 1) {
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

    for (const pt of preview.points) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(toSX(pt.x), toSY(pt.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function renderSelectionBox(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  box: { start: ToolPoint; end: ToolPoint }
) {
  const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
  const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;

  const sx = toSX(Math.min(box.start.x, box.end.x));
  const sy = toSY(Math.max(box.start.y, box.end.y));
  const sw = Math.abs(box.end.x - box.start.x) * vp.zoom;
  const sh = Math.abs(box.end.y - box.start.y) * vp.zoom;

  ctx.save();
  ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
  ctx.fillRect(sx, sy, sw, sh);
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
  ctx.lineWidth = 1;
  ctx.strokeRect(sx, sy, sw, sh);
  ctx.restore();
}

function renderSelectionHandles(
  ctx: CanvasRenderingContext2D,
  screenPoints: { x: number; y: number }[]
) {
  const size = 4;
  ctx.fillStyle = "#3b82f6";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (const p of screenPoints) {
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
  }
}

// ══════════════════════════════════════════════════════════════════════
// DRC Violation Overlay
// ══════════════════════════════════════════════════════════════════════

function renderDrcViolations(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number,
  h: number,
  violations: DrcViolation[],
  selectedId: string | null
) {
  const toSX = (x: number) => (x - vp.centerX) * vp.zoom + w / 2;
  const toSY = (y: number) => h / 2 - (y - vp.centerY) * vp.zoom;

  for (const v of violations) {
    const isSelected = v.id === selectedId;
    const color = v.severity === "error"
      ? "rgba(239, 68, 68,"
      : v.severity === "warning"
      ? "rgba(245, 158, 11,"
      : "rgba(59, 130, 246,";

    const sx = toSX(v.bbox.minX);
    const sy = toSY(v.bbox.maxY);
    const sw = (v.bbox.maxX - v.bbox.minX) * vp.zoom;
    const sh = (v.bbox.maxY - v.bbox.minY) * vp.zoom;

    // Violation region highlight
    ctx.save();
    ctx.fillStyle = `${color} ${isSelected ? 0.25 : 0.12})`;
    ctx.fillRect(sx - 3, sy - 3, sw + 6, sh + 6);

    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = `${color} ${isSelected ? 0.9 : 0.6})`;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(sx - 3, sy - 3, sw + 6, sh + 6);
    ctx.setLineDash([]);

    // Violation marker (X)
    const cx = toSX(v.location.x);
    const cy = toSY(v.location.y);
    const markerSize = isSelected ? 8 : 6;

    ctx.strokeStyle = `${color} 1)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - markerSize, cy - markerSize);
    ctx.lineTo(cx + markerSize, cy + markerSize);
    ctx.moveTo(cx + markerSize, cy - markerSize);
    ctx.lineTo(cx - markerSize, cy + markerSize);
    ctx.stroke();

    // Rule label (show when zoomed in enough)
    if (vp.zoom > 5 || isSelected) {
      ctx.fillStyle = `${color} 0.9)`;
      ctx.font = `${isSelected ? "bold " : ""}9px 'JetBrains Mono', monospace`;
      ctx.textAlign = "left";
      ctx.fillText(v.ruleId, sx + sw + 6, sy + 10);
    }

    ctx.restore();
  }
}

// ══════════════════════════════════════════════════════════════════════
// Hit testing
// ══════════════════════════════════════════════════════════════════════

function hitTestGeometries(
  x: number,
  y: number,
  geometries: CanvasGeometry[],
  layers: LayerDef[]
): number {
  for (let i = geometries.length - 1; i >= 0; i--) {
    const geom = geometries[i];
    const layer = layers.find((l) => l.id === geom.layerId);
    if (!layer || !layer.visible || !layer.selectable) continue;

    if (geom.type === "rect" && geom.points.length >= 2) {
      const [p1, p2] = geom.points;
      if (x >= Math.min(p1.x, p2.x) && x <= Math.max(p1.x, p2.x) && y >= Math.min(p1.y, p2.y) && y <= Math.max(p1.y, p2.y)) {
        return i;
      }
    }
    if (geom.type === "via") {
      const pos = geom.points[0];
      const halfW = (geom.width ?? 0.17) / 2;
      if (x >= pos.x - halfW && x <= pos.x + halfW && y >= pos.y - halfW && y <= pos.y + halfW) {
        return i;
      }
    }
    if (geom.type === "polygon" && geom.points.length >= 3) {
      if (pointInPolygon(x, y, geom.points)) return i;
    }
    if (geom.type === "path" && geom.points.length >= 2) {
      const halfW = (geom.width ?? 0.1) / 2 + 0.05;
      for (let j = 0; j < geom.points.length - 1; j++) {
        if (distanceToSegment(x, y, geom.points[j], geom.points[j + 1]) <= halfW) return i;
      }
    }
  }
  return -1;
}

function pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distanceToSegment(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - a.x) ** 2 + (py - a.y) ** 2);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - a.x - t * dx) ** 2 + (py - a.y - t * dy) ** 2);
}

// ══════════════════════════════════════════════════════════════════════
// Box selection (drag-select)
// ══════════════════════════════════════════════════════════════════════

function boxSelectGeometries(
  minX: number, minY: number, maxX: number, maxY: number,
  geometries: CanvasGeometry[], layers: LayerDef[]
): number[] {
  const hits: number[] = [];
  for (let i = 0; i < geometries.length; i++) {
    const geom = geometries[i];
    const layer = layers.find((l) => l.id === geom.layerId);
    if (!layer || !layer.visible || !layer.selectable) continue;
    const bb = geomBoundingBox(geom);
    if (!bb) continue;
    // Geometry is selected if its bounding box is fully inside the selection box
    if (bb.minX >= minX && bb.maxX <= maxX && bb.minY >= minY && bb.maxY <= maxY) {
      hits.push(i);
    }
  }
  return hits;
}

function geomBoundingBox(geom: CanvasGeometry): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (geom.points.length === 0) return null;
  if (geom.type === "via") {
    const halfW = (geom.width ?? 0.17) / 2;
    return {
      minX: geom.points[0].x - halfW, minY: geom.points[0].y - halfW,
      maxX: geom.points[0].x + halfW, maxY: geom.points[0].y + halfW,
    };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of geom.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (geom.type === "path" && geom.width) {
    const halfW = geom.width / 2;
    minX -= halfW; minY -= halfW; maxX += halfW; maxY += halfW;
  }
  return { minX, minY, maxX, maxY };
}

// ══════════════════════════════════════════════════════════════════════
// Selection handle hit-testing (for stretch/resize)
// ══════════════════════════════════════════════════════════════════════

function hitTestSelectionHandle(
  x: number, y: number, geom: CanvasGeometry, vp: ViewportState
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
      if (Math.abs(x - c.x) <= handleRadiusLayout && Math.abs(y - c.y) <= handleRadiusLayout) {
        return i;
      }
    }
  } else if ((geom.type === "polygon" || geom.type === "path") && geom.points.length >= 2) {
    for (let i = 0; i < geom.points.length; i++) {
      const p = geom.points[i];
      if (Math.abs(x - p.x) <= handleRadiusLayout && Math.abs(y - p.y) <= handleRadiusLayout) {
        return i;
      }
    }
  }
  return -1;
}

// ══════════════════════════════════════════════════════════════════════
// Ruler rendering
// ══════════════════════════════════════════════════════════════════════

function renderRuler(
  ctx: CanvasRenderingContext2D,
  vp: ViewportState,
  w: number, h: number,
  ruler: RulerMeasurement
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

  ctx.save();

  // Ruler line
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(start.sx, start.sy);
  ctx.lineTo(end.sx, end.sy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Endpoints
  const r = 4;
  for (const pt of [start, end]) {
    ctx.fillStyle = "#FFD700";
    ctx.beginPath();
    ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distance label
  const midX = (start.sx + end.sx) / 2;
  const midY = (start.sy + end.sy) / 2;
  const label = `${distance.toFixed(3)} µm`;
  const dxLabel = `Δx=${Math.abs(dx).toFixed(3)}`;
  const dyLabel = `Δy=${Math.abs(dy).toFixed(3)}`;

  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  // Background for labels
  const metrics = ctx.measureText(label);
  const labelW = Math.max(metrics.width, ctx.measureText(dxLabel).width, ctx.measureText(dyLabel).width) + 12;
  ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
  ctx.fillRect(midX - labelW / 2, midY - 52, labelW, 48);

  ctx.fillStyle = "#FFD700";
  ctx.fillText(label, midX, midY - 36);
  ctx.font = "11px monospace";
  ctx.fillStyle = "#CCCCCC";
  ctx.fillText(dxLabel, midX, midY - 20);
  ctx.fillText(dyLabel, midX, midY - 6);

  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
