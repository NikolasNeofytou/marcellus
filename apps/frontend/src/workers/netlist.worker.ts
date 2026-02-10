/**
 * Netlist extraction Web Worker — runs netlist extraction off the main thread.
 *
 * Message protocol:
 *   Request  → { type: 'extractNetlist', id, geometries, pdk }
 *   Response ← { type: 'netlistResult', id, result } | { type: 'netlistError', id, error }
 */

import { extractNetlist } from "../engines/netlist";
import type { NetlistGeometry, ExtractedNetlist } from "../engines/netlist";

export interface NetlistWorkerRequest {
  type: "extractNetlist";
  id: string;
  geometries: NetlistGeometry[];
  pdk: Parameters<typeof extractNetlist>[1];
}

export interface NetlistWorkerResponse {
  type: "netlistResult" | "netlistError";
  id: string;
  result?: ExtractedNetlist;
  error?: string;
}

self.onmessage = (e: MessageEvent<NetlistWorkerRequest>) => {
  const { type, id, geometries, pdk } = e.data;
  if (type !== "extractNetlist") return;

  try {
    const result = extractNetlist(geometries, pdk);
    self.postMessage({ type: "netlistResult", id, result } satisfies NetlistWorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "netlistError",
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies NetlistWorkerResponse);
  }
};
