/**
 * HDL Store — Zustand state for HDL files, parse results, and diagnostics.
 *
 * Manages open HDL documents, their parsed AST, lint results, and
 * provides actions for the HDL editor / panel UI.
 */

import { create } from "zustand";
import {
  detectLanguage,
  type HdlLanguage,
  type HdlModule,
  type HdlParseResult,
  type HdlDiagnostic,
} from "../engines/hdlParser";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface HdlFile {
  id: string;
  filename: string;
  language: HdlLanguage;
  content: string;
  /** Last parse result */
  parseResult: HdlParseResult | null;
  /** Merged diagnostics (parse + lint) */
  diagnostics: HdlDiagnostic[];
  modified: boolean;
  /** Cursor line (1-based) */
  cursorLine: number;
  cursorColumn: number;
}

interface HdlState {
  /** All open HDL files keyed by id */
  files: Map<string, HdlFile>;
  /** Currently active file id */
  activeFileId: string | null;

  /** Sidebar expansion state */
  expandedModules: Set<string>;

  /** Selected module in the hierarchy panel */
  selectedModule: string | null;

  /** Whether the HDL output console is visible */
  consoleOutput: string[];

  // ── Actions ──
  openFile: (id: string, filename: string, content: string) => void;
  closeFile: (id: string) => void;
  setActiveFile: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  setCursorPosition: (id: string, line: number, column: number) => void;
  setParseResult: (id: string, result: HdlParseResult) => void;
  setDiagnostics: (id: string, diagnostics: HdlDiagnostic[]) => void;
  markSaved: (id: string) => void;

  toggleModuleExpanded: (moduleName: string) => void;
  setSelectedModule: (moduleName: string | null) => void;

  appendConsole: (text: string) => void;
  clearConsole: () => void;

  /** Get the active file (convenience) */
  getActiveFile: () => HdlFile | null;

  /** Get all modules across all open files */
  getAllModules: () => HdlModule[];

  /** Get diagnostics summary */
  getDiagnosticCounts: () => { errors: number; warnings: number; infos: number };

  /** Create a new empty HDL file */
  newFile: (language: HdlLanguage) => string;
}

/* ------------------------------------------------------------------ */
/*  Templates                                                         */
/* ------------------------------------------------------------------ */

const VERILOG_TEMPLATE = `module top (
    input  wire       clk,
    input  wire       rst_n,
    input  wire [7:0] data_in,
    output reg  [7:0] data_out
);

  // Internal signals
  reg [7:0] data_reg;

  always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      data_reg <= 8'b0;
      data_out <= 8'b0;
    end else begin
      data_reg <= data_in;
      data_out <= data_reg;
    end
  end

endmodule
`;

const SYSTEMVERILOG_TEMPLATE = `module top #(
    parameter int WIDTH = 8,
    parameter int DEPTH = 16
) (
    input  logic               clk,
    input  logic               rst_n,
    input  logic [WIDTH-1:0]   data_in,
    output logic [WIDTH-1:0]   data_out,
    output logic               valid
);

  // Internal signals
  logic [WIDTH-1:0] data_reg;
  logic             valid_reg;

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      data_reg  <= '0;
      valid_reg <= 1'b0;
    end else begin
      data_reg  <= data_in;
      valid_reg <= 1'b1;
    end
  end

  assign data_out = data_reg;
  assign valid    = valid_reg;

endmodule
`;

const VHDL_TEMPLATE = `library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity top is
  generic (
    WIDTH : integer := 8
  );
  port (
    clk      : in  std_logic;
    rst_n    : in  std_logic;
    data_in  : in  std_logic_vector(WIDTH-1 downto 0);
    data_out : out std_logic_vector(WIDTH-1 downto 0);
    valid    : out std_logic
  );
end entity top;

architecture rtl of top is
  signal data_reg  : std_logic_vector(WIDTH-1 downto 0);
  signal valid_reg : std_logic;
begin

  process(clk, rst_n)
  begin
    if rst_n = '0' then
      data_reg  <= (others => '0');
      valid_reg <= '0';
    elsif rising_edge(clk) then
      data_reg  <= data_in;
      valid_reg <= '1';
    end if;
  end process;

  data_out <= data_reg;
  valid    <= valid_reg;

end architecture rtl;
`;

function getTemplate(lang: HdlLanguage): string {
  switch (lang) {
    case "vhdl":
      return VHDL_TEMPLATE;
    case "systemverilog":
      return SYSTEMVERILOG_TEMPLATE;
    default:
      return VERILOG_TEMPLATE;
  }
}

function getExtension(lang: HdlLanguage): string {
  switch (lang) {
    case "vhdl":
      return ".vhd";
    case "systemverilog":
      return ".sv";
    default:
      return ".v";
  }
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

let fileCounter = 0;

export const useHdlStore = create<HdlState>((set, get) => ({
  files: new Map(),
  activeFileId: null,
  expandedModules: new Set(),
  selectedModule: null,
  consoleOutput: [],

  /* ── File management ── */

  openFile: (id, filename, content) =>
    set((s) => {
      const next = new Map(s.files);
      const language = detectLanguage(filename, content) as HdlLanguage;
      next.set(id, {
        id,
        filename,
        language,
        content,
        parseResult: null,
        diagnostics: [],
        modified: false,
        cursorLine: 1,
        cursorColumn: 1,
      });
      return { files: next, activeFileId: id };
    }),

  closeFile: (id) =>
    set((s) => {
      const next = new Map(s.files);
      next.delete(id);
      const newActive =
        s.activeFileId === id
          ? (next.keys().next().value ?? null)
          : s.activeFileId;
      return { files: next, activeFileId: newActive };
    }),

  setActiveFile: (id) => set({ activeFileId: id }),

  updateContent: (id, content) =>
    set((s) => {
      const next = new Map(s.files);
      const file = next.get(id);
      if (file) {
        next.set(id, { ...file, content, modified: true });
      }
      return { files: next };
    }),

  setCursorPosition: (id, line, column) =>
    set((s) => {
      const next = new Map(s.files);
      const file = next.get(id);
      if (file) {
        next.set(id, { ...file, cursorLine: line, cursorColumn: column });
      }
      return { files: next };
    }),

  setParseResult: (id, result) =>
    set((s) => {
      const next = new Map(s.files);
      const file = next.get(id);
      if (file) {
        next.set(id, { ...file, parseResult: result });
      }
      return { files: next };
    }),

  setDiagnostics: (id, diagnostics) =>
    set((s) => {
      const next = new Map(s.files);
      const file = next.get(id);
      if (file) {
        next.set(id, { ...file, diagnostics });
      }
      return { files: next };
    }),

  markSaved: (id) =>
    set((s) => {
      const next = new Map(s.files);
      const file = next.get(id);
      if (file) {
        next.set(id, { ...file, modified: false });
      }
      return { files: next };
    }),

  /* ── Hierarchy panel ── */

  toggleModuleExpanded: (moduleName) =>
    set((s) => {
      const next = new Set(s.expandedModules);
      if (next.has(moduleName)) next.delete(moduleName);
      else next.add(moduleName);
      return { expandedModules: next };
    }),

  setSelectedModule: (moduleName) => set({ selectedModule: moduleName }),

  /* ── Console ── */

  appendConsole: (text) =>
    set((s) => ({
      consoleOutput: [...s.consoleOutput, text],
    })),

  clearConsole: () => set({ consoleOutput: [] }),

  /* ── Computed ── */

  getActiveFile: () => {
    const { files, activeFileId } = get();
    if (!activeFileId) return null;
    return files.get(activeFileId) ?? null;
  },

  getAllModules: () => {
    const { files } = get();
    const modules: HdlModule[] = [];
    for (const file of files.values()) {
      if (file.parseResult) {
        modules.push(...file.parseResult.modules);
      }
    }
    return modules;
  },

  getDiagnosticCounts: () => {
    const { files } = get();
    let errors = 0,
      warnings = 0,
      infos = 0;
    for (const file of files.values()) {
      for (const d of file.diagnostics) {
        if (d.severity === "error") errors++;
        else if (d.severity === "warning") warnings++;
        else infos++;
      }
    }
    return { errors, warnings, infos };
  },

  newFile: (language) => {
    fileCounter++;
    const ext = getExtension(language);
    const filename = `untitled_${fileCounter}${ext}`;
    const id = `hdl-${Date.now()}-${fileCounter}`;
    const content = getTemplate(language);
    get().openFile(id, filename, content);
    return id;
  },
}));
