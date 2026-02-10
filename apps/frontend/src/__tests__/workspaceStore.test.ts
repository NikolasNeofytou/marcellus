/**
 * workspaceStore unit tests
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useWorkspaceStore, type TabConfig } from "../stores/workspaceStore";

const getState = () => useWorkspaceStore.getState();

describe("workspaceStore", () => {
  beforeEach(() => {
    // Reset store to defaults
    useWorkspaceStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: false,
      bottomPanelVisible: false,
      activeSidebarPanel: "layers",
      leftWidth: 260,
      rightWidth: 260,
      bottomHeight: 200,
      tabs: [{ id: "welcome", title: "Welcome", type: "welcome", modified: false }],
      activeTabId: "welcome",
    });
    vi.useFakeTimers();
  });

  // ── Sidebar toggles ──

  it("toggleLeftSidebar flips visibility", () => {
    expect(getState().leftSidebarVisible).toBe(true);
    getState().toggleLeftSidebar();
    vi.runAllTimers();
    expect(getState().leftSidebarVisible).toBe(false);
    getState().toggleLeftSidebar();
    vi.runAllTimers();
    expect(getState().leftSidebarVisible).toBe(true);
  });

  it("toggleRightSidebar flips visibility", () => {
    expect(getState().rightSidebarVisible).toBe(false);
    getState().toggleRightSidebar();
    vi.runAllTimers();
    expect(getState().rightSidebarVisible).toBe(true);
  });

  it("toggleBottomPanel flips visibility", () => {
    expect(getState().bottomPanelVisible).toBe(false);
    getState().toggleBottomPanel();
    vi.runAllTimers();
    expect(getState().bottomPanelVisible).toBe(true);
  });

  it("setActiveSidebarPanel opens left sidebar", () => {
    useWorkspaceStore.setState({ leftSidebarVisible: false });
    getState().setActiveSidebarPanel("explorer");
    vi.runAllTimers();
    expect(getState().activeSidebarPanel).toBe("explorer");
    expect(getState().leftSidebarVisible).toBe(true);
  });

  // ── Resize dimensions ──

  it("setLeftWidth / setRightWidth / setBottomHeight update values", () => {
    getState().setLeftWidth(300);
    vi.runAllTimers();
    expect(getState().leftWidth).toBe(300);

    getState().setRightWidth(400);
    vi.runAllTimers();
    expect(getState().rightWidth).toBe(400);

    getState().setBottomHeight(150);
    vi.runAllTimers();
    expect(getState().bottomHeight).toBe(150);
  });

  // ── Tab management ──

  it("addTab appends a new tab and activates it", () => {
    const tab: TabConfig = {
      id: "layout-1",
      title: "Layout 1",
      type: "layout",
      modified: false,
    };
    getState().addTab(tab);
    expect(getState().tabs).toHaveLength(2);
    expect(getState().activeTabId).toBe("layout-1");
  });

  it("addTab deduplicates by id", () => {
    const tab: TabConfig = {
      id: "layout-1",
      title: "Layout 1",
      type: "layout",
      modified: false,
    };
    getState().addTab(tab);
    getState().addTab(tab);
    expect(getState().tabs).toHaveLength(2); // welcome + layout-1
    expect(getState().activeTabId).toBe("layout-1");
  });

  it("closeTab removes tab and activates last remaining", () => {
    const tab: TabConfig = {
      id: "layout-1",
      title: "Layout 1",
      type: "layout",
      modified: false,
    };
    getState().addTab(tab);
    expect(getState().activeTabId).toBe("layout-1");
    getState().closeTab("layout-1");
    expect(getState().tabs).toHaveLength(1);
    expect(getState().activeTabId).toBe("welcome");
  });

  it("closeTab handles closing non-active tab", () => {
    const tab1: TabConfig = { id: "t1", title: "T1", type: "layout", modified: false };
    const tab2: TabConfig = { id: "t2", title: "T2", type: "layout", modified: false };
    getState().addTab(tab1);
    getState().addTab(tab2);
    expect(getState().activeTabId).toBe("t2");
    getState().closeTab("t1");
    expect(getState().tabs).toHaveLength(2); // welcome + t2
    expect(getState().activeTabId).toBe("t2"); // unchanged
  });

  it("closeTab on last tab sets activeTabId to null", () => {
    getState().closeTab("welcome");
    expect(getState().tabs).toHaveLength(0);
    expect(getState().activeTabId).toBeNull();
  });

  it("setActiveTab switches active", () => {
    const tab: TabConfig = { id: "t1", title: "T1", type: "layout", modified: false };
    getState().addTab(tab);
    getState().setActiveTab("welcome");
    expect(getState().activeTabId).toBe("welcome");
  });
});
