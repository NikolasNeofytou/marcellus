import { useWorkspaceStore } from "../../stores/workspaceStore";
import "./ActivityBar.css";

const activityItems = [
  { id: "explorer", icon: "📁", tooltip: "Explorer" },
  { id: "cell-hierarchy", icon: "🏗️", tooltip: "Cell Hierarchy" },
  { id: "layers", icon: "◧", tooltip: "Layers" },
  { id: "components", icon: "⊞", tooltip: "Component Library" },
  { id: "plugins", icon: "🧩", tooltip: "Plugins" },
  { id: "marketplace", icon: "🏪", tooltip: "Marketplace" },
  { id: "source-control", icon: "⑂", tooltip: "Source Control" },
];

const activityBottomItems = [
  { id: "settings", icon: "⚙", tooltip: "Keyboard Shortcuts" },
];

export function ActivityBar() {
  const activeSidebarPanel = useWorkspaceStore((s) => s.activeSidebarPanel);
  const setActiveSidebarPanel = useWorkspaceStore((s) => s.setActiveSidebarPanel);
  const leftSidebarVisible = useWorkspaceStore((s) => s.leftSidebarVisible);
  const toggleLeftSidebar = useWorkspaceStore((s) => s.toggleLeftSidebar);

  const handleClick = (id: string) => {
    if (activeSidebarPanel === id && leftSidebarVisible) {
      toggleLeftSidebar();
    } else {
      setActiveSidebarPanel(id);
    }
  };

  return (
    <div className="activity-bar">
      <div className="activity-bar__top">
        {activityItems.map((item) => (
          <button
            key={item.id}
            className={`activity-bar__item ${
              activeSidebarPanel === item.id && leftSidebarVisible
                ? "activity-bar__item--active"
                : ""
            }`}
            onClick={() => handleClick(item.id)}
            title={item.tooltip}
          >
            <span className="activity-bar__icon">{item.icon}</span>
          </button>
        ))}
      </div>
      <div className="activity-bar__bottom">
        {activityBottomItems.map((item) => (
          <button
            key={item.id}
            className="activity-bar__item"
            title={item.tooltip}
          >
            <span className="activity-bar__icon">{item.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
