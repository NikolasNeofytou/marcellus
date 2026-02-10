/**
 * HDL Navigator — Go-to-Definition, Find References, and Symbol Search
 * for Verilog/SystemVerilog/VHDL.
 *
 * Provides:
 * - Go-to-definition: module instantiation → module declaration
 * - Find all references: where a module/signal/port is used
 * - Symbol outline: all symbols in the current file
 * - Workspace symbol search: all symbols across all files
 */

import type { HdlModule, HdlParseResult } from "./hdlParser";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface HdlLocation {
  fileId: string;
  filename: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface HdlDefinition {
  name: string;
  kind: "module" | "port" | "signal" | "parameter" | "instance";
  location: HdlLocation;
  detail?: string;
}

export interface HdlReference {
  location: HdlLocation;
  kind: "definition" | "instantiation" | "connection" | "usage";
  context: string; // line text
}

export interface HdlSymbol {
  name: string;
  kind: "module" | "port" | "signal" | "parameter" | "instance";
  detail: string;
  fileId: string;
  filename: string;
  line: number;
  containerName?: string;
}

export interface HdlFileInfo {
  id: string;
  filename: string;
  content: string;
  parseResult: HdlParseResult | null;
}

/* ------------------------------------------------------------------ */
/*  Go-to-Definition                                                  */
/* ------------------------------------------------------------------ */

/**
 * Given a word at a cursor position, find its definition across all files.
 */
export function goToDefinition(
  word: string,
  cursorFile: HdlFileInfo,
  cursorLine: number,
  allFiles: HdlFileInfo[],
): HdlDefinition | null {
  // 1. Check if the word is a module name → jump to module declaration
  for (const file of allFiles) {
    if (!file.parseResult) continue;
    for (const mod of file.parseResult.modules) {
      if (mod.name === word) {
        return {
          name: mod.name,
          kind: "module",
          location: {
            fileId: file.id,
            filename: file.filename,
            line: mod.startLine,
            column: 1,
            endLine: mod.endLine,
          },
          detail: `module ${mod.name} (${mod.ports.length} ports)`,
        };
      }
    }
  }

  // 2. Check if the word is a port/signal/parameter in the current file's module
  if (cursorFile.parseResult) {
    for (const mod of cursorFile.parseResult.modules) {
      if (cursorLine < mod.startLine || cursorLine > mod.endLine) continue;

      // Ports
      for (const port of mod.ports) {
        if (port.name === word) {
          return {
            name: port.name,
            kind: "port",
            location: {
              fileId: cursorFile.id,
              filename: cursorFile.filename,
              line: port.line,
              column: 1,
            },
            detail: `${port.direction} ${port.width > 1 ? `[${port.width - 1}:0] ` : ""}${port.name}`,
          };
        }
      }

      // Signals
      for (const sig of mod.signals) {
        if (sig.name === word) {
          return {
            name: sig.name,
            kind: "signal",
            location: {
              fileId: cursorFile.id,
              filename: cursorFile.filename,
              line: sig.line,
              column: 1,
            },
            detail: `${sig.type} ${sig.width > 1 ? `[${sig.width - 1}:0] ` : ""}${sig.name}`,
          };
        }
      }

      // Parameters
      for (const param of mod.parameters) {
        if (param.name === word) {
          return {
            name: param.name,
            kind: "parameter",
            location: {
              fileId: cursorFile.id,
              filename: cursorFile.filename,
              line: param.line,
              column: 1,
            },
            detail: `parameter ${param.name} = ${param.defaultValue ?? "?"}`,
          };
        }
      }

      // Instances
      for (const inst of mod.instances) {
        if (inst.instanceName === word) {
          return {
            name: inst.instanceName,
            kind: "instance",
            location: {
              fileId: cursorFile.id,
              filename: cursorFile.filename,
              line: inst.line,
              column: 1,
            },
            detail: `instance of ${inst.moduleName}`,
          };
        }
      }
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Find References                                                   */
/* ------------------------------------------------------------------ */

/**
 * Find all references to a symbol across all files.
 */
export function findReferences(
  word: string,
  allFiles: HdlFileInfo[],
): HdlReference[] {
  const refs: HdlReference[] = [];

  for (const file of allFiles) {
    if (!file.parseResult) {
      // Fallback: text search
      const lines = file.content.split("\n");
      const wordRe = new RegExp(`\\b${escapeRegex(word)}\\b`, "g");
      for (let i = 0; i < lines.length; i++) {
        if (wordRe.test(lines[i])) {
          refs.push({
            location: {
              fileId: file.id,
              filename: file.filename,
              line: i + 1,
              column: lines[i].indexOf(word) + 1,
            },
            kind: "usage",
            context: lines[i].trim(),
          });
        }
      }
      continue;
    }

    for (const mod of file.parseResult.modules) {
      // Module declaration
      if (mod.name === word) {
        refs.push({
          location: {
            fileId: file.id,
            filename: file.filename,
            line: mod.startLine,
            column: 1,
          },
          kind: "definition",
          context: `module ${mod.name}`,
        });
      }

      // Instances referencing the module
      for (const inst of mod.instances) {
        if (inst.moduleName === word) {
          refs.push({
            location: {
              fileId: file.id,
              filename: file.filename,
              line: inst.line,
              column: 1,
            },
            kind: "instantiation",
            context: `${inst.moduleName} ${inst.instanceName}`,
          });
        }

        // Connection references
        for (const [portName, netName] of Object.entries(inst.connections)) {
          if (portName === word || netName === word) {
            refs.push({
              location: {
                fileId: file.id,
                filename: file.filename,
                line: inst.line,
                column: 1,
              },
              kind: "connection",
              context: `.${portName}(${netName})`,
            });
          }
        }
      }

      // Port declarations
      for (const port of mod.ports) {
        if (port.name === word) {
          refs.push({
            location: {
              fileId: file.id,
              filename: file.filename,
              line: port.line,
              column: 1,
            },
            kind: "definition",
            context: `${port.direction} ${port.name}`,
          });
        }
      }

      // Signal declarations
      for (const sig of mod.signals) {
        if (sig.name === word) {
          refs.push({
            location: {
              fileId: file.id,
              filename: file.filename,
              line: sig.line,
              column: 1,
            },
            kind: "definition",
            context: `${sig.type} ${sig.name}`,
          });
        }
      }
    }

    // Also do a text-level search for usages not captured by the parser
    const lines = file.content.split("\n");
    const wordRe = new RegExp(`\\b${escapeRegex(word)}\\b`);
    for (let i = 0; i < lines.length; i++) {
      if (wordRe.test(lines[i])) {
        const lineNum = i + 1;
        // Don't duplicate entries we already have
        if (!refs.some((r) => r.location.fileId === file.id && r.location.line === lineNum)) {
          refs.push({
            location: {
              fileId: file.id,
              filename: file.filename,
              line: lineNum,
              column: lines[i].indexOf(word) + 1,
            },
            kind: "usage",
            context: lines[i].trim(),
          });
        }
      }
    }
  }

  return refs;
}

/* ------------------------------------------------------------------ */
/*  Symbol Outline (current file)                                     */
/* ------------------------------------------------------------------ */

/**
 * Get all symbols in a file for the outline/breadcrumb view.
 */
export function getFileSymbols(file: HdlFileInfo): HdlSymbol[] {
  if (!file.parseResult) return [];

  const symbols: HdlSymbol[] = [];

  for (const mod of file.parseResult.modules) {
    symbols.push({
      name: mod.name,
      kind: "module",
      detail: `(${mod.ports.length} ports, ${mod.instances.length} instances)`,
      fileId: file.id,
      filename: file.filename,
      line: mod.startLine,
    });

    for (const port of mod.ports) {
      symbols.push({
        name: port.name,
        kind: "port",
        detail: `${port.direction}${port.width > 1 ? ` [${port.width - 1}:0]` : ""}`,
        fileId: file.id,
        filename: file.filename,
        line: port.line,
        containerName: mod.name,
      });
    }

    for (const sig of mod.signals) {
      symbols.push({
        name: sig.name,
        kind: "signal",
        detail: `${sig.type}${sig.width > 1 ? ` [${sig.width - 1}:0]` : ""}`,
        fileId: file.id,
        filename: file.filename,
        line: sig.line,
        containerName: mod.name,
      });
    }

    for (const param of mod.parameters) {
      symbols.push({
        name: param.name,
        kind: "parameter",
        detail: `= ${param.defaultValue ?? "?"}`,
        fileId: file.id,
        filename: file.filename,
        line: param.line,
        containerName: mod.name,
      });
    }

    for (const inst of mod.instances) {
      symbols.push({
        name: inst.instanceName,
        kind: "instance",
        detail: `${inst.moduleName}`,
        fileId: file.id,
        filename: file.filename,
        line: inst.line,
        containerName: mod.name,
      });
    }
  }

  return symbols;
}

/* ------------------------------------------------------------------ */
/*  Workspace Symbol Search                                           */
/* ------------------------------------------------------------------ */

/**
 * Search for symbols across all files matching a query.
 */
export function searchWorkspaceSymbols(
  query: string,
  allFiles: HdlFileInfo[],
  maxResults = 50,
): HdlSymbol[] {
  const results: HdlSymbol[] = [];
  const queryLower = query.toLowerCase();

  for (const file of allFiles) {
    const symbols = getFileSymbols(file);
    for (const sym of symbols) {
      if (sym.name.toLowerCase().includes(queryLower)) {
        results.push(sym);
        if (results.length >= maxResults) return results;
      }
    }
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  Testbench Generator                                               */
/* ------------------------------------------------------------------ */

/**
 * Generate a testbench for a given module.
 */
export function generateTestbench(mod: HdlModule, language: "verilog" | "systemverilog" | "vhdl" = "verilog"): string {
  if (language === "vhdl") {
    return generateVhdlTestbench(mod);
  }

  const lines: string[] = [];
  const tbName = `tb_${mod.name}`;

  lines.push("`timescale 1ns/1ps");
  lines.push("");
  lines.push(`module ${tbName};`);
  lines.push("");

  // Declare signals matching DUT ports
  const hasClk = mod.ports.some((p) => /^clk|clock$/i.test(p.name));
  const hasRst = mod.ports.some((p) => /^rst|reset|rst_n|reset_n$/i.test(p.name));
  const rstPort = mod.ports.find((p) => /^rst|reset|rst_n|reset_n$/i.test(p.name));
  const isActiveLow = rstPort ? /_n$/i.test(rstPort.name) : true;

  lines.push("  // ── Testbench signals ──");
  for (const port of mod.ports) {
    const range = port.width > 1 ? ` [${port.width - 1}:0]` : "";
    if (port.direction === "input") {
      const init = /^clk|clock$/i.test(port.name) ? " = 0" : "";
      lines.push(`  reg ${range} ${port.name}${init};`);
    } else {
      lines.push(`  wire${range} ${port.name};`);
    }
  }

  lines.push("");

  // Clock generation
  if (hasClk) {
    const clkPort = mod.ports.find((p) => /^clk|clock$/i.test(p.name));
    if (clkPort) {
      lines.push("  // ── Clock generation (100 MHz) ──");
      lines.push(`  always #5 ${clkPort.name} = ~${clkPort.name};`);
      lines.push("");
    }
  }

  // DUT instantiation
  lines.push("  // ── DUT instantiation ──");
  lines.push(`  ${mod.name} u_dut (`);
  const portConns = mod.ports.map((p, i) =>
    `    .${p.name}(${p.name})${i < mod.ports.length - 1 ? "," : ""}`
  );
  lines.push(...portConns);
  lines.push("  );");
  lines.push("");

  // Initial block
  lines.push("  // ── Stimulus ──");
  lines.push("  initial begin");
  lines.push(`    $dumpfile("${tbName}.vcd");`);
  lines.push(`    $dumpvars(0, ${tbName});`);
  lines.push("");

  if (hasRst && rstPort) {
    lines.push("    // Reset sequence");
    lines.push(`    ${rstPort.name} = ${isActiveLow ? "0" : "1"};`);
    lines.push("    #20;");
    lines.push(`    ${rstPort.name} = ${isActiveLow ? "1" : "0"};`);
    lines.push("    #10;");
    lines.push("");
  }

  // Initialize inputs
  lines.push("    // Initialize inputs");
  for (const port of mod.ports) {
    if (port.direction === "input" && !/^clk|clock|rst|reset/i.test(port.name)) {
      lines.push(`    ${port.name} = ${port.width > 1 ? `${port.width}'d0` : "1'b0"};`);
    }
  }
  lines.push("");

  lines.push("    // TODO: Add test stimulus here");
  lines.push("    #100;");
  lines.push("");
  lines.push('    $display("Simulation complete");');
  lines.push("    $finish;");
  lines.push("  end");
  lines.push("");

  // Optional: monitor
  lines.push("  // ── Monitor ──");
  lines.push("  initial begin");
  const monSignals = mod.ports.slice(0, 6).map((p) => `${p.name}=%h`).join(", ");
  const monVars = mod.ports.slice(0, 6).map((p) => p.name).join(", ");
  lines.push(`    $monitor("t=%0t: ${monSignals}", $time, ${monVars});`);
  lines.push("  end");
  lines.push("");
  lines.push("endmodule");

  return lines.join("\n");
}

function generateVhdlTestbench(mod: HdlModule): string {
  const lines: string[] = [];
  const tbName = `tb_${mod.name}`;

  lines.push("library ieee;");
  lines.push("use ieee.std_logic_1164.all;");
  lines.push("use ieee.numeric_std.all;");
  lines.push("");
  lines.push(`entity ${tbName} is`);
  lines.push(`end entity ${tbName};`);
  lines.push("");
  lines.push(`architecture sim of ${tbName} is`);
  lines.push("");

  // Component declaration
  lines.push(`  component ${mod.name} is`);
  lines.push("    port (");
  mod.ports.forEach((p, i) => {
    const type = p.width > 1 ? `std_logic_vector(${p.width - 1} downto 0)` : "std_logic";
    const sep = i < mod.ports.length - 1 ? ";" : "";
    lines.push(`      ${p.name} : ${p.direction} ${type}${sep}`);
  });
  lines.push("    );");
  lines.push(`  end component ${mod.name};`);
  lines.push("");

  // Signal declarations
  const hasClk = mod.ports.some((p) => /^clk|clock$/i.test(p.name));
  const rstPort = mod.ports.find((p) => /^rst|reset|rst_n|reset_n$/i.test(p.name));

  for (const port of mod.ports) {
    const type = port.width > 1 ? `std_logic_vector(${port.width - 1} downto 0)` : "std_logic";
    const init = /^clk|clock$/i.test(port.name) ? " := '0'" : "";
    lines.push(`  signal ${port.name} : ${type}${init};`);
  }
  lines.push("");

  if (hasClk) {
    lines.push("  constant CLK_PERIOD : time := 10 ns;");
    lines.push("");
  }

  lines.push("begin");
  lines.push("");

  // DUT instantiation
  lines.push(`  u_dut: ${mod.name} port map (`);
  mod.ports.forEach((p, i) => {
    const sep = i < mod.ports.length - 1 ? "," : "";
    lines.push(`    ${p.name} => ${p.name}${sep}`);
  });
  lines.push("  );");
  lines.push("");

  // Clock process
  if (hasClk) {
    const clkPort = mod.ports.find((p) => /^clk|clock$/i.test(p.name));
    if (clkPort) {
      lines.push("  -- Clock generation");
      lines.push(`  clk_proc: process`);
      lines.push("  begin");
      lines.push(`    ${clkPort.name} <= '0';`);
      lines.push("    wait for CLK_PERIOD / 2;");
      lines.push(`    ${clkPort.name} <= '1';`);
      lines.push("    wait for CLK_PERIOD / 2;");
      lines.push("  end process;");
      lines.push("");
    }
  }

  // Stimulus process
  lines.push("  -- Stimulus");
  lines.push("  stim_proc: process");
  lines.push("  begin");
  if (rstPort) {
    const isActiveLow = /_n$/i.test(rstPort.name);
    lines.push(`    ${rstPort.name} <= '${isActiveLow ? "0" : "1"}';`);
    lines.push("    wait for 20 ns;");
    lines.push(`    ${rstPort.name} <= '${isActiveLow ? "1" : "0"}';`);
    lines.push("    wait for 10 ns;");
    lines.push("");
  }
  lines.push("    -- TODO: Add test stimulus here");
  lines.push("    wait for 100 ns;");
  lines.push("");
  lines.push('    report "Simulation complete" severity note;');
  lines.push("    wait;");
  lines.push("  end process;");
  lines.push("");
  lines.push(`end architecture sim;`);

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Hover Info                                                        */
/* ------------------------------------------------------------------ */

/**
 * Get hover information for a word at a cursor position.
 */
export function getHoverInfo(
  word: string,
  cursorFile: HdlFileInfo,
  cursorLine: number,
  allFiles: HdlFileInfo[],
): string | null {
  const def = goToDefinition(word, cursorFile, cursorLine, allFiles);
  if (!def) return null;

  switch (def.kind) {
    case "module":
      return `**module** \`${def.name}\`\n\n${def.detail}\n\nDefined in ${def.location.filename}:${def.location.line}`;
    case "port":
      return `**port** \`${def.detail}\``;
    case "signal":
      return `**signal** \`${def.detail}\``;
    case "parameter":
      return `**parameter** \`${def.detail}\``;
    case "instance":
      return `**instance** \`${def.name}\` — ${def.detail}`;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get the word at a cursor position in a line of text.
 */
export function getWordAtPosition(lineText: string, column: number): string {
  const pos = column - 1; // 0-based index
  if (pos < 0 || pos >= lineText.length) return "";

  // Find word boundaries
  let start = pos;
  let end = pos;
  const wordRe = /[\w$]/;

  while (start > 0 && wordRe.test(lineText[start - 1])) start--;
  while (end < lineText.length - 1 && wordRe.test(lineText[end + 1])) end++;

  return lineText.substring(start, end + 1);
}
