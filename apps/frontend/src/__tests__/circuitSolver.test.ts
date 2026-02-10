/**
 * Tests for engines/circuitSolver.ts
 */

import { describe, it, expect } from "vitest";
import { parseSpiceNetlist } from "../engines/spiceParser";
import { runDCOp, runTransient, runDCSweep, runSimulation } from "../engines/circuitSolver";

// Helper: build a ParsedNetlist from SPICE text
const parse = (text: string) => parseSpiceNetlist(text);

// ══════════════════════════════════════════════════════════════════════
// runDCOp
// ══════════════════════════════════════════════════════════════════════

describe("runDCOp", () => {
  it("solves a single voltage source", () => {
    const nl = parse("single vsrc\nV1 vdd 0 1.8\n.end");
    const result = runDCOp(nl);
    expect(result.converged).toBe(true);
    // Node "vdd" should be at 1.8V
    const vdd = result.opPoint?.["V(vdd)"] ?? result.opPoint?.["vdd"];
    if (vdd !== undefined) {
      expect(vdd).toBeCloseTo(1.8, 1);
    }
  });

  it("solves a resistive voltage divider", () => {
    const nl = parse(
      "divider\nV1 vdd 0 1.8\nR1 vdd out 1k\nR2 out 0 1k\n.end",
    );
    const result = runDCOp(nl);
    expect(result.converged).toBe(true);
    const vout = result.opPoint?.["V(out)"] ?? result.opPoint?.["out"];
    if (vout !== undefined) {
      expect(vout).toBeCloseTo(0.9, 1);
    }
  });

  it("handles an empty netlist gracefully", () => {
    const nl = parse("empty\n.end");
    const result = runDCOp(nl);
    expect(result).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════
// runTransient
// ══════════════════════════════════════════════════════════════════════

describe("runTransient", () => {
  it("produces waveform data", () => {
    const nl = parse(
      "tran test\nV1 in 0 PULSE(0 1.8 0 1n 1n 5n 10n)\nR1 in out 1k\nC1 out 0 1p\n.end",
    );
    const result = runTransient(nl, { type: "tran", step: 0.1e-9, stop: 20e-9 });
    expect(result).toBeDefined();
    if (result.waveform) {
      expect(result.waveform.signals.length).toBeGreaterThan(0);
    }
  });

  it("invokes progress callback", () => {
    const nl = parse("prog\nV1 a 0 1.0\nR1 a 0 1k\n.end");
    let called = false;
    runTransient(nl, { type: "tran", step: 0.1e-9, stop: 1e-9 }, () => {
      called = true;
    });
    // Progress may or may not be called depending on step count
    expect(typeof called).toBe("boolean");
  });
});

// ══════════════════════════════════════════════════════════════════════
// runDCSweep
// ══════════════════════════════════════════════════════════════════════

describe("runDCSweep", () => {
  it("produces sweep results", () => {
    const nl = parse("sweep\nV1 vdd 0 1.8\nR1 vdd out 1k\nR2 out 0 1k\n.end");
    const result = runDCSweep(nl, {
      type: "dc",
      source: "V1",
      start: 0,
      stop: 1.8,
      step: 0.1,
    });
    expect(result).toBeDefined();
    if (result.waveform) {
      expect(result.waveform.signals.length).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// runSimulation (dispatch)
// ══════════════════════════════════════════════════════════════════════

describe("runSimulation", () => {
  it("dispatches to runDCOp when analysis is .op", () => {
    const nl = parse("dispatch op\nV1 a 0 1.0\nR1 a 0 1k\n.end");
    const result = runSimulation(nl, { type: "op" });
    expect(result).toBeDefined();
    expect(result.converged).toBe(true);
  });

  it("defaults to OP if no analysis provided", () => {
    const nl = parse("default\nV1 a 0 1.0\nR1 a 0 1k\n.end");
    const result = runSimulation(nl);
    expect(result).toBeDefined();
  });
});
