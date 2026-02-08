/**
 * SchematicLayoutSyncPanel — sidebar panel for V5 bi-directional sync.
 *
 * Shows sync mappings between schematic symbols and layout devices,
 * pending actions, back-annotation controls, and sync settings.
 */

import { useSyncStore } from "../../stores/syncStore";
import type { SyncMapping, SyncAction } from "../../engines/schematicLayoutSync";
import "./SchematicLayoutSyncPanel.css";

const STATUS_ICON: Record<string, string> = {
  synced: "✓",
  "param-mismatch": "⚠",
  "missing-layout": "▽",
  "missing-schematic": "△",
  unlinked: "○",
};

const STATUS_LABEL: Record<string, string> = {
  synced: "Synced",
  "param-mismatch": "Param Mismatch",
  "missing-layout": "No Layout",
  "missing-schematic": "No Schematic",
  unlinked: "Unlinked",
};

const ACTION_ICON: Record<string, string> = {
  "create-layout-device": "＋L",
  "create-schematic-symbol": "＋S",
  "update-layout-params": "→L",
  "update-schematic-params": "→S",
  "fix-net-connection": "⚡",
  "remove-extra-layout": "−L",
  "remove-extra-schematic": "−S",
};

export function SchematicLayoutSyncPanel() {
  const {
    syncState,
    report,
    mappings,
    pendingActions,
    backAnnotations,
    autoSyncEnabled,
    syncDirection,
    selectedMappingIndex,
    runSync,
    runDemoSync,
    applyBackAnnotationToSchematic,
    acceptAction,
    rejectAction,
    acceptAllActions,
    toggleAutoSync,
    setSyncDirection,
    selectMapping,
    highlightMapping,
    clearSync,
  } = useSyncStore();

  const summary = report?.summary;

  return (
    <div className="sync-panel">
      {/* ── Header Controls ── */}
      <div className="sync-panel__controls">
        <button
          className="sync-panel__btn sync-panel__btn--primary"
          onClick={runSync}
          disabled={syncState === "syncing"}
        >
          {syncState === "syncing" ? "Syncing..." : "Run Sync"}
        </button>
        <button className="sync-panel__btn" onClick={runDemoSync}>
          Demo
        </button>
        <button className="sync-panel__btn" onClick={clearSync} disabled={!report}>
          Clear
        </button>
      </div>

      {/* ── Settings ── */}
      <div className="sync-panel__settings">
        <label className="sync-panel__checkbox">
          <input type="checkbox" checked={autoSyncEnabled} onChange={toggleAutoSync} />
          Auto-sync
        </label>
        <select
          className="sync-panel__select"
          value={syncDirection}
          onChange={(e) => setSyncDirection(e.target.value as any)}
        >
          <option value="bidirectional">Bidirectional</option>
          <option value="schematic-to-layout">Schematic → Layout</option>
          <option value="layout-to-schematic">Layout → Schematic</option>
        </select>
      </div>

      {/* ── Summary ── */}
      {summary && (
        <div className="sync-panel__summary">
          <div className="sync-panel__summary-title">Sync Summary</div>
          <div className="sync-panel__summary-grid">
            <span className="sync-panel__stat-label">Schematic Devices</span>
            <span className="sync-panel__stat-value">{summary.totalSchematicDevices}</span>
            <span className="sync-panel__stat-label">Layout Devices</span>
            <span className="sync-panel__stat-value">{summary.totalLayoutDevices}</span>
            <span className="sync-panel__stat-label">Synced</span>
            <span className="sync-panel__stat-value sync-panel__stat--ok">{summary.synced}</span>
            <span className="sync-panel__stat-label">Param Mismatches</span>
            <span className="sync-panel__stat-value sync-panel__stat--warn">{summary.paramMismatches}</span>
            <span className="sync-panel__stat-label">Missing in Layout</span>
            <span className="sync-panel__stat-value sync-panel__stat--err">{summary.missingInLayout}</span>
            <span className="sync-panel__stat-label">Missing in Schematic</span>
            <span className="sync-panel__stat-value sync-panel__stat--err">{summary.missingInSchematic}</span>
            <span className="sync-panel__stat-label">Net Mismatches</span>
            <span className="sync-panel__stat-value sync-panel__stat--warn">{summary.netMismatches}</span>
          </div>
          <div className="sync-panel__summary-time">
            Completed in {report!.durationMs.toFixed(1)} ms
          </div>
        </div>
      )}

      {/* ── Mappings ── */}
      {mappings.length > 0 && (
        <div className="sync-panel__section">
          <div className="sync-panel__section-title">
            Device Mappings ({mappings.length})
          </div>
          <div className="sync-panel__mapping-list">
            {mappings.map((m: SyncMapping, idx: number) => (
              <div
                key={idx}
                className={`sync-panel__mapping ${m.status} ${selectedMappingIndex === idx ? "selected" : ""}`}
                onClick={() => {
                  selectMapping(idx);
                  highlightMapping(m);
                }}
              >
                <span className={`sync-panel__mapping-icon ${m.status}`}>
                  {STATUS_ICON[m.status] ?? "?"}
                </span>
                <span className="sync-panel__mapping-name">{m.instanceName}</span>
                <span className="sync-panel__mapping-status">{STATUS_LABEL[m.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Selected Mapping Detail ── */}
      {selectedMappingIndex !== null && mappings[selectedMappingIndex] && (
        <div className="sync-panel__detail">
          <div className="sync-panel__detail-title">
            {mappings[selectedMappingIndex].instanceName} Details
          </div>
          {mappings[selectedMappingIndex].parameterDeltas.length > 0 && (
            <table className="sync-panel__delta-table">
              <thead>
                <tr>
                  <th>Param</th>
                  <th>Schematic</th>
                  <th>Layout</th>
                  <th>Δ%</th>
                </tr>
              </thead>
              <tbody>
                {mappings[selectedMappingIndex].parameterDeltas.map((d, i) => (
                  <tr key={i}>
                    <td>{d.param}</td>
                    <td>{String(d.schematicValue)}</td>
                    <td>{String(d.layoutValue)}</td>
                    <td>{d.percentDiff !== undefined ? `${d.percentDiff}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {Object.keys(mappings[selectedMappingIndex].netMappings).length > 0 && (
            <div className="sync-panel__net-map">
              <div className="sync-panel__detail-subtitle">Net Connections</div>
              {Object.entries(mappings[selectedMappingIndex].netMappings).map(([pin, net]) => (
                <div key={pin} className="sync-panel__net-entry">
                  <span className="sync-panel__net-pin">{pin}</span>
                  <span className="sync-panel__net-arrow">→</span>
                  <span className="sync-panel__net-name">{net || "unconnected"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pending Actions ── */}
      {pendingActions.length > 0 && (
        <div className="sync-panel__section">
          <div className="sync-panel__section-header">
            <span className="sync-panel__section-title">
              Actions ({pendingActions.length})
            </span>
            <button className="sync-panel__btn sync-panel__btn--sm" onClick={acceptAllActions}>
              Accept All
            </button>
          </div>
          <div className="sync-panel__action-list">
            {pendingActions.map((a: SyncAction, idx: number) => (
              <div key={idx} className="sync-panel__action">
                <span className="sync-panel__action-icon">{ACTION_ICON[a.type] ?? "?"}</span>
                <span className="sync-panel__action-desc">{a.description}</span>
                <div className="sync-panel__action-buttons">
                  <button
                    className="sync-panel__btn sync-panel__btn--accept"
                    onClick={() => acceptAction(idx)}
                    title="Accept"
                  >
                    ✓
                  </button>
                  <button
                    className="sync-panel__btn sync-panel__btn--reject"
                    onClick={() => rejectAction(idx)}
                    title="Reject"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Back-Annotation ── */}
      {backAnnotations.length > 0 && (
        <div className="sync-panel__section">
          <div className="sync-panel__section-header">
            <span className="sync-panel__section-title">
              Back-Annotation ({backAnnotations.length} devices)
            </span>
            <button
              className="sync-panel__btn sync-panel__btn--primary sync-panel__btn--sm"
              onClick={applyBackAnnotationToSchematic}
            >
              Apply
            </button>
          </div>
          <div className="sync-panel__annot-list">
            {backAnnotations.slice(0, 10).map((a, idx) => (
              <div key={idx} className="sync-panel__annot">
                <span className="sync-panel__annot-name">{a.instanceName}</span>
                <span className="sync-panel__annot-r">R: {a.parasitics.totalResistance.toFixed(1)}Ω</span>
                <span className="sync-panel__annot-c">C: {a.parasitics.totalCapacitance.toFixed(2)}fF</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!report && syncState === "idle" && (
        <div className="sync-panel__empty">
          Run sync to compare schematic and layout devices. Click "Demo" for a sample report.
        </div>
      )}
    </div>
  );
}
