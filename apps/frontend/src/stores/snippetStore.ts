/**
 * Snippet Store — HDL code snippet manager.
 *
 * Ships built-in HDL snippets for Verilog / SystemVerilog / VHDL and
 * lets users create custom snippets.  Snippets can be inserted from
 * the sidebar panel or via autocomplete using a prefix trigger.
 */

import { create } from "zustand";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type HdlLanguage = "verilog" | "systemverilog" | "vhdl";

export interface Snippet {
  id: string;
  name: string;
  prefix: string;          // trigger text for autocomplete
  body: string;            // may contain $1 $2 $0 tabstops
  description: string;
  language: HdlLanguage;
  category: string;
  builtIn: boolean;
}

export interface SnippetState {
  snippets: Snippet[];
  searchQuery: string;
  activeCategory: string | null;
  activeLanguage: HdlLanguage | null;

  // Actions
  addSnippet: (snippet: Omit<Snippet, "id" | "builtIn">) => void;
  removeSnippet: (id: string) => void;
  updateSnippet: (id: string, patch: Partial<Omit<Snippet, "id" | "builtIn">>) => void;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (cat: string | null) => void;
  setActiveLanguage: (lang: HdlLanguage | null) => void;
  getFilteredSnippets: () => Snippet[];
  getCategories: () => string[];
  getSnippetsForAutocomplete: (language: HdlLanguage, prefix: string) => Snippet[];
  expandSnippet: (snippet: Snippet) => string;
}

/* ------------------------------------------------------------------ */
/*  Built-in snippets                                                 */
/* ------------------------------------------------------------------ */

let nextId = 1;
const s = (
  name: string, prefix: string, body: string, description: string,
  language: HdlLanguage, category: string
): Snippet => ({
  id: `builtin-${nextId++}`,
  name, prefix, body, description, language, category, builtIn: true,
});

const BUILT_IN: Snippet[] = [
  // ── Verilog / SystemVerilog — Module ──
  s("Module Declaration", "mod",
    `module \$1 (\n  input  wire \$2,\n  output wire \$3\n);\n\n\$0\n\nendmodule`,
    "Basic Verilog module with ports", "verilog", "Module"),
  s("Module Declaration (SV)", "svmod",
    `module \$1 #(\n  parameter \$2 = \$3\n) (\n  input  logic \$4,\n  output logic \$5\n);\n\n\$0\n\nendmodule`,
    "SystemVerilog module with parameters", "systemverilog", "Module"),
  s("Testbench Template", "tb",
    `\`timescale 1ns/1ps\n\nmodule \$1_tb;\n\n  // Parameters\n  localparam CLK_PERIOD = 10;\n\n  // Signals\n  logic clk, rst_n;\n  \$2\n\n  // DUT instantiation\n  \$1 dut (\n    .clk(clk),\n    .rst_n(rst_n)\$3\n  );\n\n  // Clock generation\n  initial clk = 0;\n  always #(CLK_PERIOD/2) clk = ~clk;\n\n  // Reset\n  initial begin\n    rst_n = 0;\n    #(CLK_PERIOD * 5);\n    rst_n = 1;\n  end\n\n  // Stimulus\n  initial begin\n    @(posedge rst_n);\n    @(posedge clk);\n    \$0\n    #(CLK_PERIOD * 100);\n    \\$finish;\n  end\n\n  // Waveform dump\n  initial begin\n    \\$dumpfile("\$1_tb.vcd");\n    \\$dumpvars(0, \$1_tb);\n  end\n\nendmodule`,
    "Full testbench skeleton", "systemverilog", "Testbench"),

  // ── Always blocks ──
  s("Always FF", "aff",
    `always_ff @(posedge \$1 or negedge \$2) begin\n  if (!\$2)\n    \$3 <= '0;\n  else\n    \$0\nend`,
    "SystemVerilog always_ff with async reset", "systemverilog", "Always"),
  s("Always Comb", "acomb",
    `always_comb begin\n  \$0\nend`,
    "SystemVerilog always_comb block", "systemverilog", "Always"),
  s("Always Latch", "alatch",
    `always_latch begin\n  if (\$1)\n    \$2 <= \$0;\nend`,
    "SystemVerilog always_latch block", "systemverilog", "Always"),
  s("Always @*", "astar",
    `always @(*) begin\n  \$0\nend`,
    "Verilog combinational always block", "verilog", "Always"),
  s("Always @posedge", "apos",
    `always @(posedge \$1) begin\n  if (!\$2) begin\n    \$3 <= '0;\n  end else begin\n    \$0\n  end\nend`,
    "Verilog clocked always block with reset", "verilog", "Always"),

  // ── FSM ──
  s("FSM (2-process)", "fsm",
    `typedef enum logic [\$1:0] {\n  IDLE,\n  \$2\n} state_t;\n\nstate_t state, next_state;\n\nalways_ff @(posedge clk or negedge rst_n) begin\n  if (!rst_n)\n    state <= IDLE;\n  else\n    state <= next_state;\nend\n\nalways_comb begin\n  next_state = state;\n  case (state)\n    IDLE: begin\n      if (\$3)\n        next_state = \$4;\n    end\n    \$0\n    default: next_state = IDLE;\n  endcase\nend`,
    "Two-process FSM template", "systemverilog", "FSM"),
  s("Case Statement", "cas",
    `case (\$1)\n  \$2: begin\n    \$0\n  end\n  default: begin\n  end\nendcase`,
    "Case statement with default", "verilog", "Control Flow"),

  // ── Interface / Struct ──
  s("Interface", "intf",
    `interface \$1;\n  logic \$2;\n\n  modport master (\n    output \$3\n  );\n  modport slave (\n    input \$4\n  );\nendinterface`,
    "SystemVerilog interface with modports", "systemverilog", "Interface"),
  s("Struct", "stru",
    `typedef struct packed {\n  logic [\$1:0] \$2;\n  logic \$3;\n} \$4_t;`,
    "Packed struct typedef", "systemverilog", "Interface"),

  // ── Assertions ──
  s("Immediate Assert", "asrt",
    `assert (\$1) else \\$error("\$2");`,
    "Immediate assertion", "systemverilog", "Assertion"),
  s("Property Assert", "prop",
    `property \$1;\n  @(posedge clk) disable iff (!rst_n)\n  \$2 |-> \$0;\nendproperty\nassert property (\$1);`,
    "Concurrent property assertion", "systemverilog", "Assertion"),

  // ── Generate ──
  s("Generate For", "genfor",
    `genvar \$1;\ngenerate\n  for (\$1 = 0; \$1 < \$2; \$1 = \$1 + 1) begin : gen_\$3\n    \$0\n  end\nendgenerate`,
    "Generate for loop", "verilog", "Generate"),
  s("Generate If", "genif",
    `generate\n  if (\$1) begin : gen_\$2\n    \$0\n  end\nendgenerate`,
    "Conditional generate", "verilog", "Generate"),

  // ── VHDL ──
  s("Entity + Architecture", "ent",
    `library IEEE;\nuse IEEE.STD_LOGIC_1164.ALL;\n\nentity \$1 is\n  port (\n    clk   : in  std_logic;\n    rst   : in  std_logic;\n    \$2\n  );\nend entity \$1;\n\narchitecture rtl of \$1 is\nbegin\n  \$0\nend architecture rtl;`,
    "VHDL entity with architecture", "vhdl", "Module"),
  s("Process (clocked)", "proc",
    `process(clk, rst)\nbegin\n  if rst = '1' then\n    \$1 <= '0';\n  elsif rising_edge(clk) then\n    \$0\n  end if;\nend process;`,
    "Clocked process with reset", "vhdl", "Process"),
  s("Process (combinational)", "cproc",
    `process(all)\nbegin\n  \$0\nend process;`,
    "Combinational process (VHDL-2008)", "vhdl", "Process"),

  // ── Common ──
  s("Timescale", "ts",
    `\`timescale \$1ns/\$2ps`,
    "Timescale directive", "verilog", "Directive"),
  s("Include Guard", "guard",
    `\`ifndef \$1_SVH\n\`define \$1_SVH\n\n\$0\n\n\`endif`,
    "Include guard", "systemverilog", "Directive"),
  s("Assign", "asgn",
    `assign \$1 = \$0;`,
    "Continuous assign", "verilog", "Assignment"),
];

const SNIPPET_STORAGE_KEY = "opensilicon:snippets";

function loadCustomSnippets(): Snippet[] {
  try {
    const raw = localStorage.getItem(SNIPPET_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Snippet[]) : [];
  } catch { return []; }
}

function saveCustomSnippets(snippets: Snippet[]) {
  try {
    const custom = snippets.filter((s) => !s.builtIn);
    localStorage.setItem(SNIPPET_STORAGE_KEY, JSON.stringify(custom));
  } catch { /* quota exceeded */ }
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: [...BUILT_IN, ...loadCustomSnippets()],
  searchQuery: "",
  activeCategory: null,
  activeLanguage: null,

  addSnippet: (snippet) => {
    const newSnippet: Snippet = {
      ...snippet,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      builtIn: false,
    };
    set((s) => {
      const next = [...s.snippets, newSnippet];
      saveCustomSnippets(next);
      return { snippets: next };
    });
  },

  removeSnippet: (id) =>
    set((s) => {
      const next = s.snippets.filter((sn) => sn.id !== id);
      saveCustomSnippets(next);
      return { snippets: next };
    }),

  updateSnippet: (id, patch) =>
    set((s) => {
      const next = s.snippets.map((sn) =>
        sn.id === id && !sn.builtIn ? { ...sn, ...patch } : sn
      );
      saveCustomSnippets(next);
      return { snippets: next };
    }),

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveCategory: (cat) => set({ activeCategory: cat }),
  setActiveLanguage: (lang) => set({ activeLanguage: lang }),

  getFilteredSnippets: () => {
    const { snippets, searchQuery, activeCategory, activeLanguage } = get();
    return snippets.filter((s) => {
      if (activeLanguage && s.language !== activeLanguage) return false;
      if (activeCategory && s.category !== activeCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q)
          || s.prefix.toLowerCase().includes(q)
          || s.description.toLowerCase().includes(q);
      }
      return true;
    });
  },

  getCategories: () => {
    const cats = new Set(get().snippets.map((s) => s.category));
    return Array.from(cats).sort();
  },

  getSnippetsForAutocomplete: (language, prefix) => {
    const q = prefix.toLowerCase();
    return get().snippets.filter(
      (s) => (s.language === language || s.language === "verilog" && language === "systemverilog")
        && s.prefix.toLowerCase().startsWith(q)
    );
  },

  expandSnippet: (snippet) => {
    // Strip tabstop markers for plain insertion
    return snippet.body
      .replace(/\$\d+/g, "")
      .replace(/\$\{(\d+):([^}]*)}/g, "$2");
  },
}));
