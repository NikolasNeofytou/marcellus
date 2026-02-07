import { useWorkspaceStore } from "../../stores/workspaceStore";
import { LayoutCanvas } from "../canvas/LayoutCanvas";
import { SchematicCanvas } from "../canvas/SchematicCanvas";
import { WelcomeTab } from "./WelcomeTab";
import "./EditorArea.css";

export function EditorArea() {
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const setActiveTab = useWorkspaceStore((s) => s.setActiveTab);
  const closeTab = useWorkspaceStore((s) => s.closeTab);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="editor-area">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="editor-area__tabs">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`editor-area__tab ${
                tab.id === activeTabId ? "editor-area__tab--active" : ""
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="editor-area__tab-label">
                {tab.modified && <span className="editor-area__tab-dot">●</span>}
                {tab.title}
              </span>
              <button
                className="editor-area__tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor content */}
      <div className="editor-area__content">
        {activeTab?.type === "welcome" && <WelcomeTab />}
        {activeTab?.type === "layout" && <LayoutCanvas />}
        {activeTab?.type === "schematic" && <SchematicCanvas />}
        {!activeTab && (
          <div className="editor-area__empty">
            <p>No editor open</p>
            <p style={{ fontSize: "var(--os-font-size-sm)", color: "var(--os-fg-muted)" }}>
              Open a file or create a new layout
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
