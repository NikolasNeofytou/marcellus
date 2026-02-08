/**
 * ngspice Raw Output Parser
 *
 * Parses ngspice raw binary/ASCII output format into structured data.
 * Also handles plain text simulation output (print statements, etc.).
 *
 * ngspice raw format (ASCII version):
 *   Title: <title>
 *   Date: <date>
 *   Plotname: <analysis name>
 *   Flags: <real|complex>
 *   No. Variables: <n>
 *   No. Points: <m>
 *   Variables:
 *     0 <name> <type>
 *     1 <name> <type>
 *     ...
 *   Values:
 *     0 <sweep> <v1> <v2> ...
 *     1 <sweep> <v1> <v2> ...
 *     ...
 */

// ══════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════

export interface NgspiceVariable {
  index: number;
  name: string;
  type: string; // "voltage", "current", "time", "frequency"
}

export interface NgspiceRawData {
  title: string;
  date: string;
  plotname: string;
  flags: string; // "real" or "complex"
  variables: NgspiceVariable[];
  /** data[variableIndex][pointIndex] */
  data: number[][];
  /** For complex data: imaginary parts */
  imagData?: number[][];
  noPoints: number;
  noVariables: number;
}

// ══════════════════════════════════════════════════════════════════
// ASCII Raw Format Parser
// ══════════════════════════════════════════════════════════════════

export function parseRawOutput(text: string): NgspiceRawData | null {
  if (!text || text.trim().length === 0) return null;

  const lines = text.split(/\r?\n/);
  let lineIdx = 0;

  const result: NgspiceRawData = {
    title: "",
    date: "",
    plotname: "",
    flags: "real",
    variables: [],
    data: [],
    noPoints: 0,
    noVariables: 0,
  };

  const nextLine = (): string | undefined => lines[lineIdx++];
  const peekLine = (): string | undefined => lines[lineIdx];

  // Parse header
  while (lineIdx < lines.length) {
    const line = nextLine();
    if (!line) continue;

    if (line.startsWith("Title:")) {
      result.title = line.slice(6).trim();
    } else if (line.startsWith("Date:")) {
      result.date = line.slice(5).trim();
    } else if (line.startsWith("Plotname:")) {
      result.plotname = line.slice(9).trim();
    } else if (line.startsWith("Flags:")) {
      result.flags = line.slice(6).trim().toLowerCase();
    } else if (line.startsWith("No. Variables:")) {
      result.noVariables = parseInt(line.slice(14).trim()) || 0;
    } else if (line.startsWith("No. Points:")) {
      result.noPoints = parseInt(line.slice(11).trim()) || 0;
    } else if (line.startsWith("Variables:")) {
      // Parse variable list
      while (lineIdx < lines.length) {
        const varLine = peekLine();
        if (!varLine || !varLine.match(/^\s+\d+/)) break;
        nextLine();
        const parts = varLine.trim().split(/\s+/);
        if (parts.length >= 3) {
          result.variables.push({
            index: parseInt(parts[0]),
            name: parts[1],
            type: parts[2],
          });
        }
      }
    } else if (line.startsWith("Values:") || line.startsWith("Binary:")) {
      // Parse data values
      const isComplex = result.flags.includes("complex");

      // Initialize data arrays
      result.data = result.variables.map(() => []);
      if (isComplex) result.imagData = result.variables.map(() => []);

      if (line.startsWith("Values:")) {
        parseAsciiValues(lines, lineIdx, result, isComplex);
      }
      break;
    }
  }

  return result;
}

function parseAsciiValues(
  lines: string[],
  startIdx: number,
  result: NgspiceRawData,
  isComplex: boolean,
): void {
  let idx = startIdx;
  const nVars = result.noVariables;

  while (idx < lines.length) {
    const line = lines[idx]?.trim();
    if (!line) {
      idx++;
      continue;
    }

    // Each point starts with an index number, then values follow
    // Format can be:
    //   <idx> <value0>
    //   <value1>
    //   <value2>
    //   ...
    // OR:
    //   <idx> <value0> <value1> <value2> ...

    const firstParts = line.split(/\s+/);
    const pointIdx = parseInt(firstParts[0]);
    if (isNaN(pointIdx)) {
      idx++;
      continue;
    }

    // First value on the same line as index
    const values: number[] = [];
    const imagValues: number[] = [];

    if (firstParts.length > 1) {
      if (isComplex) {
        // Complex values: real,imag
        const parts = firstParts[1].split(",");
        values.push(parseFloat(parts[0]) || 0);
        imagValues.push(parseFloat(parts[1] ?? "0") || 0);
      } else {
        values.push(parseFloat(firstParts[1]) || 0);
      }
    }

    idx++;

    // Read remaining variables for this point
    while (values.length < nVars && idx < lines.length) {
      const valLine = lines[idx]?.trim();
      if (!valLine) {
        idx++;
        continue;
      }
      // Check if this is a new point (starts with a number tab format)
      if (valLine.match(/^\d+\s/)) break;

      if (isComplex) {
        const parts = valLine.split(",");
        values.push(parseFloat(parts[0]) || 0);
        imagValues.push(parseFloat(parts[1] ?? "0") || 0);
      } else {
        values.push(parseFloat(valLine) || 0);
      }
      idx++;
    }

    // Store values
    for (let v = 0; v < nVars && v < values.length; v++) {
      result.data[v].push(values[v]);
      if (isComplex && result.imagData) {
        result.imagData[v].push(imagValues[v] ?? 0);
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════
// Plain Text Output Parser (for print/measure commands)
// ══════════════════════════════════════════════════════════════════

export interface MeasurementResult {
  name: string;
  value: number;
  unit: string;
}

export function parsePrintOutput(text: string): MeasurementResult[] {
  const results: MeasurementResult[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    // Match patterns like: "vout = 1.2345e+00"
    const match = line.match(/(\w+[\w()]*)\s*=\s*([+-]?\d+\.?\d*(?:e[+-]?\d+)?)\s*(\w*)/i);
    if (match) {
      results.push({
        name: match[1],
        value: parseFloat(match[2]),
        unit: match[3] || "",
      });
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════
// SPICE Output Formatter
// ══════════════════════════════════════════════════════════════════

/**
 * Format simulation results as a human-readable text report.
 */
export function formatSimulationReport(raw: NgspiceRawData): string {
  const lines: string[] = [];

  lines.push(`═══════════════════════════════════════════════`);
  lines.push(`  ${raw.title || "Simulation Results"}`);
  lines.push(`═══════════════════════════════════════════════`);
  lines.push(`  Plot: ${raw.plotname}`);
  lines.push(`  Date: ${raw.date || new Date().toISOString()}`);
  lines.push(`  Variables: ${raw.noVariables}`);
  lines.push(`  Points: ${raw.noPoints}`);
  lines.push(`  Format: ${raw.flags}`);
  lines.push(``);

  // Variables table
  lines.push(`  Variables:`);
  lines.push(`  ${"#".padStart(3)} ${"Name".padEnd(20)} Type`);
  lines.push(`  ${"─".repeat(40)}`);
  for (const v of raw.variables) {
    lines.push(`  ${String(v.index).padStart(3)} ${v.name.padEnd(20)} ${v.type}`);
  }
  lines.push(``);

  // Data summary (first/last few points)
  if (raw.data.length > 0 && raw.data[0].length > 0) {
    lines.push(`  Data Summary:`);
    const nPts = raw.data[0].length;
    const showPts = Math.min(5, nPts);

    // Header
    const header = raw.variables.map((v) => v.name.padStart(14)).join(" ");
    lines.push(`  ${header}`);
    lines.push(`  ${"─".repeat(14 * raw.variables.length)}`);

    // First points
    for (let i = 0; i < showPts; i++) {
      const row = raw.variables.map((_, vi) => {
        const val = raw.data[vi][i] ?? 0;
        return val.toExponential(4).padStart(14);
      }).join(" ");
      lines.push(`  ${row}`);
    }

    if (nPts > showPts * 2) {
      lines.push(`  ${"...".padStart(14)}`);
    }

    // Last points
    if (nPts > showPts) {
      const startLast = Math.max(showPts, nPts - showPts);
      for (let i = startLast; i < nPts; i++) {
        const row = raw.variables.map((_, vi) => {
          const val = raw.data[vi][i] ?? 0;
          return val.toExponential(4).padStart(14);
        }).join(" ");
        lines.push(`  ${row}`);
      }
    }
  }

  lines.push(``);
  lines.push(`═══════════════════════════════════════════════`);

  return lines.join("\n");
}
