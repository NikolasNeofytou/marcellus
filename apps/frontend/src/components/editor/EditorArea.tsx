import { useState, useCallback } from "react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { LayoutCanvas } from "../canvas/LayoutCanvas";
import { SchematicCanvas } from "../canvas/SchematicCanvas";
import { HdlEditor } from "./HdlEditor";
import { WelcomeTab } from "./WelcomeTab";
import { WaveformViewer } from "../panels/WaveformViewer";
import { DiffEditor } from "./DiffEditor";
import { Columns2, X } from "lucide-react";
import "./EditorArea.css";

/* ------------------------------------------------------------------ */
/*  Tab content renderer                                              */
/* ------------------------------------------------------------------ */

function TabContent({ type }: { type: string }) {
  switch (type) {
    case "welcome":    return <WelcomeTab />;
    case "layout":     return <LayoutCanvas />;
    case "schematic":  return <SchematicCanvas />;
    case "hdl":        return <HdlEditor />;
    case "waveform-vcd": return <WaveformViewer />;
    case "diff":       return <DiffEditor />;
    default:           return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Editor Area with split view support                               */
/* ------------------------------------------------------------------ */

export function EditorArea() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  /* ── Split state ── */
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [splitDirection, setSplitDirection] = useState<"horizontal" | "vertical">("horizontal");

  const splitTab = splitTabId ? tabs.find((t) => t.id === splitTabId) : null;

  const handleSplitRight = useCallback(() => {
    if (!activeTab) return;
    // Find another tab to show in split, or duplicate current
    const other = tabs.find((t) => t.id !== activeTabId);
    if (other) {
      setSplitTabId(other.id);
    } else {
      // No other tab — show same tab
      setSplitTabId(activeTab.id);
    }
    setSplitDirection("horizontal");
  }, [activeTab, activeTabId, tabs]);

  const closeSplit = useCallback(() => {
    setSplitTabId(null);
  }, []);

  return (
    <div className="editor-area">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="editor-area__tabs" role="tablist" aria-label="Open editors">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              role="tab"
              aria-selected={tab.id === activeTabId}
              tabIndex={tab.id === activeTabId ? 0 : -1}
              className={`editor-area__tab ${
                tab.id === activeTabId ? "editor-area__tab--active" : ""
              } ${tab.id === splitTabId ? "editor-area__tab--split" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={() => {
                // Double-click to open in split
                if (tab.id !== activeTabId) {
                  setSplitTabId(tab.id);
                }
              }}
            >
              <span className="editor-area__tab-label">
                {tab.modified && <span className="editor-area__tab-dot">●</span>}
                {tab.title}
              </span>
              <button
                className="editor-area__tab-close"
                aria-label={`Close ${tab.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (splitTabId === tab.id) setSplitTabId(null);
                  closeTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
          ))}

          {/* Split toggle button */}
          {activeTab && (
            <button
              className="editor-area__split-btn"
              title={splitTab ? "Close split view" : "Split editor"}
              aria-label={splitTab ? "Close split view" : "Split editor"}
              onClick={splitTab ? closeSplit : handleSplitRight}
            >
              {splitTab ? <X size={14} /> : <Columns2 size={14} />}
            </button>
          )}
        </div>
      )}

      {/* Editor content (with optional split) */}
      <div className={`editor-area__content-wrap ${splitTab ? `editor-area__content-wrap--split-${splitDirection}` : ""}`}>
        {/* Primary pane */}
        <div className="editor-area__content" role="tabpanel">
          {activeTab && <TabContent type={activeTab.type} />}
          {!activeTab && (
            <div className="editor-area__empty">
              <p>No editor open</p>
              <p style={{ fontSize: "var(--os-font-size-sm)", color: "var(--os-fg-muted)" }}>
                Open a file or create a new layout
              </p>
            </div>
          )}
        </div>

        {/* Split pane */}
        {splitTab && (
          <>
            <div className="editor-area__split-divider" />
            <div className="editor-area__content editor-area__content--split" role="tabpanel">
              <div className="editor-area__split-header">
                <span className="editor-area__split-title">{splitTab.title}</span>
                <button className="editor-area__tab-close" onClick={closeSplit} aria-label="Close split">
                  ×
                </button>
              </div>
              <TabContent type={splitTab.type} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
