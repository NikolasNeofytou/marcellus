/**
 * useLayoutInput — mouse / keyboard interaction for the layout canvas.
 *
 * Handles: select, box-select, move-drag, stretch-drag, drawing tools
 * (rect/polygon/path/via/ruler), panning, keyboard shortcuts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useToolStore } from "../stores/toolStore";
import { useGeometryStore, type CanvasGeometry } from "../stores/geometryStore";
import { useCellStore } from "../stores/cellStore";
import { useLayerStore } from "../stores/layerStore";
import { snapPoint, constrainAngle } from "../utils/gridSnap";
import {
  hitTestGeometries,
  hitTestSelectionHandle,
  boxSelectGeometries,
} from "../utils/layoutHitTesting";
import type { ViewportState } from "./useLayoutViewport";
import type { RulerMeasurement } from "./useLayoutRenderer";

// ── Types ──

export interface DragState {
  mode: "move" | "stretch";
  startLayout: { x: number; y: number };
  handleIndex: number;
  originalGeometries: CanvasGeometry[];
}

interface UseLayoutInputOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewportRef: React.MutableRefObject<ViewportState>;
  renderGeometries: CanvasGeometry[];
  screenToLayout: (sx: number, sy: number, vp: ViewportState) => { x: number; y: number };
  isPanning: boolean;
  startPan: (clientX: number, clientY: number) => void;
  updatePan: (clientX: number, clientY: number) => void;
  endPan: () => void;
}

export function useLayoutInput(opts: UseLayoutInputOptions) {
  const {
    canvasRef, viewportRef, renderGeometries,
    screenToLayout, isPanning, startPan, updatePan, endPan,
  } = opts;

  // ── Store selectors ──
  const activeTool     = useToolStore((s) => s.activeTool);
  const toolState      = useToolStore((s) => s.toolState);
  const drawingPreview = useToolStore((s) => s.drawingPreview);
  const selectedItems  = useToolStore((s) => s.selectedItems);
  const selectionBox   = useToolStore((s) => s.selectionBox);
  const beginDrawing   = useToolStore((s) => s.beginDrawing);
  const addDrawingPoint = useToolStore((s) => s.addDrawingPoint);
  const updateCursorPos = useToolStore((s) => s.updateCursorPos);
  const finishDrawing  = useToolStore((s) => s.finishDrawing);
  const cancelDrawing  = useToolStore((s) => s.cancelDrawing);
  const select         = useToolStore((s) => s.select);
  const clearSelection = useToolStore((s) => s.clearSelection);
  const setSelectionBox = useToolStore((s) => s.setSelectionBox);
  const clearSelectionBox = useToolStore((s) => s.clearSelectionBox);

  const layers         = useLayerStore((s) => s.layers);
  const activeLayerId  = useLayerStore((s) => s.activeLayerId);

  const addGeometry      = useGeometryStore((s) => s.addGeometry);
  const removeGeometries = useGeometryStore((s) => s.removeGeometries);
  const commitGeometries = useGeometryStore((s) => s.commit);

  const geometriesRef = useRef(useGeometryStore.getState().geometries);
  useEffect(() => useGeometryStore.subscribe((s) => { geometriesRef.current = s.geometries; }), []);

  // ── Local state ──
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const [dragPreview, setDragPreview] = useState<CanvasGeometry[] | null>(null);
  const [rulerMeasurements, setRulerMeasurements] = useState<RulerMeasurement[]>([]);
  const [rulerPreview, setRulerPreview] = useState<RulerMeasurement | null>(null);

  /** The geometries to actually render (drag preview overrides store during drag). */
  const effectiveGeometries = dragPreview ?? renderGeometries;

  // ── Mouse: Down ──

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
        startPan(e.clientX, e.clientY);
        return;
      }
      if (e.button !== 0) return;

      if (activeTool === "pan") {
        startPan(e.clientX, e.clientY);
        return;
      }

      // ── Select tool ──
      if (activeTool === "select") {
        // Check selection handle (stretch)
        if (selectedItems.length === 1) {
          const selGeom = renderGeometries[selectedItems[0].geometryIndex];
          if (selGeom) {
            const handleIdx = hitTestSelectionHandle(layoutPos.x, layoutPos.y, selGeom, viewportRef.current);
            if (handleIdx >= 0) {
              setDragState({
                mode: "stretch", startLayout: snapped, handleIndex: handleIdx,
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
          const instanceId = geom.properties?._instanceId as string | undefined;
          if (instanceId) {
            useCellStore.getState().selectInstances([instanceId]);
            clearSelection();
          } else if (e.ctrlKey) {
            const alreadySelected = selectedItems.findIndex((s) => s.geometryIndex === hitIdx);
            if (alreadySelected >= 0) {
              useToolStore.getState().removeFromSelection(alreadySelected);
            } else {
              useToolStore.getState().addToSelection({ cellId: "local", geometryIndex: hitIdx, type: geom.type });
            }
            useCellStore.getState().clearSelection();
          } else {
            select({ cellId: "local", geometryIndex: hitIdx, type: geom.type });
            useCellStore.getState().clearSelection();
          }
          if (!instanceId) {
            setDragState({
              mode: "move", startLayout: snapped, handleIndex: -1,
              originalGeometries: renderGeometries.map((g) => ({ ...g, points: [...g.points] })),
            });
            useToolStore.getState().setToolState("dragging");
          }
        } else {
          clearSelection();
          useCellStore.getState().clearSelection();
          setSelectionBox(layoutPos, layoutPos);
        }
        return;
      }

      // ── Drawing tools ──
      if (activeTool === "rect") {
        if (toolState === "idle") beginDrawing("rect", activeLayerId, snapped);
        return;
      }
      if (activeTool === "polygon") {
        if (toolState === "idle") beginDrawing("polygon", activeLayerId, snapped);
        else if (toolState === "drawing") addDrawingPoint(snapped);
        return;
      }
      if (activeTool === "path") {
        if (toolState === "idle") beginDrawing("path", activeLayerId, snapped);
        else if (toolState === "drawing") addDrawingPoint(snapped);
        return;
      }
      if (activeTool === "via") {
        addGeometry({ type: "via", layerId: activeLayerId, points: [{ x: snapped.x, y: snapped.y }], width: 0.17 });
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
    [activeTool, toolState, activeLayerId, renderGeometries, layers, screenToLayout,
     beginDrawing, addDrawingPoint, select, clearSelection, setSelectionBox, selectedItems, rulerPreview, startPan, canvasRef, viewportRef],
  );

  // ── Mouse: Move ──

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
        updatePan(e.clientX, e.clientY);
        return;
      }

      // Drawing
      if (toolState === "drawing" && drawingPreview) {
        if (activeTool === "rect") {
          updateCursorPos(snapped);
        } else if (activeTool === "polygon" || activeTool === "path") {
          if (e.ctrlKey && drawingPreview.points.length > 0) {
            const last = drawingPreview.points[drawingPreview.points.length - 1];
            updateCursorPos(constrainAngle(last.x, last.y, snapped.x, snapped.y, false));
          } else {
            updateCursorPos(snapped);
          }
        }
      }

      // Selection box
      if (selectionBox && activeTool === "select") {
        setSelectionBox(selectionBox.start, layoutPos);
      }

      // Move/stretch drag
      if (dragState && activeTool === "select") {
        const dx = snapped.x - dragState.startLayout.x;
        const dy = snapped.y - dragState.startLayout.y;

        if (dragState.mode === "move" && selectedItems.length > 0) {
          const updated = dragState.originalGeometries.map((g) => ({ ...g, points: g.points.map((p) => ({ ...p })) }));
          for (const sel of selectedItems) {
            const geom = updated[sel.geometryIndex];
            if (geom) {
              geom.points = dragState.originalGeometries[sel.geometryIndex].points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
            }
          }
          setDragPreview(updated);
        }

        if (dragState.mode === "stretch" && selectedItems.length === 1) {
          const selIdx = selectedItems[0].geometryIndex;
          const updated = dragState.originalGeometries.map((g) => ({ ...g, points: g.points.map((p) => ({ ...p })) }));
          const geom = updated[selIdx];
          const orig = dragState.originalGeometries[selIdx];
          if (geom && orig && geom.type === "rect" && geom.points.length === 2) {
            const hi = dragState.handleIndex;
            const p = [{ ...orig.points[0] }, { ...orig.points[1] }];
            if (hi === 0 || hi === 3) p[0].x += dx;
            if (hi === 1 || hi === 2) p[1].x += dx;
            if (hi === 0 || hi === 1) p[0].y += dy;
            if (hi === 2 || hi === 3) p[1].y += dy;
            geom.points = [
              { x: Math.min(p[0].x, p[1].x), y: Math.min(p[0].y, p[1].y) },
              { x: Math.max(p[0].x, p[1].x), y: Math.max(p[0].y, p[1].y) },
            ];
          } else if (geom && orig && (geom.type === "polygon" || geom.type === "path")) {
            const vi = dragState.handleIndex;
            if (vi >= 0 && vi < orig.points.length) {
              geom.points[vi] = { x: orig.points[vi].x + dx, y: orig.points[vi].y + dy };
            }
          }
          setDragPreview(updated);
        }
      }

      // Ruler drag
      if (rulerPreview && activeTool === "ruler") {
        setRulerPreview({ start: rulerPreview.start, end: snapped });
      }
    },
    [isPanning, toolState, activeTool, drawingPreview, selectionBox, screenToLayout,
     updateCursorPos, setSelectionBox, dragState, selectedItems, rulerPreview, updatePan, canvasRef, viewportRef],
  );

  // ── Mouse: Up ──

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) { endPan(); return; }

      // Finish rect
      if (activeTool === "rect" && toolState === "drawing" && drawingPreview) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const layoutPos = screenToLayout(e.clientX - rect.left, e.clientY - rect.top, viewportRef.current);
        const snapped = snapPoint(layoutPos.x, layoutPos.y);
        addDrawingPoint(snapped);
        const preview = finishDrawing();
        if (preview && preview.points.length >= 2) {
          const p1 = preview.points[0];
          const p2 = preview.points[preview.points.length - 1];
          addGeometry({
            type: "rect", layerId: preview.layerId,
            points: [
              { x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y) },
              { x: Math.max(p1.x, p2.x), y: Math.max(p1.y, p2.y) },
            ],
          });
        }
      }

      // Box selection
      if (selectionBox && activeTool === "select") {
        const box = selectionBox;
        const minX = Math.min(box.start.x, box.end.x);
        const maxX = Math.max(box.start.x, box.end.x);
        const minY = Math.min(box.start.y, box.end.y);
        const maxY = Math.max(box.start.y, box.end.y);
        if (Math.abs(maxX - minX) > 0.001 || Math.abs(maxY - minY) > 0.001) {
          const hits = boxSelectGeometries(minX, minY, maxX, maxY, renderGeometries, layers);
          if (hits.length > 0) {
            useToolStore.getState().clearSelection();
            for (const idx of hits) {
              useToolStore.getState().addToSelection({ cellId: "local", geometryIndex: idx, type: renderGeometries[idx].type });
            }
          } else { clearSelection(); }
        }
        clearSelectionBox();
      }

      // Commit drag
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
    [isPanning, activeTool, toolState, drawingPreview, selectionBox, screenToLayout,
     addDrawingPoint, finishDrawing, clearSelectionBox, clearSelection, renderGeometries, layers,
     dragState, dragPreview, endPan, canvasRef, viewportRef, addGeometry],
  );

  // ── Mouse: Double-click (finish polygon / path) ──

  const handleDoubleClick = useCallback(() => {
    if ((activeTool === "polygon" || activeTool === "path") && toolState === "drawing") {
      const preview = finishDrawing();
      if (preview) {
        if (preview.tool === "polygon" && preview.points.length >= 3) {
          addGeometry({ type: "polygon", layerId: preview.layerId, points: preview.points });
        } else if (preview.tool === "path" && preview.points.length >= 2) {
          addGeometry({ type: "path", layerId: preview.layerId, points: preview.points, width: preview.width ?? 0.1 });
        }
      }
    }
  }, [activeTool, toolState, finishDrawing, addGeometry]);

  // ── Keyboard shortcuts ──

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (toolState === "drawing") cancelDrawing();
        else clearSelection();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const instSel = useCellStore.getState().selectedInstances;
        if (instSel.length > 0) useCellStore.getState().removeInstances(instSel);
        if (selectedItems.length > 0) {
          removeGeometries(selectedItems.map((s) => s.geometryIndex));
          clearSelection();
        }
      }

      // Rotate (R)
      if (e.key === "r" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const instSel = useCellStore.getState().selectedInstances;
        if (instSel.length > 0) {
          e.preventDefault();
          for (const id of instSel) useCellStore.getState().rotateInstance(id);
        }
      }
      // Mirror (X)
      if (e.key === "x" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const instSel = useCellStore.getState().selectedInstances;
        if (instSel.length > 0) {
          e.preventDefault();
          for (const id of instSel) useCellStore.getState().mirrorInstance(id);
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
          const offset = 0.5;
          const newGeoms: CanvasGeometry[] = pasted.map((entry) => ({
            type: entry.type, layerId: entry.layerId,
            points: entry.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
            width: entry.width,
          }));
          const baseIndex = geometriesRef.current.length;
          commitGeometries((prev) => [...prev, ...newGeoms]);
          const newItems = newGeoms.map((g, i) => ({
            cellId: "local" as const, geometryIndex: baseIndex + i, type: g.type,
          }));
          setTimeout(() => {
            useToolStore.getState().clearSelection();
            for (const item of newItems) useToolStore.getState().addToSelection(item);
          }, 0);
        }
      }

      // Clear rulers (Ctrl+Shift+R)
      if (e.key === "R" && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        setRulerMeasurements([]);
        setRulerPreview(null);
      }

      // Duplicate (Ctrl+D)
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const dupOffset = 0.5;

        const instSel = useCellStore.getState().selectedInstances;
        if (instSel.length > 0) {
          const newIds: string[] = [];
          for (const id of instSel) {
            const inst = useCellStore.getState().getInstance(id);
            if (inst) {
              const newId = useCellStore.getState().placeInstance(inst.cellId, {
                x: inst.position.x + dupOffset, y: inst.position.y + dupOffset,
              }, { rotation: inst.rotation, mirror: inst.mirror, connections: { ...inst.connections } });
              if (newId) newIds.push(newId);
            }
          }
          if (newIds.length > 0) useCellStore.getState().selectInstances(newIds);
        }

        if (selectedItems.length > 0) {
          const currentGeoms = geometriesRef.current;
          const newGeoms: CanvasGeometry[] = selectedItems
            .map((s) => currentGeoms[s.geometryIndex])
            .filter(Boolean)
            .map((g) => ({
              ...g, id: undefined as unknown as string,
              points: g.points.map((p) => ({ x: p.x + dupOffset, y: p.y + dupOffset })),
            }));
          const baseIndex = currentGeoms.length;
          commitGeometries((prev) => [...prev, ...newGeoms]);
          const newItems = newGeoms.map((g, i) => ({
            cellId: "local" as const, geometryIndex: baseIndex + i, type: g.type,
          }));
          setTimeout(() => {
            useToolStore.getState().clearSelection();
            for (const item of newItems) useToolStore.getState().addToSelection(item);
          }, 0);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toolState, selectedItems, cancelDrawing, clearSelection, removeGeometries, commitGeometries]);

  // ── Cursor style ──

  const cursorStyle: string =
    dragState
      ? dragState.mode === "stretch" ? "nwse-resize" : "move"
      : isPanning
        ? "grabbing"
        : activeTool === "pan"
          ? "grab"
          : activeTool === "select"
            ? "default"
            : "crosshair";

  return {
    cursorPos,
    cursorStyle,
    dragPreview,
    rulerMeasurements,
    rulerPreview,
    effectiveGeometries,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleDoubleClick,
    handleMouseLeave: endPan,
  };
}
