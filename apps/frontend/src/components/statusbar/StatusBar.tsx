import { useMemo } from "react";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useThemeStore } from "../../stores/themeStore";
import { usePluginStore } from "../../stores/pluginStore";
import { useDrcStore } from "../../stores/drcStore";
import { useToolStore } from "../../stores/toolStore";
import { useSimStore } from "../../stores/simStore";
import "./StatusBar.css";

export function StatusBar() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const tabs = useWorkspaceStore((s) => s.tabs);
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const toggleBottomPanel = useWorkspaceStore((s) => s.toggleBottomPanel);

  // Plugin / PDK — select raw state, derive in useMemo
  const plugins = usePluginStore((s) => s.plugins);
  const activePdkId = usePluginStore((s) => s.activePdkId);
  const activePdk = useMemo(() => {
    if (!activePdkId) return undefined;
    const plugin = plugins.find((p) => p.manifest.id === activePdkId);
    return plugin?.manifest.contributes.pdk;
  }, [plugins, activePdkId]);
  const pdkLabel = activePdk ? `${activePdk.name}` : "No PDK";
  const gridLabel = activePdk
    ? `Grid: ${activePdk.manufacturingGrid * 1000}nm`
    : "Grid: --";

  // DRC — select raw violations array, derive counts in useMemo
  const drcViolations = useDrcStore((s) => s.violations);
  const drcRunState = useDrcStore((s) => s.runState);
  const drcCounts = useMemo(() => {
    let errors = 0, warnings = 0, infos = 0;
    for (const v of drcViolations) {
      if (v.severity === "error") errors++;
      else if (v.severity === "warning") warnings++;
      else infos++;
    }
    return { errors, warnings, infos, total: drcViolations.length };
  }, [drcViolations]);
  const drcLabel =
    drcRunState === "running"
      ? "⏳ DRC Running…"
      : drcCounts.errors > 0
        ? `⛔ ${drcCounts.errors} Errors`
        : drcCounts.warnings > 0
          ? `⚠ ${drcCounts.warnings} Warnings`
          : "✓ No DRC Errors";
  const drcClassName =
    drcCounts.errors > 0
      ? "statusbar__item statusbar__item--error"
      : drcCounts.warnings > 0
        ? "statusbar__item statusbar__item--warning"
        : "statusbar__item statusbar__item--info";

  // Tool
  const activeTool = useToolStore((s) => s.activeTool);

  // Sim
  const simState = useSimStore((s) => s.state);
  const simLabel =
    simState === "running"
      ? "⏳ Simulating…"
      : simState === "extracting"
        ? "⏳ Extracting…"
        : simState === "completed"
          ? "✓ Sim Done"
          : null;

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="statusbar">
      <div className="statusbar__left">
        <button className="statusbar__item" onClick={toggleBottomPanel}>
          ⊞ Terminal
        </button>
        <span className={drcClassName}>{drcLabel}</span>
        {simLabel && (
          <span className="statusbar__item statusbar__item--info">
            {simLabel}
          </span>
        )}
      </div>
      <div className="statusbar__right">
        {activeTab && (
          <span className="statusbar__item">
            {activeTab.type === "layout" ? "Layout Editor" : activeTab.title}
          </span>
        )}
        <span className="statusbar__item">🔧 {activeTool}</span>
        <span className="statusbar__item">{pdkLabel}</span>
        <span className="statusbar__item">{gridLabel}</span>
        <button className="statusbar__item" onClick={toggleTheme}>
          {theme === "dark" ? "🌘 Dark" : "☀ Light"}
        </button>
        <span className="statusbar__item">OpenSilicon v0.1.0</span>
      </div>
    </div>
  );
}
