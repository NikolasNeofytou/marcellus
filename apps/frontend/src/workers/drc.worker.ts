/**
 * DRC Web Worker — runs DRC checks off the main thread.
 *
 * Message protocol:
 *   Request  → { type: 'runDrc', id, geometries, rules, techLayers? }
 *   Response ← { type: 'drcResult', id, result } | { type: 'drcError', id, error }
 */

import { prepareDrcGeometries, runDrc } from "../engines/drc";
import type { DrcResult } from "../engines/drc";

export interface DrcWorkerRequest {
  type: "runDrc";
  id: string;
  geometries: Parameters<typeof prepareDrcGeometries>[0];
  rules: Parameters<typeof runDrc>[1];
  layerMap?: Record<number, string>;
  techLayers?: Parameters<typeof runDrc>[2];
}

export interface DrcWorkerResponse {
  type: "drcResult" | "drcError";
  id: string;
  result?: DrcResult;
  error?: string;
}

self.onmessage = (e: MessageEvent<DrcWorkerRequest>) => {
  const { type, id, geometries, rules, layerMap, techLayers } = e.data;
  if (type !== "runDrc") return;

  try {
    const prepared = prepareDrcGeometries(geometries, layerMap);
    const result = runDrc(prepared, rules, techLayers);
    self.postMessage({ type: "drcResult", id, result } satisfies DrcWorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "drcError",
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies DrcWorkerResponse);
  }
};
