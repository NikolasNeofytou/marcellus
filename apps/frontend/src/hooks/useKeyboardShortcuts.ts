import { useEffect } from "react";
import { useCommandStore } from "../stores/commandStore";

/**
 * Global keyboard shortcut handler.
 * Listens for key combinations and dispatches to the command system.
 */
export function useKeyboardShortcuts() {
  const togglePalette = useCommandStore((s) => s.togglePalette);
  const executeCommand = useCommandStore((s) => s.executeCommand);
  const commands = useCommandStore((s) => s.commands);
  const isOpen = useCommandStore((s) => s.isOpen);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when palette is open (it handles its own keys)
      // But do handle the palette toggle
      if (
        (e.ctrlKey && e.shiftKey && e.key === "P") ||
        (e.ctrlKey && e.shiftKey && e.key === "p")
      ) {
        e.preventDefault();
        togglePalette();
        return;
      }

      // If palette is open, let it handle events
      if (isOpen) return;

      // Build the key combo string
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");

      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (!["Control", "Alt", "Shift", "Meta"].includes(e.key)) {
        parts.push(key);
      }

      const combo = parts.join("+");

      // Match against registered commands
      for (const cmd of commands.values()) {
        if (cmd.keybinding) {
          const normalizedBinding = cmd.keybinding
            .replace(/\s/g, "")
            .split("+")
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join("+");

          if (normalizedBinding === combo) {
            e.preventDefault();
            executeCommand(cmd.id);
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePalette, executeCommand, commands, isOpen]);
}
