/**
 * Tests for engines/spiceParser.ts
 */

import { describe, it, expect } from "vitest";
import { parseSpiceNumber, parseSpiceNetlist, evalTransientSource, analysisToSpice } from "../engines/spiceParser";

// ══════════════════════════════════════════════════════════════════════
// parseSpiceNumber
// ══════════════════════════════════════════════════════════════════════

describe("parseSpiceNumber", () => {
  it("parses plain integers", () => {
    expect(parseSpiceNumber("42")).toBe(42);
  });

  it("parses plain floats", () => {
    expect(parseSpiceNumber("3.14")).toBeCloseTo(3.14);
  });

  it("parses scientific notation", () => {
    expect(parseSpiceNumber("1e-12")).toBeCloseTo(1e-12);
    expect(parseSpiceNumber("2.5E3")).toBeCloseTo(2500);
  });

  it("parses SPICE suffixes — femto (f)", () => {
    expect(parseSpiceNumber("1f")).toBeCloseTo(1e-15);
  });

  it("parses SPICE suffixes — pico (p)", () => {
    expect(parseSpiceNumber("47p")).toBeCloseTo(47e-12);
  });

  it("parses SPICE suffixes — nano (n)", () => {
    expect(parseSpiceNumber("100n")).toBeCloseTo(1e-7);
  });

  it("parses SPICE suffixes — micro (u)", () => {
    expect(parseSpiceNumber("2.5u")).toBeCloseTo(2.5e-6);
  });

  it("parses SPICE suffixes — milli (m)", () => {
    expect(parseSpiceNumber("5m")).toBeCloseTo(5e-3);
  });

  it("parses SPICE suffixes — kilo (k)", () => {
    expect(parseSpiceNumber("10k")).toBeCloseTo(10000);
  });

  it("parses SPICE suffixes — mega (meg)", () => {
    expect(parseSpiceNumber("3.3meg")).toBeCloseTo(3.3e6);
  });

  it("parses SPICE suffixes — tera (t)", () => {
    expect(parseSpiceNumber("1t")).toBeCloseTo(1e12);
  });

  it("parses negative values with suffix", () => {
    expect(parseSpiceNumber("-5m")).toBeCloseTo(-5e-3);
  });

  it("returns 0 for empty string", () => {
    expect(parseSpiceNumber("")).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// parseSpiceNetlist
// ══════════════════════════════════════════════════════════════════════

describe("parseSpiceNetlist", () => {
  it("parses a netlist title", () => {
    const nl = parseSpiceNetlist("My Test Circuit\n.end");
    expect(nl.title).toBe("My Test Circuit");
  });

  it("parses a single resistor", () => {
    const nl = parseSpiceNetlist("test\nR1 a b 1k\n.end");
    expect(nl.devices.length).toBeGreaterThanOrEqual(1);
    const r = nl.devices.find((d) => d.name === "R1");
    expect(r).toBeDefined();
    expect(r!.type).toBe("resistor");
    if (r!.type === "resistor") {
      expect(r!.value).toBeCloseTo(1000);
    }
  });

  it("parses a MOSFET with W/L parameters", () => {
    const nl = parseSpiceNetlist(
      "mosfet test\nM1 drain gate source body NMOS W=1u L=0.13u\n.end",
    );
    const m = nl.devices.find((d) => d.name === "M1");
    expect(m).toBeDefined();
    expect(m!.type).toBe("mosfet");
    if (m!.type === "mosfet") {
      expect(m!.params.w).toBeCloseTo(1e-6);
      expect(m!.params.l).toBeCloseTo(0.13e-6);
    }
  });

  it("parses a DC voltage source", () => {
    const nl = parseSpiceNetlist("test\nV1 vdd 0 1.8\n.end");
    const v = nl.devices.find((d) => d.name === "V1");
    expect(v).toBeDefined();
    expect(v!.type).toBe("vsource");
    if (v!.type === "vsource") {
      expect(v!.dcValue).toBeCloseTo(1.8);
    }
  });

  it("parses .tran analysis directive", () => {
    const nl = parseSpiceNetlist("test\n.tran 1n 100n\n.end");
    const tran = nl.analyses?.find((a) => a.type === "tran");
    expect(tran).toBeDefined();
    if (tran && tran.type === "tran") {
      expect(tran.step).toBeCloseTo(1e-9);
      expect(tran.stop).toBeCloseTo(100e-9);
    }
  });

  it("parses .model directive", () => {
    const nl = parseSpiceNetlist(
      "test\n.model NMOS nmos (vth0=0.4 kp=120u)\n.end",
    );
    expect(nl.models.length).toBeGreaterThanOrEqual(1);
    const model = nl.models.find((m) => m.name === "NMOS");
    expect(model).toBeDefined();
  });

  it("strips comment lines", () => {
    const nl = parseSpiceNetlist(
      "test\n* This is a comment\nR1 a b 1k\n.end",
    );
    expect(nl.devices.length).toBeGreaterThanOrEqual(1);
  });

  it("handles continuation lines (+)", () => {
    const nl = parseSpiceNetlist(
      "test\nR1 a b\n+ 1k\n.end",
    );
    const r = nl.devices.find((d) => d.name === "R1");
    expect(r).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════
// evalTransientSource — basic checks
// ══════════════════════════════════════════════════════════════════════

describe("evalTransientSource", () => {
  it("evaluates a pulse source at t < delay → v1", () => {
    const pulse = {
      kind: "pulse" as const,
      v1: 0,
      v2: 1.8,
      delay: 1e-9,
      rise: 0.1e-9,
      fall: 0.1e-9,
      width: 5e-9,
      period: 10e-9,
    };
    expect(evalTransientSource(pulse, 0)).toBeCloseTo(0);
  });

  it("evaluates a pulse source during pulse width → v2", () => {
    const pulse = {
      kind: "pulse" as const,
      v1: 0,
      v2: 1.8,
      delay: 0,
      rise: 0,
      fall: 0,
      width: 5e-9,
      period: 10e-9,
    };
    expect(evalTransientSource(pulse, 2e-9)).toBeCloseTo(1.8);
  });

  it("evaluates a sin source at t = 0 → offset", () => {
    const sin = {
      kind: "sin" as const,
      offset: 0.9,
      amplitude: 0.5,
      frequency: 1e6,
      delay: 0,
      damping: 0,
      phase: 0,
    };
    expect(evalTransientSource(sin, 0)).toBeCloseTo(0.9);
  });
});

// ══════════════════════════════════════════════════════════════════════
// analysisToSpice
// ══════════════════════════════════════════════════════════════════════

describe("analysisToSpice", () => {
  it("produces .tran line", () => {
    const line = analysisToSpice({ type: "tran", step: 1e-9, stop: 100e-9 });
    expect(line).toContain(".tran");
  });

  it("produces .op line", () => {
    const line = analysisToSpice({ type: "op" });
    expect(line).toContain(".op");
  });
});
