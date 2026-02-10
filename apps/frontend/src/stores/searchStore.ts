/**
 * Search Store — Zustand state for global text/regex search across project files.
 */

import { create } from "zustand";
import { getVirtualFileSystem } from "../engines/projectFileSystem";

export interface SearchMatch {
  filePath: string;
  lineNumber: number;
  lineText: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchFileGroup {
  filePath: string;
  matches: SearchMatch[];
}

interface SearchState {
  /** Search query string */
  query: string;
  /** Whether regex mode is enabled */
  isRegex: boolean;
  /** Whether case-sensitive */
  caseSensitive: boolean;
  /** Whether to match whole word only */
  wholeWord: boolean;
  /** File glob include pattern */
  includePattern: string;
  /** File glob exclude pattern */
  excludePattern: string;
  /** Search results grouped by file */
  results: SearchFileGroup[];
  /** Total match count */
  totalMatches: number;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Expanded file paths in results tree */
  expandedFiles: Set<string>;
  /** Selected match index */
  selectedIndex: number;

  /** Actions */
  setQuery: (query: string) => void;
  toggleRegex: () => void;
  toggleCaseSensitive: () => void;
  toggleWholeWord: () => void;
  setIncludePattern: (p: string) => void;
  setExcludePattern: (p: string) => void;
  executeSearch: () => void;
  clearResults: () => void;
  toggleFileExpand: (filePath: string) => void;
  setSelectedIndex: (idx: number) => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  isRegex: false,
  caseSensitive: false,
  wholeWord: false,
  includePattern: "",
  excludePattern: "",
  results: [],
  totalMatches: 0,
  isSearching: false,
  expandedFiles: new Set<string>(),
  selectedIndex: -1,

  setQuery: (query) => set({ query }),
  toggleRegex: () => set((s) => ({ isRegex: !s.isRegex })),
  toggleCaseSensitive: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  toggleWholeWord: () => set((s) => ({ wholeWord: !s.wholeWord })),
  setIncludePattern: (p) => set({ includePattern: p }),
  setExcludePattern: (p) => set({ excludePattern: p }),

  executeSearch: () => {
    const { query, isRegex, caseSensitive, wholeWord } = get();
    if (!query.trim()) {
      set({ results: [], totalMatches: 0 });
      return;
    }

    set({ isSearching: true });

    // Use VFS search
    const vfs = getVirtualFileSystem();
    const vfsResults = vfs.searchContent(query, { caseSensitive, regex: isRegex });

    // Group by file
    const groups = new Map<string, SearchMatch[]>();
    let total = 0;

    for (const r of vfsResults) {
      const existing = groups.get(r.filePath) ?? [];
      // Parse line matches from each result
      const content = vfs.readFile(r.filePath);
      if (!content) continue;

      const lines = content.split("\n");
      let searchRegex: RegExp;
      try {
        let pattern = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (wholeWord) pattern = `\\b${pattern}\\b`;
        searchRegex = new RegExp(pattern, caseSensitive ? "g" : "gi");
      } catch {
        continue;
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match: RegExpExecArray | null;
        searchRegex.lastIndex = 0;
        while ((match = searchRegex.exec(line)) !== null) {
          existing.push({
            filePath: r.filePath,
            lineNumber: i + 1,
            lineText: line,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
          });
          total++;
          // Prevent infinite loop on zero-length match
          if (match[0].length === 0) break;
        }
      }

      if (existing.length > 0) {
        groups.set(r.filePath, existing);
      }
    }

    const results: SearchFileGroup[] = Array.from(groups.entries()).map(
      ([filePath, matches]) => ({ filePath, matches })
    );

    // Auto-expand all files that have results
    const expandedFiles = new Set(results.map((r) => r.filePath));

    set({ results, totalMatches: total, isSearching: false, expandedFiles });
  },

  clearResults: () =>
    set({
      query: "",
      results: [],
      totalMatches: 0,
      expandedFiles: new Set(),
      selectedIndex: -1,
    }),

  toggleFileExpand: (filePath) =>
    set((s) => {
      const next = new Set(s.expandedFiles);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return { expandedFiles: next };
    }),

  setSelectedIndex: (idx) => set({ selectedIndex: idx }),
}));
