/**
 * Marketplace Store
 *
 * Provides a searchable registry of remote plugins & PDKs,
 * installation, version management, and dependency resolution.
 * Uses an in-memory mock registry (no backend needed).
 */

import { create } from "zustand";
import type { PluginManifest, PluginCategory } from "../plugins/types";
import { usePluginStore } from "./pluginStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface MarketplaceEntry {
  manifest: PluginManifest;
  /** Number of downloads (demo) */
  downloads: number;
  /** Average rating 0-5 */
  rating: number;
  /** Number of ratings */
  ratingCount: number;
  /** Publish date ISO string */
  publishedAt: string;
  /** Updated date ISO string */
  updatedAt: string;
  /** Repository URL */
  repoUrl?: string;
  /** README markdown */
  readme: string;
  /** Tags for search */
  tags: string[];
  /** Whether this is a featured/promoted entry */
  featured: boolean;
}

export type SortBy = "relevance" | "downloads" | "rating" | "newest" | "name";
export type MarketplaceFilter = "all" | PluginCategory;

export interface PackageDependency {
  id: string;
  version: string;
  satisfied: boolean;
}

export interface InstalledPackageInfo {
  id: string;
  name: string;
  version: string;
  installedAt: number;
  autoUpdatable: boolean;
  availableUpdate?: string;
  dependencies: PackageDependency[];
}

// ══════════════════════════════════════════════════════════════════════
// Mock Registry
// ══════════════════════════════════════════════════════════════════════

const MOCK_REGISTRY: MarketplaceEntry[] = [
  {
    manifest: {
      id: "opensilicon.sky130-pdk",
      name: "SkyWater SKY130 PDK",
      version: "1.2.0",
      description:
        "Complete SkyWater 130nm process design kit with 5 metal layers, standard cells, and DRC/LVS rule decks.",
      author: "OpenSilicon",
      license: "Apache-2.0",
      categories: ["pdk", "drc"],
      contributes: {},
    },
    downloads: 12840,
    rating: 4.7,
    ratingCount: 156,
    publishedAt: "2024-01-15T00:00:00Z",
    updatedAt: "2025-03-10T00:00:00Z",
    repoUrl: "https://github.com/opensilicon/sky130-pdk",
    readme: "# SKY130 PDK\n\nOpen-source 130nm PDK from SkyWater Technology.\n\n## Features\n- 5 metal layers\n- Standard cell library\n- DRC & LVS rule decks\n- Parasitic extraction models",
    tags: ["pdk", "skywater", "130nm", "open-source", "foundry"],
    featured: true,
  },
  {
    manifest: {
      id: "opensilicon.gf180mcu-pdk",
      name: "GlobalFoundries GF180MCU PDK",
      version: "0.9.2",
      description:
        "GlobalFoundries 180nm MCU PDK with 5 metal layers, 3.3V/5V devices, and analog support.",
      author: "OpenSilicon",
      license: "Apache-2.0",
      categories: ["pdk", "drc"],
      contributes: {},
    },
    downloads: 5420,
    rating: 4.3,
    ratingCount: 67,
    publishedAt: "2024-06-01T00:00:00Z",
    updatedAt: "2025-02-20T00:00:00Z",
    repoUrl: "https://github.com/opensilicon/gf180mcu-pdk",
    readme: "# GF180MCU PDK\n\nOpen-source 180nm PDK from GlobalFoundries.\n\n## Features\n- 5 metal layers\n- 3.3V and 5V device support\n- MCU-optimized standard cells\n- Analog components",
    tags: ["pdk", "globalfoundries", "180nm", "mcu", "analog"],
    featured: true,
  },
  {
    manifest: {
      id: "community.ihp-sg13g2-pdk",
      name: "IHP SG13G2 PDK",
      version: "0.5.0",
      description:
        "IHP Microelectronics 130nm SiGe:C BiCMOS PDK for RF and high-speed applications.",
      author: "IHP Community",
      license: "Apache-2.0",
      categories: ["pdk"],
      contributes: {},
    },
    downloads: 1830,
    rating: 4.0,
    ratingCount: 23,
    publishedAt: "2024-09-15T00:00:00Z",
    updatedAt: "2025-01-05T00:00:00Z",
    readme: "# IHP SG13G2\n\n130nm SiGe:C BiCMOS process for RF/mm-wave applications.\n\n## Features\n- SiGe HBTs up to 350 GHz fT\n- 7 metal layers including thick top metal\n- MIM capacitors",
    tags: ["pdk", "ihp", "sige", "bicmos", "rf", "130nm"],
    featured: false,
  },
  {
    manifest: {
      id: "opensilicon.spice-sim",
      name: "SPICE Simulator Bridge",
      version: "2.1.0",
      description:
        "Connects OpenSilicon to ngspice/Xyce for SPICE-level circuit simulation with waveform import.",
      author: "OpenSilicon",
      license: "MIT",
      categories: ["simulation"],
      contributes: {},
    },
    downloads: 8750,
    rating: 4.5,
    ratingCount: 98,
    publishedAt: "2024-03-01T00:00:00Z",
    updatedAt: "2025-04-01T00:00:00Z",
    repoUrl: "https://github.com/opensilicon/spice-bridge",
    readme: "# SPICE Simulator Bridge\n\nRun ngspice or Xyce simulations directly from OpenSilicon.\n\n## Features\n- Netlist export (SPICE)\n- Simulation control panel\n- Waveform result import\n- Parameter sweeps",
    tags: ["simulation", "spice", "ngspice", "xyce", "waveform"],
    featured: true,
  },
  {
    manifest: {
      id: "community.gds-export",
      name: "GDSII / OASIS Export",
      version: "1.0.3",
      description:
        "Export layouts to GDSII and OASIS stream formats for foundry tape-out.",
      author: "LayoutTools Community",
      license: "MIT",
      categories: ["import-export"],
      contributes: {},
    },
    downloads: 9210,
    rating: 4.6,
    ratingCount: 112,
    publishedAt: "2024-02-10T00:00:00Z",
    updatedAt: "2025-03-25T00:00:00Z",
    readme: "# GDSII / OASIS Export\n\nExport your layouts to industry-standard stream formats.\n\n## Supported Formats\n- GDSII (GDS2)\n- OASIS (OAS)\n- Flat and hierarchical export\n- Layer mapping table support",
    tags: ["gdsii", "oasis", "export", "tapeout", "foundry"],
    featured: false,
  },
  {
    manifest: {
      id: "community.lef-def-import",
      name: "LEF/DEF Importer",
      version: "0.8.1",
      description:
        "Import LEF (Library Exchange Format) and DEF (Design Exchange Format) files for place-and-route integration.",
      author: "EDA Community",
      license: "BSD-3-Clause",
      categories: ["import-export"],
      contributes: {},
    },
    downloads: 3100,
    rating: 4.1,
    ratingCount: 34,
    publishedAt: "2024-07-20T00:00:00Z",
    updatedAt: "2025-01-15T00:00:00Z",
    readme: "# LEF/DEF Importer\n\nImport standard cell and macro definitions from LEF files, and placed designs from DEF.\n\n## Features\n- LEF technology section parsing\n- LEF macro/cell import\n- DEF placement & routing import\n- Net connectivity preservation",
    tags: ["lef", "def", "import", "place-route", "standard-cell"],
    featured: false,
  },
  {
    manifest: {
      id: "opensilicon.drc-magic",
      name: "Magic DRC Engine",
      version: "1.3.0",
      description:
        "Integrates Magic's DRC engine for sign-off quality design rule checking.",
      author: "OpenSilicon",
      license: "MIT",
      categories: ["drc"],
      contributes: {},
    },
    downloads: 6430,
    rating: 4.4,
    ratingCount: 78,
    publishedAt: "2024-04-05T00:00:00Z",
    updatedAt: "2025-03-01T00:00:00Z",
    repoUrl: "https://github.com/opensilicon/drc-magic",
    readme: "# Magic DRC Engine\n\nRun Magic-compatible DRC checks within OpenSilicon.\n\n## Features\n- Full Magic DRC rule deck support\n- Incremental checking\n- Error highlighting with cross-probing\n- Batch mode for CI/CD",
    tags: ["drc", "magic", "sign-off", "design-rules"],
    featured: false,
  },
  {
    manifest: {
      id: "community.dark-silicon-theme",
      name: "Dark Silicon Theme",
      version: "1.0.0",
      description: "A dark theme optimized for long VLSI design sessions with reduced eye strain.",
      author: "UI Community",
      license: "MIT",
      categories: ["theme"],
      contributes: {},
    },
    downloads: 4200,
    rating: 4.8,
    ratingCount: 89,
    publishedAt: "2024-05-12T00:00:00Z",
    updatedAt: "2024-11-30T00:00:00Z",
    readme: "# Dark Silicon Theme\n\nA carefully crafted dark theme for VLSI layout editing.\n\n## Features\n- Optimized contrast for thin geometry lines\n- Layer-aware color palette\n- Reduced blue-light emission\n- Multiple accent color variants",
    tags: ["theme", "dark", "ui", "accessibility"],
    featured: false,
  },
  {
    manifest: {
      id: "community.pcell-generators",
      name: "Parametric Cell Generators",
      version: "2.0.1",
      description:
        "Comprehensive library of parametric cells: transistors, resistors, capacitors, inductors and guard rings.",
      author: "DeviceGen Community",
      license: "Apache-2.0",
      categories: ["device-generator"],
      contributes: {},
    },
    downloads: 7650,
    rating: 4.5,
    ratingCount: 92,
    publishedAt: "2024-01-28T00:00:00Z",
    updatedAt: "2025-02-14T00:00:00Z",
    readme: "# Parametric Cell Generators\n\nGenerate layout-ready devices with parameterized dimensions.\n\n## Included Generators\n- MOSFET (N/P, multi-finger)\n- MIM Capacitors\n- Poly/Diffusion Resistors\n- Spiral Inductors\n- Guard Rings\n- ESD Clamps",
    tags: ["pcell", "generator", "transistor", "capacitor", "inductor"],
    featured: true,
  },
  {
    manifest: {
      id: "community.analog-tools",
      name: "Analog Design Toolkit",
      version: "0.7.0",
      description:
        "Tools for analog IC design: matching constraints, symmetry enforcement, common-centroid placement.",
      author: "Analog Community",
      license: "MIT",
      categories: ["tool"],
      contributes: {},
    },
    downloads: 2890,
    rating: 4.2,
    ratingCount: 41,
    publishedAt: "2024-08-10T00:00:00Z",
    updatedAt: "2025-01-20T00:00:00Z",
    readme: "# Analog Design Toolkit\n\nSpecialized tools for analog and mixed-signal layout.\n\n## Features\n- Device matching constraints\n- Common-centroid placement wizard\n- Symmetry axis enforcement\n- Dummy device insertion\n- Interdigitation patterns",
    tags: ["analog", "matching", "symmetry", "mixed-signal", "placement"],
    featured: false,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════

interface MarketplaceStoreState {
  /** Registry entries */
  registry: MarketplaceEntry[];
  /** Search query */
  searchQuery: string;
  /** Category filter */
  filter: MarketplaceFilter;
  /** Sort order */
  sortBy: SortBy;
  /** Currently selected entry for detail view */
  selectedEntryId: string | null;
  /** Install-in-progress IDs */
  installing: Set<string>;
  /** Installed package metadata */
  installedPackages: Map<string, InstalledPackageInfo>;
  /** Whether package manager view is open */
  packageManagerOpen: boolean;

  // ── Actions ──
  setSearchQuery: (q: string) => void;
  setFilter: (f: MarketplaceFilter) => void;
  setSortBy: (s: SortBy) => void;
  selectEntry: (id: string | null) => void;
  togglePackageManager: () => void;

  /** Get filtered + sorted entries */
  getFilteredEntries: () => MarketplaceEntry[];

  /** Install a marketplace entry (registers in pluginStore) */
  installEntry: (id: string) => void;
  /** Uninstall a marketplace entry */
  uninstallEntry: (id: string) => void;
  /** Check for updates across all installed packages */
  checkForUpdates: () => void;
  /** Update a single package */
  updatePackage: (id: string) => void;
  /** Toggle auto-update for a package */
  toggleAutoUpdate: (id: string) => void;
  /** Get dependency info for a package */
  getDependencies: (id: string) => PackageDependency[];
  /** Check if entry is installed */
  isInstalled: (id: string) => boolean;
}

export const useMarketplaceStore = create<MarketplaceStoreState>((set, get) => ({
  registry: MOCK_REGISTRY,
  searchQuery: "",
  filter: "all",
  sortBy: "relevance",
  selectedEntryId: null,
  installing: new Set(),
  installedPackages: new Map([
    [
      "opensilicon.sky130-pdk",
      {
        id: "opensilicon.sky130-pdk",
        name: "SkyWater SKY130 PDK",
        version: "1.2.0",
        installedAt: Date.now() - 86400000 * 30,
        autoUpdatable: true,
        dependencies: [],
      },
    ],
  ]),
  packageManagerOpen: false,

  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilter: (f) => set({ filter: f }),
  setSortBy: (s) => set({ sortBy: s }),
  selectEntry: (id) => set({ selectedEntryId: id }),
  togglePackageManager: () => set((s) => ({ packageManagerOpen: !s.packageManagerOpen })),

  getFilteredEntries: () => {
    const { registry, searchQuery, filter, sortBy } = get();
    let entries = [...registry];

    // Filter by category
    if (filter !== "all") {
      entries = entries.filter((e) =>
        e.manifest.categories.includes(filter as PluginCategory)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.manifest.name.toLowerCase().includes(q) ||
          e.manifest.description.toLowerCase().includes(q) ||
          e.tags.some((t) => t.includes(q)) ||
          e.manifest.author.toLowerCase().includes(q) ||
          e.manifest.id.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sortBy) {
      case "downloads":
        entries.sort((a, b) => b.downloads - a.downloads);
        break;
      case "rating":
        entries.sort((a, b) => b.rating - a.rating);
        break;
      case "newest":
        entries.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        break;
      case "name":
        entries.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name));
        break;
      case "relevance":
      default:
        // Featured first, then by downloads
        entries.sort((a, b) => {
          if (a.featured !== b.featured) return a.featured ? -1 : 1;
          return b.downloads - a.downloads;
        });
        break;
    }

    return entries;
  },

  isInstalled: (id) => {
    const plugins = usePluginStore.getState().plugins;
    return plugins.some((p) => p.manifest.id === id);
  },

  installEntry: (id) => {
    const entry = get().registry.find((e) => e.manifest.id === id);
    if (!entry) return;

    // Simulate install delay
    set((s) => {
      const installing = new Set(s.installing);
      installing.add(id);
      return { installing };
    });

    setTimeout(() => {
      // Register in plugin store
      usePluginStore.getState().registerPlugin(entry.manifest);
      usePluginStore.getState().activatePlugin(id);

      // Track in installed packages
      set((s) => {
        const installing = new Set(s.installing);
        installing.delete(id);
        const installedPackages = new Map(s.installedPackages);
        installedPackages.set(id, {
          id,
          name: entry.manifest.name,
          version: entry.manifest.version,
          installedAt: Date.now(),
          autoUpdatable: true,
          dependencies: get().getDependencies(id),
        });
        return { installing, installedPackages };
      });
    }, 800 + Math.random() * 600);
  },

  uninstallEntry: (id) => {
    usePluginStore.getState().disablePlugin(id);
    usePluginStore.getState().unregisterPlugin(id);

    set((s) => {
      const installedPackages = new Map(s.installedPackages);
      installedPackages.delete(id);
      return { installedPackages };
    });
  },

  checkForUpdates: () => {
    // Simulate finding updates for some packages
    set((s) => {
      const installedPackages = new Map(s.installedPackages);
      for (const [id, pkg] of installedPackages) {
        const registryEntry = s.registry.find((e) => e.manifest.id === id);
        if (registryEntry && registryEntry.manifest.version !== pkg.version) {
          installedPackages.set(id, {
            ...pkg,
            availableUpdate: registryEntry.manifest.version,
          });
        }
      }
      return { installedPackages };
    });
  },

  updatePackage: (id) => {
    const pkg = get().installedPackages.get(id);
    const entry = get().registry.find((e) => e.manifest.id === id);
    if (!pkg || !entry) return;

    // Update plugin manifest
    usePluginStore.getState().registerPlugin(entry.manifest);

    set((s) => {
      const installedPackages = new Map(s.installedPackages);
      installedPackages.set(id, {
        ...pkg,
        version: entry.manifest.version,
        availableUpdate: undefined,
      });
      return { installedPackages };
    });
  },

  toggleAutoUpdate: (id) => {
    set((s) => {
      const installedPackages = new Map(s.installedPackages);
      const pkg = installedPackages.get(id);
      if (pkg) {
        installedPackages.set(id, {
          ...pkg,
          autoUpdatable: !pkg.autoUpdatable,
        });
      }
      return { installedPackages };
    });
  },

  getDependencies: (id) => {
    // Mock dependency resolution
    const depMap: Record<string, PackageDependency[]> = {
      "opensilicon.spice-sim": [
        { id: "opensilicon.sky130-pdk", version: ">=1.0.0", satisfied: true },
      ],
      "opensilicon.drc-magic": [
        { id: "opensilicon.sky130-pdk", version: ">=1.0.0", satisfied: true },
      ],
      "community.pcell-generators": [
        { id: "opensilicon.sky130-pdk", version: ">=1.0.0", satisfied: true },
      ],
    };
    return depMap[id] ?? [];
  },
}));
