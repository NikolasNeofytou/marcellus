/**
 * HDL Outline Store — Symbol tree for the current HDL file.
 *
 * Provides a hierarchical outline of modules, ports, signals,
 * parameters, instances, always blocks, and generate blocks.
 */

import { create } from "zustand";
import type { HdlParseResult, HdlModule } from "../engines/hdlParser";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type OutlineSymbolKind =
  | "module"
  | "port"
  | "signal"
  | "parameter"
  | "instance"
  | "always"
  | "generate"
  | "function"
  | "task"
  | "typedef";

export interface OutlineSymbol {
  id: string;
  name: string;
  kind: OutlineSymbolKind;
  detail: string;
  line: number;
  endLine?: number;
  children: OutlineSymbol[];
  icon: string; // single char for compact display
}

export interface OutlineState {
  symbols: OutlineSymbol[];
  expandedIds: Set<string>;
  selectedId: string | null;
  filterText: string;

  // Actions
  buildOutline: (parseResult: HdlParseResult | null, content: string) => void;
  toggleExpanded: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setSelectedId: (id: string | null) => void;
  setFilterText: (text: string) => void;
  getFilteredSymbols: () => OutlineSymbol[];
}

/* ------------------------------------------------------------------ */
/*  Outline builder                                                   */
/* ------------------------------------------------------------------ */

function buildModuleOutline(mod: HdlModule, content: string): OutlineSymbol {
  const children: OutlineSymbol[] = [];
  let childIdx = 0;

  // Ports
  if (mod.ports.length > 0) {
    const portChildren: OutlineSymbol[] = mod.ports.map((p) => ({
      id: `${mod.name}-port-${p.name}`,
      name: p.name,
      kind: "port" as const,
      detail: `${p.direction} ${p.type}${p.width > 1 ? ` [${p.width - 1}:0]` : ""}`,
      line: p.line,
      children: [],
      icon: p.direction === "input" ? "→" : p.direction === "output" ? "←" : "↔",
    }));
    children.push({
      id: `${mod.name}-ports`,
      name: `Ports (${mod.ports.length})`,
      kind: "port",
      detail: "",
      line: mod.ports[0]?.line ?? 1,
      children: portChildren,
      icon: "⚡",
    });
  }

  // Parameters
  if (mod.parameters.length > 0) {
    const paramChildren: OutlineSymbol[] = mod.parameters.map((p) => ({
      id: `${mod.name}-param-${p.name}`,
      name: p.name,
      kind: "parameter" as const,
      detail: p.defaultValue ?? "",
      line: p.line,
      children: [],
      icon: "#",
    }));
    children.push({
      id: `${mod.name}-params`,
      name: `Parameters (${mod.parameters.length})`,
      kind: "parameter",
      detail: "",
      line: mod.parameters[0]?.line ?? 1,
      children: paramChildren,
      icon: "#",
    });
  }

  // Signals
  if (mod.signals.length > 0) {
    const sigChildren: OutlineSymbol[] = mod.signals.map((s) => ({
      id: `${mod.name}-sig-${s.name}`,
      name: s.name,
      kind: "signal" as const,
      detail: `${s.type}${s.width > 1 ? ` [${s.width - 1}:0]` : ""}`,
      line: s.line,
      children: [],
      icon: "~",
    }));
    children.push({
      id: `${mod.name}-signals`,
      name: `Signals (${mod.signals.length})`,
      kind: "signal",
      detail: "",
      line: mod.signals[0]?.line ?? 1,
      children: sigChildren,
      icon: "~",
    });
  }

  // Instances
  if (mod.instances.length > 0) {
    const instChildren: OutlineSymbol[] = mod.instances.map((inst) => ({
      id: `${mod.name}-inst-${inst.instanceName}`,
      name: inst.instanceName,
      kind: "instance" as const,
      detail: inst.moduleName,
      line: inst.line,
      children: [],
      icon: "□",
    }));
    children.push({
      id: `${mod.name}-instances`,
      name: `Instances (${mod.instances.length})`,
      kind: "instance",
      detail: "",
      line: mod.instances[0]?.line ?? 1,
      children: instChildren,
      icon: "□",
    });
  }

  // Always blocks (by scanning content)
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const alwaysMatch = line.match(/^(always|always_ff|always_comb|always_latch)\b/);
    if (alwaysMatch) {
      const sensitivity = line.match(/@\s*\(([^)]*)\)/)?.[1] ?? "";
      children.push({
        id: `${mod.name}-always-${childIdx++}`,
        name: alwaysMatch[1],
        kind: "always",
        detail: sensitivity ? `@(${sensitivity})` : "",
        line: i + 1,
        children: [],
        icon: "⟳",
      });
    }
    // Generate blocks
    const genMatch = line.match(/^generate\b/);
    if (genMatch) {
      children.push({
        id: `${mod.name}-gen-${childIdx++}`,
        name: "generate",
        kind: "generate",
        detail: "",
        line: i + 1,
        children: [],
        icon: "G",
      });
    }
    // Functions
    const funcMatch = line.match(/^function\s+(?:\w+\s+)?(\w+)/);
    if (funcMatch) {
      children.push({
        id: `${mod.name}-func-${funcMatch[1]}`,
        name: funcMatch[1],
        kind: "function",
        detail: "function",
        line: i + 1,
        children: [],
        icon: "ƒ",
      });
    }
    // Tasks
    const taskMatch = line.match(/^task\s+(\w+)/);
    if (taskMatch) {
      children.push({
        id: `${mod.name}-task-${taskMatch[1]}`,
        name: taskMatch[1],
        kind: "task",
        detail: "task",
        line: i + 1,
        children: [],
        icon: "T",
      });
    }
  }

  return {
    id: `module-${mod.name}`,
    name: mod.name,
    kind: "module",
    detail: `${mod.ports.length} ports, ${mod.signals.length} signals`,
    line: mod.startLine,
    endLine: mod.endLine,
    children,
    icon: "M",
  };
}

function filterSymbols(symbols: OutlineSymbol[], query: string): OutlineSymbol[] {
  if (!query) return symbols;
  const q = query.toLowerCase();
  return symbols
    .map((sym) => {
      const childMatches = filterSymbols(sym.children, query);
      const selfMatches = sym.name.toLowerCase().includes(q) || sym.detail.toLowerCase().includes(q);
      if (selfMatches || childMatches.length > 0) {
        return { ...sym, children: selfMatches ? sym.children : childMatches };
      }
      return null;
    })
    .filter((s): s is OutlineSymbol => s !== null);
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

export const useOutlineStore = create<OutlineState>((set, get) => ({
  symbols: [],
  expandedIds: new Set<string>(),
  selectedId: null,
  filterText: "",

  buildOutline: (parseResult, content) => {
    if (!parseResult || parseResult.modules.length === 0) {
      set({ symbols: [] });
      return;
    }
    const symbols = parseResult.modules.map((mod) => buildModuleOutline(mod, content));
    // Auto-expand top-level modules
    const expandedIds = new Set(symbols.map((s) => s.id));
    set({ symbols, expandedIds });
  },

  toggleExpanded: (id) =>
    set((s) => {
      const next = new Set(s.expandedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { expandedIds: next };
    }),

  expandAll: () => {
    const ids = new Set<string>();
    const collect = (syms: OutlineSymbol[]) => {
      for (const s of syms) {
        ids.add(s.id);
        collect(s.children);
      }
    };
    collect(get().symbols);
    set({ expandedIds: ids });
  },

  collapseAll: () => set({ expandedIds: new Set() }),

  setSelectedId: (id) => set({ selectedId: id }),

  setFilterText: (text) => set({ filterText: text }),

  getFilteredSymbols: () => filterSymbols(get().symbols, get().filterText),
}));
