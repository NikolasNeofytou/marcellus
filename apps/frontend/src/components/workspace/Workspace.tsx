import { TitleBar } from "../titlebar/TitleBar";
import { ActivityBar } from "../sidebar/ActivityBar";
import { Sidebar } from "../sidebar/Sidebar";
import { EditorArea } from "../editor/EditorArea";
import { BottomPanel } from "../panels/BottomPanel";
import { StatusBar } from "../statusbar/StatusBar";
import { Toolbar } from "../toolbar/Toolbar";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useCommandRegistration } from "../../hooks/useCommandRegistration";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useToolShortcuts } from "../../hooks/useToolShortcuts";
import "./Workspace.css";

export function Workspace() {
  useCommandRegistration();
  useKeyboardShortcuts();
  useToolShortcuts();

  const leftSidebarVisible = useWorkspaceStore((s) => s.leftSidebarVisible);
  const rightSidebarVisible = useWorkspaceStore((s) => s.rightSidebarVisible);
  const bottomPanelVisible = useWorkspaceStore((s) => s.bottomPanelVisible);

  return (
    <div className="workspace">
      <TitleBar />
      <Toolbar />
      <div className="workspace__body">
        <ActivityBar />
        {leftSidebarVisible && <Sidebar position="left" />}
        <div className="workspace__main">
          <EditorArea />
          {bottomPanelVisible && <BottomPanel />}
        </div>
        {rightSidebarVisible && <Sidebar position="right" />}
      </div>
      <StatusBar />
    </div>
  );
}
