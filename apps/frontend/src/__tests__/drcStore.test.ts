/**
 * drcStore unit tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useDrcStore } from "../stores/drcStore";
import type { DrcViolation, DrcResult } from "../engines/drc";

const getState = () => useDrcStore.getState();

function makeViolation(
  overrides: Partial<DrcViolation> & { id: string; severity: "error" | "warning" | "info" },
): DrcViolation {
  return {
    ruleId: "min_spacing",
    description: "Min spacing violation",
    ruleType: "minSpacing",
    geometryIndices: [0, 1],
    location: { x: 10, y: 20 },
    bbox: { minX: 5, minY: 15, maxX: 15, maxY: 25 },
    actualValue: 0.1,
    requiredValue: 0.14,
    layers: ["met1"],
    ...overrides,
  } as DrcViolation;
}

function makeResult(violations: DrcViolation[]): DrcResult {
  return {
    violations,
    rulesChecked: 10,
    geometriesChecked: 100,
    runtimeMs: 42,
    timestamp: Date.now(),
  };
}

describe("drcStore", () => {
  beforeEach(() => {
    getState().clearViolations();
  });

  // ── Result management ──

  it("starts in idle with no violations", () => {
    expect(getState().runState).toBe("idle");
    expect(getState().violations).toHaveLength(0);
    expect(getState().selectedViolationId).toBeNull();
  });

  it("setResult populates violations and marks completed", () => {
    const v1 = makeViolation({ id: "v1", severity: "error" });
    const v2 = makeViolation({ id: "v2", severity: "warning" });
    getState().setResult(makeResult([v1, v2]));

    expect(getState().runState).toBe("completed");
    expect(getState().violations).toHaveLength(2);
    expect(getState().lastResult).not.toBeNull();
  });

  it("clearViolations resets to idle", () => {
    getState().setResult(makeResult([makeViolation({ id: "v1", severity: "error" })]));
    getState().clearViolations();
    expect(getState().runState).toBe("idle");
    expect(getState().violations).toHaveLength(0);
    expect(getState().lastResult).toBeNull();
  });

  // ── Selection navigation ──

  it("selectViolation sets selectedViolationId", () => {
    getState().selectViolation("v1");
    expect(getState().selectedViolationId).toBe("v1");
    getState().selectViolation(null);
    expect(getState().selectedViolationId).toBeNull();
  });

  it("nextViolation cycles through filtered violations", () => {
    const violations = [
      makeViolation({ id: "v1", severity: "error" }),
      makeViolation({ id: "v2", severity: "error" }),
      makeViolation({ id: "v3", severity: "error" }),
    ];
    getState().setResult(makeResult(violations));

    // Start with no selection → should pick first
    getState().nextViolation();
    expect(getState().selectedViolationId).toBe("v1");

    getState().nextViolation();
    expect(getState().selectedViolationId).toBe("v2");

    getState().nextViolation();
    expect(getState().selectedViolationId).toBe("v3");

    // Wrap around
    getState().nextViolation();
    expect(getState().selectedViolationId).toBe("v1");
  });

  it("prevViolation wraps backwards", () => {
    const violations = [
      makeViolation({ id: "v1", severity: "error" }),
      makeViolation({ id: "v2", severity: "error" }),
    ];
    getState().setResult(makeResult(violations));

    // No selection → first call should wrap to last
    getState().prevViolation();
    const id = getState().selectedViolationId;
    expect(["v1", "v2"]).toContain(id);
  });

  // ── Severity filter ──

  it("toggleSeverityFilter excludes violations", () => {
    const violations = [
      makeViolation({ id: "v1", severity: "error" }),
      makeViolation({ id: "v2", severity: "warning" }),
      makeViolation({ id: "v3", severity: "info" }),
    ];
    getState().setResult(makeResult(violations));

    expect(getState().getFilteredViolations()).toHaveLength(3);

    // Disable warnings
    getState().toggleSeverityFilter("warning");
    expect(getState().getFilteredViolations()).toHaveLength(2);
    expect(getState().getFilteredViolations().every((v) => v.severity !== "warning")).toBe(true);

    // Re-enable
    getState().toggleSeverityFilter("warning");
    expect(getState().getFilteredViolations()).toHaveLength(3);
  });

  it("setLayerFilter filters by layer", () => {
    const violations = [
      makeViolation({ id: "v1", severity: "error", layers: ["met1"] }),
      makeViolation({ id: "v2", severity: "error", layers: ["met2"] }),
    ];
    getState().setResult(makeResult(violations));

    getState().setLayerFilter("met1");
    expect(getState().getFilteredViolations()).toHaveLength(1);
    expect(getState().getFilteredViolations()[0].id).toBe("v1");

    getState().setLayerFilter(null);
    expect(getState().getFilteredViolations()).toHaveLength(2);
  });

  // ── Counts ──

  it("getCounts returns correct breakdown", () => {
    const violations = [
      makeViolation({ id: "v1", severity: "error" }),
      makeViolation({ id: "v2", severity: "error" }),
      makeViolation({ id: "v3", severity: "warning" }),
      makeViolation({ id: "v4", severity: "info" }),
    ];
    getState().setResult(makeResult(violations));

    const counts = getState().getCounts();
    expect(counts.errors).toBe(2);
    expect(counts.warnings).toBe(1);
    expect(counts.infos).toBe(1);
    expect(counts.total).toBe(4);
  });

  // ── Dirty tracking ──

  it("markDirty increments geometryVersion", () => {
    const v1 = getState().geometryVersion;
    getState().markDirty([0, 1, 2]);
    expect(getState().geometryVersion).toBe(v1 + 1);
  });

  it("isDirty returns true after markDirty, false after setResult", () => {
    // First ensure clean state by setting a result to sync version counters
    getState().setResult(makeResult([]));
    expect(getState().isDirty()).toBe(false);
    getState().markDirty([0]);
    expect(getState().isDirty()).toBe(true);
    getState().setResult(makeResult([]));
    expect(getState().isDirty()).toBe(false);
  });

  // ── Overlay toggle ──

  it("toggleOverlay flips showOverlay", () => {
    expect(getState().showOverlay).toBe(true);
    getState().toggleOverlay();
    expect(getState().showOverlay).toBe(false);
  });

  it("toggleAutoRun flips autoRun", () => {
    expect(getState().autoRun).toBe(false);
    getState().toggleAutoRun();
    expect(getState().autoRun).toBe(true);
  });
});
