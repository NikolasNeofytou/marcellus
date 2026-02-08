/**
 * Schematic-Layout Sync Store (V5)
 *
 * Manages bidirectional synchronisation state between schematic and layout,
 * including sync mappings, back-annotation, and forward-sync actions.
 */

import { create } from "zustand";
import type {
  SyncMapping,
  SyncAction,
  SyncReport,
  SyncSummary,
  BackAnnotation,
} from "../engines/schematicLayoutSync";
import {
  generateSyncReport,
  generateBackAnnotation,
  applyBackAnnotation,
  refineMappingsFromLvs,
  generateDemoSyncReport,
} from "../engines/schematicLayoutSync";
import { useSchematicStore } from "./schematicStore";
import { useGeometryStore } from "./geometryStore";
import { useCrossProbeStore } from "./crossProbeStore";
import type { LvsResult } from "../engines/lvs";
import type { ExtractedNetlist } from "../engines/netlist";
import type { SchematicSymbol } from "./schematicStore";

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export type SyncDirection = "schematic-to-layout" | "layout-to-schematic" | "bidirectional";
export type SyncState = "idle" | "syncing" | "completed" | "error";

interface SyncStoreState {
  /** Current sync state */
  syncState: SyncState;
  /** Latest sync report */
  report: SyncReport | null;
  /** Current mappings between schematic and layout */
  mappings: SyncMapping[];
  /** Pending sync actions (user can accept/reject) */
  pendingActions: SyncAction[];
  /** Completed action history */
  actionHistory: Array<{ action: SyncAction; timestamp: number; applied: boolean }>;
  /** Back-annotation data from post-layout extraction */
  backAnnotations: BackAnnotation[];
  /** Whether auto-sync is enabled */
  autoSyncEnabled: boolean;
  /** Sync direction preference */
  syncDirection: SyncDirection;
  /** Selected mapping index for detail view */
  selectedMappingIndex: number | null;
  /** Selected action index */
  selectedActionIndex: number | null;
  /** Error message if sync failed */
  errorMessage: string | null;

  // ── Actions ──

  /** Run a full sync analysis */
  runSync: () => void;
  /** Run sync with demo data */
  runDemoSync: () => void;
  /** Refine mappings using LVS result */
  refineWithLvs: (lvsResult: LvsResult) => void;
  /** Generate back-annotations from extraction */
  backAnnotate: (extraction: ExtractedNetlist) => void;
  /** Apply back-annotation to schematic (push extracted params) */
  applyBackAnnotationToSchematic: () => void;
  /** Accept a sync action */
  acceptAction: (index: number) => void;
  /** Reject a sync action */
  rejectAction: (index: number) => void;
  /** Accept all pending actions */
  acceptAllActions: () => void;
  /** Toggle auto-sync */
  toggleAutoSync: () => void;
  /** Set sync direction */
  setSyncDirection: (dir: SyncDirection) => void;
  /** Select a mapping for detail view */
  selectMapping: (index: number | null) => void;
  /** Select an action */
  selectAction: (index: number | null) => void;
  /** Highlight mapping in both schematic and layout */
  highlightMapping: (mapping: SyncMapping) => void;
  /** Clear sync state */
  clearSync: () => void;
  /** Get summary */
  getSummary: () => SyncSummary | null;
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  syncState: "idle",
  report: null,
  mappings: [],
  pendingActions: [],
  actionHistory: [],
  backAnnotations: [],
  autoSyncEnabled: false,
  syncDirection: "bidirectional",
  selectedMappingIndex: null,
  selectedActionIndex: null,
  errorMessage: null,

  runSync: () => {
    set({ syncState: "syncing", errorMessage: null });

    try {
      const schematicElements = useSchematicStore.getState().elements;
      const schematicSymbols = schematicElements.filter(
        (e): e is SchematicSymbol => e.kind === "symbol",
      );
      const schematicNets = useSchematicStore.getState().nets;

      // For now, we use the extracted netlist devices from the cross-probe store
      // In a full implementation, we'd extract from geometryStore
      const lvsResult = useCrossProbeStore.getState().lvsView.result;
      const layoutDevices = lvsResult
        ? lvsResult.deviceMatches
            .filter((d) => d.layoutDevice)
            .map((d) => d.layoutDevice!)
        : [];

      const report = generateSyncReport(schematicSymbols, layoutDevices, schematicNets);

      set({
        syncState: "completed",
        report,
        mappings: report.mappings,
        pendingActions: report.actions,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ syncState: "error", errorMessage: msg });
    }
  },

  runDemoSync: () => {
    set({ syncState: "syncing", errorMessage: null });
    const report = generateDemoSyncReport();
    set({
      syncState: "completed",
      report,
      mappings: report.mappings,
      pendingActions: report.actions,
    });
  },

  refineWithLvs: (lvsResult) => {
    const { mappings } = get();
    const refined = refineMappingsFromLvs(mappings, lvsResult);
    set({ mappings: refined });
  },

  backAnnotate: (extraction) => {
    const annotations = generateBackAnnotation(extraction);
    set({ backAnnotations: annotations });
  },

  applyBackAnnotationToSchematic: () => {
    const { backAnnotations } = get();
    if (backAnnotations.length === 0) return;

    const schematicElements = useSchematicStore.getState().elements;
    const symbols = schematicElements.filter(
      (e): e is SchematicSymbol => e.kind === "symbol",
    );

    const updates = applyBackAnnotation(backAnnotations, symbols);

    // Apply updates through schematic store
    const store = useSchematicStore.getState();
    for (const [symId, newParams] of updates) {
      store.updateSymbolParams(symId, newParams);
    }

    // Record in history
    set((s) => ({
      actionHistory: [
        ...s.actionHistory,
        {
          action: {
            type: "update-schematic-params",
            description: `Back-annotated ${updates.size} device(s)`,
            instanceName: "*",
            priority: 0,
          },
          timestamp: Date.now(),
          applied: true,
        },
      ],
    }));
  },

  acceptAction: (index) => {
    const { pendingActions } = get();
    if (index < 0 || index >= pendingActions.length) return;

    const action = pendingActions[index];

    // Apply the action based on type
    switch (action.type) {
      case "update-schematic-params":
        if (action.mapping && action.suggestedParams) {
          const store = useSchematicStore.getState();
          const sym = store.elements.find(
            (e) => e.kind === "symbol" && (e as SchematicSymbol).instanceName === action.instanceName,
          );
          if (sym) {
            store.updateSymbolParams(sym.id, action.suggestedParams);
          }
        }
        break;

      case "update-layout-params":
        if (action.mapping && action.suggestedParams) {
          const geomStore = useGeometryStore.getState();
          for (const idx of action.mapping.layoutGeometryIndices) {
            geomStore.updateGeometry(idx, {
              properties: action.suggestedParams as Record<string, string | number | boolean>,
            });
          }
        }
        break;

      // Other action types are informational / require manual user action
      default:
        break;
    }

    // Move from pending to history
    set((s) => ({
      pendingActions: s.pendingActions.filter((_, i) => i !== index),
      actionHistory: [...s.actionHistory, { action, timestamp: Date.now(), applied: true }],
    }));
  },

  rejectAction: (index) => {
    const { pendingActions } = get();
    if (index < 0 || index >= pendingActions.length) return;
    const action = pendingActions[index];

    set((s) => ({
      pendingActions: s.pendingActions.filter((_, i) => i !== index),
      actionHistory: [...s.actionHistory, { action, timestamp: Date.now(), applied: false }],
    }));
  },

  acceptAllActions: () => {
    const { pendingActions } = get();
    // Accept each in order (non-destructive ones only)
    for (let i = pendingActions.length - 1; i >= 0; i--) {
      get().acceptAction(i);
    }
  },

  toggleAutoSync: () => set((s) => ({ autoSyncEnabled: !s.autoSyncEnabled })),

  setSyncDirection: (dir) => set({ syncDirection: dir }),

  selectMapping: (index) => set({ selectedMappingIndex: index }),

  selectAction: (index) => set({ selectedActionIndex: index }),

  highlightMapping: (mapping) => {
    if (mapping.layoutGeometryIndices.length > 0) {
      useCrossProbeStore.getState().hoverHighlight(
        mapping.layoutGeometryIndices,
        mapping.instanceName,
      );
    }
    if (mapping.schematicId) {
      // Highlight in schematic
      useSchematicStore.getState().select([mapping.schematicId]);
    }
  },

  clearSync: () =>
    set({
      syncState: "idle",
      report: null,
      mappings: [],
      pendingActions: [],
      backAnnotations: [],
      selectedMappingIndex: null,
      selectedActionIndex: null,
      errorMessage: null,
    }),

  getSummary: () => get().report?.summary ?? null,
}));
