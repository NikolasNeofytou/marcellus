/**
 * workerPool — Promise-based wrappers around compute Web Workers.
 *
 * Main-thread code should call these functions instead of the raw
 * engine functions.  Each call creates a one-shot request ID, posts
 * to the worker, and resolves/rejects when the worker replies.
 *
 * Usage:
 *   import { workerDrc, workerLvs, workerSimulate, workerNetlist } from './workerPool';
 *   const result = await workerDrc(geometries, rules);
 */

import type { DrcResult } from "../engines/drc";
import type { LvsResult, SchematicNetlist } from "../engines/lvs";
import type { ExtractedNetlist, NetlistGeometry } from "../engines/netlist";
import type { SimulationResult } from "../engines/circuitSolver";

import type { DrcWorkerRequest, DrcWorkerResponse } from "./drc.worker";
import type { LvsWorkerRequest, LvsWorkerResponse } from "./lvs.worker";
import type { NetlistWorkerRequest, NetlistWorkerResponse } from "./netlist.worker";
import type { SimWorkerRequest, SimWorkerResponse } from "./circuitSolver.worker";

// ── Internal helpers ──

let _idCounter = 0;
function nextId(): string {
  return `w${++_idCounter}-${Date.now().toString(36)}`;
}

/** Lazily create a single worker per module. */
function lazyWorker(factory: () => Worker): () => Worker {
  let instance: Worker | null = null;
  return () => {
    if (!instance) instance = factory();
    return instance;
  };
}

// Vite handles `new Worker(new URL(...), { type: 'module' })` out of the box.

const getDrcWorker = lazyWorker(
  () => new Worker(new URL("./drc.worker.ts", import.meta.url), { type: "module" }),
);
const getLvsWorker = lazyWorker(
  () => new Worker(new URL("./lvs.worker.ts", import.meta.url), { type: "module" }),
);
const getNetlistWorker = lazyWorker(
  () => new Worker(new URL("./netlist.worker.ts", import.meta.url), { type: "module" }),
);
const getSimWorker = lazyWorker(
  () => new Worker(new URL("./circuitSolver.worker.ts", import.meta.url), { type: "module" }),
);

// ── DRC ──

export function workerDrc(
  geometries: DrcWorkerRequest["geometries"],
  rules: DrcWorkerRequest["rules"],
  layerMap?: Record<number, string>,
  techLayers?: DrcWorkerRequest["techLayers"],
): Promise<DrcResult> {
  return new Promise((resolve, reject) => {
    const id = nextId();
    const worker = getDrcWorker();
    const handler = (e: MessageEvent<DrcWorkerResponse>) => {
      if (e.data.id !== id) return;
      worker.removeEventListener("message", handler);
      if (e.data.type === "drcResult" && e.data.result) resolve(e.data.result);
      else reject(new Error(e.data.error ?? "DRC worker error"));
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "runDrc", id, geometries, rules, layerMap, techLayers } satisfies DrcWorkerRequest);
  });
}

// ── LVS ──

export function workerLvs(
  layout: ExtractedNetlist,
  schematic: SchematicNetlist,
): Promise<LvsResult> {
  return new Promise((resolve, reject) => {
    const id = nextId();
    const worker = getLvsWorker();
    const handler = (e: MessageEvent<LvsWorkerResponse>) => {
      if (e.data.id !== id) return;
      worker.removeEventListener("message", handler);
      if (e.data.type === "lvsResult" && e.data.result) resolve(e.data.result);
      else reject(new Error(e.data.error ?? "LVS worker error"));
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "runLvs", id, layout, schematic } satisfies LvsWorkerRequest);
  });
}

// ── Netlist extraction ──

export function workerNetlist(
  geometries: NetlistGeometry[],
  pdk: NetlistWorkerRequest["pdk"],
): Promise<ExtractedNetlist> {
  return new Promise((resolve, reject) => {
    const id = nextId();
    const worker = getNetlistWorker();
    const handler = (e: MessageEvent<NetlistWorkerResponse>) => {
      if (e.data.id !== id) return;
      worker.removeEventListener("message", handler);
      if (e.data.type === "netlistResult" && e.data.result) resolve(e.data.result);
      else reject(new Error(e.data.error ?? "Netlist worker error"));
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "extractNetlist", id, geometries, pdk } satisfies NetlistWorkerRequest);
  });
}

// ── Circuit solver ──

export interface SimulateOptions {
  onProgress?: (percent: number) => void;
}

export function workerSimulate(
  netlist: SimWorkerRequest["netlist"],
  analysis?: SimWorkerRequest["analysis"],
  options?: SimulateOptions,
): Promise<SimulationResult> {
  return new Promise((resolve, reject) => {
    const id = nextId();
    const worker = getSimWorker();
    const handler = (e: MessageEvent<SimWorkerResponse>) => {
      if (e.data.id !== id) return;
      if (e.data.type === "simProgress") {
        options?.onProgress?.(e.data.percent ?? 0);
        return; // keep listening
      }
      worker.removeEventListener("message", handler);
      if (e.data.type === "simResult" && e.data.result) resolve(e.data.result);
      else reject(new Error(e.data.error ?? "Simulation worker error"));
    };
    worker.addEventListener("message", handler);
    worker.postMessage({ type: "simulate", id, netlist, analysis } satisfies SimWorkerRequest);
  });
}
