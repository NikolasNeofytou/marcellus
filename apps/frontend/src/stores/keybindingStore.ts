/**
 * Keybinding Store — configurable keyboard shortcuts with multi-chord support.
 *
 * Features:
 *  - Override default keybindings per command
 *  - Multi-chord sequences (e.g. Ctrl+K Ctrl+T)
 *  - Conflict detection
 *  - Persistence via localStorage
 *  - Reset to defaults
 *  - EDA preset profiles (Virtuoso / Magic / KLayout)
 *  - Context-sensitive keymaps via `when` clauses
 */

import { create } from "zustand";

// ── Types ─────────────────────────────────────────────────────────────

export interface KeybindingEntry {
  /** Command ID this binding triggers */
  commandId: string;
  /** Key combo string, e.g. "Ctrl+Shift+P" or "Ctrl+K Ctrl+T" (multi-chord) */
  keybinding: string;
  /** Whether this is a user override (vs. built-in default) */
  isCustom: boolean;
  /** Optional context condition for when this binding is active */
  when?: string;
}

export interface KeybindingConflict {
  keybinding: string;
  commandIds: string[];
}

// ── Context Keys ──────────────────────────────────────────────────────

/**
 * Context keys represent the current application state.
 * Keybindings with a `when` clause are only active when the clause evaluates
 * to true against the current context.
 *
 * Supported operators: `===`, `!==`, `&&`, `||`, `!`
 * Example when clauses:
 *   "tool === 'select'"
 *   "panel === 'canvas' && tool !== 'pan'"
 *   "hasSelection"
 */
const contextKeys = new Map<string, string | boolean>();

/** Set a context key value. */
export function setContextKey(key: string, value: string | boolean): void {
  contextKeys.set(key, value);
}

/** Remove a context key. */
export function clearContextKey(key: string): void {
  contextKeys.delete(key);
}

/** Get all current context keys (for debug panel). */
export function getContextKeys(): Record<string, string | boolean> {
  return Object.fromEntries(contextKeys);
}

/**
 * Evaluate a `when` clause against the current context keys.
 * Supports:
 *  - Simple truthy check: "hasSelection"
 *  - Equality: "tool === 'select'"
 *  - Inequality: "tool !== 'pan'"
 *  - Negation: "!hasSelection"
 *  - AND/OR: "tool === 'rect' && panel === 'canvas'"
 */
export function evaluateWhenClause(when: string | undefined): boolean {
  if (!when || when.trim() === "") return true;

  // Split on || first (lower precedence)
  if (when.includes("||")) {
    return when.split("||").some((part) => evaluateWhenClause(part.trim()));
  }

  // Split on && (higher precedence)
  if (when.includes("&&")) {
    return when.split("&&").every((part) => evaluateWhenClause(part.trim()));
  }

  const trimmed = when.trim();

  // Negation: !key
  if (trimmed.startsWith("!")) {
    return !evaluateWhenClause(trimmed.slice(1).trim());
  }

  // Equality: key === 'value'
  const eqMatch = trimmed.match(/^(\w+)\s*===\s*'([^']*)'$/);
  if (eqMatch) {
    return contextKeys.get(eqMatch[1]) === eqMatch[2];
  }

  // Inequality: key !== 'value'
  const neqMatch = trimmed.match(/^(\w+)\s*!==\s*'([^']*)'$/);
  if (neqMatch) {
    return contextKeys.get(neqMatch[1]) !== neqMatch[2];
  }

  // Simple truthy check: "hasSelection"
  const val = contextKeys.get(trimmed);
  return !!val;
}

// ── EDA Preset Profiles ───────────────────────────────────────────────

export type PresetId = "default" | "virtuoso" | "magic" | "klayout";

export interface KeybindingPreset {
  id: PresetId;
  name: string;
  description: string;
  /** Map of commandId → keybinding string */
  bindings: Record<string, string>;
}

export const KEYBINDING_PRESETS: KeybindingPreset[] = [
  {
    id: "default",
    name: "OpenSilicon Default",
    description: "Default keybindings optimized for the OpenSilicon IDE",
    bindings: {}, // Empty = use built-in defaults
  },
  {
    id: "virtuoso",
    name: "Cadence Virtuoso",
    description: "Keybindings familiar to Cadence Virtuoso users",
    bindings: {
      "layout.rect":      "R",
      "layout.polygon":   "Shift+P",
      "layout.path":      "P",
      "layout.via":       "O",
      "layout.select":    "S",
      "layout.pan":       "F",
      "edit.undo":        "U",
      "edit.redo":        "Shift+U",
      "edit.copy":        "C",
      "edit.move":        "M",
      "edit.stretch":     "S",
      "edit.delete":      "Delete",
      "edit.selectAll":   "Ctrl+A",
      "view.zoomIn":      "Z",
      "view.zoomOut":     "Shift+Z",
      "view.fitAll":      "F",
      "view.toggleLayers": "L",
      "file.save":        "Ctrl+S",
      "file.open":        "Ctrl+O",
      "drc.runCheck":     "Shift+D",
    },
  },
  {
    id: "magic",
    name: "Magic VLSI",
    description: "Keybindings familiar to Magic VLSI users",
    bindings: {
      "layout.rect":      "R",
      "layout.polygon":   "Ctrl+P",
      "layout.path":      "W",
      "layout.select":    "S",
      "layout.pan":       "Space",
      "edit.undo":        "Ctrl+Z",
      "edit.redo":        "Ctrl+Y",
      "edit.copy":        "C",
      "edit.move":        "M",
      "edit.delete":      "D",
      "edit.selectAll":   "A",
      "view.zoomIn":      "Z",
      "view.zoomOut":     "Shift+Z",
      "view.fitAll":      "V",
      "view.toggleGrid":  "G",
      "file.save":        "Ctrl+S",
      "drc.runCheck":     "Shift+D",
      "extraction.run":   "Ctrl+E",
    },
  },
  {
    id: "klayout",
    name: "KLayout",
    description: "Keybindings familiar to KLayout users",
    bindings: {
      "layout.rect":      "B",
      "layout.polygon":   "G",
      "layout.path":      "P",
      "layout.select":    "F2",
      "layout.pan":       "F3",
      "layout.ruler":     "R",
      "edit.undo":        "Ctrl+Z",
      "edit.redo":        "Ctrl+Y",
      "edit.copy":        "Ctrl+C",
      "edit.delete":      "Delete",
      "edit.selectAll":   "Ctrl+A",
      "view.zoomIn":      "Ctrl+=",
      "view.zoomOut":     "Ctrl+-",
      "view.fitAll":      "Ctrl+F",
      "view.toggleLayers": "Ctrl+L",
      "file.save":        "Ctrl+S",
      "file.open":        "Ctrl+O",
      "file.newLayout":   "Ctrl+N",
      "drc.runCheck":     "Ctrl+Shift+D",
    },
  },
];

// ── Store ─────────────────────────────────────────────────────────────

interface KeybindingStoreState {
  /** User-overridden bindings (commandId → keybinding string) */
  customBindings: Map<string, string>;

  /** Removed (disabled) default bindings */
  removedDefaults: Set<string>;

  /** Currently active preset id */
  activePreset: PresetId;

  /** When-clause overrides for specific command bindings (commandId → when clause) */
  whenClauses: Map<string, string>;

  /** Set a custom keybinding for a command */
  setKeybinding: (commandId: string, keybinding: string) => void;

  /** Remove a keybinding (disable it) */
  removeKeybinding: (commandId: string) => void;

  /** Reset a single binding to its default */
  resetKeybinding: (commandId: string) => void;

  /** Reset all custom bindings */
  resetAll: () => void;

  /** Get the effective keybinding for a command */
  getKeybinding: (commandId: string, defaultBinding?: string) => string | undefined;

  /** Detect conflicts (two commands bound to same key) */
  getConflicts: (allBindings: Map<string, string>) => KeybindingConflict[];

  /** Load a keybinding preset profile */
  loadPreset: (presetId: PresetId) => void;

  /** Set a when clause for a command binding */
  setWhenClause: (commandId: string, when: string) => void;

  /** Remove a when clause for a command binding */
  removeWhenClause: (commandId: string) => void;

  /** Check if a command's binding is active in the current context */
  isActiveInContext: (commandId: string) => boolean;

  /** Persist to localStorage */
  save: () => void;

  /** Load from localStorage */
  load: () => void;
}

const STORAGE_KEY = "opensilicon.keybindings";

export const useKeybindingStore = create<KeybindingStoreState>((set, get) => ({
  customBindings: new Map(),
  removedDefaults: new Set(),
  activePreset: "default" as PresetId,
  whenClauses: new Map(),

  setKeybinding: (commandId, keybinding) => {
    set((s) => {
      const next = new Map(s.customBindings);
      next.set(commandId, keybinding);
      const removed = new Set(s.removedDefaults);
      removed.delete(commandId); // Re-enable if was removed
      return { customBindings: next, removedDefaults: removed };
    });
    get().save();
  },

  removeKeybinding: (commandId) => {
    set((s) => {
      const next = new Map(s.customBindings);
      next.delete(commandId);
      const removed = new Set(s.removedDefaults);
      removed.add(commandId);
      return { customBindings: next, removedDefaults: removed };
    });
    get().save();
  },

  resetKeybinding: (commandId) => {
    set((s) => {
      const next = new Map(s.customBindings);
      next.delete(commandId);
      const removed = new Set(s.removedDefaults);
      removed.delete(commandId);
      return { customBindings: next, removedDefaults: removed };
    });
    get().save();
  },

  resetAll: () => {
    set({ customBindings: new Map(), removedDefaults: new Set(), activePreset: "default" as PresetId });
    get().save();
  },

  getKeybinding: (commandId, defaultBinding) => {
    const { customBindings, removedDefaults } = get();
    if (removedDefaults.has(commandId)) return undefined;
    return customBindings.get(commandId) ?? defaultBinding;
  },

  getConflicts: (allBindings) => {
    const byKey = new Map<string, string[]>();
    for (const [cmdId, key] of allBindings) {
      const normalized = normalizeKeybinding(key);
      const existing = byKey.get(normalized) ?? [];
      existing.push(cmdId);
      byKey.set(normalized, existing);
    }
    const conflicts: KeybindingConflict[] = [];
    for (const [keybinding, commandIds] of byKey) {
      if (commandIds.length > 1) {
        conflicts.push({ keybinding, commandIds });
      }
    }
    return conflicts;
  },

  save: () => {
    const { customBindings, removedDefaults, activePreset, whenClauses } = get();
    const data = {
      bindings: Object.fromEntries(customBindings),
      removed: Array.from(removedDefaults),
      preset: activePreset,
      when: Object.fromEntries(whenClauses),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  },

  load: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      set({
        customBindings: new Map(Object.entries(data.bindings ?? {})),
        removedDefaults: new Set(data.removed ?? []),
        activePreset: (data.preset ?? "default") as PresetId,
        whenClauses: new Map(Object.entries(data.when ?? {})),
      });
    } catch {
      // Ignore parse errors
    }
  },

  loadPreset: (presetId) => {
    const preset = KEYBINDING_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    if (presetId === "default") {
      // Reset to defaults
      set({
        customBindings: new Map(),
        removedDefaults: new Set(),
        activePreset: "default",
      });
    } else {
      // Apply preset bindings as custom overrides
      const bindings = new Map<string, string>(Object.entries(preset.bindings));
      set({
        customBindings: bindings,
        removedDefaults: new Set(),
        activePreset: presetId,
      });
    }
    get().save();
  },

  setWhenClause: (commandId, when) => {
    set((s) => {
      const next = new Map(s.whenClauses);
      next.set(commandId, when);
      return { whenClauses: next };
    });
    get().save();
  },

  removeWhenClause: (commandId) => {
    set((s) => {
      const next = new Map(s.whenClauses);
      next.delete(commandId);
      return { whenClauses: next };
    });
    get().save();
  },

  isActiveInContext: (commandId) => {
    const when = get().whenClauses.get(commandId);
    return evaluateWhenClause(when);
  },
}));

// ══════════════════════════════════════════════════════════════════════
// Keybinding Normalization
// ══════════════════════════════════════════════════════════════════════

/**
 * Normalize a keybinding string for consistent comparison.
 * "ctrl+shift+p" → "Ctrl+Shift+P"
 * "Ctrl+K Ctrl+T" → "Ctrl+K Ctrl+T" (multi-chord preserved)
 */
export function normalizeKeybinding(input: string): string {
  return input
    .split(" ")
    .map((chord) =>
      chord
        .split("+")
        .map((part) => {
          const lower = part.toLowerCase();
          if (lower === "ctrl" || lower === "control") return "Ctrl";
          if (lower === "alt") return "Alt";
          if (lower === "shift") return "Shift";
          if (lower === "meta" || lower === "cmd" || lower === "super") return "Meta";
          return part.length === 1 ? part.toUpperCase() : part;
        })
        .join("+")
    )
    .join(" ");
}

/**
 * Parse a keybinding into chords.
 * "Ctrl+K Ctrl+T" → [["Ctrl", "K"], ["Ctrl", "T"]]
 */
export function parseKeybinding(binding: string): string[][] {
  return binding.split(" ").map((chord) => chord.split("+"));
}

/**
 * Check if a keybinding is multi-chord (has spaces).
 */
export function isMultiChord(binding: string): boolean {
  return binding.includes(" ");
}

/**
 * Convert a KeyboardEvent into a combo string.
 */
export function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");

  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
    parts.push(key);
  }

  return parts.join("+");
}
