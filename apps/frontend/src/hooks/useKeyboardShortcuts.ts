import { useEffect, useRef } from "react";
import { useCommandStore } from "../stores/commandStore";
import { useKeybindingStore, normalizeKeybinding, eventToCombo, parseKeybinding } from "../stores/keybindingStore";

const CHORD_TIMEOUT_MS = 1500;

/**
 * Global keyboard shortcut handler with multi-chord support.
 *
 * Supports:
 *  - Single-key shortcuts (Ctrl+S, Ctrl+Shift+P)
 *  - Multi-chord sequences (Ctrl+K Ctrl+T) with timeout
 *  - Configurable bindings via keybindingStore
 */
export function useKeyboardShortcuts() {
  const togglePalette = useCommandStore((s) => s.togglePalette);
  const executeCommand = useCommandStore((s) => s.executeCommand);
  const commands = useCommandStore((s) => s.commands);
  const isOpen = useCommandStore((s) => s.isOpen);

  // Multi-chord state
  const pendingChordRef = useRef<string | null>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Load persisted keybindings on mount
    useKeybindingStore.getState().load();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore modifier-only presses
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

      // Always handle palette toggle
      if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        clearPendingChord();
        togglePalette();
        return;
      }

      // If palette is open, let it handle its own events
      if (isOpen) return;

      const combo = eventToCombo(e);
      const { removedDefaults, getKeybinding } = useKeybindingStore.getState();

      // Try multi-chord: if there's a pending first chord, combine
      if (pendingChordRef.current) {
        const fullChord = `${pendingChordRef.current} ${combo}`;
        clearPendingChord();

        const normalizedFull = normalizeKeybinding(fullChord);
        for (const cmd of commands.values()) {
          if (removedDefaults.has(cmd.id)) continue;
          const binding = getKeybinding(cmd.id, cmd.keybinding);
          if (!binding) continue;

          if (normalizeKeybinding(binding) === normalizedFull) {
            e.preventDefault();
            executeCommand(cmd.id);
            return;
          }
        }
        // No match for multi-chord — fall through to try as single
      }

      // Try single-key match
      const normalizedCombo = normalizeKeybinding(combo);
      for (const cmd of commands.values()) {
        if (removedDefaults.has(cmd.id)) continue;
        const binding = getKeybinding(cmd.id, cmd.keybinding);
        if (!binding) continue;

        const normalizedBinding = normalizeKeybinding(binding);

        // Exact single-chord match
        if (normalizedBinding === normalizedCombo) {
          e.preventDefault();
          executeCommand(cmd.id);
          return;
        }

        // First chord of a multi-chord sequence
        const chords = parseKeybinding(normalizedBinding);
        if (chords.length > 1 && chords[0].join("+") === normalizedCombo) {
          e.preventDefault();
          setPendingChord(normalizedCombo);
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePalette, executeCommand, commands, isOpen]);

  function setPendingChord(chord: string) {
    pendingChordRef.current = chord;
    if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
    chordTimerRef.current = setTimeout(() => {
      pendingChordRef.current = null;
      chordTimerRef.current = null;
    }, CHORD_TIMEOUT_MS);
  }

  function clearPendingChord() {
    pendingChordRef.current = null;
    if (chordTimerRef.current) {
      clearTimeout(chordTimerRef.current);
      chordTimerRef.current = null;
    }
  }
}
