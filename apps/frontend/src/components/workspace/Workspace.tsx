import { useCallback, useState } from "react";
import { TitleBar } from "../titlebar/TitleBar";
import { ActivityBar } from "../sidebar/ActivityBar";
import { Sidebar } from "../sidebar/Sidebar";
import { EditorArea } from "../editor/EditorArea";
import { BottomPanel } from "../panels/BottomPanel";
import { StatusBar } from "../statusbar/StatusBar";
import { Toolbar } from "../toolbar/Toolbar";
import { ResizeHandle } from "./ResizeHandle";
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

  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(260);
  const [bottomHeight, setBottomHeight] = useState(200);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.max(150, Math.min(600, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.max(150, Math.min(600, w - delta)));
  }, []);

  const handleBottomResize = useCallback((delta: number) => {
    setBottomHeight((h) => Math.max(100, Math.min(600, h - delta)));
  }, []);

  return (
    <div className="workspace">
      <TitleBar />
      <Toolbar />
      <div className="workspace__body">
        <ActivityBar />
        {leftSidebarVisible && (
          <>
            <Sidebar position="left" style={{ width: leftWidth }} />
            <ResizeHandle direction="horizontal" onResize={handleLeftResize} />
          </>
        )}
        <div className="workspace__main">
          <EditorArea />
          {bottomPanelVisible && (
            <>
              <ResizeHandle direction="vertical" onResize={handleBottomResize} />
              <BottomPanel style={{ height: bottomHeight }} />
            </>
          )}
        </div>
        {rightSidebarVisible && (
          <>
            <ResizeHandle direction="horizontal" onResize={handleRightResize} />
            <Sidebar position="right" style={{ width: rightWidth }} />
          </>
        )}
      </div>
      <StatusBar />
    </div>
  );
}
