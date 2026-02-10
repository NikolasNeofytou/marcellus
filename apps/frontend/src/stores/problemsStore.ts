/**
 * Problems Store — Unified aggregation of diagnostics, errors, and warnings
 * from all sources: HDL parser, DRC, LVS, elaboration, linting.
 */

import { create } from "zustand";

export type ProblemSeverity = "error" | "warning" | "info" | "hint";
export type ProblemSource = "hdl-parser" | "drc" | "lvs" | "elaboration" | "lint" | "simulation" | "synthesis" | "timing";

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  source: ProblemSource;
  message: string;
  filePath?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  code?: string;
  /** Quick-fix suggestion */
  suggestion?: string;
}

export interface ProblemGroup {
  filePath: string;
  problems: Problem[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

interface ProblemsState {
  /** All problems */
  problems: Problem[];
  /** Filter by severity */
  severityFilter: Set<ProblemSeverity>;
  /** Filter by source */
  sourceFilter: Set<ProblemSource>;
  /** Search filter text */
  filterText: string;
  /** Expanded file paths in tree */
  expandedFiles: Set<string>;

  /** Computed */
  errorCount: number;
  warningCount: number;
  infoCount: number;

  /** Actions */
  setProblems: (source: ProblemSource, problems: Problem[]) => void;
  addProblem: (problem: Problem) => void;
  clearSource: (source: ProblemSource) => void;
  clearAll: () => void;
  toggleSeverityFilter: (severity: ProblemSeverity) => void;
  toggleSourceFilter: (source: ProblemSource) => void;
  setFilterText: (text: string) => void;
  toggleFileExpand: (filePath: string) => void;
  /** Get filtered problems grouped by file */
  getFilteredGroups: () => ProblemGroup[];
  /** Populate with demo data */
  loadDemoProblems: () => void;
}

let problemIdCounter = 0;

function countBySeverity(problems: Problem[], severity: ProblemSeverity): number {
  return problems.filter((p) => p.severity === severity).length;
}

export const useProblemsStore = create<ProblemsState>((set, get) => ({
  problems: [],
  severityFilter: new Set<ProblemSeverity>(["error", "warning", "info", "hint"]),
  sourceFilter: new Set<ProblemSource>(),
  filterText: "",
  expandedFiles: new Set<string>(),
  errorCount: 0,
  warningCount: 0,
  infoCount: 0,

  setProblems: (source, newProblems) =>
    set((s) => {
      const other = s.problems.filter((p) => p.source !== source);
      const all = [...other, ...newProblems];
      return {
        problems: all,
        errorCount: countBySeverity(all, "error"),
        warningCount: countBySeverity(all, "warning"),
        infoCount: countBySeverity(all, "info"),
      };
    }),

  addProblem: (problem) =>
    set((s) => {
      const all = [...s.problems, problem];
      return {
        problems: all,
        errorCount: countBySeverity(all, "error"),
        warningCount: countBySeverity(all, "warning"),
        infoCount: countBySeverity(all, "info"),
      };
    }),

  clearSource: (source) =>
    set((s) => {
      const all = s.problems.filter((p) => p.source !== source);
      return {
        problems: all,
        errorCount: countBySeverity(all, "error"),
        warningCount: countBySeverity(all, "warning"),
        infoCount: countBySeverity(all, "info"),
      };
    }),

  clearAll: () =>
    set({ problems: [], errorCount: 0, warningCount: 0, infoCount: 0 }),

  toggleSeverityFilter: (severity) =>
    set((s) => {
      const next = new Set(s.severityFilter);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return { severityFilter: next };
    }),

  toggleSourceFilter: (source) =>
    set((s) => {
      const next = new Set(s.sourceFilter);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return { sourceFilter: next };
    }),

  setFilterText: (text) => set({ filterText: text }),

  toggleFileExpand: (filePath) =>
    set((s) => {
      const next = new Set(s.expandedFiles);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return { expandedFiles: next };
    }),

  getFilteredGroups: () => {
    const { problems, severityFilter, sourceFilter, filterText } = get();

    let filtered = problems.filter((p) => severityFilter.has(p.severity));
    if (sourceFilter.size > 0) {
      filtered = filtered.filter((p) => sourceFilter.has(p.source));
    }
    if (filterText) {
      const lower = filterText.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.message.toLowerCase().includes(lower) ||
          (p.filePath?.toLowerCase().includes(lower) ?? false) ||
          (p.code?.toLowerCase().includes(lower) ?? false)
      );
    }

    // Group by file
    const groups = new Map<string, Problem[]>();
    for (const p of filtered) {
      const key = p.filePath ?? "(no file)";
      const arr = groups.get(key) ?? [];
      arr.push(p);
      groups.set(key, arr);
    }

    return Array.from(groups.entries())
      .map(([filePath, probs]) => ({
        filePath,
        problems: probs.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
        errorCount: countBySeverity(probs, "error"),
        warningCount: countBySeverity(probs, "warning"),
        infoCount: countBySeverity(probs, "info"),
      }))
      .sort((a, b) => b.errorCount - a.errorCount || a.filePath.localeCompare(b.filePath));
  },

  loadDemoProblems: () => {
    const demoProblems: Problem[] = [
      {
        id: `prob-${problemIdCounter++}`,
        severity: "error",
        source: "hdl-parser",
        message: "Undeclared identifier 'data_out_reg'",
        filePath: "/project/rtl/processor.sv",
        line: 42,
        column: 12,
        code: "E1001",
        suggestion: "Did you mean 'data_out'?",
      },
      {
        id: `prob-${problemIdCounter++}`,
        severity: "warning",
        source: "hdl-parser",
        message: "Port 'debug_port' is declared but never connected",
        filePath: "/project/rtl/top.v",
        line: 15,
        column: 1,
        code: "W2003",
      },
      {
        id: `prob-${problemIdCounter++}`,
        severity: "warning",
        source: "lint",
        message: "Signal 'temp' is assigned but never read",
        filePath: "/project/rtl/output_stage.v",
        line: 28,
        column: 8,
        code: "W3001",
      },
      {
        id: `prob-${problemIdCounter++}`,
        severity: "error",
        source: "drc",
        message: "Metal1 minimum spacing violation: 0.12µm < 0.14µm required",
        filePath: "/project/layout/top.gds",
        line: undefined,
        code: "DRC-M1.S.1",
      },
      {
        id: `prob-${problemIdCounter++}`,
        severity: "warning",
        source: "drc",
        message: "Metal2 minimum width advisory: 0.16µm (recommended ≥ 0.18µm)",
        filePath: "/project/layout/top.gds",
        code: "DRC-M2.W.1",
      },
      {
        id: `prob-${problemIdCounter++}`,
        severity: "error",
        source: "lvs",
        message: "Net mismatch: schematic net 'vdd' not found in layout",
        filePath: "/project/layout/top.gds",
        code: "LVS-NET-001",
      },
      {
        id: `prob-${problemIdCounter++}`,
        severity: "info",
        source: "elaboration",
        message: "Module 'processor' has 2 always blocks, 1 combinational, 1 sequential",
        filePath: "/project/rtl/processor.sv",
        line: 1,
        code: "I4001",
      },
      {
        id: `prob-${problemIdCounter++}`,
        severity: "warning",
        source: "timing",
        message: "Setup time violation on path: clk → data_out (slack: -0.15ns)",
        filePath: "/project/constraints/timing.sdc",
        line: 3,
        code: "T5001",
      },
      {
        id: `prob-${problemIdCounter++}`,
        severity: "info",
        source: "synthesis",
        message: "Inferred 8-bit register for signal 'data_out'",
        filePath: "/project/rtl/output_stage.v",
        line: 12,
        code: "I6001",
      },
    ];

    set({
      problems: demoProblems,
      errorCount: countBySeverity(demoProblems, "error"),
      warningCount: countBySeverity(demoProblems, "warning"),
      infoCount: countBySeverity(demoProblems, "info"),
      expandedFiles: new Set(
        demoProblems.filter((p) => p.filePath).map((p) => p.filePath!)
      ),
    });
  },
}));
