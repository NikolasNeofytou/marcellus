/**
 * toolStore unit tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useToolStore } from "../stores/toolStore";

const getState = () => useToolStore.getState();

describe("toolStore", () => {
  beforeEach(() => {
    useToolStore.setState({
      activeTool: "select",
      toolState: "idle",
      drawingPreview: null,
      selectedItems: [],
      selectionBox: null,
      clipboard: [],
    });
  });

  // ── Tool switching ──

  it("setActiveTool changes tool", () => {
    getState().setActiveTool("rect");
    expect(getState().activeTool).toBe("rect");
  });

  it("setActiveTool cancels in-progress drawing", () => {
    getState().beginDrawing("rect", 1, { x: 0, y: 0 });
    expect(getState().toolState).toBe("drawing");
    expect(getState().drawingPreview).not.toBeNull();

    getState().setActiveTool("polygon");
    expect(getState().toolState).toBe("idle");
    expect(getState().drawingPreview).toBeNull();
    expect(getState().activeTool).toBe("polygon");
  });

  // ── Drawing lifecycle ──

  it("beginDrawing → addPoint → finishDrawing lifecycle", () => {
    getState().beginDrawing("rect", 5, { x: 0, y: 0 });
    expect(getState().toolState).toBe("drawing");

    getState().addDrawingPoint({ x: 10, y: 10 });
    expect(getState().drawingPreview!.points).toHaveLength(2);

    const result = getState().finishDrawing();
    expect(result).not.toBeNull();
    expect(result!.tool).toBe("rect");
    expect(result!.layerId).toBe(5);
    expect(getState().toolState).toBe("idle");
    expect(getState().drawingPreview).toBeNull();
  });

  it("cancelDrawing clears preview", () => {
    getState().beginDrawing("polygon", 2, { x: 5, y: 5 });
    getState().cancelDrawing();
    expect(getState().drawingPreview).toBeNull();
    expect(getState().toolState).toBe("idle");
  });

  it("path drawing gets default width", () => {
    getState().beginDrawing("path", 3, { x: 0, y: 0 });
    expect(getState().drawingPreview!.width).toBe(0.1);
  });

  // ── Selection ──

  it("select replaces current selection", () => {
    const item = { cellId: "c1", geometryIndex: 0, type: "rect" as const };
    getState().select(item);
    expect(getState().selectedItems).toHaveLength(1);
    expect(getState().selectedItems[0]).toEqual(item);
  });

  it("addToSelection appends", () => {
    getState().select({ cellId: "c1", geometryIndex: 0, type: "rect" });
    getState().addToSelection({ cellId: "c1", geometryIndex: 1, type: "polygon" });
    expect(getState().selectedItems).toHaveLength(2);
  });

  it("removeFromSelection removes by index", () => {
    getState().select({ cellId: "c1", geometryIndex: 0, type: "rect" });
    getState().addToSelection({ cellId: "c1", geometryIndex: 1, type: "polygon" });
    getState().removeFromSelection(0);
    expect(getState().selectedItems).toHaveLength(1);
    expect(getState().selectedItems[0].geometryIndex).toBe(1);
  });

  it("clearSelection empties array", () => {
    getState().select({ cellId: "c1", geometryIndex: 0, type: "rect" });
    getState().clearSelection();
    expect(getState().selectedItems).toHaveLength(0);
  });

  // ── Clipboard ──

  it("copyGeometries stores entries", () => {
    const entries = [
      { type: "rect" as const, layerId: 1, points: [{ x: 0, y: 0 }] },
    ];
    getState().copyGeometries(entries);
    expect(getState().clipboard).toHaveLength(1);
  });

  it("paste returns deep clones", () => {
    const original = { type: "rect" as const, layerId: 1, points: [{ x: 0, y: 0 }] };
    getState().copyGeometries([original]);
    const pasted = getState().paste();
    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toEqual(original);
    // Should be a clone, not the same reference
    expect(pasted[0]).not.toBe(getState().clipboard[0]);
  });
});
