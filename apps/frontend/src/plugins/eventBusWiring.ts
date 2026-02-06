/**
 * Event Bus Wiring — connects Zustand store changes to the plugin event bus.
 *
 * Call `wireEventBus()` once at app startup to begin emitting plugin events
 * whenever geometry, tool, selection, DRC, or layer state changes.
 */

import { pluginEventBus } from "./pluginApi";
import { useGeometryStore } from "../stores/geometryStore";
import { useToolStore } from "../stores/toolStore";
import { useDrcStore } from "../stores/drcStore";
import { useLayerStore } from "../stores/layerStore";

let wired = false;

export function wireEventBus(): void {
  if (wired) return;
  wired = true;

  // ── Geometry changes ──
  let prevGeomCount = useGeometryStore.getState().geometries.length;
  useGeometryStore.subscribe((state) => {
    const count = state.geometries.length;
    if (count > prevGeomCount) {
      pluginEventBus.emit("geometry:added", { count: count - prevGeomCount });
    } else if (count < prevGeomCount) {
      pluginEventBus.emit("geometry:removed", { count: prevGeomCount - count });
    } else if (count === prevGeomCount && state.modified) {
      pluginEventBus.emit("geometry:changed", {});
    }
    prevGeomCount = count;
  });

  // ── Tool changes ──
  let prevTool = useToolStore.getState().activeTool;
  useToolStore.subscribe((state) => {
    if (state.activeTool !== prevTool) {
      pluginEventBus.emit("tool:changed", { tool: state.activeTool, previous: prevTool });
      prevTool = state.activeTool;
    }
  });

  // ── Selection changes ──
  let prevSelLen = useToolStore.getState().selectedItems.length;
  useToolStore.subscribe((state) => {
    const len = state.selectedItems.length;
    if (len !== prevSelLen) {
      pluginEventBus.emit("selection:changed", {
        count: len,
        indices: state.selectedItems.map((s) => s.geometryIndex),
      });
      prevSelLen = len;
    }
  });

  // ── DRC events ──
  let prevDrcState: string = useDrcStore.getState().runState;
  useDrcStore.subscribe((state) => {
    if (state.runState === "running" && prevDrcState !== "running") {
      pluginEventBus.emit("drc:started", {});
    } else if (state.runState === "completed" && prevDrcState !== "completed") {
      pluginEventBus.emit("drc:completed", {
        violationCount: state.lastResult?.violations.length ?? 0,
      });
    }
    prevDrcState = state.runState;
  });

  // ── Layer changes ──
  let prevActiveLayer = useLayerStore.getState().activeLayerId;
  useLayerStore.subscribe((state) => {
    if (state.activeLayerId !== prevActiveLayer) {
      pluginEventBus.emit("layer:changed", {
        layerId: state.activeLayerId,
        previous: prevActiveLayer,
      });
      prevActiveLayer = state.activeLayerId;
    }
  });
}
