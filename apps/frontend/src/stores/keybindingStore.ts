/**
 * Keybinding Store — configurable keyboard shortcuts with multi-chord support.
 *
 * Features:
 *  - Override default keybindings per command
 *  - Multi-chord sequences (e.g. Ctrl+K Ctrl+T)
 *  - Conflict detection
 *  - Persistence via localStorage
 *  - Reset to defaults
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
}

export interface KeybindingConflict {
  keybinding: string;
  commandIds: string[];
}

// ── Store ─────────────────────────────────────────────────────────────

interface KeybindingStoreState {
  /** User-overridden bindings (commandId → keybinding string) */
  customBindings: Map<string, string>;

  /** Removed (disabled) default bindings */
  removedDefaults: Set<string>;

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

  /** Persist to localStorage */
  save: () => void;

  /** Load from localStorage */
  load: () => void;
}

const STORAGE_KEY = "opensilicon.keybindings";

export const useKeybindingStore = create<KeybindingStoreState>((set, get) => ({
  customBindings: new Map(),
  removedDefaults: new Set(),

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
    set({ customBindings: new Map(), removedDefaults: new Set() });
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
    const { customBindings, removedDefaults } = get();
    const data = {
      bindings: Object.fromEntries(customBindings),
      removed: Array.from(removedDefaults),
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
      });
    } catch {
      // Ignore parse errors
    }
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
