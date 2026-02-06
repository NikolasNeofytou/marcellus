/**
 * VCS Store — version control for layout designs.
 *
 * Provides Git-like semantics (branch, commit, diff, merge) for
 * CanvasGeometry snapshots. All history is kept in-memory.
 */

import { create } from "zustand";
import type { CanvasGeometry } from "./geometryStore";

// ── Types ─────────────────────────────────────────────────────────

export interface VcsCommit {
  id: string;
  message: string;
  timestamp: number;
  author: string;
  parentIds: string[];
  /** Snapshot of all geometries at this commit */
  snapshot: CanvasGeometry[];
  /** Branch this commit was made on */
  branch: string;
}

export interface VcsBranch {
  name: string;
  headCommitId: string;
  createdAt: number;
  /** Upstream branch name (for merge tracking) */
  upstream?: string;
}

export type DiffAction = "added" | "removed" | "modified";

export interface GeometryDiff {
  action: DiffAction;
  /** Index in the "before" snapshot (undefined for "added") */
  beforeIndex?: number;
  /** Index in the "after" snapshot (undefined for "removed") */
  afterIndex?: number;
  /** The geometry in the before state */
  before?: CanvasGeometry;
  /** The geometry in the after state */
  after?: CanvasGeometry;
  layerId: number;
}

export interface CommitDiff {
  fromCommitId: string;
  toCommitId: string;
  diffs: GeometryDiff[];
  stats: { added: number; removed: number; modified: number };
}

export interface MergeConflict {
  /** Geometry index in target branch */
  targetIndex: number;
  /** Geometry from target branch */
  targetGeom: CanvasGeometry;
  /** Geometry from source branch */
  sourceGeom: CanvasGeometry;
  /** Resolution: "target" | "source" | "manual" */
  resolution: "target" | "source" | "manual" | null;
  /** Manual geometry if resolution is "manual" */
  manualGeom?: CanvasGeometry;
}

interface VcsStoreState {
  /** All commits by id */
  commits: Map<string, VcsCommit>;

  /** All branches */
  branches: Map<string, VcsBranch>;

  /** Current branch name */
  currentBranch: string;

  /** Ordered commit IDs (newest first) for log display */
  commitLog: string[];

  /** Currently viewed diff */
  activeDiff: CommitDiff | null;

  /** Merge state */
  mergeConflicts: MergeConflict[];
  isMerging: boolean;
  mergeSourceBranch: string | null;

  /** Author name */
  authorName: string;

  // ── Actions ──

  /** Initialise the VCS with the current geometries as initial commit */
  init: (geometries: CanvasGeometry[], projectName?: string) => void;

  /** Create a new commit from the current geometries */
  commit: (message: string, geometries: CanvasGeometry[]) => string;

  /** Get a specific commit */
  getCommit: (id: string) => VcsCommit | undefined;

  /** Create a new branch at the current HEAD */
  createBranch: (name: string) => void;

  /** Switch to a branch (returns the snapshot to load) */
  checkout: (branchName: string) => CanvasGeometry[] | null;

  /** Delete a branch */
  deleteBranch: (name: string) => boolean;

  /** Compute diff between two commits */
  diff: (fromId: string, toId: string) => CommitDiff;

  /** Diff working tree against HEAD */
  diffWorking: (currentGeometries: CanvasGeometry[]) => CommitDiff;

  /** Set active diff for display */
  setActiveDiff: (diff: CommitDiff | null) => void;

  /** Start a merge from sourceBranch into current branch */
  startMerge: (sourceBranch: string, currentGeometries: CanvasGeometry[]) => MergeConflict[];

  /** Resolve a single merge conflict */
  resolveConflict: (index: number, resolution: "target" | "source") => void;

  /** Complete the merge (returns merged geometries) */
  completeMerge: () => CanvasGeometry[] | null;

  /** Abort the merge */
  abortMerge: () => void;

  /** Get HEAD commit of current branch */
  getHead: () => VcsCommit | undefined;

  /** Get commit history for current branch */
  getHistory: (limit?: number) => VcsCommit[];

  /** Get all branch names */
  getBranchNames: () => string[];

  /** Set author name */
  setAuthorName: (name: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────

function generateId(): string {
  const chars = "0123456789abcdef";
  let id = "";
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * 16)];
  return id;
}

function cloneGeom(g: CanvasGeometry): CanvasGeometry {
  return { ...g, points: g.points.map((p) => ({ ...p })) };
}

function cloneGeometries(geoms: CanvasGeometry[]): CanvasGeometry[] {
  return geoms.map(cloneGeom);
}

/** Check if two geometries are structurally equal */
function geomEqual(a: CanvasGeometry, b: CanvasGeometry): boolean {
  if (a.type !== b.type || a.layerId !== b.layerId || a.width !== b.width) return false;
  if (a.points.length !== b.points.length) return false;
  for (let i = 0; i < a.points.length; i++) {
    if (a.points[i].x !== b.points[i].x || a.points[i].y !== b.points[i].y) return false;
  }
  return true;
}

/** Compute a fingerprint for a geometry (for matching across snapshots) */
function geomFingerprint(g: CanvasGeometry): string {
  const pts = g.points.map((p) => `${p.x},${p.y}`).join(";");
  return `${g.type}|${g.layerId}|${pts}|${g.width ?? ""}`;
}

// ── Store ─────────────────────────────────────────────────────────

export const useVcsStore = create<VcsStoreState>((set, get) => ({
  commits: new Map(),
  branches: new Map(),
  currentBranch: "main",
  commitLog: [],
  activeDiff: null,
  mergeConflicts: [],
  isMerging: false,
  mergeSourceBranch: null,
  authorName: "Designer",

  init: (geometries, projectName) => {
    const commitId = generateId();
    const commit: VcsCommit = {
      id: commitId,
      message: projectName ? `Initial commit: ${projectName}` : "Initial commit",
      timestamp: Date.now(),
      author: get().authorName,
      parentIds: [],
      snapshot: cloneGeometries(geometries),
      branch: "main",
    };

    const branch: VcsBranch = {
      name: "main",
      headCommitId: commitId,
      createdAt: Date.now(),
    };

    set({
      commits: new Map([[commitId, commit]]),
      branches: new Map([["main", branch]]),
      currentBranch: "main",
      commitLog: [commitId],
    });
  },

  commit: (message, geometries) => {
    const state = get();
    const branch = state.branches.get(state.currentBranch);
    if (!branch) return "";

    const commitId = generateId();
    const commit: VcsCommit = {
      id: commitId,
      message,
      timestamp: Date.now(),
      author: state.authorName,
      parentIds: [branch.headCommitId],
      snapshot: cloneGeometries(geometries),
      branch: state.currentBranch,
    };

    const newCommits = new Map(state.commits);
    newCommits.set(commitId, commit);

    const newBranches = new Map(state.branches);
    newBranches.set(state.currentBranch, { ...branch, headCommitId: commitId });

    set({
      commits: newCommits,
      branches: newBranches,
      commitLog: [commitId, ...state.commitLog],
    });

    return commitId;
  },

  getCommit: (id) => get().commits.get(id),

  createBranch: (name) => {
    const state = get();
    if (state.branches.has(name)) return;
    const currentHead = state.branches.get(state.currentBranch);
    if (!currentHead) return;

    const newBranch: VcsBranch = {
      name,
      headCommitId: currentHead.headCommitId,
      createdAt: Date.now(),
      upstream: state.currentBranch,
    };

    const newBranches = new Map(state.branches);
    newBranches.set(name, newBranch);
    set({ branches: newBranches });
  },

  checkout: (branchName) => {
    const state = get();
    const branch = state.branches.get(branchName);
    if (!branch) return null;

    const commit = state.commits.get(branch.headCommitId);
    if (!commit) return null;

    // Rebuild commit log for this branch
    const log: string[] = [];
    let current: VcsCommit | undefined = commit;
    while (current) {
      log.push(current.id);
      current = current.parentIds.length > 0
        ? state.commits.get(current.parentIds[0])
        : undefined;
    }

    set({ currentBranch: branchName, commitLog: log });
    return cloneGeometries(commit.snapshot);
  },

  deleteBranch: (name) => {
    if (name === "main" || name === get().currentBranch) return false;
    const newBranches = new Map(get().branches);
    newBranches.delete(name);
    set({ branches: newBranches });
    return true;
  },

  diff: (fromId, toId) => {
    const state = get();
    const fromCommit = state.commits.get(fromId);
    const toCommit = state.commits.get(toId);
    if (!fromCommit || !toCommit) {
      return { fromCommitId: fromId, toCommitId: toId, diffs: [], stats: { added: 0, removed: 0, modified: 0 } };
    }
    return computeDiff(fromId, toId, fromCommit.snapshot, toCommit.snapshot);
  },

  diffWorking: (currentGeometries) => {
    const head = get().getHead();
    if (!head) {
      return { fromCommitId: "", toCommitId: "working", diffs: [], stats: { added: 0, removed: 0, modified: 0 } };
    }
    return computeDiff(head.id, "working", head.snapshot, currentGeometries);
  },

  setActiveDiff: (diff) => set({ activeDiff: diff }),

  startMerge: (sourceBranch, currentGeometries) => {
    const state = get();
    const srcBranch = state.branches.get(sourceBranch);
    if (!srcBranch) return [];

    const srcCommit = state.commits.get(srcBranch.headCommitId);
    if (!srcCommit) return [];

    // Simple three-way merge: find conflicts where both branches modified same geometry
    const targetSnap = currentGeometries;
    const sourceSnap = srcCommit.snapshot;

    // Find common ancestor (HEAD of upstream or first commit)
    const head = state.getHead();
    const baseSnap = head?.snapshot ?? [];

    const conflicts: MergeConflict[] = [];
    const baseFprints = new Map<string, number>();
    baseSnap.forEach((g, i) => baseFprints.set(geomFingerprint(g), i));

    const targetFprints = new Map<string, number>();
    targetSnap.forEach((g, i) => targetFprints.set(geomFingerprint(g), i));

    const sourceFprints = new Map<string, number>();
    sourceSnap.forEach((g, i) => sourceFprints.set(geomFingerprint(g), i));

    // For each geometry in base that was modified differently in both branches
    for (const [fp, baseIdx] of baseFprints) {
      const inTarget = targetFprints.has(fp);
      const inSource = sourceFprints.has(fp);

      if (!inTarget && !inSource) {
        // Both deleted — no conflict
        continue;
      }
      if (inTarget && !inSource) {
        // Source deleted, target kept — conflict
        const tIdx = targetFprints.get(fp)!;
        conflicts.push({
          targetIndex: tIdx,
          targetGeom: cloneGeom(targetSnap[tIdx]),
          sourceGeom: cloneGeom(baseSnap[baseIdx]),
          resolution: null,
        });
      }
    }

    // Check for geometry modifications
    for (let i = 0; i < Math.min(targetSnap.length, sourceSnap.length); i++) {
      if (i < baseSnap.length) {
        const base = baseSnap[i];
        const target = i < targetSnap.length ? targetSnap[i] : undefined;
        const source = i < sourceSnap.length ? sourceSnap[i] : undefined;
        if (target && source && !geomEqual(base, target) && !geomEqual(base, source) && !geomEqual(target, source)) {
          conflicts.push({
            targetIndex: i,
            targetGeom: cloneGeom(target),
            sourceGeom: cloneGeom(source),
            resolution: null,
          });
        }
      }
    }

    set({
      isMerging: true,
      mergeConflicts: conflicts,
      mergeSourceBranch: sourceBranch,
    });

    return conflicts;
  },

  resolveConflict: (index, resolution) => {
    set((s) => ({
      mergeConflicts: s.mergeConflicts.map((c, i) =>
        i === index ? { ...c, resolution } : c,
      ),
    }));
  },

  completeMerge: () => {
    const state = get();
    if (!state.isMerging || !state.mergeSourceBranch) return null;

    // Check all conflicts are resolved
    if (state.mergeConflicts.some((c) => c.resolution === null)) return null;

    // Build merged snapshot from current HEAD + source changes
    const head = state.getHead();
    if (!head) return null;

    const srcBranch = state.branches.get(state.mergeSourceBranch);
    if (!srcBranch) return null;

    const srcCommit = state.commits.get(srcBranch.headCommitId);
    if (!srcCommit) return null;

    // Start with source snapshot, apply conflict resolutions
    const merged = cloneGeometries(srcCommit.snapshot);
    for (const conflict of state.mergeConflicts) {
      if (conflict.resolution === "target" && conflict.targetIndex < merged.length) {
        merged[conflict.targetIndex] = cloneGeom(conflict.targetGeom);
      }
    }

    set({
      isMerging: false,
      mergeConflicts: [],
      mergeSourceBranch: null,
    });

    return merged;
  },

  abortMerge: () => {
    set({
      isMerging: false,
      mergeConflicts: [],
      mergeSourceBranch: null,
    });
  },

  getHead: () => {
    const state = get();
    const branch = state.branches.get(state.currentBranch);
    if (!branch) return undefined;
    return state.commits.get(branch.headCommitId);
  },

  getHistory: (limit = 50) => {
    const state = get();
    return state.commitLog
      .slice(0, limit)
      .map((id) => state.commits.get(id))
      .filter((c): c is VcsCommit => c !== undefined);
  },

  getBranchNames: () => Array.from(get().branches.keys()),

  setAuthorName: (name) => set({ authorName: name }),
}));

// ── Diff Algorithm ────────────────────────────────────────────────

function computeDiff(
  fromId: string,
  toId: string,
  before: CanvasGeometry[],
  after: CanvasGeometry[],
): CommitDiff {
  const diffs: GeometryDiff[] = [];
  let added = 0, removed = 0, modified = 0;

  // Build fingerprint maps
  const beforeFp = new Map<string, number[]>();
  before.forEach((g, i) => {
    const fp = geomFingerprint(g);
    if (!beforeFp.has(fp)) beforeFp.set(fp, []);
    beforeFp.get(fp)!.push(i);
  });

  const afterFp = new Map<string, number[]>();
  after.forEach((g, i) => {
    const fp = geomFingerprint(g);
    if (!afterFp.has(fp)) afterFp.set(fp, []);
    afterFp.get(fp)!.push(i);
  });

  const matchedBefore = new Set<number>();
  const matchedAfter = new Set<number>();

  // Match identical geometries
  for (const [fp, beforeIndices] of beforeFp) {
    const afterIndices = afterFp.get(fp);
    if (afterIndices) {
      const matchCount = Math.min(beforeIndices.length, afterIndices.length);
      for (let i = 0; i < matchCount; i++) {
        matchedBefore.add(beforeIndices[i]);
        matchedAfter.add(afterIndices[i]);
      }
    }
  }

  // Try to match unmatched geometries by position (modified)
  const unmatchedBefore = before
    .map((g, i) => ({ g, i }))
    .filter(({ i }) => !matchedBefore.has(i));
  const unmatchedAfter = after
    .map((g, i) => ({ g, i }))
    .filter(({ i }) => !matchedAfter.has(i));

  // Match by same layer + overlapping bbox → modified
  for (const ub of unmatchedBefore) {
    let bestMatch = -1;
    let bestScore = 0;
    for (let j = 0; j < unmatchedAfter.length; j++) {
      const ua = unmatchedAfter[j];
      if (matchedAfter.has(ua.i)) continue;
      if (ub.g.layerId === ua.g.layerId && ub.g.type === ua.g.type) {
        // Compute overlap score
        const score = overlapScore(ub.g, ua.g);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = j;
        }
      }
    }
    if (bestMatch >= 0 && bestScore > 0) {
      const ua = unmatchedAfter[bestMatch];
      matchedBefore.add(ub.i);
      matchedAfter.add(ua.i);
      diffs.push({
        action: "modified",
        beforeIndex: ub.i,
        afterIndex: ua.i,
        before: ub.g,
        after: ua.g,
        layerId: ub.g.layerId,
      });
      modified++;
    }
  }

  // Remaining unmatched before → removed
  for (const ub of unmatchedBefore) {
    if (!matchedBefore.has(ub.i)) {
      diffs.push({
        action: "removed",
        beforeIndex: ub.i,
        before: ub.g,
        layerId: ub.g.layerId,
      });
      removed++;
    }
  }

  // Remaining unmatched after → added
  for (const ua of unmatchedAfter) {
    if (!matchedAfter.has(ua.i)) {
      diffs.push({
        action: "added",
        afterIndex: ua.i,
        after: ua.g,
        layerId: ua.g.layerId,
      });
      added++;
    }
  }

  return { fromCommitId: fromId, toCommitId: toId, diffs, stats: { added, removed, modified } };
}

function overlapScore(a: CanvasGeometry, b: CanvasGeometry): number {
  const aBbox = bbox(a);
  const bBbox = bbox(b);
  const ox = Math.max(0, Math.min(aBbox.maxX, bBbox.maxX) - Math.max(aBbox.minX, bBbox.minX));
  const oy = Math.max(0, Math.min(aBbox.maxY, bBbox.maxY) - Math.max(aBbox.minY, bBbox.minY));
  return ox * oy;
}

function bbox(g: CanvasGeometry): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of g.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
