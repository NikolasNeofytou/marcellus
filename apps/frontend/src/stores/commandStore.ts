import { create } from "zustand";

export interface CommandEntry {
  id: string;
  label: string;
  category?: string;
  keybinding?: string;
  icon?: string;
  execute: () => void;
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

  /** Get filtered commands based on current query. */
  getFilteredCommands: () => CommandEntry[];
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
    if (!query) return all;

    const lower = query.toLowerCase();
    return all
      .filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(lower) ||
          cmd.id.toLowerCase().includes(lower) ||
          cmd.category?.toLowerCase().includes(lower)
      )
      .sort((a, b) => {
        // Prioritize matches at the start
        const aStarts = a.label.toLowerCase().startsWith(lower) ? 0 : 1;
        const bStarts = b.label.toLowerCase().startsWith(lower) ? 0 : 1;
        return aStarts - bStarts || a.label.localeCompare(b.label);
      });
  },
}));
