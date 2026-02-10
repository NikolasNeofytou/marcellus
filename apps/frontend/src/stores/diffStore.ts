/**
 * Diff Store — manages side-by-side file comparison state.
 *
 * Supports comparing two HDL files (or any text blobs) with
 * a line-based diff algorithm (Myers-like LCS).
 */

import { create } from "zustand";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type DiffLineKind = "equal" | "added" | "removed" | "modified";

export interface DiffLine {
  kind: DiffLineKind;
  leftLineNo: number | null;   // null when added on right
  rightLineNo: number | null;  // null when removed on left
  leftText: string;
  rightText: string;
}

export interface DiffResult {
  leftTitle: string;
  rightTitle: string;
  lines: DiffLine[];
  stats: { added: number; removed: number; modified: number; equal: number };
}

interface DiffState {
  /** Active diff result */
  activeDiff: DiffResult | null;
  /** Whether to ignore whitespace */
  ignoreWhitespace: boolean;

  // ── Actions ──
  computeDiff: (leftTitle: string, leftContent: string, rightTitle: string, rightContent: string) => void;
  clearDiff: () => void;
  setIgnoreWhitespace: (v: boolean) => void;
}

/* ------------------------------------------------------------------ */
/*  Simple LCS-based diff                                             */
/* ------------------------------------------------------------------ */

function computeLineDiff(
  leftLines: string[],
  rightLines: string[],
  ignoreWs: boolean,
): DiffLine[] {
  const normalize = (s: string) => (ignoreWs ? s.replace(/\s+/g, " ").trim() : s);

  const m = leftLines.length;
  const n = rightLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normalize(leftLines[i - 1]) === normalize(rightLines[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrace
  let i = m, j = n;
  const pending: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalize(leftLines[i - 1]) === normalize(rightLines[j - 1])) {
      pending.unshift({
        kind: "equal",
        leftLineNo: i,
        rightLineNo: j,
        leftText: leftLines[i - 1],
        rightText: rightLines[j - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      pending.unshift({
        kind: "added",
        leftLineNo: null,
        rightLineNo: j,
        leftText: "",
        rightText: rightLines[j - 1],
      });
      j--;
    } else {
      pending.unshift({
        kind: "removed",
        leftLineNo: i,
        rightLineNo: null,
        leftText: leftLines[i - 1],
        rightText: "",
      });
      i--;
    }
  }

  return pending;
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

export const useDiffStore = create<DiffState>((set, get) => ({
  activeDiff: null,
  ignoreWhitespace: false,

  computeDiff: (leftTitle, leftContent, rightTitle, rightContent) => {
    const leftLines = leftContent.split("\n");
    const rightLines = rightContent.split("\n");
    const ignoreWs = get().ignoreWhitespace;

    const lines = computeLineDiff(leftLines, rightLines, ignoreWs);

    let added = 0, removed = 0, modified = 0, equal = 0;
    for (const l of lines) {
      if (l.kind === "added") added++;
      else if (l.kind === "removed") removed++;
      else if (l.kind === "modified") modified++;
      else equal++;
    }

    set({
      activeDiff: {
        leftTitle,
        rightTitle,
        lines,
        stats: { added, removed, modified, equal },
      },
    });
  },

  clearDiff: () => set({ activeDiff: null }),

  setIgnoreWhitespace: (v) => set({ ignoreWhitespace: v }),
}));
