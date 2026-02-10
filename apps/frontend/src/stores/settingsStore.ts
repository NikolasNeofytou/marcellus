/**
 * Settings Store — Persistent user preferences with categories.
 *
 * Mirrors VS Code's settings model: every setting has an ID, label,
 * category, type, default value, and optional constraints.
 */

import { create } from "zustand";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type SettingType = "boolean" | "number" | "string" | "enum" | "color";

export interface SettingDefinition {
  id: string;
  label: string;
  description: string;
  category: string;
  type: SettingType;
  defaultValue: unknown;
  /** For enum type */
  options?: string[];
  /** For number type */
  min?: number;
  max?: number;
  step?: number;
  /** Restart required? */
  requiresRestart?: boolean;
}

export interface SettingsState {
  /** All registered setting definitions */
  definitions: SettingDefinition[];
  /** Current values (overrides of defaults) */
  values: Record<string, unknown>;
  /** Search filter */
  searchQuery: string;
  /** Active category filter */
  activeCategory: string | null;
  /** Whether settings have been modified since last save */
  dirty: boolean;

  // Actions
  setValue: (id: string, value: unknown) => void;
  resetToDefault: (id: string) => void;
  resetAllDefaults: () => void;
  setSearchQuery: (q: string) => void;
  setActiveCategory: (cat: string | null) => void;
  getValue: <T = unknown>(id: string) => T;
  getCategories: () => string[];
  getFilteredSettings: () => SettingDefinition[];
}

/* ------------------------------------------------------------------ */
/*  Built-in setting definitions                                      */
/* ------------------------------------------------------------------ */

const BUILT_IN_SETTINGS: SettingDefinition[] = [
  // ── Editor ──
  { id: "editor.fontSize", label: "Font Size", description: "Controls the editor font size in pixels.", category: "Editor", type: "number", defaultValue: 13, min: 8, max: 32, step: 1 },
  { id: "editor.fontFamily", label: "Font Family", description: "Controls the editor font family.", category: "Editor", type: "string", defaultValue: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" },
  { id: "editor.tabSize", label: "Tab Size", description: "Number of spaces per indentation level.", category: "Editor", type: "number", defaultValue: 2, min: 1, max: 8, step: 1 },
  { id: "editor.wordWrap", label: "Word Wrap", description: "Controls how lines should wrap.", category: "Editor", type: "enum", defaultValue: "off", options: ["off", "on", "wordWrapColumn", "bounded"] },
  { id: "editor.lineNumbers", label: "Line Numbers", description: "Controls the display of line numbers.", category: "Editor", type: "enum", defaultValue: "on", options: ["on", "off", "relative"] },
  { id: "editor.minimap", label: "Show Minimap", description: "Controls whether the minimap is displayed.", category: "Editor", type: "boolean", defaultValue: true },
  { id: "editor.renderWhitespace", label: "Render Whitespace", description: "Controls how whitespace is rendered.", category: "Editor", type: "enum", defaultValue: "selection", options: ["none", "boundary", "selection", "all"] },
  { id: "editor.cursorStyle", label: "Cursor Style", description: "Controls the cursor style.", category: "Editor", type: "enum", defaultValue: "line", options: ["line", "block", "underline"] },
  { id: "editor.cursorBlinking", label: "Cursor Blinking", description: "Controls cursor blinking animation.", category: "Editor", type: "enum", defaultValue: "blink", options: ["blink", "smooth", "phase", "expand", "solid"] },
  { id: "editor.autoSave", label: "Auto Save", description: "Controls auto-save behavior.", category: "Editor", type: "enum", defaultValue: "afterDelay", options: ["off", "afterDelay", "onFocusChange"] },
  { id: "editor.autoSaveDelay", label: "Auto Save Delay", description: "Delay in milliseconds before auto-save triggers.", category: "Editor", type: "number", defaultValue: 1000, min: 100, max: 30000, step: 100 },

  // ── HDL ──
  { id: "hdl.defaultLanguage", label: "Default HDL Language", description: "Default language for new HDL files.", category: "HDL", type: "enum", defaultValue: "systemverilog", options: ["verilog", "systemverilog", "vhdl"] },
  { id: "hdl.lintOnType", label: "Lint on Type", description: "Run linter as you type (with debounce).", category: "HDL", type: "boolean", defaultValue: true },
  { id: "hdl.lintDelay", label: "Lint Delay", description: "Delay in ms before linting after the last keystroke.", category: "HDL", type: "number", defaultValue: 300, min: 50, max: 2000, step: 50 },
  { id: "hdl.autocomplete", label: "Enable Autocomplete", description: "Enable IntelliSense-style autocomplete in HDL editor.", category: "HDL", type: "boolean", defaultValue: true },
  { id: "hdl.autoTriggerChars", label: "Auto-trigger Characters", description: "Characters that automatically trigger autocomplete.", category: "HDL", type: "string", defaultValue: "$." },
  { id: "hdl.formatOnSave", label: "Format on Save", description: "Automatically format HDL code when saving.", category: "HDL", type: "boolean", defaultValue: false },
  { id: "hdl.indentStyle", label: "Indent Style", description: "Indentation style for HDL formatting.", category: "HDL", type: "enum", defaultValue: "spaces", options: ["spaces", "tabs"] },

  // ── Layout ──
  { id: "layout.gridVisible", label: "Show Grid", description: "Show grid lines on layout canvas.", category: "Layout", type: "boolean", defaultValue: true },
  { id: "layout.gridSnap", label: "Snap to Grid", description: "Snap geometry to the manufacturing grid.", category: "Layout", type: "boolean", defaultValue: true },
  { id: "layout.gridSize", label: "Grid Size (µm)", description: "Grid spacing in micrometers.", category: "Layout", type: "number", defaultValue: 0.005, min: 0.001, max: 1, step: 0.001 },
  { id: "layout.crosshairs", label: "Crosshair Cursor", description: "Show full-screen crosshairs at cursor position.", category: "Layout", type: "boolean", defaultValue: true },
  { id: "layout.zoomSpeed", label: "Zoom Speed", description: "Mouse wheel zoom sensitivity (1-10).", category: "Layout", type: "number", defaultValue: 5, min: 1, max: 10, step: 1 },
  { id: "layout.antialiasing", label: "Antialiasing", description: "Enable antialiased geometry rendering.", category: "Layout", type: "boolean", defaultValue: true },
  { id: "layout.fillOpacity", label: "Fill Opacity", description: "Default fill opacity for geometries (0-100).", category: "Layout", type: "number", defaultValue: 40, min: 0, max: 100, step: 5 },

  // ── Simulation ──
  { id: "sim.engineBackend", label: "Simulation Engine", description: "Preferred simulation backend.", category: "Simulation", type: "enum", defaultValue: "builtin", options: ["builtin", "ngspice-wasm"] },
  { id: "sim.maxIterations", label: "Max NR Iterations", description: "Maximum Newton-Raphson iterations before giving up.", category: "Simulation", type: "number", defaultValue: 100, min: 10, max: 1000, step: 10 },
  { id: "sim.convergenceTol", label: "Convergence Tolerance", description: "Voltage convergence tolerance (V).", category: "Simulation", type: "number", defaultValue: 1e-6, min: 1e-12, max: 1e-3, step: 1e-7 },
  { id: "sim.temperature", label: "Default Temperature (°C)", description: "Default simulation temperature.", category: "Simulation", type: "number", defaultValue: 27, min: -40, max: 175, step: 1 },

  // ── DRC ──
  { id: "drc.runOnEdit", label: "Incremental DRC", description: "Automatically run DRC on geometry changes.", category: "DRC", type: "boolean", defaultValue: true },
  { id: "drc.showOverlay", label: "Show DRC Overlay", description: "Display DRC violation markers on canvas.", category: "DRC", type: "boolean", defaultValue: true },
  { id: "drc.maxViolations", label: "Max Violations", description: "Maximum violations to display before truncating.", category: "DRC", type: "number", defaultValue: 500, min: 10, max: 5000, step: 10 },

  // ── Appearance ──
  { id: "appearance.theme", label: "Color Theme", description: "The color theme for the IDE.", category: "Appearance", type: "enum", defaultValue: "dark", options: ["dark", "light", "solarized-dark", "dracula", "nord"] },
  { id: "appearance.accentColor", label: "Accent Color", description: "Primary accent color for UI elements.", category: "Appearance", type: "color", defaultValue: "#4a9eff" },
  { id: "appearance.activityBarPosition", label: "Activity Bar Position", description: "Position of the activity bar.", category: "Appearance", type: "enum", defaultValue: "left", options: ["left", "top", "hidden"] },
  { id: "appearance.statusBar", label: "Show Status Bar", description: "Controls whether the status bar is visible.", category: "Appearance", type: "boolean", defaultValue: true },
  { id: "appearance.breadcrumbs", label: "Show Breadcrumbs", description: "Controls whether breadcrumbs are shown in the editor.", category: "Appearance", type: "boolean", defaultValue: true },

  // ── Terminal ──
  { id: "terminal.fontSize", label: "Terminal Font Size", description: "Font size for the integrated terminal.", category: "Terminal", type: "number", defaultValue: 12, min: 8, max: 24, step: 1 },
  { id: "terminal.fontFamily", label: "Terminal Font Family", description: "Font family for the integrated terminal.", category: "Terminal", type: "string", defaultValue: "'JetBrains Mono', monospace" },
  { id: "terminal.scrollback", label: "Scrollback Lines", description: "Maximum number of terminal scrollback lines.", category: "Terminal", type: "number", defaultValue: 1000, min: 100, max: 10000, step: 100 },

  // ── Waveform ──
  { id: "waveform.defaultRadix", label: "Default Radix", description: "Default display radix for bus signals.", category: "Waveform", type: "enum", defaultValue: "hex", options: ["hex", "decimal", "binary", "octal"] },
  { id: "waveform.analogInterpolation", label: "Analog Interpolation", description: "Interpolation style for analog signals.", category: "Waveform", type: "enum", defaultValue: "linear", options: ["linear", "step", "smooth"] },
  { id: "waveform.signalHeight", label: "Signal Height (px)", description: "Default height of each signal track.", category: "Waveform", type: "number", defaultValue: 40, min: 20, max: 100, step: 5 },

  // ── Build ──
  { id: "build.defaultTool", label: "Default Build Tool", description: "Preferred EDA tool for building/simulation.", category: "Build", type: "enum", defaultValue: "iverilog", options: ["iverilog", "verilator", "yosys", "make"] },
  { id: "build.autoSaveBefore", label: "Auto-save Before Build", description: "Automatically save files before running build.", category: "Build", type: "boolean", defaultValue: true },
  { id: "build.showOutput", label: "Show Build Output", description: "Automatically show terminal on build.", category: "Build", type: "boolean", defaultValue: true },
];

/* ------------------------------------------------------------------ */
/*  Persistence                                                       */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "opensilicon:settings";

function loadValues(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveValues(values: Record<string, unknown>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

export const useSettingsStore = create<SettingsState>((set, get) => ({
  definitions: BUILT_IN_SETTINGS,
  values: loadValues(),
  searchQuery: "",
  activeCategory: null,
  dirty: false,

  setValue: (id, value) => {
    const newValues = { ...get().values, [id]: value };
    saveValues(newValues);
    set({ values: newValues, dirty: true });
  },

  resetToDefault: (id) => {
    const newValues = { ...get().values };
    delete newValues[id];
    saveValues(newValues);
    set({ values: newValues, dirty: true });
  },

  resetAllDefaults: () => {
    saveValues({});
    set({ values: {}, dirty: true });
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveCategory: (cat) => set({ activeCategory: cat }),

  getValue: <T = unknown>(id: string): T => {
    const { values, definitions } = get();
    if (id in values) return values[id] as T;
    const def = definitions.find((d) => d.id === id);
    return (def?.defaultValue ?? undefined) as T;
  },

  getCategories: () => {
    const cats = new Set(get().definitions.map((d) => d.category));
    return Array.from(cats).sort();
  },

  getFilteredSettings: () => {
    const { definitions, searchQuery, activeCategory } = get();
    let filtered = definitions;
    if (activeCategory) {
      filtered = filtered.filter((d) => d.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.label.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q)
      );
    }
    return filtered;
  },
}));
