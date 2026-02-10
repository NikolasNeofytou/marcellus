import { create } from "zustand";

export type Theme = "dark" | "light";

const THEME_STORAGE_KEY = "opensilicon:theme";

function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* ignore */ }
  return "dark";
}

function saveTheme(theme: Theme) {
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadTheme(),
  setTheme: (theme) => {
    saveTheme(theme);
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      saveTheme(next);
      return { theme: next };
    }),
}));
