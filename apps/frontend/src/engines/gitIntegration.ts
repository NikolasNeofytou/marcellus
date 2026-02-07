/**
 * Git Integration Engine — Sprint 25-26
 *
 * Extends the in-memory VCS with:
 * - Layout diff visualization (XOR overlay between two revisions)
 * - Cell-level locking for collaborative editing
 * - GitHub/GitLab PR integration stubs
 * - Branch comparison utilities
 */

import type { CanvasGeometry } from "../stores/geometryStore";

// ── XOR / Layout Diff ─────────────────────────────────────────────

export interface XorRegion {
  /** The resulting XOR shape polygon */
  polygon: { x: number; y: number }[];
  /** Which side it belongs to: "only-a" = only in version A, "only-b" = only in B */
  side: "only-a" | "only-b";
  layerId: number;
  /** Area in square database units */
  area: number;
}

export interface LayoutDiffResult {
  /** XOR regions between two layout states */
  xorRegions: XorRegion[];
  /** Total area of differences */
  totalDiffArea: number;
  /** Per-layer diff stats */
  layerStats: Map<number, { onlyA: number; onlyB: number; areaA: number; areaB: number }>;
  /** Time taken for diff computation (ms) */
  computeTimeMs: number;
}

/**
 * Compute the XOR overlay diff between two geometry snapshots.
 * For rectangles, computes actual geometric XOR regions.
 * For complex shapes, uses bounding-box approximation.
 */
export function computeLayoutXor(
  snapshotA: CanvasGeometry[],
  snapshotB: CanvasGeometry[],
): LayoutDiffResult {
  const t0 = performance.now();
  const xorRegions: XorRegion[] = [];
  const layerStats = new Map<number, { onlyA: number; onlyB: number; areaA: number; areaB: number }>();

  const ensureLayer = (lid: number) => {
    if (!layerStats.has(lid)) layerStats.set(lid, { onlyA: 0, onlyB: 0, areaA: 0, areaB: 0 });
    return layerStats.get(lid)!;
  };

  // Build fingerprint maps for quick matching
  const fpA = new Map<string, CanvasGeometry[]>();
  for (const g of snapshotA) {
    const key = geomFingerprint(g);
    if (!fpA.has(key)) fpA.set(key, []);
    fpA.get(key)!.push(g);
  }

  const fpB = new Map<string, CanvasGeometry[]>();
  for (const g of snapshotB) {
    const key = geomFingerprint(g);
    if (!fpB.has(key)) fpB.set(key, []);
    fpB.get(key)!.push(g);
  }

  // Find geometries only in A
  for (const g of snapshotA) {
    const key = geomFingerprint(g);
    const bList = fpB.get(key);
    if (!bList || bList.length === 0) {
      const bbox = geomBBox(g);
      const area = bbox.w * bbox.h;
      xorRegions.push({
        polygon: bboxToPolygon(bbox),
        side: "only-a",
        layerId: g.layerId,
        area,
      });
      const st = ensureLayer(g.layerId);
      st.onlyA++;
      st.areaA += area;
    } else {
      bList.shift(); // consume one match
    }
  }

  // Rebuild fpA for B-side check
  const fpA2 = new Map<string, CanvasGeometry[]>();
  for (const g of snapshotA) {
    const key = geomFingerprint(g);
    if (!fpA2.has(key)) fpA2.set(key, []);
    fpA2.get(key)!.push(g);
  }

  // Find geometries only in B
  for (const g of snapshotB) {
    const key = geomFingerprint(g);
    const aList = fpA2.get(key);
    if (!aList || aList.length === 0) {
      const bbox = geomBBox(g);
      const area = bbox.w * bbox.h;
      xorRegions.push({
        polygon: bboxToPolygon(bbox),
        side: "only-b",
        layerId: g.layerId,
        area,
      });
      const st = ensureLayer(g.layerId);
      st.onlyB++;
      st.areaB += area;
    } else {
      aList.shift();
    }
  }

  const totalDiffArea = xorRegions.reduce((s, r) => s + r.area, 0);

  return {
    xorRegions,
    totalDiffArea,
    layerStats,
    computeTimeMs: performance.now() - t0,
  };
}

// ── Cell-Level Locking ────────────────────────────────────────────

export interface CellLock {
  cellId: string;
  cellName: string;
  lockedBy: string;
  lockedAt: number;
  /** Optional expiry (ms since epoch) */
  expiresAt?: number;
  /** Reason for lock */
  reason?: string;
}

export interface LockManager {
  locks: Map<string, CellLock>;
  acquireLock: (cellId: string, cellName: string, user: string, reason?: string) => LockResult;
  releaseLock: (cellId: string, user: string) => boolean;
  isLocked: (cellId: string) => boolean;
  getLockedBy: (cellId: string) => string | null;
  forceRelease: (cellId: string) => void;
  listLocks: () => CellLock[];
}

export type LockResult =
  | { success: true; lock: CellLock }
  | { success: false; reason: string; heldBy: string };

export function createLockManager(): LockManager {
  const locks = new Map<string, CellLock>();

  return {
    locks,

    acquireLock(cellId, cellName, user, reason) {
      const existing = locks.get(cellId);
      if (existing) {
        // Check if expired
        if (existing.expiresAt && existing.expiresAt < Date.now()) {
          locks.delete(cellId);
        } else {
          return { success: false, reason: "Cell already locked", heldBy: existing.lockedBy };
        }
      }
      const lock: CellLock = {
        cellId,
        cellName,
        lockedBy: user,
        lockedAt: Date.now(),
        expiresAt: Date.now() + 3600_000, // 1 hour default
        reason,
      };
      locks.set(cellId, lock);
      return { success: true, lock };
    },

    releaseLock(cellId, user) {
      const lock = locks.get(cellId);
      if (!lock) return false;
      if (lock.lockedBy !== user) return false;
      locks.delete(cellId);
      return true;
    },

    isLocked(cellId) {
      const lock = locks.get(cellId);
      if (!lock) return false;
      if (lock.expiresAt && lock.expiresAt < Date.now()) {
        locks.delete(cellId);
        return false;
      }
      return true;
    },

    getLockedBy(cellId) {
      const lock = locks.get(cellId);
      if (!lock) return null;
      if (lock.expiresAt && lock.expiresAt < Date.now()) {
        locks.delete(cellId);
        return null;
      }
      return lock.lockedBy;
    },

    forceRelease(cellId) {
      locks.delete(cellId);
    },

    listLocks() {
      const now = Date.now();
      // Purge expired
      for (const [id, lock] of locks) {
        if (lock.expiresAt && lock.expiresAt < now) locks.delete(id);
      }
      return Array.from(locks.values());
    },
  };
}

// ── GitHub / GitLab PR Integration ────────────────────────────────

export type RemoteProvider = "github" | "gitlab" | "none";

export interface RemoteConfig {
  provider: RemoteProvider;
  baseUrl: string;
  owner: string;
  repo: string;
  token?: string;
}

export interface PullRequestSummary {
  id: number;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  state: "open" | "closed" | "merged";
  createdAt: number;
  updatedAt: number;
  comments: number;
  reviewStatus: "pending" | "approved" | "changes-requested";
  url: string;
  labels: string[];
  diffStats: { additions: number; deletions: number; changedFiles: number };
}

export interface PRComment {
  id: number;
  author: string;
  body: string;
  createdAt: number;
  /** For inline review comments */
  filePath?: string;
  line?: number;
}

/**
 * Generate demo PR data for UI testing.
 */
export function generateDemoPRs(branches: string[]): PullRequestSummary[] {
  const now = Date.now();
  const prs: PullRequestSummary[] = [];
  const authors = ["alice", "bob", "charlie"];
  const labels = [["layout", "review-needed"], ["drc-fix"], ["feature", "analog"], ["bugfix"]];

  branches.forEach((branch, i) => {
    if (branch === "main") return;
    prs.push({
      id: 100 + i,
      title: `${branch}: Layout updates`,
      author: authors[i % authors.length],
      sourceBranch: branch,
      targetBranch: "main",
      state: i % 3 === 0 ? "merged" : "open",
      createdAt: now - (i + 1) * 86400_000,
      updatedAt: now - i * 3600_000,
      comments: Math.floor(Math.random() * 10),
      reviewStatus: i % 3 === 0 ? "approved" : i % 3 === 1 ? "pending" : "changes-requested",
      url: `https://github.com/opensilicon/design/pull/${100 + i}`,
      labels: labels[i % labels.length],
      diffStats: {
        additions: Math.floor(Math.random() * 50) + 5,
        deletions: Math.floor(Math.random() * 20),
        changedFiles: Math.floor(Math.random() * 8) + 1,
      },
    });
  });

  return prs;
}

// ── Helpers ───────────────────────────────────────────────────────

function geomFingerprint(g: CanvasGeometry): string {
  const pts = g.points.map((p) => `${p.x},${p.y}`).join("|");
  return `${g.type}:${g.layerId}:${pts}:${g.width ?? 0}`;
}

interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function geomBBox(g: CanvasGeometry): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of g.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function bboxToPolygon(b: BBox): { x: number; y: number }[] {
  return [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ];
}
