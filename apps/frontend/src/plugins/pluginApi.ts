/**
 * Plugin API — the surface area that third-party plugins interact with.
 *
 * A plugin receives a `PluginContext` that contains everything it needs:
 *   • layout   – read/write geometries
 *   • layers   – query layer stack
 *   • drc      – register checkers, report violations
 *   • commands – register custom commands
 *   • ui       – show notifications, register sidebar panels
 *   • events   – subscribe to IDE lifecycle events
 *
 * Plugins are ordinary TS/JS modules exporting `activate(ctx: PluginContext)`.
 */

import type { CanvasGeometry } from "../stores/geometryStore";
import type { DesignRule, TechLayer, PDKDefinition, DRCRuleDeck } from "./types";
import type { DrcViolation } from "../engines/drc";

// ══════════════════════════════════════════════════════════════════════
// Event System
// ══════════════════════════════════════════════════════════════════════

export type PluginEventType =
  | "geometry:added"
  | "geometry:removed"
  | "geometry:changed"
  | "selection:changed"
  | "tool:changed"
  | "layer:changed"
  | "drc:started"
  | "drc:completed"
  | "netlist:extracted"
  | "project:loaded"
  | "project:saved";

export interface PluginEvent<T = unknown> {
  type: PluginEventType;
  timestamp: number;
  data: T;
}

export type PluginEventHandler<T = unknown> = (event: PluginEvent<T>) => void;

/** Global event bus shared by all plugins and the core IDE. */
class PluginEventBus {
  private listeners = new Map<PluginEventType, Set<PluginEventHandler>>();

  on<T = unknown>(type: PluginEventType, handler: PluginEventHandler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const set = this.listeners.get(type)!;
    set.add(handler as PluginEventHandler);
    // Return unsubscribe function
    return () => set.delete(handler as PluginEventHandler);
  }

  once<T = unknown>(type: PluginEventType, handler: PluginEventHandler<T>): () => void {
    const unsub = this.on<T>(type, (event) => {
      unsub();
      handler(event);
    });
    return unsub;
  }

  emit<T = unknown>(type: PluginEventType, data: T): void {
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    const event: PluginEvent<T> = { type, timestamp: Date.now(), data };
    for (const handler of handlers) {
      try {
        (handler as PluginEventHandler<T>)(event);
      } catch (err) {
        console.error(`[PluginEventBus] Error in handler for "${type}":`, err);
      }
    }
  }

  removeAll(type?: PluginEventType): void {
    if (type) {
      this.listeners.delete(type);
    } else {
      this.listeners.clear();
    }
  }
}

/** Singleton event bus */
export const pluginEventBus = new PluginEventBus();

// ══════════════════════════════════════════════════════════════════════
// Plugin Context — API given to each plugin on activation
// ══════════════════════════════════════════════════════════════════════

/** Layout API: read/write geometries */
export interface LayoutApi {
  getGeometries(): CanvasGeometry[];
  addGeometry(geom: CanvasGeometry): void;
  removeGeometries(indices: number[]): void;
  replaceAll(geoms: CanvasGeometry[]): void;
  undo(): boolean;
  redo(): boolean;
}

/** Layer API: query/modify the layer stack */
export interface LayerApi {
  getLayers(): TechLayer[];
  getLayerByAlias(alias: string): TechLayer | undefined;
  setLayerVisibility(gdsLayer: number, visible: boolean): void;
}

/** DRC API: run checks, register custom checkers */
export interface DrcApi {
  runCheck(): void;
  getViolations(): DrcViolation[];
  clearViolations(): void;
  registerCustomChecker(checker: CustomDrcChecker): void;
  unregisterCustomChecker(id: string): void;
}

/** A custom DRC checker registered by a plugin */
export interface CustomDrcChecker {
  id: string;
  name: string;
  description: string;
  /** The check function receives geometries + rules and returns violations */
  check: (
    geometries: Array<{
      index: number;
      type: string;
      layerAlias: string;
      bbox: { minX: number; minY: number; maxX: number; maxY: number };
      points: { x: number; y: number }[];
      width?: number;
    }>,
    rules: DesignRule[]
  ) => DrcViolation[];
}

/** Command API: register commands plugins can expose */
export interface CommandApi {
  register(id: string, label: string, execute: () => void, keybinding?: string): void;
  unregister(id: string): void;
  execute(id: string): void;
}

/** UI API: notifications, status indicators */
export interface UiApi {
  showNotification(message: string, severity?: "info" | "warning" | "error"): void;
  setStatusBarItem(id: string, text: string): void;
  removeStatusBarItem(id: string): void;
  appendTerminalLine(line: string): void;
}

/** The complete context object given to plugins on activation */
export interface PluginContext {
  /** Plugin identity */
  pluginId: string;

  /** Layout geometry API */
  layout: LayoutApi;

  /** Layer stack API */
  layers: LayerApi;

  /** DRC API */
  drc: DrcApi;

  /** Command registration API */
  commands: CommandApi;

  /** UI/notification API */
  ui: UiApi;

  /** Event bus for subscribing to IDE events */
  events: {
    on: PluginEventBus["on"];
    once: PluginEventBus["once"];
  };

  /** Active PDK, if any */
  pdk: PDKDefinition | undefined;

  /** Active DRC rule decks */
  ruleDeck: DRCRuleDeck[];

  /** Log to plugin console */
  log: (...args: unknown[]) => void;
}

// ══════════════════════════════════════════════════════════════════════
// Plugin Lifecycle
// ══════════════════════════════════════════════════════════════════════

/** A loaded plugin module must export at least `activate`. */
export interface PluginModule {
  activate: (ctx: PluginContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

// ══════════════════════════════════════════════════════════════════════
// WASM Plugin Support
// ══════════════════════════════════════════════════════════════════════

/**
 * Expected exports from a WebAssembly plugin module.
 * The WASM module must export:
 *   - activate(ctxPtr) → void
 *   - deactivate() → void  (optional)
 *   - memory: WebAssembly.Memory
 *
 * Communication with the host is done via an import object providing
 * callback functions for layout, DRC, and command APIs.
 */
export interface WasmPluginExports {
  activate: (ctxPtr: number) => void;
  deactivate?: () => void;
  memory: WebAssembly.Memory;
}

/**
 * Load a WebAssembly plugin from a URL or ArrayBuffer and wrap it
 * as a standard PluginModule so it can be used with loadAndActivateModule.
 *
 * The WASM module receives a simplified host API via imports:
 *   env.host_log(ptr, len)           — log a UTF-8 string
 *   env.host_add_rect(layer, x, y, w, h) — add a rectangle geometry
 *   env.host_register_command(idPtr, idLen, labelPtr, labelLen) — register cmd
 *   env.host_show_notification(ptr, len, severity) — show notification
 *
 * @param source  URL string or ArrayBuffer of the .wasm file
 * @param pluginId  Plugin identifier for context creation
 * @returns A PluginModule wrapping the WASM instance
 */
export async function loadWasmPlugin(
  source: string | ArrayBuffer,
  _pluginId: string
): Promise<PluginModule> {
  // Will be populated once activate() creates the context
  let ctx: PluginContext | null = null;

  /** Read a UTF-8 string from WASM memory */
  function readString(memory: WebAssembly.Memory, ptr: number, len: number): string {
    const bytes = new Uint8Array(memory.buffer, ptr, len);
    return new TextDecoder().decode(bytes);
  }

  // Host imports provided to the WASM module
  const importObject: WebAssembly.Imports = {
    env: {
      host_log: (ptr: number, len: number) => {
        if (!wasmInstance) return;
        const msg = readString(wasmInstance.exports.memory as WebAssembly.Memory, ptr, len);
        ctx?.log(msg);
      },
      host_add_rect: (layer: number, x: number, y: number, w: number, h: number) => {
        ctx?.layout.addGeometry({
          type: "rect",
          layerId: layer,
          points: [
            { x, y },
            { x: x + w, y: y + h },
          ],
        } as import("../stores/geometryStore").CanvasGeometry);
      },
      host_register_command: (
        idPtr: number,
        idLen: number,
        labelPtr: number,
        labelLen: number
      ) => {
        if (!wasmInstance) return;
        const mem = wasmInstance.exports.memory as WebAssembly.Memory;
        const id = readString(mem, idPtr, idLen);
        const label = readString(mem, labelPtr, labelLen);
        ctx?.commands.register(id, label, () => {
          /* WASM command callback — can be extended with function table */
        });
      },
      host_show_notification: (ptr: number, len: number, severity: number) => {
        if (!wasmInstance) return;
        const msg = readString(wasmInstance.exports.memory as WebAssembly.Memory, ptr, len);
        const sev = severity === 2 ? "error" : severity === 1 ? "warning" : "info";
        ctx?.ui.showNotification(msg, sev);
      },
    },
  };

  // Load WASM module
  let wasmModule: WebAssembly.Module;
  if (typeof source === "string") {
    // Streaming compile from URL
    if (typeof WebAssembly.compileStreaming === "function") {
      wasmModule = await WebAssembly.compileStreaming(fetch(source));
    } else {
      const response = await fetch(source);
      const buffer = await response.arrayBuffer();
      wasmModule = await WebAssembly.compile(buffer);
    }
  } else {
    wasmModule = await WebAssembly.compile(source);
  }

  let wasmInstance: WebAssembly.Instance | null = null;

  return {
    activate: async (pluginCtx: PluginContext) => {
      ctx = pluginCtx;
      wasmInstance = await WebAssembly.instantiate(wasmModule, importObject);
      const exports = wasmInstance.exports as unknown as WasmPluginExports;
      if (typeof exports.activate === "function") {
        exports.activate(0); // Pass 0 as context pointer; host manages context
      }
    },
    deactivate: async () => {
      if (wasmInstance) {
        const exports = wasmInstance.exports as unknown as WasmPluginExports;
        if (typeof exports.deactivate === "function") {
          exports.deactivate();
        }
        wasmInstance = null;
      }
      ctx = null;
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// Custom DRC Checker Registry
// ══════════════════════════════════════════════════════════════════════

const customCheckers = new Map<string, CustomDrcChecker>();

export function registerCustomChecker(checker: CustomDrcChecker): void {
  customCheckers.set(checker.id, checker);
}

export function unregisterCustomChecker(id: string): void {
  customCheckers.delete(id);
}

export function getCustomCheckers(): CustomDrcChecker[] {
  return Array.from(customCheckers.values());
}

import { useGeometryStore } from "../stores/geometryStore";
import { useLayerStore } from "../stores/layerStore";
import { useDrcStore } from "../stores/drcStore";
import { useCommandStore } from "../stores/commandStore";
import { usePluginStore } from "../stores/pluginStore";
import { useSimStore } from "../stores/simStore";

// ══════════════════════════════════════════════════════════════════════
// Context Factory — builds a PluginContext from store references
// ══════════════════════════════════════════════════════════════════════

export function createPluginContext(pluginId: string): PluginContext {

  const layout: LayoutApi = {
    getGeometries: () => useGeometryStore.getState().geometries,
    addGeometry: (geom) => useGeometryStore.getState().addGeometry(geom),
    removeGeometries: (indices) => useGeometryStore.getState().removeGeometries(indices),
    replaceAll: (geoms) => useGeometryStore.getState().replaceAll(geoms),
    undo: () => useGeometryStore.getState().undo(),
    redo: () => useGeometryStore.getState().redo(),
  };

  const layers: LayerApi = {
    getLayers: () => {
      const pdk = usePluginStore.getState().getActivePdk();
      return pdk?.layers ?? [];
    },
    getLayerByAlias: (alias) => {
      const pdk = usePluginStore.getState().getActivePdk();
      return pdk?.layers.find((l: TechLayer) => l.alias === alias);
    },
    setLayerVisibility: (gdsLayer, visible) => {
      const store = useLayerStore.getState();
      const layer = store.layers.find((l: { id: number }) => l.id === gdsLayer);
      if (layer && layer.visible !== visible) {
        store.toggleVisibility(gdsLayer);
      }
    },
  };

  const drc: DrcApi = {
    runCheck: () => useCommandStore.getState().executeCommand("drc.runCheck"),
    getViolations: () => useDrcStore.getState().violations,
    clearViolations: () => useDrcStore.getState().clearViolations(),
    registerCustomChecker: (checker) => registerCustomChecker(checker),
    unregisterCustomChecker: (id) => unregisterCustomChecker(id),
  };

  const commands: CommandApi = {
    register: (id, label, execute, keybinding) => {
      useCommandStore.getState().registerCommand({
        id: `plugin.${pluginId}.${id}`,
        label,
        category: "Plugin",
        keybinding,
        execute,
      });
    },
    unregister: (id) => {
      useCommandStore.getState().unregisterCommand(`plugin.${pluginId}.${id}`);
    },
    execute: (id) => useCommandStore.getState().executeCommand(id),
  };

  const ui: UiApi = {
    showNotification: (message, severity = "info") => {
      const prefix = severity === "error" ? "⛔" : severity === "warning" ? "⚠" : "ℹ";
      useSimStore.getState().appendTerminalLine(`${prefix} [${pluginId}] ${message}`);
    },
    setStatusBarItem: (_id, _text) => {
      // Future: custom status bar items
    },
    removeStatusBarItem: (_id) => {
      // Future: custom status bar items
    },
    appendTerminalLine: (line) => {
      useSimStore.getState().appendTerminalLine(line);
    },
  };

  const pluginStore = usePluginStore.getState();

  return {
    pluginId,
    layout,
    layers,
    drc,
    commands,
    ui,
    events: {
      on: pluginEventBus.on.bind(pluginEventBus),
      once: pluginEventBus.once.bind(pluginEventBus),
    },
    pdk: pluginStore.getActivePdk(),
    ruleDeck: pluginStore.getActiveDrcDecks(),
    log: (...args: unknown[]) => console.log(`[Plugin:${pluginId}]`, ...args),
  };
}
