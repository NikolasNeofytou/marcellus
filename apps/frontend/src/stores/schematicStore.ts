/**
 * Schematic Store — state management for the schematic capture editor.
 *
 * Manages schematic elements: symbols, wires, pins, labels, and nets.
 * Supports undo/redo, selection, and bidirectional cross-probing with layout.
 */

import { create } from "zustand";

// ── Schematic Element Types ───────────────────────────────────────────

export interface SchematicPoint {
  x: number;
  y: number;
}

export interface SchematicPin {
  id: string;
  name: string;
  position: SchematicPoint;
  /** Direction the pin extends from the symbol body */
  direction: "left" | "right" | "top" | "bottom";
  /** Electrical type */
  type: "input" | "output" | "inout" | "power" | "passive";
  /** Connected net name (resolved after wiring) */
  netName?: string;
}

export interface SchematicSymbol {
  kind: "symbol";
  id: string;
  /** Instance name, e.g. M1, R0 */
  instanceName: string;
  /** Reference to a device type */
  deviceType: "nmos" | "pmos" | "resistor" | "capacitor" | "inductor" | "diode" | "voltage_source" | "current_source" | "ground" | "vdd";
  /** Position of the symbol origin */
  position: SchematicPoint;
  /** Rotation in 90° increments (0, 90, 180, 270) */
  rotation: number;
  /** Mirror horizontally */
  mirror: boolean;
  /** Symbol pins */
  pins: SchematicPin[];
  /** Device parameters (W, L, R, C, etc.) */
  parameters: Record<string, number | string>;
  /** Layout geometry indices for cross-probing */
  layoutGeometryIndices: number[];
}

export interface SchematicWire {
  kind: "wire";
  id: string;
  /** Ordered polyline points */
  points: SchematicPoint[];
  /** Net this wire belongs to */
  netName?: string;
}

export interface SchematicLabel {
  kind: "label";
  id: string;
  text: string;
  position: SchematicPoint;
  /** Net name this label assigns */
  netName: string;
  /** Font size in schematic units */
  fontSize: number;
}

export interface SchematicPort {
  kind: "port";
  id: string;
  name: string;
  position: SchematicPoint;
  direction: "input" | "output" | "inout";
  /** Net this port connects to */
  netName: string;
}

export type SchematicElement = SchematicSymbol | SchematicWire | SchematicLabel | SchematicPort;

/** A resolved net in the schematic */
export interface SchematicNet {
  name: string;
  /** IDs of elements connected to this net */
  connectedElementIds: string[];
  /** IDs of pins connected to this net */
  connectedPinIds: string[];
  /** Whether this net is highlighted */
  highlighted: boolean;
}

// ── Default Symbol Templates ──────────────────────────────────────────

function createDefaultPins(deviceType: SchematicSymbol["deviceType"]): SchematicPin[] {
  const baseId = () => crypto.randomUUID().slice(0, 8);
  switch (deviceType) {
    case "nmos":
    case "pmos":
      return [
        { id: baseId(), name: "D", position: { x: 0, y: -1 }, direction: "top", type: "inout" },
        { id: baseId(), name: "G", position: { x: -1, y: 0 }, direction: "left", type: "input" },
        { id: baseId(), name: "S", position: { x: 0, y: 1 }, direction: "bottom", type: "inout" },
        { id: baseId(), name: "B", position: { x: 1, y: 0 }, direction: "right", type: "inout" },
      ];
    case "resistor":
    case "capacitor":
    case "inductor":
      return [
        { id: baseId(), name: "A", position: { x: 0, y: -1 }, direction: "top", type: "passive" },
        { id: baseId(), name: "B", position: { x: 0, y: 1 }, direction: "bottom", type: "passive" },
      ];
    case "diode":
      return [
        { id: baseId(), name: "A", position: { x: 0, y: -1 }, direction: "top", type: "passive" },
        { id: baseId(), name: "K", position: { x: 0, y: 1 }, direction: "bottom", type: "passive" },
      ];
    case "voltage_source":
    case "current_source":
      return [
        { id: baseId(), name: "+", position: { x: 0, y: -1 }, direction: "top", type: "passive" },
        { id: baseId(), name: "-", position: { x: 0, y: 1 }, direction: "bottom", type: "passive" },
      ];
    case "ground":
      return [
        { id: baseId(), name: "GND", position: { x: 0, y: -1 }, direction: "top", type: "power" },
      ];
    case "vdd":
      return [
        { id: baseId(), name: "VDD", position: { x: 0, y: 1 }, direction: "bottom", type: "power" },
      ];
  }
}

// ── Store ─────────────────────────────────────────────────────────────

interface SchematicStoreState {
  /** All schematic elements */
  elements: SchematicElement[];
  /** Resolved nets */
  nets: SchematicNet[];
  /** Selected element IDs */
  selectedIds: Set<string>;
  /** Currently highlighted net (for cross-probe) */
  highlightedNet: string | null;
  /** Active tool */
  activeTool: "select" | "wire" | "symbol" | "label" | "port" | "pan";
  /** Wire being drawn */
  wireInProgress: SchematicPoint[] | null;
  /** Symbol type being placed */
  placingSymbolType: SchematicSymbol["deviceType"] | null;
  /** Undo/redo stacks */
  undoStack: SchematicElement[][];
  redoStack: SchematicElement[][];
  /** Instance name counters */
  instanceCounters: Record<string, number>;
  /** Title of the schematic */
  title: string;
  /** View transform */
  viewOffset: SchematicPoint;
  viewZoom: number;

  // ── Actions ──

  /** Add a symbol at position */
  addSymbol: (deviceType: SchematicSymbol["deviceType"], position: SchematicPoint) => string;
  /** Add a wire */
  addWire: (points: SchematicPoint[]) => string;
  /** Add a net label */
  addLabel: (text: string, netName: string, position: SchematicPoint) => string;
  /** Add a port */
  addPort: (name: string, direction: SchematicPort["direction"], position: SchematicPoint) => string;
  /** Remove elements by ID */
  removeElements: (ids: string[]) => void;
  /** Update a symbol's parameters */
  updateSymbolParams: (id: string, params: Record<string, number | string>) => void;
  /** Update symbol instance name */
  updateInstanceName: (id: string, name: string) => void;
  /** Move elements by delta */
  moveElements: (ids: string[], dx: number, dy: number) => void;
  /** Select elements */
  select: (ids: string[]) => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Toggle element selection */
  toggleSelection: (id: string) => void;
  /** Set active tool */
  setActiveTool: (tool: SchematicStoreState["activeTool"]) => void;
  /** Set placing symbol type */
  setPlacingSymbolType: (type: SchematicSymbol["deviceType"] | null) => void;

  // ── Wire drawing ──
  beginWire: (start: SchematicPoint) => void;
  addWirePoint: (point: SchematicPoint) => void;
  finishWire: () => void;
  cancelWire: () => void;

  // ── Net resolution ──
  /** Resolve all nets from connectivity */
  resolveNets: () => void;
  /** Highlight a specific net (for cross-probing) */
  highlightNet: (netName: string | null) => void;

  // ── Cross-probing ──
  /** Link a symbol to layout geometry indices */
  linkToLayout: (symbolId: string, geometryIndices: number[]) => void;
  /** Find symbol by layout geometry index */
  findSymbolByGeometry: (geometryIndex: number) => SchematicSymbol | undefined;

  // ── Undo/Redo ──
  undo: () => boolean;
  redo: () => boolean;

  // ── View ──
  setView: (offset: SchematicPoint, zoom: number) => void;

  // ── File ops ──
  loadSchematic: (elements: SchematicElement[], title?: string) => void;
  loadDemoSchematic: () => void;
  exportSpice: () => string;
  clear: () => void;
}

const MAX_UNDO = 80;

function cloneElements(els: SchematicElement[]): SchematicElement[] {
  return JSON.parse(JSON.stringify(els));
}

let nextId = 1;
function genId(): string {
  return `sch_${nextId++}_${Date.now().toString(36)}`;
}

export const useSchematicStore = create<SchematicStoreState>((set, get) => ({
  elements: [],
  nets: [],
  selectedIds: new Set(),
  highlightedNet: null,
  activeTool: "select",
  wireInProgress: null,
  placingSymbolType: null,
  undoStack: [],
  redoStack: [],
  instanceCounters: {},
  title: "Untitled Schematic",
  viewOffset: { x: 0, y: 0 },
  viewZoom: 40,

  // ── Internal commit helper ──

  addSymbol: (deviceType, position) => {
    const state = get();
    const prefix =
      deviceType === "nmos" || deviceType === "pmos" ? "M" :
      deviceType === "resistor" ? "R" :
      deviceType === "capacitor" ? "C" :
      deviceType === "inductor" ? "L" :
      deviceType === "diode" ? "D" :
      deviceType === "voltage_source" ? "V" :
      deviceType === "current_source" ? "I" :
      "X";
    const count = (state.instanceCounters[prefix] ?? 0) + 1;
    const instanceName = `${prefix}${count - 1}`;
    const id = genId();

    const symbol: SchematicSymbol = {
      kind: "symbol",
      id,
      instanceName,
      deviceType,
      position,
      rotation: 0,
      mirror: false,
      pins: createDefaultPins(deviceType),
      parameters: deviceType === "nmos" || deviceType === "pmos"
        ? { W: 0.42, L: 0.15, nf: 1 }
        : deviceType === "resistor"
        ? { R: 1000 }
        : deviceType === "capacitor"
        ? { C: 1e-12 }
        : {},
      layoutGeometryIndices: [],
    };

    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), cloneElements(s.elements)],
      redoStack: [],
      elements: [...s.elements, symbol],
      instanceCounters: { ...s.instanceCounters, [prefix]: count },
    }));

    return id;
  },

  addWire: (points) => {
    const id = genId();
    const wire: SchematicWire = { kind: "wire", id, points };
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), cloneElements(s.elements)],
      redoStack: [],
      elements: [...s.elements, wire],
    }));
    return id;
  },

  addLabel: (text, netName, position) => {
    const id = genId();
    const label: SchematicLabel = { kind: "label", id, text, position, netName, fontSize: 0.5 };
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), cloneElements(s.elements)],
      redoStack: [],
      elements: [...s.elements, label],
    }));
    return id;
  },

  addPort: (name, direction, position) => {
    const id = genId();
    const port: SchematicPort = { kind: "port", id, name, position, direction, netName: name };
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), cloneElements(s.elements)],
      redoStack: [],
      elements: [...s.elements, port],
    }));
    return id;
  },

  removeElements: (ids) => {
    const idSet = new Set(ids);
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), cloneElements(s.elements)],
      redoStack: [],
      elements: s.elements.filter((e) => !idSet.has(e.id)),
      selectedIds: new Set([...s.selectedIds].filter((id) => !idSet.has(id))),
    }));
  },

  updateSymbolParams: (id, params) => {
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), cloneElements(s.elements)],
      redoStack: [],
      elements: s.elements.map((e) =>
        e.kind === "symbol" && e.id === id
          ? { ...e, parameters: { ...e.parameters, ...params } }
          : e
      ),
    }));
  },

  updateInstanceName: (id, name) => {
    set((s) => ({
      elements: s.elements.map((e) =>
        e.kind === "symbol" && e.id === id ? { ...e, instanceName: name } : e
      ),
    }));
  },

  moveElements: (ids, dx, dy) => {
    const idSet = new Set(ids);
    set((s) => ({
      undoStack: [...s.undoStack.slice(-(MAX_UNDO - 1)), cloneElements(s.elements)],
      redoStack: [],
      elements: s.elements.map((e) => {
        if (!idSet.has(e.id)) return e;
        if (e.kind === "symbol") {
          return { ...e, position: { x: e.position.x + dx, y: e.position.y + dy } };
        }
        if (e.kind === "wire") {
          return { ...e, points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
        }
        if (e.kind === "label" || e.kind === "port") {
          return { ...e, position: { x: e.position.x + dx, y: e.position.y + dy } };
        }
        return e;
      }),
    }));
  },

  select: (ids) => set({ selectedIds: new Set(ids) }),
  clearSelection: () => set({ selectedIds: new Set() }),
  toggleSelection: (id) => {
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    });
  },

  setActiveTool: (tool) => set({ activeTool: tool, wireInProgress: null, placingSymbolType: null }),
  setPlacingSymbolType: (type) => set({ placingSymbolType: type, activeTool: "symbol" }),

  // ── Wire drawing ──

  beginWire: (start) => set({ wireInProgress: [start] }),
  addWirePoint: (point) => {
    set((s) => ({
      wireInProgress: s.wireInProgress ? [...s.wireInProgress, point] : [point],
    }));
  },
  finishWire: () => {
    const wip = get().wireInProgress;
    if (wip && wip.length >= 2) {
      get().addWire(wip);
    }
    set({ wireInProgress: null });
  },
  cancelWire: () => set({ wireInProgress: null }),

  // ── Net resolution ──

  resolveNets: () => {
    const { elements } = get();
    const netMap = new Map<string, SchematicNet>();

    // 1. Collect explicitly named nets from labels and ports
    for (const el of elements) {
      if (el.kind === "label" || el.kind === "port") {
        if (!netMap.has(el.netName)) {
          netMap.set(el.netName, {
            name: el.netName,
            connectedElementIds: [],
            connectedPinIds: [],
            highlighted: false,
          });
        }
        netMap.get(el.netName)!.connectedElementIds.push(el.id);
      }
    }

    // 2. Assign symbols' pins to nets based on proximity to wire endpoints / labels
    const symbols = elements.filter((e): e is SchematicSymbol => e.kind === "symbol");
    const wires = elements.filter((e): e is SchematicWire => e.kind === "wire");
    const labels = elements.filter((e): e is SchematicLabel => e.kind === "label");

    for (const sym of symbols) {
      for (const pin of sym.pins) {
        const globalPinPos = {
          x: sym.position.x + pin.position.x,
          y: sym.position.y + pin.position.y,
        };

        // Check if pin touches a label
        let assigned = false;
        for (const label of labels) {
          const d = Math.hypot(globalPinPos.x - label.position.x, globalPinPos.y - label.position.y);
          if (d < 0.5) {
            pin.netName = label.netName;
            const net = netMap.get(label.netName)!;
            net.connectedPinIds.push(pin.id);
            net.connectedElementIds.push(sym.id);
            assigned = true;
            break;
          }
        }

        // Check if pin touches a wire endpoint
        if (!assigned) {
          for (const wire of wires) {
            for (const pt of wire.points) {
              const d = Math.hypot(globalPinPos.x - pt.x, globalPinPos.y - pt.y);
              if (d < 0.3) {
                const netName = wire.netName ?? `net_${wire.id.slice(0, 6)}`;
                wire.netName = netName;
                pin.netName = netName;
                if (!netMap.has(netName)) {
                  netMap.set(netName, {
                    name: netName,
                    connectedElementIds: [],
                    connectedPinIds: [],
                    highlighted: false,
                  });
                }
                const net = netMap.get(netName)!;
                net.connectedPinIds.push(pin.id);
                if (!net.connectedElementIds.includes(sym.id)) {
                  net.connectedElementIds.push(sym.id);
                }
                if (!net.connectedElementIds.includes(wire.id)) {
                  net.connectedElementIds.push(wire.id);
                }
                assigned = true;
                break;
              }
            }
            if (assigned) break;
          }
        }
      }
    }

    set({ nets: Array.from(netMap.values()) });
  },

  highlightNet: (netName) => {
    set((s) => ({
      highlightedNet: netName,
      nets: s.nets.map((n) => ({ ...n, highlighted: n.name === netName })),
    }));
  },

  // ── Cross-probing ──

  linkToLayout: (symbolId, geometryIndices) => {
    set((s) => ({
      elements: s.elements.map((e) =>
        e.kind === "symbol" && e.id === symbolId
          ? { ...e, layoutGeometryIndices: geometryIndices }
          : e
      ),
    }));
  },

  findSymbolByGeometry: (geometryIndex) => {
    return get().elements.find(
      (e): e is SchematicSymbol =>
        e.kind === "symbol" && e.layoutGeometryIndices.includes(geometryIndex)
    );
  },

  // ── Undo / Redo ──

  undo: () => {
    const { undoStack, elements, redoStack } = get();
    if (undoStack.length === 0) return false;
    const prev = undoStack[undoStack.length - 1];
    set({
      elements: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cloneElements(elements)],
    });
    return true;
  },

  redo: () => {
    const { redoStack, elements, undoStack } = get();
    if (redoStack.length === 0) return false;
    const next = redoStack[redoStack.length - 1];
    set({
      elements: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, cloneElements(elements)],
    });
    return true;
  },

  // ── View ──

  setView: (offset, zoom) => set({ viewOffset: offset, viewZoom: zoom }),

  // ── File ops ──

  loadSchematic: (elements, title) => {
    set({
      elements: cloneElements(elements),
      undoStack: [],
      redoStack: [],
      selectedIds: new Set(),
      highlightedNet: null,
      nets: [],
      title: title ?? "Untitled Schematic",
    });
  },

  loadDemoSchematic: () => {
    const state = get();
    state.clear();

    // Build a simple CMOS inverter schematic
    const vddId = state.addSymbol("vdd", { x: 5, y: 0 });
    const pmosId = state.addSymbol("pmos", { x: 5, y: 2 });
    const nmosId = state.addSymbol("nmos", { x: 5, y: 5 });
    const gndId = state.addSymbol("ground", { x: 5, y: 7 });

    // Wires
    state.addWire([{ x: 5, y: 1 }, { x: 5, y: 1.0 }]); // VDD → PMOS drain
    state.addWire([{ x: 5, y: 3 }, { x: 5, y: 4 }]); // PMOS source → NMOS drain
    state.addWire([{ x: 5, y: 6 }, { x: 5, y: 6.0 }]); // NMOS source → GND

    // Input wire
    state.addWire([{ x: 2, y: 2 }, { x: 4, y: 2 }]); // Gate input (PMOS)
    state.addWire([{ x: 2, y: 5 }, { x: 4, y: 5 }]); // Gate input (NMOS)
    state.addWire([{ x: 2, y: 2 }, { x: 2, y: 5 }]); // Connect gates

    // Output wire
    state.addWire([{ x: 5, y: 3.5 }, { x: 8, y: 3.5 }]); // Output

    // Labels
    state.addLabel("IN", "IN", { x: 1.5, y: 3.5 });
    state.addLabel("OUT", "OUT", { x: 8.5, y: 3.5 });
    state.addLabel("VDD", "VDD", { x: 5, y: -0.5 });
    state.addLabel("GND", "GND", { x: 5, y: 7.5 });

    // Ports
    state.addPort("IN", "input", { x: 1, y: 3.5 });
    state.addPort("OUT", "output", { x: 9, y: 3.5 });

    // Resolve nets
    state.resolveNets();

    // Link to layout (demo geometry indices)
    const els = get().elements;
    const pmos = els.find((e): e is SchematicSymbol => e.kind === "symbol" && e.id === pmosId);
    const nmos = els.find((e): e is SchematicSymbol => e.kind === "symbol" && e.id === nmosId);
    if (pmos) state.linkToLayout(pmos.id, [0, 1, 3]);
    if (nmos) state.linkToLayout(nmos.id, [2, 4, 5]);

    // suppress unused
    void vddId;
    void gndId;
  },

  exportSpice: () => {
    const { elements, title } = get();
    const lines: string[] = [`* ${title}`, ""];

    const symbols = elements.filter((e): e is SchematicSymbol => e.kind === "symbol");
    for (const sym of symbols) {
      if (sym.deviceType === "ground" || sym.deviceType === "vdd") continue;

      const pinNets = sym.pins.map((p) => p.netName ?? "?").join(" ");
      const params = Object.entries(sym.parameters)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");

      if (sym.deviceType === "nmos" || sym.deviceType === "pmos") {
        lines.push(`${sym.instanceName} ${pinNets} ${sym.deviceType}_model ${params}`);
      } else if (sym.deviceType === "resistor") {
        lines.push(`${sym.instanceName} ${pinNets} ${params}`);
      } else if (sym.deviceType === "capacitor") {
        lines.push(`${sym.instanceName} ${pinNets} ${params}`);
      } else {
        lines.push(`${sym.instanceName} ${pinNets} ${params}`);
      }
    }

    lines.push("", ".end");
    return lines.join("\n");
  },

  clear: () => {
    set({
      elements: [],
      nets: [],
      selectedIds: new Set(),
      highlightedNet: null,
      wireInProgress: null,
      undoStack: [],
      redoStack: [],
      instanceCounters: {},
    });
  },
}));
