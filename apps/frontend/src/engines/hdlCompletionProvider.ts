/**
 * HDL Completion Provider — IntelliSense for Verilog/SystemVerilog/VHDL.
 *
 * Provides context-aware completions:
 * - Language keywords
 * - Module/entity names from parsed files
 * - Port names when inside an instantiation
 * - Signal/wire/reg names from the current module scope
 * - Parameter names
 * - System tasks ($display, $finish, etc.)
 * - Common HDL snippets (always blocks, FSM templates, etc.)
 */

import type { HdlModule, HdlLanguage } from "./hdlParser";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type CompletionKind =
  | "keyword"
  | "module"
  | "port"
  | "signal"
  | "parameter"
  | "systemTask"
  | "snippet"
  | "type"
  | "directive"
  | "instance";

export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  detail?: string;
  insertText: string;
  /** For snippets: cursor placeholder positions, e.g. ${1:name} */
  isSnippet?: boolean;
  /** Sort priority (lower = higher priority) */
  sortOrder: number;
  /** Documentation */
  documentation?: string;
}

export interface CompletionContext {
  /** The line text before the cursor */
  linePrefix: string;
  /** Full source code */
  source: string;
  /** Cursor line (1-based) */
  line: number;
  /** Cursor column (1-based) */
  column: number;
  /** The word fragment being typed */
  prefix: string;
  /** Language */
  language: HdlLanguage;
  /** All parsed modules across all open files */
  allModules: HdlModule[];
}

/* ------------------------------------------------------------------ */
/*  Keyword sets                                                      */
/* ------------------------------------------------------------------ */

const VERILOG_KEYWORDS_LIST: readonly string[] = [
  "module", "endmodule", "input", "output", "inout", "wire", "reg", "logic",
  "integer", "real", "assign", "always", "initial", "begin", "end",
  "if", "else", "case", "endcase", "casex", "casez", "default",
  "for", "while", "repeat", "forever", "generate", "endgenerate",
  "function", "endfunction", "task", "endtask", "parameter", "localparam",
  "genvar", "posedge", "negedge", "or", "and", "not",
  "supply0", "supply1", "tri", "wand", "wor", "signed", "unsigned",
];

const SV_KEYWORDS_LIST: readonly string[] = [
  ...VERILOG_KEYWORDS_LIST,
  "always_ff", "always_comb", "always_latch",
  "typedef", "struct", "enum", "union", "packed",
  "interface", "endinterface", "modport",
  "class", "endclass", "extends", "virtual", "pure", "extern",
  "import", "export", "package", "endpackage",
  "program", "endprogram", "property", "endproperty",
  "assert", "assume", "cover", "sequence", "endsequence",
  "clocking", "endclocking", "constraint", "rand", "randc",
  "bit", "byte", "shortint", "int", "longint", "shortreal", "string", "void",
  "return", "break", "continue", "fork", "join", "join_any", "join_none",
  "disable", "wait", "event", "unique", "priority",
  "inside", "iff", "throughout", "intersect",
  "covergroup", "endgroup", "coverpoint", "cross",
  "bins", "illegal_bins", "ignore_bins",
];

const VHDL_KEYWORDS_LIST: readonly string[] = [
  "library", "use", "entity", "is", "end", "architecture", "of", "begin",
  "port", "generic", "map", "signal", "variable", "constant", "type",
  "subtype", "array", "record", "process", "if", "then", "elsif", "else",
  "case", "when", "for", "loop", "while", "generate", "component",
  "function", "procedure", "return", "package", "body",
  "in", "out", "inout", "buffer", "downto", "to", "others", "all", "open",
  "with", "select", "after", "wait", "until", "on",
  "rising_edge", "falling_edge",
  "not", "and", "or", "xor", "nand", "nor", "xnor",
  "mod", "rem", "abs", "report", "severity", "assert", "null",
  "exit", "next", "file", "shared", "impure", "pure",
  "range", "attribute", "alias", "configuration", "block", "postponed",
];

const SYSTEM_TASKS: readonly string[] = [
  "$display", "$write", "$strobe", "$monitor",
  "$finish", "$stop", "$fatal", "$error", "$warning", "$info",
  "$time", "$stime", "$realtime",
  "$random", "$urandom", "$urandom_range",
  "$readmemh", "$readmemb", "$writememh", "$writememb",
  "$fopen", "$fclose", "$fwrite", "$fdisplay", "$fscanf", "$fgets",
  "$signed", "$unsigned", "$clog2", "$bits", "$size",
  "$countones", "$onehot", "$onehot0", "$isunknown",
  "$dumpfile", "$dumpvars", "$dumpoff", "$dumpon", "$dumpall",
  "$value$plusargs", "$test$plusargs",
  "$cast", "$typename",
];

const VHDL_TYPES: readonly string[] = [
  "std_logic", "std_logic_vector", "std_ulogic", "std_ulogic_vector",
  "signed", "unsigned", "integer", "natural", "positive",
  "boolean", "bit", "bit_vector", "real", "time", "string",
  "character", "severity_level",
];

/* ------------------------------------------------------------------ */
/*  Snippets                                                          */
/* ------------------------------------------------------------------ */

interface SnippetDef {
  label: string;
  detail: string;
  insertText: string;
  language: "verilog" | "systemverilog" | "vhdl" | "any";
  doc: string;
}

const SNIPPETS: readonly SnippetDef[] = [
  // Verilog/SV snippets
  {
    label: "always_ff",
    detail: "Sequential always block",
    insertText: "always_ff @(posedge clk or negedge rst_n) begin\n  if (!rst_n) begin\n    \n  end else begin\n    \n  end\nend",
    language: "systemverilog",
    doc: "SystemVerilog sequential always block with async reset",
  },
  {
    label: "always_comb",
    detail: "Combinational always block",
    insertText: "always_comb begin\n  \nend",
    language: "systemverilog",
    doc: "SystemVerilog combinational always block",
  },
  {
    label: "always @*",
    detail: "Combinational always block (Verilog)",
    insertText: "always @(*) begin\n  \nend",
    language: "verilog",
    doc: "Verilog combinational always block",
  },
  {
    label: "always @(posedge clk)",
    detail: "Sequential always block (Verilog)",
    insertText: "always @(posedge clk or negedge rst_n) begin\n  if (!rst_n) begin\n    \n  end else begin\n    \n  end\nend",
    language: "verilog",
    doc: "Verilog sequential always block with async reset",
  },
  {
    label: "module",
    detail: "Module declaration",
    insertText: "module module_name (\n  input  wire clk,\n  input  wire rst_n,\n  input  wire [7:0] data_in,\n  output reg  [7:0] data_out\n);\n\n  \n\nendmodule",
    language: "verilog",
    doc: "Complete module declaration template",
  },
  {
    label: "fsm",
    detail: "FSM template (3-block)",
    insertText: [
      "// State encoding",
      "typedef enum logic [1:0] {",
      "  IDLE  = 2'b00,",
      "  WAIT  = 2'b01,",
      "  DONE  = 2'b10",
      "} state_t;",
      "",
      "state_t state, next_state;",
      "",
      "// State register",
      "always_ff @(posedge clk or negedge rst_n) begin",
      "  if (!rst_n)",
      "    state <= IDLE;",
      "  else",
      "    state <= next_state;",
      "end",
      "",
      "// Next-state logic",
      "always_comb begin",
      "  next_state = state;",
      "  case (state)",
      "    IDLE: if (start) next_state = WAIT;",
      "    WAIT: if (done)  next_state = DONE;",
      "    DONE:            next_state = IDLE;",
      "    default:         next_state = IDLE;",
      "  endcase",
      "end",
      "",
      "// Output logic",
      "always_comb begin",
      "  busy = (state != IDLE);",
      "end",
    ].join("\n"),
    language: "systemverilog",
    doc: "Three-block FSM template with state register, next-state logic, and output logic",
  },
  {
    label: "counter",
    detail: "Simple counter",
    insertText: [
      "logic [7:0] count;",
      "",
      "always_ff @(posedge clk or negedge rst_n) begin",
      "  if (!rst_n)",
      "    count <= 8'd0;",
      "  else if (en)",
      "    count <= count + 8'd1;",
      "end",
    ].join("\n"),
    language: "systemverilog",
    doc: "Simple 8-bit counter with enable and async reset",
  },
  {
    label: "fifo",
    detail: "Synchronous FIFO skeleton",
    insertText: [
      "module sync_fifo #(",
      "  parameter DEPTH = 16,",
      "  parameter WIDTH = 8",
      ") (",
      "  input  wire             clk,",
      "  input  wire             rst_n,",
      "  input  wire             wr_en,",
      "  input  wire [WIDTH-1:0] wr_data,",
      "  input  wire             rd_en,",
      "  output wire [WIDTH-1:0] rd_data,",
      "  output wire             full,",
      "  output wire             empty",
      ");",
      "",
      "  localparam ADDR_W = $clog2(DEPTH);",
      "",
      "  reg [WIDTH-1:0] mem [0:DEPTH-1];",
      "  reg [ADDR_W:0]  wr_ptr, rd_ptr;",
      "",
      "  assign full  = (wr_ptr[ADDR_W] != rd_ptr[ADDR_W]) &&",
      "                 (wr_ptr[ADDR_W-1:0] == rd_ptr[ADDR_W-1:0]);",
      "  assign empty = (wr_ptr == rd_ptr);",
      "  assign rd_data = mem[rd_ptr[ADDR_W-1:0]];",
      "",
      "  always @(posedge clk or negedge rst_n) begin",
      "    if (!rst_n) begin",
      "      wr_ptr <= 0;",
      "      rd_ptr <= 0;",
      "    end else begin",
      "      if (wr_en && !full) begin",
      "        mem[wr_ptr[ADDR_W-1:0]] <= wr_data;",
      "        wr_ptr <= wr_ptr + 1;",
      "      end",
      "      if (rd_en && !empty)",
      "        rd_ptr <= rd_ptr + 1;",
      "    end",
      "  end",
      "",
      "endmodule",
    ].join("\n"),
    language: "verilog",
    doc: "Synchronous FIFO with parameterizable depth and width",
  },
  {
    label: "testbench",
    detail: "Testbench skeleton",
    insertText: [
      "`timescale 1ns/1ps",
      "",
      "module tb_top;",
      "",
      "  // Clock & reset",
      "  reg clk = 0;",
      "  reg rst_n = 0;",
      "",
      "  always #5 clk = ~clk; // 100 MHz",
      "",
      "  // DUT signals",
      "  wire [7:0] data_out;",
      "",
      "  // DUT instantiation",
      "  // dut u_dut (",
      "  //   .clk     (clk),",
      "  //   .rst_n   (rst_n),",
      "  //   .data_out(data_out)",
      "  // );",
      "",
      "  initial begin",
      "    $dumpfile(\"dump.vcd\");",
      "    $dumpvars(0, tb_top);",
      "",
      "    // Reset",
      "    rst_n = 0;",
      "    #20;",
      "    rst_n = 1;",
      "",
      "    // Test stimulus",
      "    #100;",
      "",
      "    $display(\"Test passed!\");",
      "    $finish;",
      "  end",
      "",
      "endmodule",
    ].join("\n"),
    language: "verilog",
    doc: "Complete testbench skeleton with clock generation, VCD dumping, and reset",
  },
  {
    label: "cdc_sync",
    detail: "Clock Domain Crossing synchronizer",
    insertText: [
      "// 2-FF synchronizer for CDC",
      "module cdc_sync #(",
      "  parameter WIDTH = 1",
      ") (",
      "  input  wire             clk_dst,",
      "  input  wire             rst_n,",
      "  input  wire [WIDTH-1:0] data_in,",
      "  output wire [WIDTH-1:0] data_out",
      ");",
      "",
      "  (* ASYNC_REG = \"TRUE\" *) reg [WIDTH-1:0] sync_ff1, sync_ff2;",
      "",
      "  always @(posedge clk_dst or negedge rst_n) begin",
      "    if (!rst_n) begin",
      "      sync_ff1 <= {WIDTH{1'b0}};",
      "      sync_ff2 <= {WIDTH{1'b0}};",
      "    end else begin",
      "      sync_ff1 <= data_in;",
      "      sync_ff2 <= sync_ff1;",
      "    end",
      "  end",
      "",
      "  assign data_out = sync_ff2;",
      "",
      "endmodule",
    ].join("\n"),
    language: "verilog",
    doc: "2-FF CDC synchronizer with parameterizable width",
  },
  // VHDL snippets
  {
    label: "process_clk",
    detail: "Clocked process",
    insertText: [
      "process(clk, rst_n)",
      "begin",
      "  if rst_n = '0' then",
      "    ",
      "  elsif rising_edge(clk) then",
      "    ",
      "  end if;",
      "end process;",
    ].join("\n"),
    language: "vhdl",
    doc: "VHDL clocked process with async reset",
  },
  {
    label: "process_comb",
    detail: "Combinational process",
    insertText: [
      "process(all)",
      "begin",
      "  ",
      "end process;",
    ].join("\n"),
    language: "vhdl",
    doc: "VHDL combinational process with sensitivity list 'all' (VHDL-2008)",
  },
  {
    label: "entity",
    detail: "Entity declaration",
    insertText: [
      "entity entity_name is",
      "  port (",
      "    clk    : in  std_logic;",
      "    rst_n  : in  std_logic;",
      "    data_i : in  std_logic_vector(7 downto 0);",
      "    data_o : out std_logic_vector(7 downto 0)",
      "  );",
      "end entity entity_name;",
      "",
      "architecture rtl of entity_name is",
      "begin",
      "",
      "end architecture rtl;",
    ].join("\n"),
    language: "vhdl",
    doc: "VHDL entity + architecture template",
  },
];

/* ------------------------------------------------------------------ */
/*  Context analysis                                                  */
/* ------------------------------------------------------------------ */

function findCurrentModule(source: string, line: number, lang: HdlLanguage): HdlModule | null {
  // Simple heuristic: find the nearest module/entity declaration before cursor
  const lines = source.split("\n").slice(0, line);
  const text = lines.join("\n");

  if (lang === "vhdl") {
    const m = /entity\s+(\w+)\s+is/gi.exec(text);
    return m ? { name: m[1] } as HdlModule : null;
  }
  // Find last module declaration before cursor
  const re = /module\s+(\w+)/gi;
  let last: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) last = match;
  return last ? { name: last[1] } as HdlModule : null;
}

function isInsideInstantiation(linePrefix: string): string | null {
  // Check if we're inside .portName(signal) context
  // e.g., "  .data_in(" or "    .clk  ("
  const m = linePrefix.match(/\.(\w*)$/);
  if (m) return m[1]; // partial port name
  return null;
}

function isAfterDot(linePrefix: string): boolean {
  return /\.\w*$/.test(linePrefix);
}

/* ------------------------------------------------------------------ */
/*  Main completion function                                          */
/* ------------------------------------------------------------------ */

/**
 * Get completion items at the given cursor position.
 */
export function getCompletions(ctx: CompletionContext): CompletionItem[] {
  const items: CompletionItem[] = [];
  const prefix = ctx.prefix.toLowerCase();

  // ── 1. Port connections inside instantiation ──
  if (isAfterDot(ctx.linePrefix)) {
    // Look for the module being instantiated
    // Parse backwards to find "module_name instance_name ("
    const textBefore = ctx.source.split("\n").slice(0, ctx.line - 1).join("\n") + "\n" + ctx.linePrefix;
    const instMatch = textBefore.match(/(\w+)\s+\w+\s*\([^)]*$/s);
    if (instMatch) {
      const moduleName = instMatch[1];
      const mod = ctx.allModules.find((m) => m.name === moduleName);
      if (mod) {
        for (const port of mod.ports) {
          const portPrefix = isInsideInstantiation(ctx.linePrefix) ?? "";
          if (port.name.toLowerCase().startsWith(portPrefix.toLowerCase())) {
            items.push({
              label: port.name,
              kind: "port",
              detail: `${port.direction} ${port.width > 1 ? `[${port.width - 1}:0] ` : ""}${port.name}`,
              insertText: port.name,
              sortOrder: 0,
              documentation: `Port of module ${mod.name}`,
            });
          }
        }
      }
    }
    if (items.length > 0) return items;
  }

  // ── 2. System tasks (after $) ──
  if (ctx.linePrefix.endsWith("$") || prefix.startsWith("$")) {
    for (const task of SYSTEM_TASKS) {
      if (task.toLowerCase().startsWith(prefix) || (prefix.startsWith("$") && task.toLowerCase().startsWith(prefix))) {
        items.push({
          label: task,
          kind: "systemTask",
          detail: "System task/function",
          insertText: task,
          sortOrder: 2,
        });
      }
    }
    if (items.length > 0) return items;
  }

  // ── 3. Signals/wires/regs from current module scope ──
  const currentModuleName = findCurrentModule(ctx.source, ctx.line, ctx.language);
  if (currentModuleName) {
    const currentMod = ctx.allModules.find((m) => m.name === currentModuleName.name);
    if (currentMod) {
      // Ports
      for (const port of currentMod.ports) {
        if (port.name.toLowerCase().startsWith(prefix)) {
          items.push({
            label: port.name,
            kind: "port",
            detail: `${port.direction}${port.width > 1 ? ` [${port.width - 1}:0]` : ""}`,
            insertText: port.name,
            sortOrder: 1,
            documentation: `Port of current module`,
          });
        }
      }
      // Signals
      for (const sig of currentMod.signals) {
        if (sig.name.toLowerCase().startsWith(prefix)) {
          items.push({
            label: sig.name,
            kind: "signal",
            detail: `${sig.type}${sig.width > 1 ? ` [${sig.width - 1}:0]` : ""}`,
            insertText: sig.name,
            sortOrder: 1,
          });
        }
      }
      // Parameters
      for (const param of currentMod.parameters) {
        if (param.name.toLowerCase().startsWith(prefix)) {
          items.push({
            label: param.name,
            kind: "parameter",
            detail: `parameter = ${param.defaultValue ?? "?"}`,
            insertText: param.name,
            sortOrder: 1,
          });
        }
      }
    }
  }

  // ── 4. Module/entity names for instantiation ──
  for (const mod of ctx.allModules) {
    if (mod.name.toLowerCase().startsWith(prefix)) {
      const portList = mod.ports.map((p) => `.${p.name}(${p.name})`).join(",\n    ");
      items.push({
        label: mod.name,
        kind: "module",
        detail: `module (${mod.ports.length} ports)`,
        insertText: `${mod.name} u_${mod.name} (\n    ${portList}\n  );`,
        isSnippet: true,
        sortOrder: 3,
        documentation: `Instantiate module ${mod.name}`,
      });
    }
  }

  // ── 5. Snippets ──
  for (const snip of SNIPPETS) {
    if (snip.language !== "any" && snip.language !== ctx.language) {
      // "verilog" snippets also apply to "systemverilog"
      if (!(snip.language === "verilog" && ctx.language === "systemverilog")) continue;
    }
    if (snip.label.toLowerCase().startsWith(prefix) || prefix.length === 0) {
      items.push({
        label: snip.label,
        kind: "snippet",
        detail: snip.detail,
        insertText: snip.insertText,
        isSnippet: true,
        sortOrder: 5,
        documentation: snip.doc,
      });
    }
  }

  // ── 6. Keywords ──
  const keywordList =
    ctx.language === "vhdl"
      ? VHDL_KEYWORDS_LIST
      : ctx.language === "systemverilog"
        ? SV_KEYWORDS_LIST
        : VERILOG_KEYWORDS_LIST;

  for (const kw of keywordList) {
    if (kw.toLowerCase().startsWith(prefix) && prefix.length >= 2) {
      items.push({
        label: kw,
        kind: "keyword",
        detail: "keyword",
        insertText: kw,
        sortOrder: 6,
      });
    }
  }

  // ── 7. VHDL types ──
  if (ctx.language === "vhdl") {
    for (const type of VHDL_TYPES) {
      if (type.toLowerCase().startsWith(prefix) && prefix.length >= 2) {
        items.push({
          label: type,
          kind: "type",
          detail: "VHDL type",
          insertText: type,
          sortOrder: 4,
        });
      }
    }
  }

  // Sort and deduplicate
  items.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  });
}

/**
 * Extract the current word prefix at the cursor position.
 */
export function getWordPrefix(lineText: string, column: number): string {
  const beforeCursor = lineText.substring(0, column - 1);
  const m = beforeCursor.match(/([\w$.]*)$/);
  return m ? m[1] : "";
}
