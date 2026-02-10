/**
 * Circuit solver Web Worker — runs SPICE simulations off the main thread.
 *
 * Message protocol:
 *   Request  → { type: 'simulate', id, netlist, analysis? }
 *   Response ← { type: 'simResult', id, result }
 *            ← { type: 'simProgress', id, percent }
 *            ← { type: 'simError', id, error }
 */

import { runSimulation } from "../engines/circuitSolver";
import type { SimulationResult } from "../engines/circuitSolver";

export interface SimWorkerRequest {
  type: "simulate";
  id: string;
  netlist: Parameters<typeof runSimulation>[0];
  analysis?: Parameters<typeof runSimulation>[1];
}

export interface SimWorkerResponse {
  type: "simResult" | "simProgress" | "simError";
  id: string;
  result?: SimulationResult;
  percent?: number;
  error?: string;
}

self.onmessage = (e: MessageEvent<SimWorkerRequest>) => {
  const { type, id, netlist, analysis } = e.data;
  if (type !== "simulate") return;

  try {
    const result = runSimulation(netlist, analysis, (pct) => {
      self.postMessage({ type: "simProgress", id, percent: pct } satisfies SimWorkerResponse);
    });
    self.postMessage({ type: "simResult", id, result } satisfies SimWorkerResponse);
  } catch (err) {
    self.postMessage({
      type: "simError",
      id,
      error: err instanceof Error ? err.message : String(err),
    } satisfies SimWorkerResponse);
  }
};
