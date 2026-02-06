import { useEffect } from "react";
import { useToolStore, type ToolId } from "../stores/toolStore";

/**
 * Keyboard shortcuts for switching tools.
 * Single-key shortcuts (no modifiers) for rapid tool access.
 */
const toolShortcuts: Record<string, ToolId> = {
  v: "select",
  r: "rect",
  p: "polygon",
  w: "path",
  i: "via",
  m: "ruler",
  h: "pan",
};

export function useToolShortcuts() {
  const setActiveTool = useToolStore((s) => s.setActiveTool);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Don't trigger with modifiers (Ctrl/Alt/Meta) — those are for other shortcuts
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const tool = toolShortcuts[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        setActiveTool(tool);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setActiveTool]);
}
