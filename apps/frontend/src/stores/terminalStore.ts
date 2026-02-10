/**
 * Terminal Store — Zustand state for the integrated terminal.
 * 
 * In Tauri mode: uses the shell plugin for real process execution.
 * In browser-dev mode: provides a simulated shell with common EDA commands.
 */

import { create } from "zustand";

export interface TerminalLine {
  id: number;
  text: string;
  type: "input" | "output" | "error" | "system";
  timestamp: number;
}

interface TerminalState {
  /** Terminal output lines */
  lines: TerminalLine[];
  /** Command history */
  history: string[];
  /** Current history navigation index */
  historyIndex: number;
  /** Current input text */
  currentInput: string;
  /** Whether a command is currently executing */
  isRunning: boolean;
  /** Current working directory */
  cwd: string;
  /** Max lines to keep */
  maxLines: number;

  /** Actions */
  appendLine: (text: string, type?: TerminalLine["type"]) => void;
  executeCommand: (command: string) => void;
  setCurrentInput: (text: string) => void;
  navigateHistory: (direction: "up" | "down") => void;
  clearTerminal: () => void;
  setCwd: (cwd: string) => void;
}

let lineIdCounter = 0;

/**
 * Simulated command responses for browser-dev mode.
 */
function simulateCommand(cmd: string, cwd: string): { output: string[]; errors: string[] } {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() ?? "";

  switch (command) {
    case "help":
      return {
        output: [
          "OpenSilicon Terminal — Available commands:",
          "",
          "  help              Show this help message",
          "  ls / dir          List directory contents",
          "  cd <dir>          Change directory",
          "  pwd               Print working directory",
          "  cat <file>        Show file contents",
          "  clear             Clear terminal",
          "  echo <text>       Print text",
          "  iverilog          (simulated) Compile Verilog",
          "  vvp               (simulated) Run simulation",
          "  yosys             (simulated) Synthesis tool",
          "  verilator         (simulated) Fast Verilog simulator",
          "  make              (simulated) Build automation",
          "  gtkwave           (simulated) Waveform viewer",
          "",
          "Note: Running in browser-dev mode. For full terminal,",
          "build with Tauri for native shell access.",
        ],
        errors: [],
      };

    case "pwd":
      return { output: [cwd], errors: [] };

    case "ls":
    case "dir": {
      // Synchronous fallback for demo
      return {
        output: [
          "rtl/",
          "tb/",
          "constraints/",
          "sim/",
          "spice/",
          "README.md",
        ],
        errors: [],
      };
    }

    case "echo":
      return { output: [parts.slice(1).join(" ")], errors: [] };

    case "iverilog": {
      const files = parts.slice(1);
      if (files.length === 0) {
        return { output: [], errors: ["iverilog: no input files"] };
      }
      return {
        output: [
          `iverilog: compiling ${files.length} file(s)...`,
          `iverilog: parsing ${files.join(", ")}`,
          `iverilog: elaborating design...`,
          `iverilog: code generation complete → a.out`,
        ],
        errors: [],
      };
    }

    case "vvp":
      return {
        output: [
          "VCD info: dumpfile dump.vcd opened for output.",
          "t=          0: clk=0, rst_n=0, data_in=00",
          "t=         20: clk=0, rst_n=1, data_in=00",
          "t=         25: clk=1, rst_n=1, data_in=1a",
          "t=         35: clk=0, rst_n=1, data_in=1a",
          "t=         45: clk=1, rst_n=1, data_in=a3",
          "Simulation complete",
        ],
        errors: [],
      };

    case "yosys":
      return {
        output: [
          "",
          " /------------\\",
          " |  Yosys 0.38 |",
          " \\------------/",
          "",
          " Yosys − Open SYnthesis Suite (simulated)",
          "",
          "yosys> read_verilog rtl/*.v",
          "yosys> synth -top top",
          "",
          "   Number of wires:        12",
          "   Number of cells:        24",
          "   $dff                     8",
          "   $add                     1",
          "   $mux                     2",
          "",
          "yosys> write_verilog synth_out.v",
          "yosys> exit",
        ],
        errors: [],
      };

    case "verilator":
      return {
        output: [
          "Verilator 5.024 (simulated)",
          "%Warning-UNUSED: rtl/processor.sv:3: Signal is not used: 'unused_sig'",
          "Compiling...",
          "Building obj_dir/Vtop...",
          "Build complete.",
        ],
        errors: [],
      };

    case "make": {
      return {
        output: [
          `make: Entering directory '${cwd}/sim'`,
          `iverilog -g2012 -o tb_top.vvp ../rtl/top.v ../rtl/processor.sv ../rtl/output_stage.v ../tb/tb_top.v`,
          `vvp tb_top.vvp`,
          `VCD info: dumpfile tb_top.vcd opened for output.`,
          `Simulation complete`,
          `make: Leaving directory '${cwd}/sim'`,
        ],
        errors: [],
      };
    }

    case "gtkwave":
      return {
        output: ["GTKWave Analyzer (simulated)", "Loading waveform..."],
        errors: ["Note: Use the built-in Waveform Viewer panel instead."],
      };

    case "cat": {
      if (parts.length < 2) return { output: [], errors: ["cat: missing file operand"] };
      return {
        output: [`(simulated) Contents of ${parts[1]}`],
        errors: [],
      };
    }

    case "cd": {
      if (parts.length < 2) return { output: [], errors: [] };
      return { output: [], errors: [] };
    }

    case "":
      return { output: [], errors: [] };

    default:
      return {
        output: [],
        errors: [`${command}: command not found. Type 'help' for available commands.`],
      };
  }
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  lines: [
    {
      id: lineIdCounter++,
      text: "OpenSilicon Terminal — Type 'help' for available commands",
      type: "system",
      timestamp: Date.now(),
    },
  ],
  history: [],
  historyIndex: -1,
  currentInput: "",
  isRunning: false,
  cwd: "/project",
  maxLines: 5000,

  appendLine: (text, type = "output") =>
    set((s) => {
      const newLine: TerminalLine = {
        id: lineIdCounter++,
        text,
        type,
        timestamp: Date.now(),
      };
      const lines = [...s.lines, newLine];
      // Trim if over max
      if (lines.length > s.maxLines) {
        return { lines: lines.slice(lines.length - s.maxLines) };
      }
      return { lines };
    }),

  executeCommand: (command) => {
    const state = get();
    if (state.isRunning) return;

    // Add to history
    const history = [command, ...state.history.filter((h) => h !== command)].slice(0, 100);

    set((s) => ({
      isRunning: true,
      history,
      historyIndex: -1,
      currentInput: "",
      lines: [
        ...s.lines,
        {
          id: lineIdCounter++,
          text: `${s.cwd}$ ${command}`,
          type: "input" as const,
          timestamp: Date.now(),
        },
      ],
    }));

    // Handle clear specially
    if (command.trim() === "clear") {
      set({ lines: [], isRunning: false });
      return;
    }

    // Handle cd specially
    const cdMatch = command.trim().match(/^cd\s+(.+)/);
    if (cdMatch) {
      const target = cdMatch[1];
      let newCwd = state.cwd;
      if (target === "..") {
        const parts = newCwd.split("/");
        if (parts.length > 2) {
          parts.pop();
          newCwd = parts.join("/");
        }
      } else if (target.startsWith("/")) {
        newCwd = target;
      } else {
        newCwd = `${state.cwd}/${target}`;
      }
      set({ cwd: newCwd, isRunning: false });
      return;
    }

    // Simulate command execution with a small delay for realism
    setTimeout(() => {
      const result = simulateCommand(command, state.cwd);
      const newLines: TerminalLine[] = [];

      for (const line of result.output) {
        newLines.push({
          id: lineIdCounter++,
          text: line,
          type: "output",
          timestamp: Date.now(),
        });
      }
      for (const line of result.errors) {
        newLines.push({
          id: lineIdCounter++,
          text: line,
          type: "error",
          timestamp: Date.now(),
        });
      }

      set((s) => ({
        isRunning: false,
        lines: [...s.lines, ...newLines],
      }));
    }, 150);
  },

  setCurrentInput: (text) => set({ currentInput: text }),

  navigateHistory: (direction) =>
    set((s) => {
      if (s.history.length === 0) return s;
      let idx = s.historyIndex;
      if (direction === "up") {
        idx = Math.min(idx + 1, s.history.length - 1);
      } else {
        idx = Math.max(idx - 1, -1);
      }
      return {
        historyIndex: idx,
        currentInput: idx >= 0 ? s.history[idx] : "",
      };
    }),

  clearTerminal: () => set({ lines: [] }),

  setCwd: (cwd) => set({ cwd }),
}));
