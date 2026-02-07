/**
 * Layout Generator — converts schematic to initial layout through:
 * 1. Retrieving transistor stick diagrams from gate library
 * 2. Auto-placing components with spatial conflict resolution
 * 3. Auto-routing nets using Manhattan/heuristic routing
 */

import type {
  SchematicElement,
  SchematicSymbol,
  SchematicNet,
} from "../stores/schematicStore";
import type { CanvasGeometry } from "../stores/geometryStore";
import { generateINV } from "./gateGen";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface LayoutInstance {
  /** Instance name (e.g., "M0", "M1") */
  name: string;
  /** Device type */
  deviceType: SchematicSymbol["deviceType"];
  /** Position on canvas (lower-left corner in µm) */
  position: { x: number; y: number };
  /** Rotation in 90° increments */
  rotation: number;
  /** Mirror horizontally */
  mirror: boolean;
  /** Stick diagram geometries for this instance */
  geometries: CanvasGeometry[];
}

export interface LayoutNet {
  /** Net name */
  name: string;
  /** Routed wire segments (polyline) */
  segments: Array<{ x: number; y: number }>;
  /** Layer to route on (e.g., "metal1") */
  layer: string;
}

export interface GeneratedLayout {
  /** All placed instances */
  instances: LayoutInstance[];
  /** All routed nets */
  nets: LayoutNet[];
  /** Bounding box of entire layout */
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

// ══════════════════════════════════════════════════════════════════════
// Symbol Dimensions (µm) — from typical 130nm-like process
// ══════════════════════════════════════════════════════════════════════

const SYMBOL_DIMENSIONS: Record<string, { width: number; height: number }> = {
  nmos: { width: 0.6, height: 0.8 },
  pmos: { width: 0.6, height: 0.8 },
  resistor: { width: 2.0, height: 1.0 },
  capacitor: { width: 1.5, height: 1.0 },
  ground: { width: 0.4, height: 0.3 },
  vdd: { width: 0.4, height: 0.3 },
};

const GRID_STEP = 1.0; // 1µm grid for placement
const MIN_SPACING = 0.2; // 0.2µm minimum spacing between instances

// ══════════════════════════════════════════════════════════════════════
// Stick Diagram Generator Wrapper
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate stick diagram geometries for a device type at a given position.
 */
function generateStickDiagram(
  deviceType: SchematicSymbol["deviceType"],
  position: { x: number; y: number }
): CanvasGeometry[] {
  // Layer IDs (from gateGen.ts)
  const LAYER_IDS = {
    poly: 2,    // polysilicon
    metal1: 4,  // metal1
  };

  // Generate from library based on device type
  let result;
  switch (deviceType) {
    case "nmos":
    case "pmos":
      // Use INV stick diagram (contains NMOS + PMOS pair)
      result = generateINV({ pW: 1.0, nW: 0.5 });
      return result.stickDiagram || [];
    case "resistor":
      // For resistor, create a simple rectangle
      return [
        {
          type: "rect",
          layerId: LAYER_IDS.poly,
          points: [
            { x: position.x, y: position.y },
            { x: position.x + 2.0, y: position.y },
            { x: position.x + 2.0, y: position.y + 1.0 },
            { x: position.x, y: position.y + 1.0 },
          ],
        },
      ];
    case "capacitor":
      // For capacitor, create a pair of parallel plates
      return [
        {
          type: "rect",
          layerId: LAYER_IDS.metal1,
          points: [
            { x: position.x + 0.5, y: position.y },
            { x: position.x + 1.0, y: position.y },
            { x: position.x + 1.0, y: position.y + 1.0 },
            { x: position.x + 0.5, y: position.y + 1.0 },
          ],
        },
      ];
    default:
      // Default: generate INV (NMOS pair)
      result = generateINV({ pW: 1.0, nW: 0.5 });
      return result.stickDiagram || [];
  }
}

// ══════════════════════════════════════════════════════════════════════
// Auto-Placement Engine
// ══════════════════════════════════════════════════════════════════════

/**
 * Place schematic symbols on canvas with conflict avoidance.
 * Uses a greedy bottom-left (BL) algorithm with grid-based positions.
 */
function autoPlaceSymbols(symbols: SchematicSymbol[]): LayoutInstance[] {
  const placed: LayoutInstance[] = [];
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (const sym of symbols) {
    const dims = SYMBOL_DIMENSIONS[sym.deviceType] || { width: 1.0, height: 1.0 };

    // Try positions in a grid, finding first non-conflicting spot
    let placed_pos = false;
    for (let y = 0; y <= 20 && !placed_pos; y += GRID_STEP) {
      for (let x = 0; x <= 50 && !placed_pos; x += GRID_STEP) {
        const candidate = {
          x,
          y,
          w: dims.width,
          h: dims.height,
        };

        // Check for conflicts with existing placements
        let hasConflict = false;
        for (const occ of occupied) {
          // AABB collision with padding
          const pad = MIN_SPACING;
          if (
            candidate.x < occ.x + occ.w + pad &&
            candidate.x + candidate.w + pad > occ.x &&
            candidate.y < occ.y + occ.h + pad &&
            candidate.y + candidate.h + pad > occ.y
          ) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          // Generate stick diagram at this position
          const geometries = generateStickDiagram(sym.deviceType, {
            x: candidate.x,
            y: candidate.y,
          });

          placed.push({
            name: sym.instanceName,
            deviceType: sym.deviceType,
            position: { x: candidate.x, y: candidate.y },
            rotation: 0,
            mirror: false,
            geometries,
          });

          occupied.push(candidate);
          placed_pos = true;
        }
      }
    }

    // If no position found, place at origin (fallback)
    if (!placed_pos) {
      const geometries = generateStickDiagram(sym.deviceType, { x: 0, y: 0 });
      placed.push({
        name: sym.instanceName,
        deviceType: sym.deviceType,
        position: { x: 0, y: 0 },
        rotation: 0,
        mirror: false,
        geometries,
      });
    }
  }

  return placed;
}

// ══════════════════════════════════════════════════════════════════════
// Auto-Routing Engine (Manhattan routing with tie-breaks)
// ══════════════════════════════════════════════════════════════════════

interface RoutePoint {
  x: number;
  y: number;
}

/**
 * Simple Manhattan router: connect net pins via L-shaped or + shaped paths.
 * For now, uses greedy left-then-up (LU) routing.
 */
function routeNet(pins: RoutePoint[]): RoutePoint[] {
  if (pins.length < 2) {
    return pins;
  }

  const route: RoutePoint[] = [];
  const visited = new Set<string>();

  // Start at first pin
  let current = pins[0];
  route.push({ ...current });
  visited.add(`${current.x},${current.y}`);

  // Greedily connect remaining pins
  const remaining = new Set(pins.slice(1));

  while (remaining.size > 0) {
    let nearest: RoutePoint | null = null;
    let nearestDist = Infinity;

    // Find nearest unvisited pin
    for (const pin of remaining) {
      const dist = Math.abs(pin.x - current.x) + Math.abs(pin.y - current.y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = pin;
      }
    }

    if (!nearest) break;

    // Route to nearest: horizontal first, then vertical (Manhattan L-shape)
    const mid: RoutePoint = { x: nearest.x, y: current.y };
    if (!visited.has(`${mid.x},${mid.y}`)) {
      route.push(mid);
      visited.add(`${mid.x},${mid.y}`);
    }
    route.push({ ...nearest });
    visited.add(`${nearest.x},${nearest.y}`);

    current = nearest;
    remaining.delete(nearest);
  }

  return route;
}

// ══════════════════════════════════════════════════════════════════════
// Main Generator
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate an initial layout from a schematic.
 *
 * @param elements Schematic elements (symbols, wires, labels)
 * @param nets Resolved schematic nets with connectivity info
 * @returns Generated layout with instances and routed nets
 */
export function generateLayoutFromSchematic(
  elements: SchematicElement[],
  nets: SchematicNet[]
): GeneratedLayout {
  // 1. Extract symbols
  const symbols = elements.filter(
    (e): e is SchematicSymbol => e.kind === "symbol"
  );

  // 2. Auto-place symbols
  const instances = autoPlaceSymbols(symbols);

  // 3. Extract pin positions for each net
  const layoutNets: LayoutNet[] = [];
  for (const net of nets) {
    // For each symbol connected to this net, find pin position
    const pinPositions: RoutePoint[] = [];

    for (const elemId of net.connectedElementIds) {
      const symbol = symbols.find((s) => s.id === elemId);
      if (!symbol) continue;

      // Find corresponding placed instance
      const placed = instances.find((i) => i.name === symbol.instanceName);
      if (!placed) continue;

      // Estimate pin position (center of instance for simplicity)
      const dims = SYMBOL_DIMENSIONS[symbol.deviceType] || { width: 1.0, height: 1.0 };
      pinPositions.push({
        x: placed.position.x + dims.width / 2,
        y: placed.position.y + dims.height / 2,
      });
    }

    // Route the net
    if (pinPositions.length > 0) {
      const segments = routeNet(pinPositions);
      layoutNets.push({
        name: net.name,
        segments,
        layer: "metal1",
      });
    }
  }

  // 4. Compute bounding box
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const inst of instances) {
    const dims = SYMBOL_DIMENSIONS[inst.deviceType] || {
      width: 1.0,
      height: 1.0,
    };
    minX = Math.min(minX, inst.position.x);
    maxX = Math.max(maxX, inst.position.x + dims.width);
    minY = Math.min(minY, inst.position.y);
    maxY = Math.max(maxY, inst.position.y + dims.height);
  }

  return {
    instances,
    nets: layoutNets,
    bbox: {
      minX: isFinite(minX) ? minX : 0,
      maxX: isFinite(maxX) ? maxX : 50,
      minY: isFinite(minY) ? minY : 0,
      maxY: isFinite(maxY) ? maxY : 20,
    },
  };
}
