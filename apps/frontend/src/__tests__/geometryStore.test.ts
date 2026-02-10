/**
 * geometryStore unit tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useGeometryStore, type CanvasGeometry } from "../stores/geometryStore";

const getState = () => useGeometryStore.getState();

function makeRect(layerId = 1): CanvasGeometry {
  return {
    type: "rect",
    layerId,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ],
  };
}

describe("geometryStore", () => {
  beforeEach(() => {
    // Reset to pristine state
    getState().load([], "test");
  });

  // ── Basic mutations ──

  it("addGeometry appends and auto-assigns id", () => {
    getState().addGeometry(makeRect());
    const geoms = getState().geometries;
    expect(geoms).toHaveLength(1);
    expect(geoms[0].id).toBeTruthy();
    expect(geoms[0].type).toBe("rect");
  });

  it("addGeometries appends multiple", () => {
    getState().addGeometries([makeRect(1), makeRect(2), makeRect(3)]);
    expect(getState().geometries).toHaveLength(3);
  });

  it("updateGeometry patches by index", () => {
    getState().addGeometry(makeRect());
    getState().updateGeometry(0, { layerId: 42 });
    expect(getState().geometries[0].layerId).toBe(42);
  });

  it("removeGeometries removes by indices", () => {
    getState().addGeometries([makeRect(1), makeRect(2), makeRect(3)]);
    getState().removeGeometries([0, 2]);
    const geoms = getState().geometries;
    expect(geoms).toHaveLength(1);
    expect(geoms[0].layerId).toBe(2);
  });

  it("replaceAll swaps all geometries", () => {
    getState().addGeometries([makeRect(1), makeRect(2)]);
    expect(getState().geometries).toHaveLength(2);
    getState().replaceAll([makeRect(99)]);
    expect(getState().geometries).toHaveLength(1);
    expect(getState().geometries[0].layerId).toBe(99);
  });

  // ── Undo / Redo ──

  it("undo reverts last commit", () => {
    getState().addGeometry(makeRect());
    expect(getState().geometries).toHaveLength(1);
    const ok = getState().undo();
    expect(ok).toBe(true);
    expect(getState().geometries).toHaveLength(0);
  });

  it("redo re-applies undone commit", () => {
    getState().addGeometry(makeRect());
    getState().undo();
    expect(getState().geometries).toHaveLength(0);
    const ok = getState().redo();
    expect(ok).toBe(true);
    expect(getState().geometries).toHaveLength(1);
  });

  it("undo on empty stack returns false", () => {
    expect(getState().undo()).toBe(false);
  });

  it("redo on empty stack returns false", () => {
    expect(getState().redo()).toBe(false);
  });

  it("canUndo / canRedo reflect stack state", () => {
    expect(getState().canUndo()).toBe(false);
    expect(getState().canRedo()).toBe(false);
    getState().addGeometry(makeRect());
    expect(getState().canUndo()).toBe(true);
    expect(getState().canRedo()).toBe(false);
    getState().undo();
    expect(getState().canUndo()).toBe(false);
    expect(getState().canRedo()).toBe(true);
  });

  it("new commit after undo clears redo stack", () => {
    getState().addGeometry(makeRect(1));
    getState().addGeometry(makeRect(2));
    getState().undo();
    expect(getState().canRedo()).toBe(true);
    getState().addGeometry(makeRect(3));
    expect(getState().canRedo()).toBe(false);
  });

  // ── Load / Export ──

  it("load replaces everything and clears history", () => {
    getState().addGeometry(makeRect());
    getState().addGeometry(makeRect());
    getState().load([makeRect(99)], "project-x");
    expect(getState().geometries).toHaveLength(1);
    expect(getState().projectName).toBe("project-x");
    expect(getState().canUndo()).toBe(false);
    expect(getState().modified).toBe(false);
  });

  it("exportJson produces valid JSON", () => {
    getState().addGeometries([makeRect(1), makeRect(2)]);
    const json = getState().exportJson();
    const parsed = JSON.parse(json);
    // exportJson wraps in { projectName, geometries }
    expect(parsed.geometries).toHaveLength(2);
    expect(parsed.geometries[0].type).toBe("rect");
  });

  // ── Modified flag ──

  it("modifications set modified = true", () => {
    expect(getState().modified).toBe(false);
    getState().addGeometry(makeRect());
    expect(getState().modified).toBe(true);
  });

  it("markSaved clears modified", () => {
    getState().addGeometry(makeRect());
    expect(getState().modified).toBe(true);
    getState().markSaved();
    expect(getState().modified).toBe(false);
  });
});
