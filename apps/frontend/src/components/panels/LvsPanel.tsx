import { useCrossProbeStore } from "../../stores/crossProbeStore";
import { runDemoLvs, type DeviceMatch, type NetMatch } from "../../engines/lvs";
import { VirtualList } from "../VirtualList";
import "./LvsPanel.css";

// ── Status helpers ──

const STATUS_ICONS: Record<string, string> = {
  match: "✓",
  mismatch: "✕",
  extra: "+",
  missing: "−",
};

const STATUS_LABELS: Record<string, string> = {
  match: "Match",
  mismatch: "Mismatch",
  extra: "Extra in Layout",
  missing: "Missing in Layout",
};

// ── Summary Tab ──

function SummaryTab() {
  const lvsView = useCrossProbeStore((s) => s.lvsView);
  const result = lvsView.result;

  if (!result) return null;
  const s = result.summary;

  return (
    <div className="lvs-summary">
      <div
        className={`lvs-summary__badge lvs-summary__badge--${result.status}`}
      >
        {result.status === "clean" ? "✓ LVS CLEAN" : "✕ LVS ERRORS"}
      </div>

      <div className="lvs-summary__time">
        Completed in {result.durationMs.toFixed(1)}ms
      </div>

      <div className="lvs-summary__grid">
        <div className="lvs-summary__section">
          <h4>Devices</h4>
          <div className="lvs-summary__row">
            <span>Total</span>
            <span>{s.totalDevices}</span>
          </div>
          <div className="lvs-summary__row lvs-summary__row--ok">
            <span>Matched</span>
            <span>{s.matchedDevices}</span>
          </div>
          <div className="lvs-summary__row lvs-summary__row--err">
            <span>Mismatched</span>
            <span>{s.mismatchedDevices}</span>
          </div>
          <div className="lvs-summary__row lvs-summary__row--warn">
            <span>Extra (layout)</span>
            <span>{s.extraLayoutDevices}</span>
          </div>
          <div className="lvs-summary__row lvs-summary__row--warn">
            <span>Missing (layout)</span>
            <span>{s.missingLayoutDevices}</span>
          </div>
        </div>

        <div className="lvs-summary__section">
          <h4>Nets</h4>
          <div className="lvs-summary__row">
            <span>Total</span>
            <span>{s.totalNets}</span>
          </div>
          <div className="lvs-summary__row lvs-summary__row--ok">
            <span>Matched</span>
            <span>{s.matchedNets}</span>
          </div>
          <div className="lvs-summary__row lvs-summary__row--warn">
            <span>Extra</span>
            <span>{s.extraNets}</span>
          </div>
          <div className="lvs-summary__row lvs-summary__row--warn">
            <span>Missing</span>
            <span>{s.missingNets}</span>
          </div>
        </div>

        <div className="lvs-summary__section">
          <h4>Errors</h4>
          <div className="lvs-summary__row lvs-summary__row--err">
            <span>Parameter</span>
            <span>{s.parameterErrors}</span>
          </div>
          <div className="lvs-summary__row lvs-summary__row--err">
            <span>Connectivity</span>
            <span>{s.connectivityErrors}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Device Match Row ──

function DeviceRow({
  match,
  index,
}: {
  match: DeviceMatch;
  index: number;
}) {
  const expandedDevices = useCrossProbeStore((s) => s.lvsView.expandedDevices);
  const toggleDeviceExpanded = useCrossProbeStore((s) => s.toggleDeviceExpanded);
  const highlightDevice = useCrossProbeStore((s) => s.highlightDevice);
  const clearHover = useCrossProbeStore((s) => s.clearHover);

  const expanded = expandedDevices.has(index);
  const name =
    match.layoutDevice?.name ?? match.schematicDevice?.name ?? "?";
  const type =
    match.layoutDevice?.type ?? match.schematicDevice?.type ?? "?";

  return (
    <div className={`lvs-device lvs-device--${match.status}`}>
      <div
        className="lvs-device__header"
        onClick={() => toggleDeviceExpanded(index)}
        onMouseEnter={() => highlightDevice(match)}
        onMouseLeave={clearHover}
      >
        <span className={`lvs-device__status lvs-device__status--${match.status}`}>
          {STATUS_ICONS[match.status]}
        </span>
        <span className="lvs-device__name">{name}</span>
        <span className="lvs-device__type">{type}</span>
        <span className="lvs-device__status-label">
          {STATUS_LABELS[match.status]}
        </span>
        <span className="lvs-device__expand">{expanded ? "▾" : "▸"}</span>
      </div>

      {expanded && (
        <div className="lvs-device__detail">
          {/* Terminal comparison */}
          {match.terminalDiffs.length > 0 && (
            <div className="lvs-device__section">
              <h5>Terminals</h5>
              <table className="lvs-device__table">
                <thead>
                  <tr>
                    <th>Terminal</th>
                    <th>Layout</th>
                    <th>Schematic</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {match.terminalDiffs.map((td) => (
                    <tr key={td.terminal} className={td.match ? "" : "lvs-device__table-row--err"}>
                      <td>{td.terminal}</td>
                      <td>{td.layoutNet ?? "—"}</td>
                      <td>{td.schematicNet ?? "—"}</td>
                      <td>{td.match ? "✓" : "✕"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Parameter comparison */}
          {match.parameterDiffs.length > 0 && (
            <div className="lvs-device__section">
              <h5>Parameters</h5>
              <table className="lvs-device__table">
                <thead>
                  <tr>
                    <th>Param</th>
                    <th>Layout</th>
                    <th>Schematic</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {match.parameterDiffs.map((pd) => (
                    <tr
                      key={pd.parameter}
                      className={pd.withinTolerance ? "" : "lvs-device__table-row--err"}
                    >
                      <td>{pd.parameter}</td>
                      <td>{pd.layoutValue?.toPrecision(3) ?? "—"}</td>
                      <td>{pd.schematicValue?.toPrecision(3) ?? "—"}</td>
                      <td>{pd.withinTolerance ? "✓" : "✕"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {match.geometryIndices.length > 0 && (
            <div className="lvs-device__geom-info">
              Linked to {match.geometryIndices.length} geometries
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Devices Tab ──

function DevicesTab() {
  const getFilteredDevices = useCrossProbeStore((s) => s.getFilteredDevices);
  const showOnlyErrors = useCrossProbeStore((s) => s.lvsView.showOnlyErrors);
  const toggleShowOnlyErrors = useCrossProbeStore((s) => s.toggleShowOnlyErrors);

  const devices = getFilteredDevices();

  return (
    <div className="lvs-devices">
      <div className="lvs-devices__toolbar">
        <label className="lvs-devices__filter">
          <input
            type="checkbox"
            checked={showOnlyErrors}
            onChange={toggleShowOnlyErrors}
          />
          Errors only
        </label>
        <span className="lvs-devices__count">{devices.length} devices</span>
      </div>
      <div className="lvs-devices__list">
        {devices.length > 0 ? (
          <VirtualList
            items={devices}
            estimateSize={40}
            className="lvs-devices__virtual"
            renderItem={(d, i) => <DeviceRow key={i} match={d} index={i} />}
          />
        ) : (
          <p className="lvs-devices__empty">
            {showOnlyErrors ? "No errors found!" : "No devices."}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Net Row ──

function NetRow({ match }: { match: NetMatch }) {
  const highlightNet = useCrossProbeStore((s) => s.highlightNet);
  const clearHover = useCrossProbeStore((s) => s.clearHover);

  const name = match.layoutNet ?? match.schematicNet ?? "?";

  return (
    <div
      className={`lvs-net lvs-net--${match.status}`}
      onMouseEnter={() => highlightNet(match)}
      onMouseLeave={clearHover}
    >
      <span className={`lvs-net__status lvs-net__status--${match.status}`}>
        {STATUS_ICONS[match.status]}
      </span>
      <span className="lvs-net__name">{name}</span>
      {match.layoutNet && match.schematicNet && match.layoutNet !== match.schematicNet && (
        <span className="lvs-net__mapping">
          {match.layoutNet} → {match.schematicNet}
        </span>
      )}
      <span className="lvs-net__status-label">
        {STATUS_LABELS[match.status]}
      </span>
    </div>
  );
}

// ── Nets Tab ──

function NetsTab() {
  const getFilteredNets = useCrossProbeStore((s) => s.getFilteredNets);
  const showOnlyErrors = useCrossProbeStore((s) => s.lvsView.showOnlyErrors);
  const toggleShowOnlyErrors = useCrossProbeStore((s) => s.toggleShowOnlyErrors);

  const nets = getFilteredNets();

  return (
    <div className="lvs-nets">
      <div className="lvs-nets__toolbar">
        <label className="lvs-nets__filter">
          <input
            type="checkbox"
            checked={showOnlyErrors}
            onChange={toggleShowOnlyErrors}
          />
          Errors only
        </label>
        <span className="lvs-nets__count">{nets.length} nets</span>
      </div>
      <div className="lvs-nets__list">
        {nets.length > 0 ? (
          <VirtualList
            items={nets}
            estimateSize={36}
            className="lvs-nets__virtual"
            renderItem={(n, i) => <NetRow key={i} match={n} />}
          />
        ) : (
          <p className="lvs-nets__empty">
            {showOnlyErrors ? "No net errors!" : "No nets."}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main LVS Panel ──

const TABS: { id: "summary" | "devices" | "nets"; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "devices", label: "Devices" },
  { id: "nets", label: "Nets" },
];

export function LvsPanel() {
  const lvsView = useCrossProbeStore((s) => s.lvsView);
  const setActiveTab = useCrossProbeStore((s) => s.setActiveTab);
  const setLvsResult = useCrossProbeStore((s) => s.setLvsResult);
  const clearAllHighlights = useCrossProbeStore((s) => s.clearAllHighlights);

  const handleRunDemo = () => {
    clearAllHighlights();
    const result = runDemoLvs();
    setLvsResult(result);
  };

  const handleClear = () => {
    clearAllHighlights();
    setLvsResult(null);
  };

  return (
    <div className="lvs-panel">
      <div className="lvs-panel__toolbar">
        <button className="lvs-panel__run-btn" onClick={handleRunDemo}>
          ▶ Run Demo LVS
        </button>
        {lvsView.result && (
          <button className="lvs-panel__clear-btn" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>

      {!lvsView.result ? (
        <div className="lvs-panel__empty">
          <p>No LVS results.</p>
          <p>Click "Run Demo LVS" to see a comparison.</p>
        </div>
      ) : (
        <>
          <div className="lvs-panel__tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`lvs-panel__tab ${
                  lvsView.activeTab === t.id ? "lvs-panel__tab--active" : ""
                }`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="lvs-panel__content">
            {lvsView.activeTab === "summary" && <SummaryTab />}
            {lvsView.activeTab === "devices" && <DevicesTab />}
            {lvsView.activeTab === "nets" && <NetsTab />}
          </div>
        </>
      )}
    </div>
  );
}
