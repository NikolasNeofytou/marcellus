/**
 * VCD (Value Change Dump) Parser
 *
 * Parses IEEE 1364 VCD files into structured waveform data that can be
 * rendered by the WaveformViewer component. Supports:
 * - $scope / $upscope hierarchy
 * - $var (wire, reg, integer, real, parameter, event)
 * - $timescale parsing
 * - #<time> timestamp delimiters
 * - 0/1/x/z single-bit transitions
 * - b<binary> multi-bit transitions
 * - r<real> real-valued transitions
 * - $dumpvars / $dumpoff / $dumpon / $dumpall
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface VcdVariable {
  /** Identifier character(s) used in VCD body */
  idCode: string;
  /** Human-readable name */
  name: string;
  /** Fully-qualified hierarchical name */
  hierarchicalName: string;
  /** Variable type (wire, reg, integer, real, parameter, event) */
  type: string;
  /** Bit width */
  width: number;
  /** Bit range string if present, e.g. "[7:0]" */
  range?: string;
  /** Scope path */
  scope: string[];
}

export interface VcdTransition {
  /** Simulation time (in base units, scaled by timescale) */
  time: number;
  /** Value as string: "0", "1", "x", "z", "b01010x", "r1.234" */
  rawValue: string;
  /** Numeric interpretation (NaN for x/z) */
  numericValue: number;
}

export interface VcdSignal {
  variable: VcdVariable;
  transitions: VcdTransition[];
}

export type VcdTimescaleUnit = "s" | "ms" | "us" | "ns" | "ps" | "fs";

export interface VcdTimescale {
  magnitude: number; // 1, 10, 100
  unit: VcdTimescaleUnit;
  /** Seconds per VCD time unit */
  secondsPerUnit: number;
}

export interface VcdScope {
  name: string;
  type: string; // "module", "task", "function", "begin", "fork"
  children: VcdScope[];
  variables: VcdVariable[];
}

export interface VcdParseResult {
  /** Date string from $date section */
  date: string;
  /** Version string from $version section */
  version: string;
  /** Comment string from $comment section */
  comment: string;
  /** Timescale info */
  timescale: VcdTimescale;
  /** Root scope hierarchy */
  rootScope: VcdScope;
  /** All signals with their transition data */
  signals: VcdSignal[];
  /** Time range [min, max] in units */
  timeRange: [number, number];
  /** Number of unique time steps */
  timeStepCount: number;
  /** Parse time in ms */
  parseTimeMs: number;
  /** Total transitions parsed */
  transitionCount: number;
}

/* ------------------------------------------------------------------ */
/*  Timescale parsing                                                 */
/* ------------------------------------------------------------------ */

const UNIT_TO_SECONDS: Record<string, number> = {
  s: 1,
  ms: 1e-3,
  us: 1e-6,
  ns: 1e-9,
  ps: 1e-12,
  fs: 1e-15,
};

function parseTimescale(text: string): VcdTimescale {
  const m = text.trim().match(/(\d+)\s*(s|ms|us|ns|ps|fs)/i);
  if (!m) {
    return { magnitude: 1, unit: "ns", secondsPerUnit: 1e-9 };
  }
  const magnitude = parseInt(m[1]);
  const unit = m[2].toLowerCase() as VcdTimescaleUnit;
  return {
    magnitude,
    unit,
    secondsPerUnit: magnitude * (UNIT_TO_SECONDS[unit] ?? 1e-9),
  };
}

/* ------------------------------------------------------------------ */
/*  Value parsing                                                     */
/* ------------------------------------------------------------------ */

function parseNumericValue(raw: string, _width: number): number {
  if (raw === "x" || raw === "X" || raw === "z" || raw === "Z") return NaN;
  if (raw === "0") return 0;
  if (raw === "1") return 1;

  // Real value
  if (raw.startsWith("r") || raw.startsWith("R")) {
    return parseFloat(raw.slice(1));
  }

  // Binary vector
  if (raw.startsWith("b") || raw.startsWith("B")) {
    const bits = raw.slice(1).trim();
    if (/[xXzZ]/.test(bits)) return NaN;
    return parseInt(bits, 2);
  }

  // Try as direct number
  const n = parseFloat(raw);
  return isNaN(n) ? NaN : n;
}

/* ------------------------------------------------------------------ */
/*  Main parser                                                       */
/* ------------------------------------------------------------------ */

export function parseVcd(source: string): VcdParseResult {
  const t0 = performance.now();

  let date = "";
  let version = "";
  let comment = "";
  let timescale: VcdTimescale = { magnitude: 1, unit: "ns", secondsPerUnit: 1e-9 };

  const rootScope: VcdScope = { name: "$root", type: "module", children: [], variables: [] };
  const scopeStack: VcdScope[] = [rootScope];
  const varMap = new Map<string, VcdVariable>(); // idCode → variable
  const transitionMap = new Map<string, VcdTransition[]>(); // idCode → transitions

  const lines = source.split("\n");
  let i = 0;
  let inHeader = true;
  let currentTime = 0;
  let minTime = Infinity;
  let maxTime = -Infinity;
  let totalTransitions = 0;
  const timeSteps = new Set<number>();

  // ── Header pass ──
  function readSection(): string {
    const parts: string[] = [];
    while (i < lines.length) {
      const line = lines[i].trim();
      i++;
      if (line === "$end") break;
      if (line.endsWith("$end")) {
        parts.push(line.replace("$end", "").trim());
        break;
      }
      parts.push(line);
    }
    return parts.join(" ").trim();
  }

  while (i < lines.length && inHeader) {
    const line = lines[i].trim();

    if (line.startsWith("$date")) {
      i++;
      date = readSection();
    } else if (line.startsWith("$version")) {
      i++;
      version = readSection();
    } else if (line.startsWith("$comment")) {
      i++;
      comment = readSection();
    } else if (line.startsWith("$timescale")) {
      i++;
      timescale = parseTimescale(readSection());
    } else if (line.startsWith("$scope")) {
      const m = line.match(/\$scope\s+(\w+)\s+(\S+)/);
      if (m) {
        const scope: VcdScope = { name: m[2], type: m[1], children: [], variables: [] };
        scopeStack[scopeStack.length - 1].children.push(scope);
        scopeStack.push(scope);
      }
      i++;
      // Skip to $end
      while (i < lines.length && !lines[i].trim().includes("$end")) i++;
      i++;
    } else if (line.startsWith("$upscope")) {
      if (scopeStack.length > 1) scopeStack.pop();
      i++;
      while (i < lines.length && !lines[i].trim().includes("$end")) i++;
      i++;
    } else if (line.startsWith("$var")) {
      const m = line.match(/\$var\s+(\w+)\s+(\d+)\s+(\S+)\s+(\S+)\s*(.*?)\s*\$end/);
      if (m) {
        const scopePath = scopeStack.slice(1).map((s) => s.name);
        const variable: VcdVariable = {
          type: m[1],
          width: parseInt(m[2]),
          idCode: m[3],
          name: m[4],
          range: m[5] || undefined,
          scope: scopePath,
          hierarchicalName: [...scopePath, m[4]].join("."),
        };
        varMap.set(variable.idCode, variable);
        transitionMap.set(variable.idCode, []);
        scopeStack[scopeStack.length - 1].variables.push(variable);
      }
      i++;
    } else if (line.startsWith("$enddefinitions")) {
      i++;
      while (i < lines.length && !lines[i].trim().includes("$end")) i++;
      i++;
      inHeader = false;
    } else {
      i++;
    }
  }

  // ── Value change pass ──

  while (i < lines.length) {
    const line = lines[i].trim();
    i++;

    if (!line || line.startsWith("$comment")) continue;

    if (line.startsWith("$dumpvars") || line.startsWith("$dumpall") || line.startsWith("$dumpon")) {
      continue;
    }
    if (line === "$end") {
      continue;
    }
    if (line.startsWith("$dumpoff")) {
      continue;
    }

    // Timestamp
    if (line.startsWith("#")) {
      currentTime = parseInt(line.slice(1));
      timeSteps.add(currentTime);
      if (currentTime < minTime) minTime = currentTime;
      if (currentTime > maxTime) maxTime = currentTime;
      continue;
    }

    // Multi-bit value change: b<binary> <idCode> or r<real> <idCode>
    if (line.startsWith("b") || line.startsWith("B") || line.startsWith("r") || line.startsWith("R")) {
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx === -1) continue;
      const rawVal = line.slice(0, spaceIdx);
      const idCode = line.slice(spaceIdx + 1).trim();
      const variable = varMap.get(idCode);
      if (!variable) continue;
      const transitions = transitionMap.get(idCode);
      if (!transitions) continue;
      transitions.push({
        time: currentTime,
        rawValue: rawVal,
        numericValue: parseNumericValue(rawVal, variable.width),
      });
      totalTransitions++;
      continue;
    }

    // Single-bit value change: <value><idCode>  (e.g., "0!", "1#", "x$")
    if (/^[01xXzZ]/.test(line)) {
      const value = line[0];
      const idCode = line.slice(1).trim();
      const variable = varMap.get(idCode);
      if (!variable) continue;
      const transitions = transitionMap.get(idCode);
      if (!transitions) continue;
      transitions.push({
        time: currentTime,
        rawValue: value,
        numericValue: parseNumericValue(value, 1),
      });
      totalTransitions++;
    }
  }

  // Handle case where no timestamps were found
  if (minTime === Infinity) minTime = 0;
  if (maxTime === -Infinity) maxTime = 0;

  // Build signals array
  const signals: VcdSignal[] = [];
  for (const [idCode, variable] of varMap) {
    const transitions = transitionMap.get(idCode) ?? [];
    signals.push({ variable, transitions });
  }

  return {
    date,
    version,
    comment,
    timescale,
    rootScope,
    signals,
    timeRange: [minTime, maxTime],
    timeStepCount: timeSteps.size,
    parseTimeMs: performance.now() - t0,
    transitionCount: totalTransitions,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/**
 * Convert a VCD signal into a format compatible with the waveform viewer.
 * Expands transitions into continuous point-to-point data for rendering.
 */
export function vcdSignalToWaveform(
  signal: VcdSignal,
  timeRange: [number, number],
  timescale: VcdTimescale,
): { name: string; times: number[]; values: number[]; isDigital: boolean; width: number } {
  const transitions = signal.transitions;
  const isDigital = signal.variable.width === 1 && signal.variable.type !== "real";
  const times: number[] = [];
  const values: number[] = [];

  for (let i = 0; i < transitions.length; i++) {
    const t = transitions[i];
    const timeSec = t.time * timescale.secondsPerUnit;
    const val = isNaN(t.numericValue) ? 0.5 : t.numericValue; // x/z → 0.5 for digital

    if (isDigital && i > 0) {
      // Step function: add point at new time with old value
      times.push(timeSec);
      values.push(values[values.length - 1]);
    }

    times.push(timeSec);
    values.push(val);
  }

  // Extend to end of time range
  if (times.length > 0 && transitions.length > 0) {
    const endTime = timeRange[1] * timescale.secondsPerUnit;
    if (times[times.length - 1] < endTime) {
      times.push(endTime);
      values.push(values[values.length - 1]);
    }
  }

  return {
    name: signal.variable.hierarchicalName,
    times,
    values,
    isDigital,
    width: signal.variable.width,
  };
}

/**
 * Generate a demo VCD string for testing the parser and waveform viewer.
 */
export function generateDemoVcd(): string {
  const lines: string[] = [
    "$date February 10, 2026 $end",
    "$version OpenSilicon VCD Generator $end",
    "$timescale 1ns $end",
    "$scope module testbench $end",
    "$var wire 1 ! clk $end",
    "$var wire 1 \" rst_n $end",
    "$var wire 1 # en $end",
    "$scope module dut $end",
    '$var wire 8 $ data_in [7:0] $end',
    '$var wire 8 % data_out [7:0] $end',
    "$var wire 1 & valid $end",
    "$var wire 1 ' ready $end",
    "$var real 1 ( voltage $end",
    "$upscope $end",
    "$upscope $end",
    "$enddefinitions $end",
    "$dumpvars",
    "0!",
    "0\"",
    "0#",
    "b00000000 $",
    "b00000000 %",
    "0&",
    "1'",
    "r0.0 (",
    "$end",
  ];

  // Generate clock + data transitions
  const endTime = 200;
  let dataVal = 0;
  for (let t = 0; t <= endTime; t++) {
    // Clock: toggle every 5ns
    if (t % 5 === 0) {
      lines.push(`#${t}`);
      lines.push(t % 10 < 5 ? "1!" : "0!");
    }

    // Reset deasserts at 10ns
    if (t === 10) {
      lines.push(`#${t}`);
      lines.push("1\"");
    }

    // Enable at 20ns
    if (t === 20) {
      lines.push(`#${t}`);
      lines.push("1#");
    }

    // Data changes every 10ns after enable
    if (t >= 20 && t % 10 === 0) {
      lines.push(`#${t}`);
      dataVal = (dataVal + 0x1a) & 0xff;
      lines.push(`b${dataVal.toString(2).padStart(8, "0")} $`);
      lines.push(`b${((dataVal * 3) & 0xff).toString(2).padStart(8, "0")} %`);
      lines.push(t % 20 === 0 ? "1&" : "0&");
      // Analog voltage ramp
      const v = 0.3 + (t / endTime) * 1.5 + Math.sin(t * 0.1) * 0.2;
      lines.push(`r${v.toFixed(3)} (`);
    }
  }

  return lines.join("\n");
}

/**
 * Check if a filename looks like a VCD file.
 */
export function isVcdFile(filename: string): boolean {
  return /\.(vcd|fst|ghw)$/i.test(filename);
}
