/**
 * Plugin Manager Store
 *
 * Manages the lifecycle of all plugins: installation, activation,
 * disabling, dynamic loading, and providing access to the active PDK + design rules.
 */

import { create } from "zustand";
import type {
  PluginManifest,
  PluginInstance,
  PluginState,
  PDKDefinition,
  DesignRule,
  DeviceGeneratorDef,
  DRCRuleDeck,
  TechLayer,
  ViaDefinition,
} from "../plugins/types";
import { sky130Plugin } from "../plugins/sky130";
import type { PluginModule } from "../plugins/pluginApi";
import { createPluginContext, pluginEventBus, loadWasmPlugin } from "../plugins/pluginApi";

// ── Loaded module registry (outside store for stable refs) ──────

const loadedModules = new Map<string, PluginModule>();
const cleanupFns = new Map<string, (() => void)[]>();

// ── Store interface ───────────────────────────────────────────────

interface PluginStoreState {
  /** All registered plugins */
  plugins: PluginInstance[];

  /** Currently active PDK plugin id */
  activePdkId: string | null;

  // ── Getters ──
  getPlugin: (id: string) => PluginInstance | undefined;
  getActivePdk: () => PDKDefinition | undefined;
  getActiveDesignRules: () => DesignRule[];
  getActiveDrcDecks: () => DRCRuleDeck[];
  getDeviceGenerators: () => DeviceGeneratorDef[];
  getTechLayers: () => TechLayer[];
  getViaDefinitions: () => ViaDefinition[];

  // ── Actions ──
  registerPlugin: (manifest: PluginManifest) => void;
  activatePlugin: (id: string) => void;
  disablePlugin: (id: string) => void;
  setActivePdk: (id: string) => void;
  unregisterPlugin: (id: string) => void;

  /** Load a JS plugin module and activate it with a PluginContext */
  loadAndActivateModule: (id: string, mod: PluginModule) => Promise<void>;

  /** Deactivate a running plugin module */
  deactivateModule: (id: string) => Promise<void>;

  /** Install a plugin from a JSON manifest blob */
  installFromManifest: (json: string) => { success: boolean; error?: string };

  /** Load and activate a WebAssembly plugin module */
  loadAndActivateWasm: (id: string, source: string | ArrayBuffer) => Promise<void>;
}

// ── Store implementation ──────────────────────────────────────────

export const usePluginStore = create<PluginStoreState>((set, get) => {
  // Auto-register built-in plugins
  const builtinPlugins: PluginInstance[] = [
    {
      manifest: sky130Plugin,
      state: "active" as PluginState,
      activatedAt: Date.now(),
    },
  ];

  return {
    plugins: builtinPlugins,
    activePdkId: "opensilicon.sky130-pdk",

    // ── Getters ──

    getPlugin: (id) => get().plugins.find((p) => p.manifest.id === id),

    getActivePdk: () => {
      const { activePdkId, plugins } = get();
      if (!activePdkId) return undefined;
      const plugin = plugins.find((p) => p.manifest.id === activePdkId);
      return plugin?.manifest.contributes.pdk;
    },

    getActiveDesignRules: () => {
      const pdk = get().getActivePdk();
      return pdk?.designRules ?? [];
    },

    getActiveDrcDecks: () => {
      const { activePdkId, plugins } = get();
      if (!activePdkId) return [];
      const plugin = plugins.find((p) => p.manifest.id === activePdkId);
      return plugin?.manifest.contributes.drcRuleDecks ?? [];
    },

    getDeviceGenerators: () => {
      const { plugins } = get();
      const generators: DeviceGeneratorDef[] = [];
      for (const p of plugins) {
        if (p.state === "active" && p.manifest.contributes.deviceGenerators) {
          generators.push(...p.manifest.contributes.deviceGenerators);
        }
      }
      return generators;
    },

    getTechLayers: () => {
      const pdk = get().getActivePdk();
      return pdk?.layers ?? [];
    },

    getViaDefinitions: () => {
      const pdk = get().getActivePdk();
      return pdk?.vias ?? [];
    },

    // ── Actions ──

    registerPlugin: (manifest) =>
      set((s) => {
        if (s.plugins.some((p) => p.manifest.id === manifest.id)) {
          return {
            plugins: s.plugins.map((p) =>
              p.manifest.id === manifest.id ? { ...p, manifest } : p
            ),
          };
        }
        return {
          plugins: [
            ...s.plugins,
            { manifest, state: "installed" as PluginState },
          ],
        };
      }),

    activatePlugin: (id) =>
      set((s) => ({
        plugins: s.plugins.map((p) =>
          p.manifest.id === id
            ? { ...p, state: "active" as PluginState, activatedAt: Date.now(), error: undefined }
            : p
        ),
      })),

    disablePlugin: (id) =>
      set((s) => ({
        plugins: s.plugins.map((p) =>
          p.manifest.id === id
            ? { ...p, state: "disabled" as PluginState }
            : p
        ),
        activePdkId: s.activePdkId === id ? null : s.activePdkId,
      })),

    setActivePdk: (id) => set({ activePdkId: id }),

    unregisterPlugin: (id) =>
      set((s) => ({
        plugins: s.plugins.filter((p) => p.manifest.id !== id),
        activePdkId: s.activePdkId === id ? null : s.activePdkId,
      })),

    // ── Dynamic module loading ──

    loadAndActivateModule: async (id, mod) => {
      try {
        const ctx = createPluginContext(id);
        await mod.activate(ctx);
        loadedModules.set(id, mod);
        get().activatePlugin(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        set((s) => ({
          plugins: s.plugins.map((p) =>
            p.manifest.id === id
              ? { ...p, state: "error" as PluginState, error: msg }
              : p
          ),
        }));
        console.error(`[PluginStore] Failed to activate "${id}":`, err);
      }
    },

    deactivateModule: async (id) => {
      const mod = loadedModules.get(id);
      if (mod?.deactivate) {
        try {
          await mod.deactivate();
        } catch (err) {
          console.error(`[PluginStore] Error deactivating "${id}":`, err);
        }
      }
      // Clean up event handlers registered via this plugin
      const fns = cleanupFns.get(id);
      if (fns) {
        fns.forEach((fn) => fn());
        cleanupFns.delete(id);
      }
      loadedModules.delete(id);
      get().disablePlugin(id);
    },

    installFromManifest: (json) => {
      try {
        const manifest = JSON.parse(json) as PluginManifest;
        if (!manifest.id || !manifest.name || !manifest.version) {
          return { success: false, error: "Manifest missing required fields (id, name, version)" };
        }
        if (!manifest.contributes) {
          manifest.contributes = {};
        }
        if (!manifest.categories) {
          manifest.categories = [];
        }
        get().registerPlugin(manifest);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    loadAndActivateWasm: async (id, source) => {
      try {
        const wasmModule = await loadWasmPlugin(source, id);
        await get().loadAndActivateModule(id, wasmModule);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        set((s) => ({
          plugins: s.plugins.map((p) =>
            p.manifest.id === id
              ? { ...p, state: "error" as PluginState, error: msg }
              : p
          ),
        }));
        console.error(`[PluginStore] Failed to load WASM plugin "${id}":`, err);
      }
    },
  };
});

/** Re-export event bus for convenience */
export { pluginEventBus };
