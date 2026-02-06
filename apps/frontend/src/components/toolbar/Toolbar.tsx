import { useToolStore, type ToolId } from "../../stores/toolStore";
import "./Toolbar.css";

const tools: { id: ToolId; label: string; icon: string; shortcut: string }[] = [
  { id: "select",  label: "Select",   icon: "⊹",  shortcut: "V" },
  { id: "rect",    label: "Rectangle", icon: "▭", shortcut: "R" },
  { id: "polygon", label: "Polygon",  icon: "⬠",  shortcut: "P" },
  { id: "path",    label: "Path/Wire", icon: "╲", shortcut: "W" },
  { id: "via",     label: "Via",      icon: "⊞",  shortcut: "I" },
  { id: "ruler",   label: "Ruler",    icon: "📏", shortcut: "M" },
  { id: "pan",     label: "Pan",      icon: "✋", shortcut: "H" },
];

export function Toolbar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const toolState = useToolStore((s) => s.toolState);

  return (
    <div className="toolbar">
      <div className="toolbar__tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`toolbar__btn ${activeTool === tool.id ? "toolbar__btn--active" : ""}`}
            onClick={() => setActiveTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            <span className="toolbar__icon">{tool.icon}</span>
          </button>
        ))}
      </div>
      <div className="toolbar__status">
        {toolState !== "idle" && (
          <span className="toolbar__state">{toolState}</span>
        )}
      </div>
    </div>
  );
}
