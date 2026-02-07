import { useToolStore, type ToolId } from "../../stores/toolStore";
import { Hand, Ruler } from "lucide-react";
import { IconSelect, IconRect, IconPolygon, IconPath, IconVia } from "../icons/EdaIcons";
import "./Toolbar.css";

const ICON_SIZE = 15;

const tools: { id: ToolId; label: string; icon: React.ReactNode; shortcut: string }[] = [
  { id: "select",  label: "Select",    icon: <IconSelect size={ICON_SIZE} />,  shortcut: "V" },
  { id: "rect",    label: "Rectangle", icon: <IconRect size={ICON_SIZE} />,    shortcut: "R" },
  { id: "polygon", label: "Polygon",   icon: <IconPolygon size={ICON_SIZE} />, shortcut: "P" },
  { id: "path",    label: "Path/Wire", icon: <IconPath size={ICON_SIZE} />,    shortcut: "W" },
  { id: "via",     label: "Via",       icon: <IconVia size={ICON_SIZE} />,     shortcut: "I" },
  { id: "ruler",   label: "Ruler",     icon: <Ruler size={ICON_SIZE} />,       shortcut: "M" },
  { id: "pan",     label: "Pan",       icon: <Hand size={ICON_SIZE} />,        shortcut: "H" },
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
