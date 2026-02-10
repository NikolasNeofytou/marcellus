import { useState, useRef, useEffect, useCallback } from "react";
import { useCommandStore } from "../../stores/commandStore";
import { useGeometryStore } from "../../stores/geometryStore";
import { Cpu } from "lucide-react";
import "./TitleBar.css";

// ── Menu definitions ──────────────────────────────────────────────────

interface MenuItem {
  label: string;
  commandId?: string;
  keybinding?: string;
  separator?: boolean;
}

const MENUS: Record<string, MenuItem[]> = {
  File: [
    { label: "New Layout", commandId: "file.newLayout", keybinding: "Ctrl+N" },
    { label: "Open File...", commandId: "file.openFile", keybinding: "Ctrl+O" },
    { separator: true, label: "" },
    { label: "Save", commandId: "file.save", keybinding: "Ctrl+S" },
    { label: "Save As...", commandId: "file.saveAs", keybinding: "Ctrl+Shift+S" },
    { separator: true, label: "" },
    { label: "Export as GDS-II...", commandId: "file.exportGds" },
  ],
  Edit: [
    { label: "Undo", commandId: "edit.undo", keybinding: "Ctrl+Z" },
    { label: "Redo", commandId: "edit.redo", keybinding: "Ctrl+Y" },
    { separator: true, label: "" },
    { label: "Select All", commandId: "edit.selectAll", keybinding: "Ctrl+A" },
    { label: "Delete Selection", commandId: "edit.delete", keybinding: "Del" },
  ],
  View: [
    { label: "Toggle Theme", commandId: "view.toggleTheme", keybinding: "Ctrl+K T" },
    { label: "Toggle Left Sidebar", commandId: "view.toggleLeftSidebar", keybinding: "Ctrl+B" },
    { label: "Toggle Right Sidebar", commandId: "view.toggleRightSidebar", keybinding: "Ctrl+Alt+B" },
    { label: "Toggle Bottom Panel", commandId: "view.toggleBottomPanel", keybinding: "Ctrl+J" },
    { separator: true, label: "" },
    { label: "Show Explorer", commandId: "view.showExplorer", keybinding: "Ctrl+Shift+E" },
    { label: "Show Layers", commandId: "view.showLayers", keybinding: "Ctrl+Shift+L" },
    { label: "Show Cell Hierarchy", commandId: "view.showCellHierarchy", keybinding: "Ctrl+Shift+H" },
    { label: "Show Properties Panel", commandId: "view.showProperties" },
  ],
  Layout: [
    { label: "Select Tool", commandId: "layout.selectTool", keybinding: "V" },
    { label: "Pan Tool", commandId: "layout.panTool", keybinding: "H" },
    { label: "Ruler / Measure", commandId: "layout.rulerTool", keybinding: "M" },
    { separator: true, label: "" },
    { label: "Draw Rectangle", commandId: "layout.drawRect", keybinding: "R" },
    { label: "Draw Polygon", commandId: "layout.drawPolygon", keybinding: "P" },
    { label: "Draw Path / Wire", commandId: "layout.drawPath", keybinding: "W" },
    { label: "Place Via", commandId: "layout.placeVia" },
    { separator: true, label: "" },
    { label: "Zoom to Fit", commandId: "layout.zoomFit", keybinding: "Ctrl+0" },
    { label: "Load Demo Layout", commandId: "layout.loadDemo" },
  ],
  Simulate: [
    { label: "Extract Netlist", commandId: "sim.extractNetlist" },
    { label: "Run Simulation", commandId: "sim.runSimulation", keybinding: "F5" },
    { separator: true, label: "" },
    { label: "Show Waveform Viewer", commandId: "sim.showWaveform" },
    { label: "Show Netlist", commandId: "sim.showNetlist" },
  ],
  Tools: [
    { label: "Run DRC Check", commandId: "drc.runCheck", keybinding: "Ctrl+Shift+D" },
    { label: "Clear DRC Violations", commandId: "drc.clearViolations" },
    { separator: true, label: "" },
    { label: "Show PDK Info", commandId: "pdk.showInfo" },
    { label: "Show Design Rules", commandId: "pdk.showDesignRules" },
  ],
  Help: [
    { label: "Documentation", commandId: undefined },
    { label: "About OpenSilicon", commandId: undefined },
  ],
};

// ── Component ─────────────────────────────────────────────────────────

export function TitleBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const executeCommand = useCommandStore((s) => s.executeCommand);
  const projectName = useGeometryStore((s) => s.projectName);
  const modified = useGeometryStore((s) => s.modified);

  // Close menu on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const handleMenuClick = useCallback(
    (menuName: string) => {
      setOpenMenu((prev) => (prev === menuName ? null : menuName));
    },
    [],
  );

  const handleItemClick = useCallback(
    (commandId?: string) => {
      setOpenMenu(null);
      if (commandId) executeCommand(commandId);
    },
    [executeCommand],
  );

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar__left" ref={menuBarRef}>
        <div className="titlebar__logo">
          <Cpu size={16} className="titlebar__logo-icon" />
          <span className="titlebar__logo-text">OpenSilicon</span>
        </div>
        <nav className="titlebar__menu">
          {Object.keys(MENUS).map((name) => (
            <div key={name} className="titlebar__menu-wrapper">
              <button
                className={`titlebar__menu-item ${openMenu === name ? "titlebar__menu-item--active" : ""}`}
                onClick={() => handleMenuClick(name)}
                onMouseEnter={() => {
                  if (openMenu && openMenu !== name) setOpenMenu(name);
                }}
              >
                {name}
              </button>

              {openMenu === name && (
                <div className="titlebar__dropdown">
                  {MENUS[name].map((item, i) =>
                    item.separator ? (
                      <div key={i} className="titlebar__dropdown-sep" />
                    ) : (
                      <button
                        key={i}
                        className="titlebar__dropdown-item"
                        onClick={() => handleItemClick(item.commandId)}
                        disabled={!item.commandId}
                      >
                        <span>{item.label}</span>
                        {item.keybinding && (
                          <span className="titlebar__dropdown-kbd">{item.keybinding}</span>
                        )}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
      <div className="titlebar__center" data-tauri-drag-region>
        <span className="titlebar__project-name">
          {modified ? "● " : ""}{projectName} — OpenSilicon
        </span>
      </div>
      <div className="titlebar__right">
        {/* Window controls will be managed by Tauri */}
      </div>
    </div>
  );
}
