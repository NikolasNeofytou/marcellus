/**
 * HDL Parser Engine — Verilog / SystemVerilog / VHDL
 *
 * Extracts structural information (modules, ports, signals, instances,
 * parameters) from HDL source text.  The parser is intentionally
 * lightweight — it uses regex-based extraction rather than a full
 * grammar so it stays fast enough for interactive IDE use while being
 * accurate for the 95% case.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type HdlLanguage = "verilog" | "systemverilog" | "vhdl";

export type PortDirection = "input" | "output" | "inout";

export interface HdlPort {
  name: string;
  direction: PortDirection;
  width: number; // bit-width, 1 = scalar
  range?: string; // "[7:0]" etc.
  type?: string; // wire, reg, logic, std_logic_vector, …
  line: number;
}

export interface HdlParameter {
  name: string;
  type?: string;
  defaultValue?: string;
  line: number;
}

export interface HdlSignal {
  name: string;
  type: string; // wire, reg, logic, signal, …
  width: number;
  range?: string;
  line: number;
}

export interface HdlInstance {
  moduleName: string;
  instanceName: string;
  connections: Record<string, string>; // portName → netName / expression
  parameterOverrides: Record<string, string>;
  line: number;
}

export interface HdlModule {
  name: string;
  language: HdlLanguage;
  ports: HdlPort[];
  parameters: HdlParameter[];
  signals: HdlSignal[];
  instances: HdlInstance[];
  startLine: number;
  endLine: number;
}

export interface HdlDiagnostic {
  severity: "error" | "warning" | "info";
  message: string;
  line: number;
  column?: number;
  rule?: string;
}

export interface HdlParseResult {
  language: HdlLanguage;
  modules: HdlModule[];
  diagnostics: HdlDiagnostic[];
  parseTimeMs: number;
}

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                   */
/* ------------------------------------------------------------------ */

function stripComments(src: string, lang: HdlLanguage): string {
  if (lang === "vhdl") {
    // VHDL: -- to end of line
    return src.replace(/--.*$/gm, "");
  }
  // Verilog / SystemVerilog: // and /* */
  return src
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Map a character offset in `src` back to a 1-based line number. */
function lineOf(src: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src[i] === "\n") line++;
  }
  return line;
}

/** Parse a Verilog range like [7:0] → width 8.  Returns 1 if none. */
function parseRange(rangeStr?: string): number {
  if (!rangeStr) return 1;
  const m = rangeStr.match(/\[\s*(\d+)\s*:\s*(\d+)\s*\]/);
  if (!m) return 1;
  return Math.abs(parseInt(m[1]) - parseInt(m[2])) + 1;
}

/* ------------------------------------------------------------------ */
/*  Language detection                                                */
/* ------------------------------------------------------------------ */

export function detectLanguage(filename: string, src?: string): HdlLanguage {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "vhd" || ext === "vhdl") return "vhdl";
  if (ext === "sv" || ext === "svh") return "systemverilog";
  if (ext === "v" || ext === "vh") return "verilog";

  // Heuristic from content
  if (src) {
    if (/\bentity\b.*\bis\b/i.test(src) || /\barchitecture\b/i.test(src)) return "vhdl";
    if (/\binterface\b|\bclass\b|\bmodport\b|\blogic\b/i.test(src)) return "systemverilog";
  }
  return "verilog";
}

/* ------------------------------------------------------------------ */
/*  Verilog / SystemVerilog parser                                    */
/* ------------------------------------------------------------------ */

function parseVerilog(src: string, lang: HdlLanguage): HdlParseResult {
  const t0 = performance.now();
  const diagnostics: HdlDiagnostic[] = [];
  const modules: HdlModule[] = [];

  const clean = stripComments(src, lang);

  // ── Module boundaries ──
  const moduleRe = /\bmodule\s+(\w+)\s*(#\s*\([\s\S]*?\))?\s*\([\s\S]*?\)\s*;/g;
  const endModuleRe = /\bendmodule\b/g;

  // Collect endmodule positions
  const endPositions: number[] = [];
  let em: RegExpExecArray | null;
  while ((em = endModuleRe.exec(clean)) !== null) {
    endPositions.push(em.index);
  }

  let mi = 0;
  let mm: RegExpExecArray | null;
  while ((mm = moduleRe.exec(clean)) !== null) {
    const moduleName = mm[1];
    const startLine = lineOf(src, mm.index);
    const headerEnd = mm.index + mm[0].length;

    // Find matching endmodule
    const endPos = endPositions.find((p) => p > headerEnd) ?? clean.length;
    if (mi < endPositions.length) mi++;
    const endLine = lineOf(src, endPos);
    const body = clean.slice(headerEnd, endPos);

    const ports = parseVerilogPorts(clean.slice(mm.index, headerEnd), mm.index, src);
    const parameters = parseVerilogParameters(mm[2] ?? "", mm.index, src);
    const signals = parseVerilogSignals(body, headerEnd, src);
    const instances = parseVerilogInstances(body, headerEnd, src);

    modules.push({
      name: moduleName,
      language: lang,
      ports,
      parameters,
      signals,
      instances,
      startLine,
      endLine,
    });
  }

  // Basic diagnostics
  if (modules.length === 0 && clean.trim().length > 0) {
    diagnostics.push({
      severity: "warning",
      message: "No module declaration found",
      line: 1,
      rule: "hdl-no-module",
    });
  }

  for (const mod of modules) {
    if (mod.ports.length === 0) {
      diagnostics.push({
        severity: "info",
        message: `Module '${mod.name}' has no ports`,
        line: mod.startLine,
        rule: "hdl-no-ports",
      });
    }
    // Check for unconnected instance ports
    for (const inst of mod.instances) {
      const floatingPorts = Object.entries(inst.connections).filter(
        ([, net]) => !net || net.trim() === ""
      );
      if (floatingPorts.length > 0) {
        diagnostics.push({
          severity: "warning",
          message: `Instance '${inst.instanceName}' has ${floatingPorts.length} unconnected port(s)`,
          line: inst.line,
          rule: "hdl-unconnected-port",
        });
      }
    }
  }

  return {
    language: lang,
    modules,
    diagnostics,
    parseTimeMs: performance.now() - t0,
  };
}

function parseVerilogPorts(header: string, baseOffset: number, fullSrc: string): HdlPort[] {
  const ports: HdlPort[] = [];
  // Match declarations like: input wire [7:0] data, clk
  const portRe =
    /\b(input|output|inout)\s+(wire|reg|logic|integer)?\s*(\[\s*\d+\s*:\s*\d+\s*\])?\s*([\w,\s]+)/g;
  let m: RegExpExecArray | null;
  while ((m = portRe.exec(header)) !== null) {
    const direction = m[1] as PortDirection;
    const type = m[2] ?? "wire";
    const range = m[3]?.trim();
    const width = parseRange(range);
    const names = m[4].split(",").map((n) => n.trim()).filter(Boolean);
    for (const name of names) {
      if (/^\w+$/.test(name)) {
        ports.push({
          name,
          direction,
          width,
          range,
          type,
          line: lineOf(fullSrc, baseOffset + m.index),
        });
      }
    }
  }
  return ports;
}

function parseVerilogParameters(paramBlock: string, baseOffset: number, fullSrc: string): HdlParameter[] {
  const params: HdlParameter[] = [];
  if (!paramBlock) return params;
  // e.g.  parameter WIDTH = 8, parameter DEPTH = 16
  const paramRe = /\bparameter\s+(?:(integer|real|string)\s+)?(\w+)\s*=\s*([^,)]+)/g;
  let m: RegExpExecArray | null;
  while ((m = paramRe.exec(paramBlock)) !== null) {
    params.push({
      name: m[2],
      type: m[1] ?? "integer",
      defaultValue: m[3].trim(),
      line: lineOf(fullSrc, baseOffset + m.index),
    });
  }
  return params;
}

function parseVerilogSignals(body: string, baseOffset: number, fullSrc: string): HdlSignal[] {
  const signals: HdlSignal[] = [];
  const sigRe = /\b(wire|reg|logic|integer)\s*(\[\s*\d+\s*:\s*\d+\s*\])?\s+([\w,\s]+)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = sigRe.exec(body)) !== null) {
    const type = m[1];
    const range = m[2]?.trim();
    const width = parseRange(range);
    const names = m[3].split(",").map((n) => n.trim()).filter(Boolean);
    for (const name of names) {
      if (/^\w+$/.test(name)) {
        signals.push({ name, type, width, range, line: lineOf(fullSrc, baseOffset + m.index) });
      }
    }
  }
  return signals;
}

function parseVerilogInstances(body: string, baseOffset: number, fullSrc: string): HdlInstance[] {
  const instances: HdlInstance[] = [];
  // Module instantiation: ModuleName #(...) inst_name (...);
  const instRe =
    /\b(\w+)\s*(?:#\s*\(([\s\S]*?)\)\s*)?(\w+)\s*\(\s*([\s\S]*?)\)\s*;/g;
  // Reserved keywords to skip
  const keywords = new Set([
    "module", "endmodule", "input", "output", "inout", "wire", "reg", "logic",
    "integer", "real", "assign", "always", "initial", "begin", "end", "if",
    "else", "case", "endcase", "for", "while", "generate", "endgenerate",
    "function", "endfunction", "task", "endtask", "parameter", "localparam",
    "genvar", "posedge", "negedge", "or", "and", "not", "buf", "nand", "nor",
    "xor", "xnor",
  ]);

  let m: RegExpExecArray | null;
  while ((m = instRe.exec(body)) !== null) {
    const moduleName = m[1];
    if (keywords.has(moduleName)) continue;
    const instanceName = m[3];
    if (keywords.has(instanceName)) continue;

    const connections: Record<string, string> = {};
    const connStr = m[4];
    // Named connections: .port(net)
    const namedRe = /\.(\w+)\s*\(\s*([^)]*)\s*\)/g;
    let cm: RegExpExecArray | null;
    while ((cm = namedRe.exec(connStr)) !== null) {
      connections[cm[1]] = cm[2].trim();
    }

    const paramOverrides: Record<string, string> = {};
    if (m[2]) {
      const pStr = m[2];
      const pRe = /\.(\w+)\s*\(\s*([^)]*)\s*\)/g;
      let pm: RegExpExecArray | null;
      while ((pm = pRe.exec(pStr)) !== null) {
        paramOverrides[pm[1]] = pm[2].trim();
      }
    }

    instances.push({
      moduleName,
      instanceName,
      connections,
      parameterOverrides: paramOverrides,
      line: lineOf(fullSrc, baseOffset + m.index),
    });
  }
  return instances;
}

/* ------------------------------------------------------------------ */
/*  VHDL parser                                                       */
/* ------------------------------------------------------------------ */

function parseVhdl(src: string): HdlParseResult {
  const t0 = performance.now();
  const diagnostics: HdlDiagnostic[] = [];
  const modules: HdlModule[] = [];

  const clean = stripComments(src, "vhdl");

  // Entity extraction
  const entityRe = /\bentity\s+(\w+)\s+is\b([\s\S]*?)\bend\s+(?:entity\s+)?(?:\1\s*)?;/gi;
  let em: RegExpExecArray | null;
  while ((em = entityRe.exec(clean)) !== null) {
    const entityName = em[1];
    const entityBody = em[2];
    const startLine = lineOf(src, em.index);
    const endLine = lineOf(src, em.index + em[0].length);

    const ports = parseVhdlPorts(entityBody, em.index, src);
    const parameters = parseVhdlGenerics(entityBody, em.index, src);

    // Find corresponding architecture
    const archRe = new RegExp(
      `\\barchitecture\\s+(\\w+)\\s+of\\s+${entityName}\\s+is\\b([\\s\\S]*?)\\bend\\s+(?:architecture\\s+)?(?:\\1\\s*)?;`,
      "gi"
    );
    const archMatch = archRe.exec(clean);
    const signals: HdlSignal[] = [];
    const instances: HdlInstance[] = [];
    let archEndLine = endLine;

    if (archMatch) {
      archEndLine = lineOf(src, archMatch.index + archMatch[0].length);
      const archBody = archMatch[2];
      // Signals in architecture declarative region
      const archDeclEnd = archBody.indexOf("begin");
      const archDecl = archDeclEnd >= 0 ? archBody.slice(0, archDeclEnd) : "";
      const archStmt = archDeclEnd >= 0 ? archBody.slice(archDeclEnd) : archBody;

      parseVhdlSignals(archDecl, archMatch.index, src, signals);
      parseVhdlInstances(archStmt, archMatch.index + (archDeclEnd >= 0 ? archDeclEnd : 0), src, instances);
    }

    modules.push({
      name: entityName,
      language: "vhdl",
      ports,
      parameters,
      signals,
      instances,
      startLine,
      endLine: archEndLine,
    });
  }

  if (modules.length === 0 && clean.trim().length > 0) {
    diagnostics.push({
      severity: "warning",
      message: "No entity declaration found",
      line: 1,
      rule: "hdl-no-entity",
    });
  }

  return {
    language: "vhdl",
    modules,
    diagnostics,
    parseTimeMs: performance.now() - t0,
  };
}

function parseVhdlPorts(entityBody: string, baseOffset: number, fullSrc: string): HdlPort[] {
  const ports: HdlPort[] = [];
  // port ( ... );
  const portBlockRe = /\bport\s*\(([\s\S]*?)\)\s*;/i;
  const blockMatch = portBlockRe.exec(entityBody);
  if (!blockMatch) return ports;

  const portStr = blockMatch[1];
  // signal_name : direction type
  const portLineRe = /([\w,\s]+?)\s*:\s*(in|out|inout|buffer)\s+([\w().\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = portLineRe.exec(portStr)) !== null) {
    const names = m[1].split(",").map((n) => n.trim()).filter(Boolean);
    const direction = m[2].toLowerCase() as string;
    if (direction === "buffer") continue; // skip buffer for simplicity
    const dir = direction as PortDirection;
    const typeStr = m[3].trim();
    let width = 1;
    const vecRe = /\(\s*(\d+)\s+(?:downto|to)\s+(\d+)\s*\)/i;
    const vecMatch = vecRe.exec(typeStr);
    if (vecMatch) {
      width = Math.abs(parseInt(vecMatch[1]) - parseInt(vecMatch[2])) + 1;
    }
    for (const name of names) {
      ports.push({
        name,
        direction: dir,
        width,
        range: vecMatch ? `(${vecMatch[1]} downto ${vecMatch[2]})` : undefined,
        type: typeStr.split("(")[0].trim(),
        line: lineOf(fullSrc, baseOffset + (blockMatch?.index ?? 0) + m.index),
      });
    }
  }
  return ports;
}

function parseVhdlGenerics(entityBody: string, baseOffset: number, fullSrc: string): HdlParameter[] {
  const params: HdlParameter[] = [];
  const genericBlockRe = /\bgeneric\s*\(([\s\S]*?)\)\s*;/i;
  const blockMatch = genericBlockRe.exec(entityBody);
  if (!blockMatch) return params;

  const genStr = blockMatch[1];
  const genRe = /(\w+)\s*:\s*(\w+)\s*(?::=\s*([^;,]+))?/g;
  let m: RegExpExecArray | null;
  while ((m = genRe.exec(genStr)) !== null) {
    params.push({
      name: m[1],
      type: m[2],
      defaultValue: m[3]?.trim(),
      line: lineOf(fullSrc, baseOffset + m.index),
    });
  }
  return params;
}

function parseVhdlSignals(
  declRegion: string,
  baseOffset: number,
  fullSrc: string,
  out: HdlSignal[]
): void {
  const sigRe = /\bsignal\s+([\w,\s]+?)\s*:\s*([\w().\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = sigRe.exec(declRegion)) !== null) {
    const names = m[1].split(",").map((n) => n.trim()).filter(Boolean);
    const typeStr = m[2].trim();
    let width = 1;
    const vecRe = /\(\s*(\d+)\s+(?:downto|to)\s+(\d+)\s*\)/i;
    const vecMatch = vecRe.exec(typeStr);
    if (vecMatch) width = Math.abs(parseInt(vecMatch[1]) - parseInt(vecMatch[2])) + 1;
    for (const name of names) {
      out.push({
        name,
        type: typeStr.split("(")[0].trim(),
        width,
        range: vecMatch ? `(${vecMatch[1]} downto ${vecMatch[2]})` : undefined,
        line: lineOf(fullSrc, baseOffset + m.index),
      });
    }
  }
}

function parseVhdlInstances(
  stmtRegion: string,
  baseOffset: number,
  fullSrc: string,
  out: HdlInstance[]
): void {
  // Label : entity work.ModuleName port map ( ... );
  const instRe =
    /(\w+)\s*:\s*(?:entity\s+\w+\.)?(\w+)\s*(?:generic\s+map\s*\(([\s\S]*?)\)\s*)?port\s+map\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  while ((m = instRe.exec(stmtRegion)) !== null) {
    const instanceName = m[1];
    const moduleName = m[2];
    const connections: Record<string, string> = {};
    const paramOverrides: Record<string, string> = {};

    if (m[4]) {
      const connParts = m[4].split(",");
      for (const part of connParts) {
        const namedRe = /(\w+)\s*=>\s*(.+)/;
        const nm = namedRe.exec(part.trim());
        if (nm) connections[nm[1].trim()] = nm[2].trim();
      }
    }
    if (m[3]) {
      const genParts = m[3].split(",");
      for (const part of genParts) {
        const namedRe = /(\w+)\s*=>\s*(.+)/;
        const nm = namedRe.exec(part.trim());
        if (nm) paramOverrides[nm[1].trim()] = nm[2].trim();
      }
    }

    out.push({
      moduleName,
      instanceName,
      connections,
      parameterOverrides: paramOverrides,
      line: lineOf(fullSrc, baseOffset + m.index),
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

/** Parse an HDL source file and return structural information. */
export function parseHdl(src: string, filename: string): HdlParseResult {
  const lang = detectLanguage(filename, src);
  if (lang === "vhdl") return parseVhdl(src);
  return parseVerilog(src, lang);
}

/** Run lint-style checks on parsed HDL. */
export function lintHdl(result: HdlParseResult, src: string): HdlDiagnostic[] {
  const diags: HdlDiagnostic[] = [...result.diagnostics];

  for (const mod of result.modules) {
    // Naming conventions
    if (mod.name !== mod.name.toLowerCase() && result.language !== "vhdl") {
      diags.push({
        severity: "info",
        message: `Module '${mod.name}' uses non-lowercase naming`,
        line: mod.startLine,
        rule: "naming-convention",
      });
    }

    // Unused signals (simple check: signal declared but never referenced in body)
    const bodyText = src.split("\n").slice(mod.startLine - 1, mod.endLine).join("\n");
    for (const sig of mod.signals) {
      // Count occurrences — if exactly 1 (the declaration), it's unused
      const occurrences = bodyText.split(new RegExp(`\\b${sig.name}\\b`)).length - 1;
      if (occurrences <= 1) {
        diags.push({
          severity: "warning",
          message: `Signal '${sig.name}' appears to be unused`,
          line: sig.line,
          rule: "unused-signal",
        });
      }
    }

    // Input ports driven inside module (common mistake)
    for (const port of mod.ports) {
      if (port.direction === "input") {
        const assignRe = new RegExp(`\\b${port.name}\\s*<=|\\bassign\\s+${port.name}\\b`);
        if (assignRe.test(bodyText)) {
          diags.push({
            severity: "error",
            message: `Input port '${port.name}' is driven inside the module`,
            line: port.line,
            rule: "input-driven",
          });
        }
      }
    }
  }

  return diags;
}

/** Generate a port-map template for instantiating a module. */
export function generateInstantiationTemplate(
  mod: HdlModule,
  instanceName?: string
): string {
  const iName = instanceName ?? `u_${mod.name}`;
  if (mod.language === "vhdl") {
    const portMap = mod.ports
      .map((p) => `    ${p.name} => ${p.name}`)
      .join(",\n");
    const genMap =
      mod.parameters.length > 0
        ? `  generic map (\n${mod.parameters.map((p) => `    ${p.name} => ${p.defaultValue ?? p.name}`).join(",\n")}\n  )\n  `
        : "  ";
    return `${iName} : entity work.${mod.name}\n${genMap}port map (\n${portMap}\n  );`;
  }

  // Verilog / SystemVerilog
  const params =
    mod.parameters.length > 0
      ? ` #(\n${mod.parameters.map((p) => `    .${p.name}(${p.defaultValue ?? p.name})`).join(",\n")}\n  )`
      : "";
  const ports = mod.ports
    .map((p) => `    .${p.name}(${p.name})`)
    .join(",\n");
  return `${mod.name}${params} ${iName} (\n${ports}\n  );`;
}

/** Get file extensions recognized as HDL. */
export function getHdlExtensions(): string[] {
  return [".v", ".vh", ".sv", ".svh", ".vhd", ".vhdl"];
}

/** Check whether a filename is an HDL file. */
export function isHdlFile(filename: string): boolean {
  const ext = "." + (filename.split(".").pop()?.toLowerCase() ?? "");
  return getHdlExtensions().includes(ext);
}
