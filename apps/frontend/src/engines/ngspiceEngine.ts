/**
 * ngspice WASM Engine — wrapper for ngspice compiled to WebAssembly.
 *
 * Provides a unified interface for running SPICE simulations either via:
 *  1. ngspice WASM module (when loaded) — full ngspice compatibility
 *  2. Built-in circuit solver (fallback) — basic MNA-based simulation
 *
 * The WASM module can be loaded from a CDN or bundled asset.
 * Handles:
 *  - WASM module lifecycle (load, init, destroy)
 *  - Netlist handoff (SPICE text → ngspice)
 *  - Output capture (stdout, stderr, raw data)
 *  - Result parsing (raw binary → waveform data)
 *  - Progress tracking
 */

import { parseSpiceNetlist, type ParsedNetlist, type AnalysisDirective, analysisToSpice } from "./spiceParser";
import { runSimulation as runBuiltinSimulation, type SimulationResult } from "./circuitSolver";
import { parseRawOutput, type NgspiceRawData } from "./rawParser";
import type { WaveformSignal, WaveformData } from "../stores/simStore";

// ══════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════

export type EngineBackend = "ngspice-wasm" | "builtin";
export type EngineState = "unloaded" | "loading" | "ready" | "running" | "error";

export interface EngineConfig {
  /** Preferred backend ("ngspice-wasm" or "builtin") */
  backend: EngineBackend;
  /** URL for ngspice WASM module */
  wasmUrl?: string;
  /** Maximum simulation time in seconds (timeout) */
  maxSimTime?: number;
  /** Temperature for simulation (°C) */
  temperature?: number;
}

export interface EngineStatus {
  backend: EngineBackend;
  state: EngineState;
  version: string;
  capabilities: string[];
  wasmLoaded: boolean;
}

export interface SimulationRequest {
  /** SPICE netlist text */
  netlistText: string;
  /** Analysis to run (overrides netlist .analysis directives) */
  analysis?: AnalysisDirective;
  /** Progress callback (0-1) */
  onProgress?: (pct: number) => void;
  /** Log line callback */
  onLog?: (line: string) => void;
  /** Temperature override */
  temperature?: number;
}

export interface SimulationResponse {
  success: boolean;
  result?: SimulationResult;
  rawOutput?: string;
  error?: string;
  backend: EngineBackend;
  durationMs: number;
}

// ══════════════════════════════════════════════════════════════════
// ngspice WASM Module Interface
// ══════════════════════════════════════════════════════════════════

/**
 * Interface for the ngspice WASM module.
 * This matches the expected exports from ngspice compiled with Emscripten.
 */
interface NgspiceWasmModule {
  _ngSpice_Init: (
    sendChar: number,
    sendStat: number,
    controlledExit: number,
    sendData: number,
    sendInitData: number,
    bgThreadRunning: number,
    userData: number,
  ) => number;
  _ngSpice_Command: (commandPtr: number) => number;
  _ngSpice_CurPlot: () => number;
  _ngSpice_AllPlots: () => number;
  _ngSpice_AllVecs: (plotPtr: number) => number;
  _ngSpice_running: () => boolean;
  allocateUTF8: (str: string) => number;
  UTF8ToString: (ptr: number) => string;
  _free: (ptr: number) => void;
  HEAPF64: Float64Array;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
}

// ══════════════════════════════════════════════════════════════════
// Engine Class
// ══════════════════════════════════════════════════════════════════

export class NgspiceEngine {
  private state: EngineState = "unloaded";
  private backend: EngineBackend = "builtin";
  private wasmModule: NgspiceWasmModule | null = null;
  private outputBuffer: string[] = [];
  private config: EngineConfig;
  private abortController: AbortController | null = null;

  constructor(config?: Partial<EngineConfig>) {
    this.config = {
      backend: config?.backend ?? "builtin",
      wasmUrl: config?.wasmUrl,
      maxSimTime: config?.maxSimTime ?? 60,
      temperature: config?.temperature ?? 27,
    };
  }

  // ── Status ──────────────────────────────────────────────────────

  getStatus(): EngineStatus {
    return {
      backend: this.backend,
      state: this.state,
      version: this.wasmModule ? "ngspice 43 (WASM)" : "OpenSilicon Built-in Solver v1.0",
      capabilities: this.getCapabilities(),
      wasmLoaded: this.wasmModule != null,
    };
  }

  private getCapabilities(): string[] {
    if (this.wasmModule) {
      return [
        "DC Operating Point",
        "DC Sweep",
        "AC Analysis",
        "Transient Analysis",
        "Noise Analysis",
        "Sensitivity Analysis",
        "Transfer Function",
        "BSIM3/BSIM4 Models",
        "Subcircuits",
        "Behavioral Sources",
      ];
    }
    return [
      "DC Operating Point",
      "DC Sweep",
      "AC Analysis",
      "Transient Analysis",
      "Level-1 MOSFET",
      "RLC Passives",
      "Voltage/Current Sources",
    ];
  }

  // ── WASM Loading ────────────────────────────────────────────────

  async loadWasm(url?: string): Promise<boolean> {
    const wasmUrl = url ?? this.config.wasmUrl;
    if (!wasmUrl) {
      this.state = "ready";
      this.backend = "builtin";
      return false;
    }

    this.state = "loading";

    try {
      // Attempt to load ngspice WASM module
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status}`);
      }

      // Try loading as ES module
      const blob = await response.blob();
      const moduleUrl = URL.createObjectURL(blob);

      try {
        const module = await import(/* @vite-ignore */ moduleUrl);
        if (module.default && typeof module.default === "function") {
          this.wasmModule = await module.default();
          this.backend = "ngspice-wasm";
          this.state = "ready";
          return true;
        }
      } catch {
        // WASM module format not compatible
      } finally {
        URL.revokeObjectURL(moduleUrl);
      }

      throw new Error("WASM module format not recognized");
    } catch (err) {
      console.warn("[NgspiceEngine] WASM load failed, using built-in solver:", err);
      this.state = "ready";
      this.backend = "builtin";
      return false;
    }
  }

  // ── Initialize without WASM (built-in only) ────────────────────

  init(): void {
    this.state = "ready";
    this.backend = "builtin";
  }

  // ── Run Simulation ──────────────────────────────────────────────

  async simulate(request: SimulationRequest): Promise<SimulationResponse> {
    if (this.state !== "ready") {
      return {
        success: false,
        error: `Engine not ready (state: ${this.state})`,
        backend: this.backend,
        durationMs: 0,
      };
    }

    this.state = "running";
    this.abortController = new AbortController();
    const t0 = performance.now();

    try {
      let response: SimulationResponse;

      if (this.backend === "ngspice-wasm" && this.wasmModule) {
        response = await this.runNgspice(request);
      } else {
        response = await this.runBuiltin(request);
      }

      return response;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error,
        backend: this.backend,
        durationMs: performance.now() - t0,
      };
    } finally {
      this.state = "ready";
      this.abortController = null;
    }
  }

  // ── Abort ───────────────────────────────────────────────────────

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // ── Built-in Solver ─────────────────────────────────────────────

  private async runBuiltin(request: SimulationRequest): Promise<SimulationResponse> {
    const t0 = performance.now();

    request.onLog?.("Using built-in OpenSilicon solver");
    request.onLog?.("Parsing netlist...");

    const parsed = parseSpiceNetlist(request.netlistText);
    request.onLog?.(`Parsed: ${parsed.devices.length} devices, ${parsed.nodeNames.length} nodes`);

    if (parsed.devices.length === 0) {
      return {
        success: false,
        error: "No devices found in netlist",
        backend: "builtin",
        durationMs: performance.now() - t0,
      };
    }

    // Determine analysis
    const analysis = request.analysis ?? parsed.analyses[0];
    if (!analysis) {
      request.onLog?.("No analysis directive found, running DC operating point");
    } else {
      request.onLog?.(`Analysis: ${analysisToSpice(analysis)}`);
    }

    // Run simulation
    const result = runBuiltinSimulation(parsed, analysis, (pct) => {
      request.onProgress?.(pct);
    });

    // Log results
    for (const line of result.log) {
      request.onLog?.(line);
    }

    // Generate raw SPICE output text
    const rawOutput = this.generateRawText(result, parsed);

    return {
      success: result.converged,
      result,
      rawOutput,
      backend: "builtin",
      durationMs: performance.now() - t0,
    };
  }

  // ── ngspice WASM Execution ──────────────────────────────────────

  private async runNgspice(request: SimulationRequest): Promise<SimulationResponse> {
    const t0 = performance.now();
    const module = this.wasmModule!;

    this.outputBuffer = [];
    request.onLog?.("Using ngspice WASM engine");

    try {
      // Send netlist to ngspice via "source" command
      // First, let ngspice parse the netlist
      const netlistLines = request.netlistText.split("\n");

      // Use the circuitbyline approach
      this.ngCommand(module, "circbyline " + netlistLines[0]); // Title
      for (let i = 1; i < netlistLines.length; i++) {
        const line = netlistLines[i].trim();
        if (line) {
          this.ngCommand(module, "circbyline " + line);
        }
      }
      this.ngCommand(module, "circbyline .end");

      request.onLog?.("Netlist loaded into ngspice");

      // If analysis override provided, add it
      if (request.analysis) {
        const analysisCmd = analysisToSpice(request.analysis);
        this.ngCommand(module, "alter " + analysisCmd);
      }

      // Set temperature
      if (request.temperature != null) {
        this.ngCommand(module, `set temp=${request.temperature}`);
      }

      // Run simulation
      request.onLog?.("Running simulation...");
      this.ngCommand(module, "run");

      // Wait for completion
      const timeout = (this.config.maxSimTime ?? 60) * 1000;
      const startWait = performance.now();
      while (module._ngSpice_running()) {
        if (performance.now() - startWait > timeout) {
          this.ngCommand(module, "stop");
          throw new Error("Simulation timeout");
        }
        if (this.abortController?.signal.aborted) {
          this.ngCommand(module, "stop");
          throw new Error("Simulation aborted");
        }
        await new Promise((r) => setTimeout(r, 50));
      }

      request.onLog?.("Simulation complete, collecting results...");

      // Collect output (this would read from ngspice's data structures)
      const rawOutput = this.outputBuffer.join("\n");
      const rawData = parseRawOutput(rawOutput);

      // Convert to waveform data
      const waveform = this.rawToWaveform(rawData);

      const result: SimulationResult = {
        analysis: request.analysis ?? { type: "op" },
        waveform,
        converged: true,
        iterations: 0,
        timeMs: performance.now() - t0,
        log: this.outputBuffer.slice(0, 50),
      };

      return {
        success: true,
        result,
        rawOutput,
        backend: "ngspice-wasm",
        durationMs: performance.now() - t0,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      request.onLog?.(`Error: ${error}`);
      return {
        success: false,
        error,
        rawOutput: this.outputBuffer.join("\n"),
        backend: "ngspice-wasm",
        durationMs: performance.now() - t0,
      };
    }
  }

  private ngCommand(module: NgspiceWasmModule, cmd: string): number {
    const ptr = module.allocateUTF8(cmd);
    const ret = module._ngSpice_Command(ptr);
    module._free(ptr);
    return ret;
  }

  // ── Output Conversion ──────────────────────────────────────────

  private rawToWaveform(raw: NgspiceRawData | null): WaveformData {
    if (!raw || raw.variables.length === 0) {
      return { signals: [], timeRange: { start: 0, end: 0 }, timeUnit: "s" };
    }

    const colors = [
      "#6366f1", "#22c55e", "#ef4444", "#f59e0b", "#ec4899",
      "#14b8a6", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16",
    ];

    const sweepVar = raw.variables[0];
    const sweepData = raw.data[0] ?? [];

    const signals: WaveformSignal[] = [];
    for (let i = 1; i < raw.variables.length; i++) {
      const v = raw.variables[i];
      const data: { time: number; value: number }[] = [];
      const values = raw.data[i] ?? [];

      for (let j = 0; j < sweepData.length; j++) {
        data.push({ time: sweepData[j], value: values[j] ?? 0 });
      }

      signals.push({
        name: v.name,
        unit: v.type === "voltage" ? "V" : v.type === "current" ? "A" : v.type,
        data,
        color: colors[(i - 1) % colors.length],
        visible: i <= 8, // Show first 8 by default
      });
    }

    const timeUnit = sweepVar.type === "frequency" ? "Hz" : "s";

    return {
      signals,
      timeRange: {
        start: sweepData[0] ?? 0,
        end: sweepData[sweepData.length - 1] ?? 0,
      },
      timeUnit,
    };
  }

  private generateRawText(result: SimulationResult, _parsed: ParsedNetlist): string {
    const lines: string[] = [];
    lines.push("SPICE Simulation Output");
    lines.push("========================");
    lines.push("");

    if (result.opPoint) {
      lines.push("DC Operating Point:");
      for (const [name, val] of Object.entries(result.opPoint)) {
        lines.push(`  ${name} = ${val.toFixed(6)}`);
      }
      lines.push("");
    }

    lines.push(`Analysis: ${result.analysis.type}`);
    lines.push(`Converged: ${result.converged}`);
    lines.push(`Iterations: ${result.iterations}`);
    lines.push(`Time: ${result.timeMs.toFixed(1)}ms`);
    lines.push("");

    if (result.waveform.signals.length > 0) {
      lines.push(`Signals: ${result.waveform.signals.map((s) => s.name).join(", ")}`);
      lines.push(`Data points: ${result.waveform.signals[0].data.length}`);
    }

    return lines.join("\n");
  }

  // ── Dispose ─────────────────────────────────────────────────────

  dispose(): void {
    this.wasmModule = null;
    this.state = "unloaded";
    this.outputBuffer = [];
  }
}

// ══════════════════════════════════════════════════════════════════
// Singleton instance
// ══════════════════════════════════════════════════════════════════

let engineInstance: NgspiceEngine | null = null;

export function getEngine(): NgspiceEngine {
  if (!engineInstance) {
    engineInstance = new NgspiceEngine();
    engineInstance.init();
  }
  return engineInstance;
}

export function resetEngine(): void {
  engineInstance?.dispose();
  engineInstance = null;
}

// ══════════════════════════════════════════════════════════════════
// Convenience functions
// ══════════════════════════════════════════════════════════════════

/** Run a simulation from netlist text */
export async function simulateNetlist(
  spiceText: string,
  analysis?: AnalysisDirective,
  callbacks?: {
    onProgress?: (pct: number) => void;
    onLog?: (line: string) => void;
  },
): Promise<SimulationResponse> {
  const engine = getEngine();
  return engine.simulate({
    netlistText: spiceText,
    analysis,
    onProgress: callbacks?.onProgress,
    onLog: callbacks?.onLog,
  });
}

/** Generate a demo CMOS inverter netlist for testing */
export function generateDemoNetlist(): string {
  return `CMOS Inverter - OpenSilicon Demo
* SKY130 CMOS Inverter

.model NMOS NMOS (LEVEL=1 VTH0=0.4 KP=120u LAMBDA=0.04)
.model PMOS PMOS (LEVEL=1 VTH0=-0.4 KP=60u LAMBDA=0.04)

* Supply
VDD VDD 0 DC 1.8
VSS VSS 0 DC 0

* Input
VIN IN 0 PULSE(0 1.8 1n 0.1n 0.1n 5n 10n)

* CMOS Inverter
M1 OUT IN VDD VDD PMOS W=2u L=0.13u
M2 OUT IN VSS VSS NMOS W=1u L=0.13u

* Load capacitor
CL OUT 0 10f

.tran 0.01n 20n
.end
`;
}

/** Generate a CMOS NAND gate netlist */
export function generateNandNetlist(): string {
  return `CMOS 2-Input NAND Gate
* SKY130 CMOS NAND2

.model NMOS NMOS (LEVEL=1 VTH0=0.4 KP=120u LAMBDA=0.04)
.model PMOS PMOS (LEVEL=1 VTH0=-0.4 KP=60u LAMBDA=0.04)

VDD VDD 0 DC 1.8
VSS VSS 0 DC 0

* Inputs
VA A 0 PULSE(0 1.8 2n 0.1n 0.1n 5n 10n)
VB B 0 PULSE(0 1.8 1n 0.1n 0.1n 3n 6n)

* Pull-up (parallel PMOS)
M1 OUT A VDD VDD PMOS W=2u L=0.13u
M2 OUT B VDD VDD PMOS W=2u L=0.13u

* Pull-down (series NMOS)
M3 OUT A MID VSS NMOS W=2u L=0.13u
M4 MID B VSS VSS NMOS W=2u L=0.13u

CL OUT 0 10f

.tran 0.01n 20n
.end
`;
}

/** Generate a common-source amplifier netlist for AC analysis */
export function generateAmplifierNetlist(): string {
  return `Common Source Amplifier - AC Analysis
* NMOS Common Source with resistor load

.model NMOS NMOS (LEVEL=1 VTH0=0.4 KP=120u LAMBDA=0.04)

VDD VDD 0 DC 1.8
VSS VSS 0 DC 0

* Bias
VIN IN 0 DC 0.9 AC 1

* Amplifier
M1 OUT IN VSS VSS NMOS W=10u L=0.13u
RD VDD OUT 5k

* Load cap
CL OUT 0 100f

.ac dec 20 1k 100g
.end
`;
}

/** Generate a DC sweep netlist */
export function generateDcSweepNetlist(): string {
  return `NMOS IV Characteristics - DC Sweep
* NMOS transistor DC characteristics

.model NMOS NMOS (LEVEL=1 VTH0=0.4 KP=120u LAMBDA=0.04)

VDS DRAIN 0 DC 0
VGS GATE 0 DC 0.9

M1 DRAIN GATE 0 0 NMOS W=1u L=0.13u

.dc VDS 0 1.8 0.01 VGS 0.4 1.8 0.2
.end
`;
}
