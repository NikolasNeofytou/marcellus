import { create } from "zustand";

export interface PanelConfig {
  id: string;
  title: string;
  visible: boolean;
  position: "left" | "right" | "bottom";
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  icon?: string;
  order: number;
}

export interface TabConfig {
  id: string;
  title: string;
  type: "layout" | "schematic" | "waveform" | "netlist" | "welcome";
  cellId?: string;
  modified: boolean;
}

interface WorkspaceState {
  // Sidebar
  leftSidebarVisible: boolean;
  rightSidebarVisible: boolean;
  bottomPanelVisible: boolean;
  activeSidebarPanel: string;

  // Panels
  panels: PanelConfig[];

  // Tabs
  tabs: TabConfig[];
  activeTabId: string | null;

  // Actions
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  toggleBottomPanel: () => void;
  setActiveSidebarPanel: (panelId: string) => void;

  addTab: (tab: TabConfig) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  setPanelVisible: (panelId: string, visible: boolean) => void;
  setPanelWidth: (panelId: string, width: number) => void;
}

const defaultPanels: PanelConfig[] = [
  {
    id: "explorer",
    title: "Explorer",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "files",
    order: 0,
  },
  {
    id: "cell-hierarchy",
    title: "Cell Hierarchy",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "hierarchy",
    order: 1,
  },
  {
    id: "layers",
    title: "Layers",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "layers",
    order: 2,
  },
  {
    id: "components",
    title: "Components",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "components",
    order: 3,
  },
  {
    id: "properties",
    title: "Properties",
    visible: true,
    position: "right",
    width: 280,
    minWidth: 200,
    icon: "properties",
    order: 0,
  },
  {
    id: "drc-violations",
    title: "DRC Violations",
    visible: true,
    position: "right",
    width: 280,
    minWidth: 200,
    icon: "warning",
    order: 1,
  },
  {
    id: "generators",
    title: "Layout Generators",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "generators",
    order: 4,
  },
  {
    id: "calculators",
    title: "Analog Calculators",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "calculators",
    order: 5,
  },
  {
    id: "verification",
    title: "Verification",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "verification",
    order: 6,
  },
  {
    id: "measurements",
    title: "Measurements",
    visible: false,
    position: "right",
    width: 280,
    minWidth: 200,
    icon: "ruler",
    order: 2,
  },
  {
    id: "git-integration",
    title: "Git Integration",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "git-pr",
    order: 7,
  },
  {
    id: "multi-pdk",
    title: "Multi-PDK",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "cpu",
    order: 8,
  },
  {
    id: "monte-carlo",
    title: "Monte Carlo",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "dice",
    order: 9,
  },
  {
    id: "education",
    title: "Education",
    visible: true,
    position: "left",
    width: 260,
    minWidth: 180,
    icon: "graduation",
    order: 10,
  },
  {
    id: "terminal",
    title: "Terminal",
    visible: true,
    position: "bottom",
    height: 200,
    minHeight: 100,
    icon: "terminal",
    order: 0,
  },
  {
    id: "simulation",
    title: "Simulation Output",
    visible: false,
    position: "bottom",
    height: 200,
    minHeight: 100,
    icon: "graph",
    order: 1,
  },
  {
    id: "waveform",
    title: "Waveform Viewer",
    visible: false,
    position: "bottom",
    height: 250,
    minHeight: 150,
    icon: "waveform",
    order: 2,
  },
];

const welcomeTab: TabConfig = {
  id: "welcome",
  title: "Welcome",
  type: "welcome",
  modified: false,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  leftSidebarVisible: true,
  rightSidebarVisible: false,
  bottomPanelVisible: false,
  activeSidebarPanel: "layers",

  panels: defaultPanels,

  tabs: [welcomeTab],
  activeTabId: "welcome",

  toggleLeftSidebar: () =>
    set((s) => ({ leftSidebarVisible: !s.leftSidebarVisible })),
  toggleRightSidebar: () =>
    set((s) => ({ rightSidebarVisible: !s.rightSidebarVisible })),
  toggleBottomPanel: () =>
    set((s) => ({ bottomPanelVisible: !s.bottomPanelVisible })),
  setActiveSidebarPanel: (panelId) =>
    set({ activeSidebarPanel: panelId, leftSidebarVisible: true }),

  addTab: (tab) =>
    set((s) => {
      const exists = s.tabs.find((t) => t.id === tab.id);
      if (exists) {
        return { activeTabId: tab.id };
      }
      return { tabs: [...s.tabs, tab], activeTabId: tab.id };
    }),
  closeTab: (tabId) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.id !== tabId);
      const newActive =
        s.activeTabId === tabId
          ? newTabs.length > 0
            ? newTabs[newTabs.length - 1].id
            : null
          : s.activeTabId;
      return { tabs: newTabs, activeTabId: newActive };
    }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  setPanelVisible: (panelId, visible) =>
    set((s) => ({
      panels: s.panels.map((p) =>
        p.id === panelId ? { ...p, visible } : p
      ),
    })),
  setPanelWidth: (panelId, width) =>
    set((s) => ({
      panels: s.panels.map((p) =>
        p.id === panelId ? { ...p, width } : p
      ),
    })),
}));
