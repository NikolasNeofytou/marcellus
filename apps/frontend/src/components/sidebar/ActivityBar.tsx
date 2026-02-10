import { useWorkspaceStore } from "../../stores/workspaceStore";
import {
  FolderOpen,
  Puzzle,
  Store,
  GitBranch,
  Settings,
  Zap,
  Calculator,
  ShieldCheck,
  GitPullRequest,
  Cpu,
  Dice5,
  GraduationCap,
  Bot,
  Activity,
  Users,
  Globe,
  PlayCircle,
  ArrowLeftRight,
  Library,
  FileCode,
  Search,
  Files,
  ListTree,
  Braces,
  Hammer,
  CircuitBoard,
} from "lucide-react";
import { IconLayers, IconCellHierarchy, IconComponentLib, IconMosfet } from "../icons/EdaIcons";
import "./ActivityBar.css";

const ICON_SIZE = 20;

const activityItems = [
  { id: "file-explorer",   icon: <Files size={ICON_SIZE} />,                  tooltip: "File Explorer" },
  { id: "search",          icon: <Search size={ICON_SIZE} />,                 tooltip: "Search" },
  { id: "explorer",        icon: <FolderOpen size={ICON_SIZE} />,              tooltip: "Geometry Explorer" },
  { id: "cell-hierarchy",  icon: <IconCellHierarchy size={ICON_SIZE} />,       tooltip: "Cell Hierarchy" },
  { id: "layers",          icon: <IconLayers size={ICON_SIZE} />,              tooltip: "Layers" },
  { id: "components",      icon: <IconComponentLib size={ICON_SIZE} />,        tooltip: "Component Library" },
  { id: "generators",      icon: <Zap size={ICON_SIZE} />,                    tooltip: "Layout Generators" },
  { id: "transistors",     icon: <IconMosfet size={ICON_SIZE} />,              tooltip: "Transistor Generator" },
  { id: "calculators",     icon: <Calculator size={ICON_SIZE} />,             tooltip: "Analog Calculators" },
  { id: "verification",    icon: <ShieldCheck size={ICON_SIZE} />,            tooltip: "Verification" },
  { id: "plugins",         icon: <Puzzle size={ICON_SIZE} />,                 tooltip: "Plugins" },
  { id: "marketplace",     icon: <Store size={ICON_SIZE} />,                  tooltip: "Marketplace" },
  { id: "source-control",  icon: <GitBranch size={ICON_SIZE} />,              tooltip: "Source Control" },
  { id: "git-integration", icon: <GitPullRequest size={ICON_SIZE} />,         tooltip: "Git Integration" },
  { id: "multi-pdk",       icon: <Cpu size={ICON_SIZE} />,                   tooltip: "Multi-PDK" },
  { id: "monte-carlo",     icon: <Dice5 size={ICON_SIZE} />,                 tooltip: "Monte Carlo" },
  { id: "education",       icon: <GraduationCap size={ICON_SIZE} />,         tooltip: "Education Mode" },
  { id: "ai-assistant",    icon: <Bot size={ICON_SIZE} />,                   tooltip: "AI Assistant" },
  { id: "advanced-analysis",icon: <Activity size={ICON_SIZE} />,              tooltip: "Advanced Analysis" },
  { id: "collaboration",   icon: <Users size={ICON_SIZE} />,                 tooltip: "Collaboration" },
  { id: "community",       icon: <Globe size={ICON_SIZE} />,                 tooltip: "Community" },
  { id: "simulation",      icon: <PlayCircle size={ICON_SIZE} />,             tooltip: "Simulation Setup" },
  { id: "sync",             icon: <ArrowLeftRight size={ICON_SIZE} />,         tooltip: "Schematic ↔ Layout Sync" },
  { id: "cell-library",     icon: <Library size={ICON_SIZE} />,                tooltip: "Cell Library Browser" },
  { id: "hdl",               icon: <FileCode size={ICON_SIZE} />,               tooltip: "HDL Editor" },
  { id: "outline",           icon: <ListTree size={ICON_SIZE} />,               tooltip: "Outline" },
  { id: "snippets",          icon: <Braces size={ICON_SIZE} />,                 tooltip: "Snippets" },
  { id: "build",             icon: <Hammer size={ICON_SIZE} />,                 tooltip: "Build Tasks" },
  { id: "board-manager",     icon: <CircuitBoard size={ICON_SIZE} />,          tooltip: "Board Manager" },
];

const activityBottomItems = [
  { id: "preferences", icon: <Settings size={ICON_SIZE} />, tooltip: "Settings" },
  { id: "settings", icon: <Settings size={ICON_SIZE} />, tooltip: "Keyboard Shortcuts" },
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
    <div className="activity-bar" role="navigation" aria-label="Sidebar panels">
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
            aria-label={item.tooltip}
            aria-pressed={activeSidebarPanel === item.id && leftSidebarVisible}
          >
            <span className="activity-bar__icon" aria-hidden="true">{item.icon}</span>
          </button>
        ))}
      </div>
      <div className="activity-bar__bottom">
        {activityBottomItems.map((item) => (
          <button
            key={item.id}
            className={`activity-bar__item ${
              activeSidebarPanel === item.id && leftSidebarVisible
                ? "activity-bar__item--active"
                : ""
            }`}
            onClick={() => handleClick(item.id)}
            title={item.tooltip}
            aria-label={item.tooltip}
            aria-pressed={activeSidebarPanel === item.id && leftSidebarVisible}
          >
            <span className="activity-bar__icon" aria-hidden="true">{item.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
