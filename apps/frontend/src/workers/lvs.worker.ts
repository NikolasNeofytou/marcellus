/**
 * LVS Web Worker — runs layout-vs-schematic off the main thread.
 *
 * Message protocol:
 *   Request  → { type: 'runLvs', id, layout, schematic }
 *   Response ← { type: 'lvsResult', id, result } | { type: 'lvsError', id, error }
 */

import { runLvs } from "../engines/lvs";
import type { LvsResult, SchematicNetlist } from "../engines/lvs";
import type { ExtractedNetlist } from "../engines/netlist";

export interface LvsWorkerRequest {
  type: "runLvs";
  id: string;
  layout: ExtractedNetlist;
  schematic: SchematicNetlist;
}

export interface LvsWorkerResponse {
  type: "lvsResult" | "lvsError";
  id: string;
  result?: LvsResult;
  error?: string;
}

self.onmessage = (e: MessageEvent<LvsWorkerRequest>) => {
  const { type, id, layout, schematic } = e.data;
  if (type !== "runLvs") return;

  try {
    const result = runLvs(layout, schematic);
    self.postMessage({ type: "lvsResult", id, result } satisfies LvsWorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "lvsError",
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies LvsWorkerResponse);
  }
};
