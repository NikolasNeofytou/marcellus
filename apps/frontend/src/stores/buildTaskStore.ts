/**
 * Build Task Store — Configure & run HDL build / lint / synth tasks.
 *
 * Supports task definitions for common EDA tools, captures output,
 * and parses problem-matcher regexes to produce diagnostics that feed
 * into the Problems panel (problemsStore).
 */

import { create } from "zustand";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type TaskStatus = "idle" | "running" | "success" | "error" | "cancelled";

export interface ProblemMatcher {
  /** Regex applied per-line of task output */
  pattern: string;
  /** Named capture groups: file, line, column, severity, message */
  groups: { file: number; line: number; column?: number; severity?: number; message: number };
}

export interface BuildTask {
  id: string;
  label: string;
  command: string;
  args: string[];
  cwd: string;
  description: string;
  category: string;
  problemMatcher?: ProblemMatcher;
  builtIn: boolean;
}

export interface TaskRun {
  taskId: string;
  status: TaskStatus;
  output: string[];
  startTime: number;
  endTime?: number;
  exitCode?: number;
  problems: TaskProblem[];
}

export interface TaskProblem {
  file: string;
  line: number;
  column?: number;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface BuildTaskState {
  tasks: BuildTask[];
  activeRunId: string | null;
  runs: Record<string, TaskRun>;
  searchQuery: string;

  // Actions
  addTask: (task: Omit<BuildTask, "id" | "builtIn">) => void;
  removeTask: (id: string) => void;
  updateTask: (id: string, patch: Partial<Omit<BuildTask, "id" | "builtIn">>) => void;
  startTask: (taskId: string) => void;
  appendOutput: (taskId: string, line: string) => void;
  finishTask: (taskId: string, exitCode: number) => void;
  cancelTask: (taskId: string) => void;
  clearRun: (taskId: string) => void;
  setSearchQuery: (q: string) => void;
  getFilteredTasks: () => BuildTask[];
  getActiveRun: () => TaskRun | null;
  parseLine: (taskId: string, line: string) => TaskProblem | null;
}

/* ------------------------------------------------------------------ */
/*  Built-in tasks                                                    */
/* ------------------------------------------------------------------ */

const BUILT_IN_TASKS: BuildTask[] = [
  {
    id: "iverilog-compile",
    label: "Icarus Verilog — Compile",
    command: "iverilog",
    args: ["-g2012", "-Wall", "-o", "${name}.vvp", "${file}"],
    cwd: "${workspaceFolder}",
    description: "Compile SystemVerilog with Icarus Verilog",
    category: "Compile",
    problemMatcher: {
      pattern: "^(.+?):(\\d+):\\s*(error|warning):\\s*(.+)$",
      groups: { file: 1, line: 2, severity: 3, message: 4 },
    },
    builtIn: true,
  },
  {
    id: "iverilog-simulate",
    label: "Icarus Verilog — Simulate",
    command: "vvp",
    args: ["${name}.vvp"],
    cwd: "${workspaceFolder}",
    description: "Run compiled Verilog simulation",
    category: "Simulate",
    builtIn: true,
  },
  {
    id: "verilator-lint",
    label: "Verilator — Lint",
    command: "verilator",
    args: ["--lint-only", "-Wall", "--top-module", "${module}", "${file}"],
    cwd: "${workspaceFolder}",
    description: "Run Verilator lint checks",
    category: "Lint",
    problemMatcher: {
      pattern: "^%(Error|Warning)(?:-([A-Z_]+))?: (.+?):(\\d+)(?::(\\d+))?: (.+)$",
      groups: { severity: 1, file: 3, line: 4, column: 5, message: 6 },
    },
    builtIn: true,
  },
  {
    id: "yosys-synth",
    label: "Yosys — Synthesize",
    command: "yosys",
    args: ["-p", "read_verilog -sv ${file}; synth -top ${module}; stat"],
    cwd: "${workspaceFolder}",
    description: "Synthesize with Yosys and show statistics",
    category: "Synthesis",
    builtIn: true,
  },
  {
    id: "ghdl-analyze",
    label: "GHDL — Analyze",
    command: "ghdl",
    args: ["-a", "--std=08", "${file}"],
    cwd: "${workspaceFolder}",
    description: "Analyze VHDL with GHDL",
    category: "Compile",
    problemMatcher: {
      pattern: "^(.+?):(\\d+):(\\d+):\\s*(error|warning):\\s*(.+)$",
      groups: { file: 1, line: 2, column: 3, severity: 4, message: 5 },
    },
    builtIn: true,
  },
  {
    id: "make-build",
    label: "Make",
    command: "make",
    args: [],
    cwd: "${workspaceFolder}",
    description: "Run make in workspace root",
    category: "Build",
    builtIn: true,
  },
  {
    id: "cocotb-test",
    label: "cocotb — Run Tests",
    command: "make",
    args: ["SIM=icarus"],
    cwd: "${workspaceFolder}",
    description: "Run cocotb testbench",
    category: "Test",
    builtIn: true,
  },
  {
    id: "svlint",
    label: "svlint — Lint",
    command: "svlint",
    args: ["${file}"],
    cwd: "${workspaceFolder}",
    description: "Run svlint on current file",
    category: "Lint",
    problemMatcher: {
      pattern: "^\\s*(Fail|Hint)\\s*\\|\\s*(.+?):(\\d+):(\\d+)\\s*\\|\\s*(.+)$",
      groups: { file: 2, line: 3, column: 4, message: 5 },
    },
    builtIn: true,
  },
];

const TASKS_STORAGE_KEY = "opensilicon:build-tasks";

function loadCustomTasks(): BuildTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BuildTask[]) : [];
  } catch { return []; }
}

function saveCustomTasks(tasks: BuildTask[]) {
  try {
    const custom = tasks.filter((t) => !t.builtIn);
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(custom));
  } catch { /* quota exceeded */ }
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

export const useBuildTaskStore = create<BuildTaskState>((set, get) => ({
  tasks: [...BUILT_IN_TASKS, ...loadCustomTasks()],
  activeRunId: null,
  runs: {},
  searchQuery: "",

  addTask: (task) => {
    const newTask: BuildTask = {
      ...task,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      builtIn: false,
    };
    set((s) => {
      const next = [...s.tasks, newTask];
      saveCustomTasks(next);
      return { tasks: next };
    });
  },

  removeTask: (id) =>
    set((s) => {
      const next = s.tasks.filter((t) => t.id !== id);
      saveCustomTasks(next);
      return { tasks: next };
    }),

  updateTask: (id, patch) =>
    set((s) => {
      const next = s.tasks.map((t) =>
        t.id === id && !t.builtIn ? { ...t, ...patch } : t
      );
      saveCustomTasks(next);
      return { tasks: next };
    }),

  startTask: (taskId) =>
    set((s) => ({
      activeRunId: taskId,
      runs: {
        ...s.runs,
        [taskId]: {
          taskId,
          status: "running",
          output: [],
          startTime: Date.now(),
          problems: [],
        },
      },
    })),

  appendOutput: (taskId, line) =>
    set((s) => {
      const run = s.runs[taskId];
      if (!run) return s;
      const problem = get().parseLine(taskId, line);
      return {
        runs: {
          ...s.runs,
          [taskId]: {
            ...run,
            output: [...run.output, line],
            problems: problem ? [...run.problems, problem] : run.problems,
          },
        },
      };
    }),

  finishTask: (taskId, exitCode) =>
    set((s) => {
      const run = s.runs[taskId];
      if (!run) return s;
      return {
        activeRunId: s.activeRunId === taskId ? null : s.activeRunId,
        runs: {
          ...s.runs,
          [taskId]: {
            ...run,
            status: exitCode === 0 ? "success" : "error",
            endTime: Date.now(),
            exitCode,
          },
        },
      };
    }),

  cancelTask: (taskId) =>
    set((s) => {
      const run = s.runs[taskId];
      if (!run) return s;
      return {
        activeRunId: s.activeRunId === taskId ? null : s.activeRunId,
        runs: {
          ...s.runs,
          [taskId]: { ...run, status: "cancelled", endTime: Date.now() },
        },
      };
    }),

  clearRun: (taskId) =>
    set((s) => {
      const next = { ...s.runs };
      delete next[taskId];
      return { runs: next };
    }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  getFilteredTasks: () => {
    const { tasks, searchQuery } = get();
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) => t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  },

  getActiveRun: () => {
    const { activeRunId, runs } = get();
    return activeRunId ? runs[activeRunId] ?? null : null;
  },

  parseLine: (taskId, line) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task?.problemMatcher) return null;
    try {
      const re = new RegExp(task.problemMatcher.pattern);
      const m = re.exec(line);
      if (!m) return null;
      const g = task.problemMatcher.groups;
      const sevRaw = g.severity ? m[g.severity]?.toLowerCase() : "error";
      const severity: TaskProblem["severity"] =
        sevRaw === "warning" || sevRaw === "warn" || sevRaw === "hint"
          ? "warning"
          : sevRaw === "info" || sevRaw === "note"
            ? "info"
            : "error";
      return {
        file: m[g.file] ?? "<unknown>",
        line: parseInt(m[g.line], 10) || 1,
        column: g.column ? parseInt(m[g.column!], 10) || undefined : undefined,
        severity,
        message: m[g.message] ?? line,
      };
    } catch { return null; }
  },
}));
