import { useMemo } from "react";
import { useDrcStore } from "../../stores/drcStore";
import { usePluginStore } from "../../stores/pluginStore";
import "./DrcPanel.css";

export function DrcPanel() {
  const runState = useDrcStore((s) => s.runState);
  const allViolations = useDrcStore((s) => s.violations);
  const severityFilter = useDrcStore((s) => s.severityFilter);
  const layerFilter = useDrcStore((s) => s.layerFilter);
  const selectedViolationId = useDrcStore((s) => s.selectedViolationId);
  const selectViolation = useDrcStore((s) => s.selectViolation);
  const nextViolation = useDrcStore((s) => s.nextViolation);
  const prevViolation = useDrcStore((s) => s.prevViolation);
  const showOverlay = useDrcStore((s) => s.showOverlay);
  const toggleOverlay = useDrcStore((s) => s.toggleOverlay);
  const clearViolations = useDrcStore((s) => s.clearViolations);
  const lastResult = useDrcStore((s) => s.lastResult);
  const toggleSeverityFilter = useDrcStore((s) => s.toggleSeverityFilter);

  // Derive filtered violations + counts in useMemo to avoid infinite re-renders
  const violations = useMemo(() => {
    return allViolations.filter((v) => {
      if (!severityFilter.has(v.severity)) return false;
      if (layerFilter && !v.layers.includes(layerFilter)) return false;
      return true;
    });
  }, [allViolations, severityFilter, layerFilter]);

  const counts = useMemo(() => {
    let errors = 0, warnings = 0, infos = 0;
    for (const v of allViolations) {
      if (v.severity === "error") errors++;
      else if (v.severity === "warning") warnings++;
      else infos++;
    }
    return { errors, warnings, infos, total: allViolations.length };
  }, [allViolations]);

  const plugins = usePluginStore((s) => s.plugins);
  const activePdkId = usePluginStore((s) => s.activePdkId);
  const activePdk = useMemo(() => {
    if (!activePdkId) return undefined;
    const plugin = plugins.find((p) => p.manifest.id === activePdkId);
    return plugin?.manifest.contributes.pdk;
  }, [plugins, activePdkId]);

  const severityIcon = (sev: "error" | "warning" | "info") => {
    switch (sev) {
      case "error": return "⛔";
      case "warning": return "⚠️";
      case "info": return "ℹ️";
    }
  };

  const severityColor = (sev: "error" | "warning" | "info") => {
    switch (sev) {
      case "error": return "var(--os-accent-error, #ef4444)";
      case "warning": return "var(--os-accent-warning, #f59e0b)";
      case "info": return "var(--os-accent-info, #3b82f6)";
    }
  };

  return (
    <div className="drc-panel">
      {/* ── Header / Stats ── */}
      <div className="drc-panel__header">
        <div className="drc-panel__stats">
          {runState === "completed" && (
            <>
              <span className="drc-panel__stat drc-panel__stat--error" title="Errors">
                ⛔ {counts.errors}
              </span>
              <span className="drc-panel__stat drc-panel__stat--warning" title="Warnings">
                ⚠️ {counts.warnings}
              </span>
              <span className="drc-panel__stat drc-panel__stat--info" title="Info">
                ℹ️ {counts.infos}
              </span>
            </>
          )}
          {runState === "idle" && (
            <span className="drc-panel__stat">Ready</span>
          )}
          {runState === "running" && (
            <span className="drc-panel__stat">Running...</span>
          )}
        </div>
        <div className="drc-panel__actions">
          <button
            className={`drc-panel__btn ${showOverlay ? "drc-panel__btn--active" : ""}`}
            onClick={toggleOverlay}
            title="Toggle violation overlay"
          >
            👁
          </button>
          <button className="drc-panel__btn" onClick={prevViolation} title="Previous violation">
            ▲
          </button>
          <button className="drc-panel__btn" onClick={nextViolation} title="Next violation">
            ▼
          </button>
          {violations.length > 0 && (
            <button className="drc-panel__btn" onClick={clearViolations} title="Clear violations">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="drc-panel__filters">
        {(["error", "warning", "info"] as const).map((sev) => (
          <button
            key={sev}
            className={`drc-panel__filter ${severityFilter.has(sev) ? "drc-panel__filter--active" : ""}`}
            onClick={() => toggleSeverityFilter(sev)}
            style={{ borderColor: severityFilter.has(sev) ? severityColor(sev) : "transparent" }}
          >
            {severityIcon(sev)} {sev}
          </button>
        ))}
      </div>

      {/* ── Violation List ── */}
      <div className="drc-panel__list">
        {violations.length === 0 && runState === "completed" && (
          <div className="drc-panel__empty">
            ✅ No DRC violations found
          </div>
        )}
        {violations.length === 0 && runState === "idle" && (
          <div className="drc-panel__empty">
            Run DRC (Ctrl+Shift+D) to check against {activePdk?.name ?? "PDK"} rules.
          </div>
        )}

        {violations.map((v) => (
          <button
            key={v.id}
            className={`drc-panel__violation ${
              selectedViolationId === v.id ? "drc-panel__violation--selected" : ""
            }`}
            onClick={() => selectViolation(v.id)}
          >
            <span className="drc-panel__violation-icon" style={{ color: severityColor(v.severity) }}>
              {severityIcon(v.severity)}
            </span>
            <div className="drc-panel__violation-info">
              <span className="drc-panel__violation-rule">{v.ruleId}</span>
              <span className="drc-panel__violation-desc">{v.description}</span>
              <span className="drc-panel__violation-loc">
                ({v.location.x.toFixed(2)}, {v.location.y.toFixed(2)}) · {v.layers.join(", ")}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* ── Run Info ── */}
      {lastResult && (
        <div className="drc-panel__footer">
          {lastResult.rulesChecked} rules • {lastResult.geometriesChecked} geometries • {lastResult.runtimeMs}ms
        </div>
      )}
    </div>
  );
}
