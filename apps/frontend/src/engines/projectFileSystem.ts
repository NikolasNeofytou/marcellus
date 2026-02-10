/**
 * Project File System — Abstraction for browsing/reading/creating project files.
 *
 * In Tauri mode: uses the native Rust FS commands via IPC.
 * In browser-dev mode: uses an in-memory virtual file system with demo project structure
 * plus optional File System Access API for real files.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  /** Size in bytes (files only) */
  size?: number;
  /** Extension without dot */
  extension?: string;
  /** Whether this is expanded in the tree view */
  expanded?: boolean;
}

export type FileLanguage =
  | "verilog"
  | "systemverilog"
  | "vhdl"
  | "spice"
  | "tcl"
  | "sdc"
  | "xdc"
  | "makefile"
  | "markdown"
  | "json"
  | "yaml"
  | "toml"
  | "c"
  | "cpp"
  | "python"
  | "text"
  | "gds"
  | "lef"
  | "def"
  | "lib"
  | "unknown";

export interface FileContent {
  path: string;
  content: string;
  language: FileLanguage;
  size: number;
}

/* ------------------------------------------------------------------ */
/*  Language detection                                                */
/* ------------------------------------------------------------------ */

const EXTENSION_MAP: Record<string, FileLanguage> = {
  v: "verilog",
  vh: "verilog",
  sv: "systemverilog",
  svh: "systemverilog",
  vhd: "vhdl",
  vhdl: "vhdl",
  spi: "spice",
  spice: "spice",
  cir: "spice",
  sp: "spice",
  cdl: "spice",
  tcl: "tcl",
  sdc: "sdc",
  xdc: "xdc",
  mk: "makefile",
  md: "markdown",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  py: "python",
  txt: "text",
  log: "text",
  gds: "gds",
  gds2: "gds",
  lef: "lef",
  def: "def",
  lib: "lib",
};

export function detectFileLanguage(filename: string): FileLanguage {
  if (filename.toLowerCase() === "makefile") return "makefile";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "unknown";
}

export function isHdlExtension(ext: string): boolean {
  const hdl = ["v", "vh", "sv", "svh", "vhd", "vhdl"];
  return hdl.includes(ext.toLowerCase());
}

export function isTextFile(filename: string): boolean {
  const lang = detectFileLanguage(filename);
  return lang !== "gds" && lang !== "unknown";
}

/* ------------------------------------------------------------------ */
/*  Icon mapping                                                      */
/* ------------------------------------------------------------------ */

export function getFileIcon(filename: string): string {
  const lang = detectFileLanguage(filename);
  switch (lang) {
    case "verilog":
    case "systemverilog":
      return "📄"; // or a custom icon name
    case "vhdl":
      return "📄";
    case "spice":
      return "⚡";
    case "tcl":
    case "sdc":
    case "xdc":
      return "⏱️";
    case "makefile":
      return "🔧";
    case "markdown":
      return "📝";
    case "json":
    case "yaml":
    case "toml":
      return "⚙️";
    case "c":
    case "cpp":
      return "🔤";
    case "python":
      return "🐍";
    case "gds":
      return "🏗️";
    case "lef":
    case "def":
    case "lib":
      return "📐";
    default:
      return "📄";
  }
}

/* ------------------------------------------------------------------ */
/*  In-Memory Virtual File System (browser dev mode)                  */
/* ------------------------------------------------------------------ */

class VirtualFileSystem {
  private files = new Map<string, string>();

  constructor() {
    // Initialize with a demo project structure
    this.initDemoProject();
  }

  private initDemoProject() {
    this.files.set("/project/rtl/top.v", [
      "module top (",
      "  input  wire       clk,",
      "  input  wire       rst_n,",
      "  input  wire [7:0] data_in,",
      "  output wire [7:0] data_out,",
      "  output wire       valid",
      ");",
      "",
      "  wire [7:0] processed;",
      "  wire       proc_valid;",
      "",
      "  processor u_proc (",
      "    .clk      (clk),",
      "    .rst_n    (rst_n),",
      "    .data_in  (data_in),",
      "    .data_out (processed),",
      "    .valid    (proc_valid)",
      "  );",
      "",
      "  output_stage u_out (",
      "    .clk      (clk),",
      "    .rst_n    (rst_n),",
      "    .data_in  (processed),",
      "    .valid_in (proc_valid),",
      "    .data_out (data_out),",
      "    .valid    (valid)",
      "  );",
      "",
      "endmodule",
    ].join("\n"));

    this.files.set("/project/rtl/processor.sv", [
      "module processor (",
      "  input  logic       clk,",
      "  input  logic       rst_n,",
      "  input  logic [7:0] data_in,",
      "  output logic [7:0] data_out,",
      "  output logic       valid",
      ");",
      "",
      "  logic [7:0] pipe_reg;",
      "  logic       pipe_valid;",
      "",
      "  always_ff @(posedge clk or negedge rst_n) begin",
      "    if (!rst_n) begin",
      "      pipe_reg   <= 8'd0;",
      "      pipe_valid <= 1'b0;",
      "    end else begin",
      "      pipe_reg   <= data_in + 8'd1;",
      "      pipe_valid <= 1'b1;",
      "    end",
      "  end",
      "",
      "  assign data_out = pipe_reg;",
      "  assign valid    = pipe_valid;",
      "",
      "endmodule",
    ].join("\n"));

    this.files.set("/project/rtl/output_stage.v", [
      "module output_stage (",
      "  input  wire       clk,",
      "  input  wire       rst_n,",
      "  input  wire [7:0] data_in,",
      "  input  wire       valid_in,",
      "  output reg  [7:0] data_out,",
      "  output reg        valid",
      ");",
      "",
      "  always @(posedge clk or negedge rst_n) begin",
      "    if (!rst_n) begin",
      "      data_out <= 8'd0;",
      "      valid    <= 1'b0;",
      "    end else if (valid_in) begin",
      "      data_out <= data_in;",
      "      valid    <= 1'b1;",
      "    end else begin",
      "      valid <= 1'b0;",
      "    end",
      "  end",
      "",
      "endmodule",
    ].join("\n"));

    this.files.set("/project/tb/tb_top.v", [
      "`timescale 1ns/1ps",
      "",
      "module tb_top;",
      "",
      "  reg       clk = 0;",
      "  reg       rst_n = 0;",
      "  reg [7:0] data_in;",
      "  wire [7:0] data_out;",
      "  wire valid;",
      "",
      "  always #5 clk = ~clk;",
      "",
      "  top u_dut (",
      "    .clk      (clk),",
      "    .rst_n    (rst_n),",
      "    .data_in  (data_in),",
      "    .data_out (data_out),",
      "    .valid    (valid)",
      "  );",
      "",
      "  initial begin",
      '    $dumpfile("tb_top.vcd");',
      "    $dumpvars(0, tb_top);",
      "",
      "    data_in = 8'd0;",
      "    #20; rst_n = 1;",
      "",
      "    repeat(10) begin",
      "      @(posedge clk);",
      "      data_in = $urandom_range(0, 255);",
      "    end",
      "",
      "    #50;",
      '    $display("Test complete");',
      "    $finish;",
      "  end",
      "",
      "endmodule",
    ].join("\n"));

    this.files.set("/project/constraints/timing.sdc", [
      "# Clock definition",
      "create_clock -period 10.0 [get_ports clk]",
      "",
      "# Input/output delays",
      "set_input_delay  -clock clk 2.0 [all_inputs]",
      "set_output_delay -clock clk 2.0 [all_outputs]",
      "",
      "# False paths",
      "set_false_path -from [get_ports rst_n]",
    ].join("\n"));

    this.files.set("/project/sim/Makefile", [
      "# Simulation Makefile",
      "IVERILOG = iverilog",
      "VVP = vvp",
      "GTKWAVE = gtkwave",
      "",
      "RTL_SRC = ../rtl/top.v ../rtl/processor.sv ../rtl/output_stage.v",
      "TB_SRC  = ../tb/tb_top.v",
      "",
      ".PHONY: sim wave clean",
      "",
      "sim: tb_top.vcd",
      "",
      "tb_top.vvp: $(RTL_SRC) $(TB_SRC)",
      "\t$(IVERILOG) -g2012 -o $@ $^",
      "",
      "tb_top.vcd: tb_top.vvp",
      "\t$(VVP) $<",
      "",
      "wave: tb_top.vcd",
      "\t$(GTKWAVE) $<",
      "",
      "clean:",
      "\trm -f *.vvp *.vcd",
    ].join("\n"));

    this.files.set("/project/spice/inverter.spice", [
      "* CMOS Inverter",
      ".include '../models/sky130.lib'",
      "",
      ".subckt inverter in out vdd vss",
      "M1 out in vdd vdd sky130_fd_pr__pfet_01v8 w=1u l=0.15u",
      "M2 out in vss vss sky130_fd_pr__nfet_01v8 w=0.5u l=0.15u",
      ".ends inverter",
      "",
      ".end",
    ].join("\n"));

    this.files.set("/project/README.md", [
      "# Demo Project",
      "",
      "A simple data processing pipeline demonstrating the OpenSilicon IDE.",
      "",
      "## Structure",
      "",
      "- `rtl/` — RTL source files (Verilog/SystemVerilog)",
      "- `tb/` — Testbench files",
      "- `constraints/` — Timing constraints (SDC)",
      "- `sim/` — Simulation scripts",
      "- `spice/` — SPICE netlists",
    ].join("\n"));
  }

  listDirectory(path: string): FileNode[] {
    const normalizedPath = path.endsWith("/") ? path : path + "/";
    const entries = new Map<string, FileNode>();

    for (const [filePath] of this.files) {
      if (!filePath.startsWith(normalizedPath)) continue;

      const relative = filePath.slice(normalizedPath.length);
      const parts = relative.split("/");

      if (parts.length === 1) {
        // Direct file
        const name = parts[0];
        entries.set(name, {
          name,
          path: filePath,
          type: "file",
          size: this.files.get(filePath)?.length ?? 0,
          extension: name.split(".").pop() ?? "",
        });
      } else if (parts.length > 1) {
        // Subdirectory
        const dirName = parts[0];
        if (!entries.has(dirName)) {
          entries.set(dirName, {
            name: dirName,
            path: normalizedPath + dirName,
            type: "directory",
          });
        }
      }
    }

    // Sort: directories first, then alphabetical
    return Array.from(entries.values()).sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  readFile(path: string): string | null {
    return this.files.get(path) ?? null;
  }

  writeFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  createFile(path: string, content = ""): void {
    this.files.set(path, content);
  }

  deleteFile(path: string): void {
    // Delete file and all children (for directories)
    const prefix = path.endsWith("/") ? path : path + "/";
    const keysToDelete: string[] = [];
    for (const key of this.files.keys()) {
      if (key === path || key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.files.delete(key);
    }
  }

  renameFile(oldPath: string, newPath: string): void {
    const content = this.files.get(oldPath);
    if (content !== undefined) {
      this.files.delete(oldPath);
      this.files.set(newPath, content);
    }
  }

  exists(path: string): boolean {
    if (this.files.has(path)) return true;
    // Check if it's a directory
    const prefix = path.endsWith("/") ? path : path + "/";
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  }

  getAllFilePaths(): string[] {
    return Array.from(this.files.keys());
  }

  /** Search for files matching a text query across all files */
  searchContent(query: string, options: { regex?: boolean; caseSensitive?: boolean; filePattern?: string } = {}): SearchResult[] {
    const results: SearchResult[] = [];
    const isRegex = options.regex ?? false;
    const caseSensitive = options.caseSensitive ?? false;

    let searchRe: RegExp;
    try {
      searchRe = isRegex
        ? new RegExp(query, caseSensitive ? "g" : "gi")
        : new RegExp(escapeRegex(query), caseSensitive ? "g" : "gi");
    } catch {
      return [];
    }

    const filePatternRe = options.filePattern
      ? new RegExp(globToRegex(options.filePattern), "i")
      : null;

    for (const [filePath, content] of this.files) {
      if (filePatternRe && !filePatternRe.test(filePath)) continue;

      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        searchRe.lastIndex = 0;
        const match = searchRe.exec(line);
        if (match) {
          results.push({
            filePath,
            filename: filePath.split("/").pop() ?? "",
            line: i + 1,
            column: match.index + 1,
            matchLength: match[0].length,
            lineText: line,
            beforeContext: lines.slice(Math.max(0, i - 1), i).join("\n"),
            afterContext: lines.slice(i + 1, Math.min(lines.length, i + 2)).join("\n"),
          });
        }
      }
    }

    return results;
  }

  buildFileTree(): FileNode {
    const root: FileNode = {
      name: "project",
      path: "/project",
      type: "directory",
      expanded: true,
      children: this.buildTreeNode("/project"),
    };
    return root;
  }

  private buildTreeNode(path: string): FileNode[] {
    const entries = this.listDirectory(path);
    return entries.map((entry) => {
      if (entry.type === "directory") {
        return {
          ...entry,
          expanded: false,
          children: this.buildTreeNode(entry.path),
        };
      }
      return entry;
    });
  }
}

/* ------------------------------------------------------------------ */
/*  Search result type                                                */
/* ------------------------------------------------------------------ */

export interface SearchResult {
  filePath: string;
  filename: string;
  line: number;
  column: number;
  matchLength: number;
  lineText: string;
  beforeContext: string;
  afterContext: string;
}

/* ------------------------------------------------------------------ */
/*  Singleton instance                                                */
/* ------------------------------------------------------------------ */

let vfsInstance: VirtualFileSystem | null = null;

export function getVirtualFileSystem(): VirtualFileSystem {
  if (!vfsInstance) {
    vfsInstance = new VirtualFileSystem();
  }
  return vfsInstance;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegex(glob: string): string {
  return glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
}
