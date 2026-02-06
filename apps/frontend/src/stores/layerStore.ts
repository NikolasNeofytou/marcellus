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
  fillPattern: "solid" | "hatch" | "cross" | "dots" | "none";
  order: number; // drawing order (lower = drawn first)
}

// ── Default SKY130 layers ─────────────────────────────────────────────

const sky130Layers: LayerDef[] = [
  { id: 0,  name: "nwell",  color: "#3b82f6", fillAlpha: 0.25, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "solid", order: 0 },
  { id: 1,  name: "pwell",  color: "#ef4444", fillAlpha: 0.25, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "solid", order: 1 },
  { id: 2,  name: "diff",   color: "#22c55e", fillAlpha: 0.30, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "solid", order: 2 },
  { id: 3,  name: "tap",    color: "#a855f7", fillAlpha: 0.25, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "solid", order: 3 },
  { id: 4,  name: "poly",   color: "#f97316", fillAlpha: 0.35, strokeAlpha: 0.8, visible: true, selectable: true, fillPattern: "solid", order: 4 },
  { id: 5,  name: "licon",  color: "#06b6d4", fillAlpha: 0.30, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "cross", order: 5 },
  { id: 6,  name: "li1",    color: "#ec4899", fillAlpha: 0.30, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "solid", order: 6 },
  { id: 7,  name: "mcon",   color: "#84cc16", fillAlpha: 0.30, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "cross", order: 7 },
  { id: 8,  name: "met1",   color: "#6366f1", fillAlpha: 0.30, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "solid", order: 8 },
  { id: 9,  name: "via",    color: "#f59e0b", fillAlpha: 0.30, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "cross", order: 9 },
  { id: 10, name: "met2",   color: "#14b8a6", fillAlpha: 0.30, strokeAlpha: 0.7, visible: true, selectable: true, fillPattern: "solid", order: 10 },
];

// ── Store ─────────────────────────────────────────────────────────────

interface LayerStoreState {
  layers: LayerDef[];
  activeLayerId: number;

  // Actions
  setActiveLayer: (id: number) => void;
  toggleVisibility: (id: number) => void;
  toggleSelectable: (id: number) => void;
  setLayerColor: (id: number, color: string) => void;
  setFillPattern: (id: number, pattern: LayerDef["fillPattern"]) => void;
  showAll: () => void;
  hideAll: () => void;
  showMetalOnly: () => void;
  getLayer: (id: number) => LayerDef | undefined;
  getVisibleLayers: () => LayerDef[];
}

export const useLayerStore = create<LayerStoreState>((set, get) => ({
  layers: sky130Layers,
  activeLayerId: 8, // met1 default

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
        visible: ["met1", "met2", "via", "li1", "mcon", "licon"].includes(l.name),
      })),
    })),

  getLayer: (id) => get().layers.find((l) => l.id === id),

  getVisibleLayers: () => get().layers.filter((l) => l.visible),
}));
