/**
 * Plugin Manager Store
 *
 * Manages the lifecycle of all plugins: installation, activation,
 * disabling, and providing access to the active PDK + design rules.
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
          // Already registered — update manifest
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
        // If disabling the active PDK, clear it
        activePdkId: s.activePdkId === id ? null : s.activePdkId,
      })),

    setActivePdk: (id) => set({ activePdkId: id }),

    unregisterPlugin: (id) =>
      set((s) => ({
        plugins: s.plugins.filter((p) => p.manifest.id !== id),
        activePdkId: s.activePdkId === id ? null : s.activePdkId,
      })),
  };
});
