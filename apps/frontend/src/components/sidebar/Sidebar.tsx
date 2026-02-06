import { useWorkspaceStore } from "../../stores/workspaceStore";
import { LayerPalette } from "../panels/LayerPalette";
import { CellHierarchy } from "../panels/CellHierarchy";
import { ExplorerPanel } from "../panels/ExplorerPanel";
import { ComponentLibrary } from "../panels/ComponentLibrary";
import { PropertiesPanel } from "../panels/PropertiesPanel";
import { DrcPanel } from "../panels/DrcPanel";
import { PluginsPanel } from "../panels/PluginsPanel";
import { KeybindingEditor } from "../panels/KeybindingEditor";
import { VcsPanel } from "../panels/VcsPanel";
import { MarketplacePanel } from "../panels/MarketplacePanel";
import "./Sidebar.css";

interface SidebarProps {
  position: "left" | "right";
  style?: React.CSSProperties;
}

export function Sidebar({ position, style }: SidebarProps) {
  const activeSidebarPanel = useWorkspaceStore((s) => s.activeSidebarPanel);
  const panels = useWorkspaceStore((s) => s.panels);

  const sidebarPanels = panels.filter((p) => p.position === position && p.visible);

  if (position === "left") {
    return (
      <div className="sidebar sidebar--left" style={style}>
        <div className="sidebar__header">
          <span className="sidebar__title">
            {activeSidebarPanel.toUpperCase().replace("-", " ")}
          </span>
        </div>
        <div className="sidebar__content">
          {activeSidebarPanel === "explorer" && <ExplorerPanel />}
          {activeSidebarPanel === "cell-hierarchy" && <CellHierarchy />}
          {activeSidebarPanel === "layers" && <LayerPalette />}
          {activeSidebarPanel === "components" && <ComponentLibrary />}
          {activeSidebarPanel === "plugins" && <PluginsPanel />}
          {activeSidebarPanel === "settings" && <KeybindingEditor />}
          {activeSidebarPanel === "marketplace" && <MarketplacePanel />}
          {activeSidebarPanel === "source-control" && <VcsPanel />}
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar sidebar--right" style={style}>
      {sidebarPanels.map((panel) => (
        <div key={panel.id} className="sidebar__section">
          <div className="sidebar__header">
            <span className="sidebar__title">{panel.title}</span>
          </div>
          <div className="sidebar__content">
            {panel.id === "properties" && <PropertiesPanel />}
            {panel.id === "drc-violations" && <DrcPanel />}
          </div>
        </div>
      ))}
    </div>
  );
}
