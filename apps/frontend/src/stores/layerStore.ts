import { create } from "zustand";

// ── Layer Definition ──────────────────────────────────────────────────

export interface LayerDef {
  id: number;
  name: string;
  color: string;
  fillAlpha: number;
  strokeAlpha: number;
  visible: boolean;
  selectable: boolean;
  /** Lock layer for editing (visible but not modifiable) */
  locked: boolean;
  fillPattern: "solid" | "hatch" | "cross" | "dots" | "none";
  order: number; // drawing order (lower = drawn first)
  /** Layer group for UI organization */
  group: LayerGroup;
  /** GDS layer number */
  gdsLayer?: number;
  /** GDS datatype */
  gdsDatatype?: number;
  /** Layer alias for display, e.g. "M1" */
  alias?: string;
  /** Material type */
  material?: LayerMaterial;
  /** Sheet resistance (Ω/sq) */
  sheetResistance?: number;
  /** Thickness in µm */
  thickness?: number;
  /** Height above substrate in µm */
  height?: number;
}

export type LayerGroup =
  | "well"
  | "diffusion"
  | "poly"
  | "contact"
  | "metal"
  | "via"
  | "implant"
  | "marker"
  | "pin"
  | "other";

export type LayerMaterial =
  | "diffusion"
  | "well"
  | "poly"
  | "metal"
  | "cut"
  | "implant"
  | "oxide"
  | "marker"
  | "other";

// ── Full SKY130 Layer Stack ───────────────────────────────────────────

const sky130Layers: LayerDef[] = [
  // ── Wells ──
  { id: 0,  name: "nwell",  color: "#5b9df5", fillAlpha: 0.12, strokeAlpha: 0.50, visible: true,  selectable: true, locked: false, fillPattern: "hatch", order: 0,  group: "well",      gdsLayer: 64,  gdsDatatype: 20, alias: "NW",   material: "well",      sheetResistance: 900,  thickness: 3.0, height: 0 },
  { id: 1,  name: "pwell",  color: "#e06060", fillAlpha: 0.12, strokeAlpha: 0.50, visible: true,  selectable: true, locked: false, fillPattern: "hatch", order: 1,  group: "well",      gdsLayer: 122, gdsDatatype: 16, alias: "PW",   material: "well",      sheetResistance: 1050, thickness: 3.0, height: 0 },
  // ── Diffusion ──
  { id: 2,  name: "diff",   color: "#4ade80", fillAlpha: 0.28, strokeAlpha: 0.70, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 2,  group: "diffusion", gdsLayer: 65,  gdsDatatype: 20, alias: "DIFF", material: "diffusion", sheetResistance: 100,  thickness: 0.13, height: 0 },
  { id: 3,  name: "tap",    color: "#c084fc", fillAlpha: 0.22, strokeAlpha: 0.65, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 3,  group: "diffusion", gdsLayer: 65,  gdsDatatype: 44, alias: "TAP",  material: "diffusion" },
  // ── Polysilicon ──
  { id: 4,  name: "poly",   color: "#f97316", fillAlpha: 0.32, strokeAlpha: 0.85, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 4,  group: "poly",      gdsLayer: 66,  gdsDatatype: 20, alias: "POLY", material: "poly",      sheetResistance: 48,   thickness: 0.18, height: 0.14 },
  // ── Contacts ──
  { id: 5,  name: "licon",  color: "#22d3ee", fillAlpha: 0.28, strokeAlpha: 0.75, visible: true,  selectable: true, locked: false, fillPattern: "cross", order: 5,  group: "contact",   gdsLayer: 66,  gdsDatatype: 44, alias: "LICON", material: "cut",     sheetResistance: 120 },
  // ── Local Interconnect ──
  { id: 6,  name: "li1",    color: "#f472b6", fillAlpha: 0.25, strokeAlpha: 0.70, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 6,  group: "metal",     gdsLayer: 67,  gdsDatatype: 20, alias: "LI",   material: "metal",     sheetResistance: 12.5, thickness: 0.1,  height: 0.93 },
  { id: 7,  name: "mcon",   color: "#a3e635", fillAlpha: 0.28, strokeAlpha: 0.70, visible: true,  selectable: true, locked: false, fillPattern: "cross", order: 7,  group: "contact",   gdsLayer: 67,  gdsDatatype: 44, alias: "MCON", material: "cut",       sheetResistance: 9.3 },
  // ── Metal 1 ──
  { id: 8,  name: "met1",   color: "#818cf8", fillAlpha: 0.28, strokeAlpha: 0.75, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 8,  group: "metal",     gdsLayer: 68,  gdsDatatype: 20, alias: "M1",   material: "metal",     sheetResistance: 0.125, thickness: 0.36, height: 1.02 },
  // ── Via 1 ──
  { id: 9,  name: "via",    color: "#fbbf24", fillAlpha: 0.30, strokeAlpha: 0.75, visible: true,  selectable: true, locked: false, fillPattern: "cross", order: 9,  group: "via",       gdsLayer: 68,  gdsDatatype: 44, alias: "VIA1", material: "cut",       sheetResistance: 4.5 },
  // ── Metal 2 ──
  { id: 10, name: "met2",   color: "#2dd4bf", fillAlpha: 0.28, strokeAlpha: 0.75, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 10, group: "metal",     gdsLayer: 69,  gdsDatatype: 20, alias: "M2",   material: "metal",     sheetResistance: 0.125, thickness: 0.36, height: 1.74 },
  // ── Via 2 ──
  { id: 11, name: "via2",   color: "#e5a833", fillAlpha: 0.28, strokeAlpha: 0.70, visible: true,  selectable: true, locked: false, fillPattern: "cross", order: 11, group: "via",       gdsLayer: 69,  gdsDatatype: 44, alias: "VIA2", material: "cut",       sheetResistance: 3.4 },
  // ── Metal 3 ──
  { id: 12, name: "met3",   color: "#38bdf8", fillAlpha: 0.28, strokeAlpha: 0.75, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 12, group: "metal",     gdsLayer: 70,  gdsDatatype: 20, alias: "M3",   material: "metal",     sheetResistance: 0.047, thickness: 0.845, height: 2.37 },
  // ── Via 3 ──
  { id: 13, name: "via3",   color: "#d4702c", fillAlpha: 0.28, strokeAlpha: 0.70, visible: true,  selectable: true, locked: false, fillPattern: "cross", order: 13, group: "via",       gdsLayer: 70,  gdsDatatype: 44, alias: "VIA3", material: "cut",       sheetResistance: 3.4 },
  // ── Metal 4 ──
  { id: 14, name: "met4",   color: "#a78bfa", fillAlpha: 0.28, strokeAlpha: 0.75, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 14, group: "metal",     gdsLayer: 71,  gdsDatatype: 20, alias: "M4",   material: "metal",     sheetResistance: 0.047, thickness: 0.845, height: 3.78 },
  // ── Via 4 ──
  { id: 15, name: "via4",   color: "#b45c2e", fillAlpha: 0.28, strokeAlpha: 0.70, visible: true,  selectable: true, locked: false, fillPattern: "cross", order: 15, group: "via",       gdsLayer: 71,  gdsDatatype: 44, alias: "VIA4", material: "cut",       sheetResistance: 0.38 },
  // ── Metal 5 (thick top metal) ──
  { id: 16, name: "met5",   color: "#fb7185", fillAlpha: 0.28, strokeAlpha: 0.75, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 16, group: "metal",     gdsLayer: 72,  gdsDatatype: 20, alias: "M5",   material: "metal",     sheetResistance: 0.029, thickness: 1.26, height: 5.30 },
  // ── Implants ──
  { id: 17, name: "nsdm",   color: "#38bdf8", fillAlpha: 0.15, strokeAlpha: 0.5, visible: false, selectable: false, locked: false, fillPattern: "hatch", order: 17, group: "implant",   gdsLayer: 93,  gdsDatatype: 44, alias: "NSDM", material: "implant" },
  { id: 18, name: "psdm",   color: "#fb7185", fillAlpha: 0.15, strokeAlpha: 0.5, visible: false, selectable: false, locked: false, fillPattern: "hatch", order: 18, group: "implant",   gdsLayer: 94,  gdsDatatype: 20, alias: "PSDM", material: "implant" },
  // ── Markers / Special ──
  { id: 19, name: "npc",    color: "#a3e635", fillAlpha: 0.10, strokeAlpha: 0.4, visible: false, selectable: false, locked: false, fillPattern: "dots",  order: 19, group: "marker",    gdsLayer: 95,  gdsDatatype: 20, alias: "NPC",  material: "marker" },
  { id: 20, name: "hvi",    color: "#fbbf24", fillAlpha: 0.10, strokeAlpha: 0.4, visible: false, selectable: false, locked: false, fillPattern: "dots",  order: 20, group: "marker",    gdsLayer: 75,  gdsDatatype: 20, alias: "HVI",  material: "marker" },
  { id: 21, name: "hvntm",  color: "#f472b6", fillAlpha: 0.10, strokeAlpha: 0.4, visible: false, selectable: false, locked: false, fillPattern: "dots",  order: 21, group: "marker",    gdsLayer: 125, gdsDatatype: 20, alias: "HVNTM", material: "marker" },
  { id: 22, name: "lvtn",   color: "#67e8f9", fillAlpha: 0.10, strokeAlpha: 0.4, visible: false, selectable: false, locked: false, fillPattern: "dots",  order: 22, group: "marker",    gdsLayer: 125, gdsDatatype: 44, alias: "LVTN", material: "marker" },
  // ── Pin Layers ──
  { id: 23, name: "li1.pin",  color: "#ec4899", fillAlpha: 0.20, strokeAlpha: 0.9, visible: false, selectable: false, locked: false, fillPattern: "none", order: 23, group: "pin",      gdsLayer: 67,  gdsDatatype: 16, alias: "LI.PIN",  material: "metal" },
  { id: 24, name: "met1.pin", color: "#6366f1", fillAlpha: 0.20, strokeAlpha: 0.9, visible: false, selectable: false, locked: false, fillPattern: "none", order: 24, group: "pin",      gdsLayer: 68,  gdsDatatype: 16, alias: "M1.PIN",  material: "metal" },
  { id: 25, name: "met2.pin", color: "#14b8a6", fillAlpha: 0.20, strokeAlpha: 0.9, visible: false, selectable: false, locked: false, fillPattern: "none", order: 25, group: "pin",      gdsLayer: 69,  gdsDatatype: 16, alias: "M2.PIN",  material: "metal" },
  { id: 26, name: "met3.pin", color: "#0ea5e9", fillAlpha: 0.20, strokeAlpha: 0.9, visible: false, selectable: false, locked: false, fillPattern: "none", order: 26, group: "pin",      gdsLayer: 70,  gdsDatatype: 16, alias: "M3.PIN",  material: "metal" },
  { id: 27, name: "met4.pin", color: "#8b5cf6", fillAlpha: 0.20, strokeAlpha: 0.9, visible: false, selectable: false, locked: false, fillPattern: "none", order: 27, group: "pin",      gdsLayer: 71,  gdsDatatype: 16, alias: "M4.PIN",  material: "metal" },
  { id: 28, name: "met5.pin", color: "#e11d48", fillAlpha: 0.20, strokeAlpha: 0.9, visible: false, selectable: false, locked: false, fillPattern: "none", order: 28, group: "pin",      gdsLayer: 72,  gdsDatatype: 16, alias: "M5.PIN",  material: "metal" },
  // ── Label Layers ──
  { id: 29, name: "met1.label", color: "#6366f1", fillAlpha: 0.15, strokeAlpha: 0.8, visible: false, selectable: false, locked: false, fillPattern: "none", order: 29, group: "pin",    gdsLayer: 68,  gdsDatatype: 5,  alias: "M1.LBL", material: "metal" },
  { id: 30, name: "met2.label", color: "#14b8a6", fillAlpha: 0.15, strokeAlpha: 0.8, visible: false, selectable: false, locked: false, fillPattern: "none", order: 30, group: "pin",    gdsLayer: 69,  gdsDatatype: 5,  alias: "M2.LBL", material: "metal" },
  // ── Blockage Layers ──
  { id: 31, name: "li1.block",  color: "#ec4899", fillAlpha: 0.08, strokeAlpha: 0.4, visible: false, selectable: false, locked: false, fillPattern: "cross", order: 31, group: "other",  gdsLayer: 67,  gdsDatatype: 10, alias: "LI.BLK",  material: "other" },
  { id: 32, name: "met1.block", color: "#6366f1", fillAlpha: 0.08, strokeAlpha: 0.4, visible: false, selectable: false, locked: false, fillPattern: "cross", order: 32, group: "other",  gdsLayer: 68,  gdsDatatype: 10, alias: "M1.BLK",  material: "other" },
  { id: 33, name: "met2.block", color: "#14b8a6", fillAlpha: 0.08, strokeAlpha: 0.4, visible: false, selectable: false, locked: false, fillPattern: "cross", order: 33, group: "other",  gdsLayer: 69,  gdsDatatype: 10, alias: "M2.BLK",  material: "other" },
  // ── Boundary ──
  { id: 34, name: "prBndry",  color: "#ffffff", fillAlpha: 0.05, strokeAlpha: 0.8, visible: true,  selectable: false, locked: true,  fillPattern: "none",  order: 34, group: "other",    gdsLayer: 235, gdsDatatype: 4,  alias: "BNDRY", material: "other" },
  // ── Density fill ──
  { id: 35, name: "met1.fill", color: "#6366f1", fillAlpha: 0.05, strokeAlpha: 0.2, visible: false, selectable: false, locked: false, fillPattern: "dots",  order: 35, group: "other",   gdsLayer: 36,  gdsDatatype: 28, alias: "M1.FIL", material: "metal" },
  { id: 36, name: "met2.fill", color: "#14b8a6", fillAlpha: 0.05, strokeAlpha: 0.2, visible: false, selectable: false, locked: false, fillPattern: "dots",  order: 36, group: "other",   gdsLayer: 41,  gdsDatatype: 28, alias: "M2.FIL", material: "metal" },
  // ── Additional purpose layers ──
  { id: 37, name: "diff.net",  color: "#22c55e", fillAlpha: 0.10, strokeAlpha: 0.5, visible: false, selectable: false, locked: false, fillPattern: "none",  order: 37, group: "other",   gdsLayer: 65,  gdsDatatype: 41, alias: "DIFF.NET", material: "diffusion" },
  { id: 38, name: "poly.net",  color: "#f97316", fillAlpha: 0.10, strokeAlpha: 0.5, visible: false, selectable: false, locked: false, fillPattern: "none",  order: 38, group: "other",   gdsLayer: 66,  gdsDatatype: 41, alias: "POLY.NET", material: "poly" },
  // ── Pad ──
  { id: 39, name: "pad",   color: "#fde047", fillAlpha: 0.25, strokeAlpha: 0.8, visible: true,  selectable: true, locked: false, fillPattern: "solid", order: 39, group: "other",    gdsLayer: 76,  gdsDatatype: 20, alias: "PAD",  material: "metal" },
  // ── RPM / poly resistor ID ──
  { id: 40, name: "rpm",   color: "#c084fc", fillAlpha: 0.12, strokeAlpha: 0.5, visible: false, selectable: false, locked: false, fillPattern: "hatch", order: 40, group: "marker",   gdsLayer: 86,  gdsDatatype: 20, alias: "RPM",  material: "marker" },
  { id: 41, name: "urpm",  color: "#a78bfa", fillAlpha: 0.12, strokeAlpha: 0.5, visible: false, selectable: false, locked: false, fillPattern: "hatch", order: 41, group: "marker",   gdsLayer: 79,  gdsDatatype: 20, alias: "URPM", material: "marker" },
  // ── CAPM (MIM cap marker) ──
  { id: 42, name: "capm",  color: "#fda4af", fillAlpha: 0.12, strokeAlpha: 0.5, visible: false, selectable: false, locked: false, fillPattern: "dots",  order: 42, group: "marker",   gdsLayer: 89,  gdsDatatype: 44, alias: "CAPM", material: "marker" },
];

// ── Layer group metadata ──────────────────────────────────────────────

export interface LayerGroupInfo {
  id: LayerGroup;
  label: string;
  description: string;
}

export const LAYER_GROUPS: LayerGroupInfo[] = [
  { id: "well",      label: "Wells",              description: "N-well, P-well" },
  { id: "diffusion", label: "Diffusion / Tap",    description: "Active areas and substrate taps" },
  { id: "poly",      label: "Polysilicon",        description: "Gate and local poly interconnect" },
  { id: "contact",   label: "Contacts",           description: "LICON, MCON contacts" },
  { id: "metal",     label: "Metals & LI",        description: "Local interconnect through Metal 5" },
  { id: "via",       label: "Vias",               description: "Inter-metal vias" },
  { id: "implant",   label: "Implants",           description: "N+ and P+ source/drain implants" },
  { id: "marker",    label: "Markers / ID",       description: "Device ID and special markers" },
  { id: "pin",       label: "Pins & Labels",      description: "Pin and label layers for LEF/DEF" },
  { id: "other",     label: "Other",              description: "Blockage, boundary, fill, net" },
];

// ── Store ─────────────────────────────────────────────────────────────

interface LayerStoreState {
  layers: LayerDef[];
  activeLayerId: number;
  /** Collapsed layer groups in the UI */
  collapsedGroups: Set<LayerGroup>;

  // Actions
  setActiveLayer: (id: number) => void;
  toggleVisibility: (id: number) => void;
  toggleSelectable: (id: number) => void;
  toggleLocked: (id: number) => void;
  setLayerColor: (id: number, color: string) => void;
  setFillPattern: (id: number, pattern: LayerDef["fillPattern"]) => void;
  setFillAlpha: (id: number, alpha: number) => void;
  setStrokeAlpha: (id: number, alpha: number) => void;
  showAll: () => void;
  hideAll: () => void;
  showMetalOnly: () => void;
  showActiveOnly: () => void;
  showDrawingLayers: () => void;
  showGroupOnly: (group: LayerGroup) => void;
  toggleGroupCollapsed: (group: LayerGroup) => void;
  getLayer: (id: number) => LayerDef | undefined;
  getLayerByAlias: (alias: string) => LayerDef | undefined;
  getVisibleLayers: () => LayerDef[];
  getLayersByGroup: (group: LayerGroup) => LayerDef[];
  /** Bulk toggle visibility for all layers in a group */
  toggleGroupVisibility: (group: LayerGroup, visible: boolean) => void;
}

export const useLayerStore = create<LayerStoreState>((set, get) => ({
  layers: sky130Layers,
  activeLayerId: 8, // met1 default
  collapsedGroups: new Set<LayerGroup>(),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  toggleVisibility: (id) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),

  toggleSelectable: (id) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, selectable: !l.selectable } : l
      ),
    })),

  toggleLocked: (id) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, locked: !l.locked } : l
      ),
    })),

  setLayerColor: (id, color) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, color } : l
      ),
    })),

  setFillPattern: (id, pattern) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, fillPattern: pattern } : l
      ),
    })),

  setFillAlpha: (id, alpha) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, fillAlpha: Math.max(0, Math.min(1, alpha)) } : l
      ),
    })),

  setStrokeAlpha: (id, alpha) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === id ? { ...l, strokeAlpha: Math.max(0, Math.min(1, alpha)) } : l
      ),
    })),

  showAll: () =>
    set((state) => ({
      layers: state.layers.map((l) => ({ ...l, visible: true })),
    })),

  hideAll: () =>
    set((state) => ({
      layers: state.layers.map((l) => ({ ...l, visible: false })),
    })),

  showMetalOnly: () =>
    set((state) => ({
      layers: state.layers.map((l) => ({
        ...l,
        visible: l.group === "metal" || l.group === "via" || l.group === "contact",
      })),
    })),

  showActiveOnly: () =>
    set((state) => ({
      layers: state.layers.map((l) => ({
        ...l,
        visible: l.group === "diffusion" || l.group === "well" || l.group === "poly" || l.group === "contact",
      })),
    })),

  showDrawingLayers: () =>
    set((state) => ({
      layers: state.layers.map((l) => ({
        ...l,
        visible: l.group !== "pin" && l.group !== "marker" && l.group !== "other",
      })),
    })),

  showGroupOnly: (group) =>
    set((state) => ({
      layers: state.layers.map((l) => ({
        ...l,
        visible: l.group === group,
      })),
    })),

  toggleGroupCollapsed: (group) =>
    set((state) => {
      const next = new Set(state.collapsedGroups);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return { collapsedGroups: next };
    }),

  toggleGroupVisibility: (group, visible) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.group === group ? { ...l, visible } : l
      ),
    })),

  getLayer: (id) => get().layers.find((l) => l.id === id),

  getLayerByAlias: (alias) =>
    get().layers.find((l) => l.alias === alias),

  getVisibleLayers: () => get().layers.filter((l) => l.visible),

  getLayersByGroup: (group) => get().layers.filter((l) => l.group === group),
}));
