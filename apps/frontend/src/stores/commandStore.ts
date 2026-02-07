import { create } from "zustand";

export interface CommandEntry {
  id: string;
  label: string;
  category?: string;
  keybinding?: string;
  icon?: string;
  execute: () => void;
}

/** Result of fuzzy matching a command entry against a query. */
export interface FuzzyCommandResult {
  command: CommandEntry;
  score: number;
  /** Indices of matched characters in the label (for highlight rendering). */
  matchedIndices: number[];
}

// ── Fuzzy matching engine ─────────────────────────────────────────

/**
 * Score a candidate string against a query using a fuzzy matching algorithm.
 * Returns { score, matchedIndices } or null if no match.
 *
 * Scoring heuristics:
 *  - Consecutive character matches get a bonus (+5)
 *  - Match at word start gets a bonus (+10)
 *  - Match at string start gets a bonus (+8)
 *  - Each gap between matched chars has a penalty (-1 per gap char)
 *  - Exact substring match gets a huge bonus (+50)
 */
export function fuzzyScore(
  query: string,
  candidate: string
): { score: number; matchedIndices: number[] } | null {
  const qLower = query.toLowerCase();
  const cLower = candidate.toLowerCase();

  // Exact substring match — highest priority
  const substringIdx = cLower.indexOf(qLower);
  if (substringIdx !== -1) {
    const indices = Array.from({ length: query.length }, (_, i) => substringIdx + i);
    let score = 50 + query.length * 2;
    if (substringIdx === 0) score += 20; // starts-with bonus
    if (
      substringIdx > 0 &&
      /[\s_\-./]/.test(candidate[substringIdx - 1])
    ) {
      score += 10; // word-boundary bonus
    }
    return { score, matchedIndices: indices };
  }

  // Fuzzy character-by-character matching
  let qi = 0;
  let score = 0;
  const matchedIndices: number[] = [];
  let lastMatchIndex = -1;

  for (let ci = 0; ci < cLower.length && qi < qLower.length; ci++) {
    if (cLower[ci] === qLower[qi]) {
      matchedIndices.push(ci);

      // Consecutive bonus
      if (lastMatchIndex === ci - 1) {
        score += 5;
      }

      // Word-start bonus
      if (ci === 0) {
        score += 8;
      } else if (/[\s_\-./]/.test(candidate[ci - 1])) {
        score += 10;
      }

      // Gap penalty
      if (lastMatchIndex >= 0) {
        const gap = ci - lastMatchIndex - 1;
        score -= gap;
      }

      score += 1; // base match point
      lastMatchIndex = ci;
      qi++;
    }
  }

  // All query characters must match
  if (qi < qLower.length) return null;

  return { score, matchedIndices };
}

interface CommandState {
  /** Registry of all available commands. */
  commands: Map<string, CommandEntry>;
  /** Whether the command palette is open. */
  isOpen: boolean;
  /** Search query in the command palette. */
  query: string;

  // Actions
  registerCommand: (command: CommandEntry) => void;
  registerCommands: (commands: CommandEntry[]) => void;
  unregisterCommand: (id: string) => void;
  executeCommand: (id: string) => void;

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setQuery: (query: string) => void;

  /** Get filtered commands based on current query (fuzzy scored). */
  getFilteredCommands: () => FuzzyCommandResult[];
}

export const useCommandStore = create<CommandState>((set, get) => ({
  commands: new Map(),
  isOpen: false,
  query: "",

  registerCommand: (command) =>
    set((s) => {
      const commands = new Map(s.commands);
      commands.set(command.id, command);
      return { commands };
    }),

  registerCommands: (commands) =>
    set((s) => {
      const map = new Map(s.commands);
      for (const cmd of commands) {
        map.set(cmd.id, cmd);
      }
      return { commands: map };
    }),

  unregisterCommand: (id) =>
    set((s) => {
      const commands = new Map(s.commands);
      commands.delete(id);
      return { commands };
    }),

  executeCommand: (id) => {
    const cmd = get().commands.get(id);
    if (cmd) {
      cmd.execute();
      set({ isOpen: false, query: "" });
    }
  },

  openPalette: () => set({ isOpen: true, query: "" }),
  closePalette: () => set({ isOpen: false, query: "" }),
  togglePalette: () =>
    set((s) => ({ isOpen: !s.isOpen, query: s.isOpen ? "" : s.query })),
  setQuery: (query) => set({ query }),

  getFilteredCommands: () => {
    const { commands, query } = get();
    const all = Array.from(commands.values());
    if (!query) return all.map((cmd) => ({ command: cmd, score: 0, matchedIndices: [] }));

    const results: FuzzyCommandResult[] = [];
    for (const cmd of all) {
      // Try matching against label, id, and category — take best score
      const labelMatch = fuzzyScore(query, cmd.label);
      const idMatch = fuzzyScore(query, cmd.id);
      const catMatch = cmd.category ? fuzzyScore(query, cmd.category) : null;

      // Pick the best match source
      let best = labelMatch;
      if (idMatch && (!best || idMatch.score > best.score)) best = idMatch;
      if (catMatch && (!best || catMatch.score > best.score)) best = catMatch;

      if (best) {
        results.push({
          command: cmd,
          score: best.score,
          // Always compute label match indices for highlight (even if id/cat scored higher)
          matchedIndices: labelMatch?.matchedIndices ?? [],
        });
      }
    }

    // Sort by score descending, then label alphabetically
    return results.sort(
      (a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label)
    );
  },
}));
