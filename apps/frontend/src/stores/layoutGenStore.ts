/**
 * Layout Generation Tool Store
 * Manages layout generation from schematic, with UI state and triggers.
 */

import { create } from "zustand";
import { generateLayoutFromSchematic, type GeneratedLayout } from "../engines/layoutGenerator";
import { useSchematicStore } from "./schematicStore";
import { useGeometryStore, type CanvasGeometry } from "./geometryStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

interface LayoutGenState {
  /** Last generated layout (for undo/inspection) */
  lastLayout: GeneratedLayout | null;
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Status message */
  status: string;

  // ── Actions ──

  /** Generate layout from current schematic and apply to geometry store */
  generateAndApplyLayout: () => void;
  /** Clear generated layout */
  clearLayout: () => void;
}

// ══════════════════════════════════════════════════════════════════════
// Store
// ══════════════════════════════════════════════════════════════════════

export const useLayoutGenStore = create<LayoutGenState>((set) => ({
  lastLayout: null,
  isGenerating: false,
  status: "Ready",

  generateAndApplyLayout: () => {
    set({ isGenerating: true, status: "Generating layout..." });

    try {
      // Get schematic and nets
      const schematicState = useSchematicStore.getState();
      const elements = schematicState.elements;
      const nets = schematicState.nets;

      // Generate layout
      const layout = generateLayoutFromSchematic(elements, nets);

      // Collect all geometries to add
      const allGeometries: CanvasGeometry[] = [];

      // Add all instance geometries
      for (const inst of layout.instances) {
        for (const geom of inst.geometries) {
          allGeometries.push(geom);
        }
      }

      // Add routed net geometries (as metal1 rectangles/paths)
      const METAL1_LAYER = 4; // Layer ID for metal1
      for (const net of layout.nets) {
        // For each segment pair, create a path geometry
        for (let i = 0; i < net.segments.length - 1; i++) {
          const p1 = net.segments[i];
          const p2 = net.segments[i + 1];

          // Create a thin metal rectangle for routing
          const minX = Math.min(p1.x, p2.x) - 0.1; // 0.2µm width
          const maxX = Math.max(p1.x, p2.x) + 0.1;
          const minY = Math.min(p1.y, p2.y) - 0.1;
          const maxY = Math.max(p1.y, p2.y) + 0.1;

          allGeometries.push({
            type: "rect",
            layerId: METAL1_LAYER,
            points: [
              { x: minX, y: minY },
              { x: maxX, y: minY },
              { x: maxX, y: maxY },
              { x: minX, y: maxY },
            ],
            net: net.name,
          });
        }
      }

      // Apply to geometry store via replaceAll
      const geometryState = useGeometryStore.getState();
      geometryState.replaceAll(allGeometries);

      set({
        lastLayout: layout,
        isGenerating: false,
        status: `Generated ${layout.instances.length} instances, ${layout.nets.length} nets`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        isGenerating: false,
        status: `Error: ${message}`,
      });
      console.error("Layout generation error:", err);
    }
  },

  clearLayout: () => {
    set({
      lastLayout: null,
      status: "Layout cleared",
    });
  },
}));
