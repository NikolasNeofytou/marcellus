import { useState } from "react";
import { useMonteCarloStore } from "../../stores/monteCarloStore";
import {
  Dice5, BarChart3, Grid3x3, Play, Trash2, Plus, Settings2,
  CheckCircle2, XCircle, Layers, TrendingUp,
} from "lucide-react";
import "./MonteCarloPanel.css";

type Tab = "setup" | "results" | "corner-matrix";

export function MonteCarloPanel() {
  const [tab, setTab] = useState<Tab>("setup");

  return (
    <div className="mc-panel">
      <div className="mc-panel__tabs">
        {([
          ["setup", "Setup", <Settings2 size={13} key="s" />],
          ["results", "Results", <BarChart3 size={13} key="r" />],
          ["corner-matrix", "Corner Matrix", <Grid3x3 size={13} key="c" />],
        ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button
            key={id}
            className={`mc-panel__tab ${tab === id ? "mc-panel__tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === "setup" && <SetupTab />}
      {tab === "results" && <ResultsTab />}
      {tab === "corner-matrix" && <CornerMatrixTab />}
    </div>
  );
}

/* ── Setup Tab ──────────────────────────────────────────────────── */

function SetupTab() {
  const { config, setConfig, addParameter, removeParameter, addMeasurement, removeMeasurement, runMonteCarloDemo, status } = useMonteCarloStore();

  return (
    <div>
      {/* Run count + seed */}
      <div className="mc-panel__section">
        <div className="mc-panel__label">Configuration</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 11 }}>
            Runs:
            <input
              className="mc-panel__input"
              type="number" min={10} max={10000} step={10}
              value={config.numRuns}
              onChange={(e) => setConfig({ numRuns: Number(e.target.value) })}
              style={{ width: 70, marginLeft: 4 }}
            />
          </label>
          <label style={{ fontSize: 11 }}>
            Seed:
            <input
              className="mc-panel__input"
              type="number" min={0}
              value={config.seed}
              onChange={(e) => setConfig({ seed: Number(e.target.value) })}
              style={{ width: 70, marginLeft: 4 }}
            />
          </label>
          <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={config.includeProcess} onChange={(e) => setConfig({ includeProcess: e.target.checked })} />
            Process
          </label>
          <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={config.includeMismatch} onChange={(e) => setConfig({ includeMismatch: e.target.checked })} />
            Mismatch
          </label>
        </div>
      </div>

      {/* Parameters */}
      <div className="mc-panel__section">
        <div className="mc-panel__label">
          Parameters ({config.parameters.length})
          <button
            className="mc-panel__btn mc-panel__btn--sm"
            onClick={() => addParameter({
              name: `PARAM_${config.parameters.length}`,
              nominal: 1,
              sigma: 0.05,
              distribution: "gaussian",
              unit: "",
              category: "process",
            })}
          >
            <Plus size={10} />
          </button>
        </div>
        {config.parameters.map((p) => (
          <div key={p.name} className="mc-panel__param-row">
            <span style={{ minWidth: 90, fontWeight: 500, fontFamily: "monospace" }}>{p.name}</span>
            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
              µ={p.nominal} σ={p.sigma} {p.unit}
            </span>
            <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 3, background: "var(--border, #333)" }}>
              {p.distribution}
            </span>
            <button className="mc-panel__btn mc-panel__btn--sm mc-panel__btn--danger" onClick={() => removeParameter(p.name)}>
              <Trash2 size={9} />
            </button>
          </div>
        ))}
      </div>

      {/* Measurements */}
      <div className="mc-panel__section">
        <div className="mc-panel__label">
          Measurements ({config.measurements.length})
          <button
            className="mc-panel__btn mc-panel__btn--sm"
            onClick={() => addMeasurement({
              name: `Meas_${config.measurements.length}`,
              unit: "",
              expression: "",
              type: "custom",
            })}
          >
            <Plus size={10} />
          </button>
        </div>
        {config.measurements.map((m) => (
          <div key={m.name} className="mc-panel__param-row">
            <span style={{ minWidth: 100, fontWeight: 500 }}>{m.name}</span>
            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{m.expression}</span>
            <span style={{ fontSize: 10 }}>{m.unit}</span>
            <button className="mc-panel__btn mc-panel__btn--sm mc-panel__btn--danger" onClick={() => removeMeasurement(m.name)}>
              <Trash2 size={9} />
            </button>
          </div>
        ))}
      </div>

      {/* Run */}
      <button
        className="mc-panel__btn mc-panel__btn--primary"
        onClick={runMonteCarloDemo}
        disabled={status === "running"}
      >
        <Dice5 size={13} /> {status === "running" ? "Running…" : "Run Monte Carlo"}
      </button>
    </div>
  );
}

/* ── Results Tab ────────────────────────────────────────────────── */

function ResultsTab() {
  const { results, statistics, status, progress, activeHistogramMeasurement, setActiveHistogramMeasurement, overlayWaveforms, setOverlayWaveforms, clearResults } = useMonteCarloStore();

  if (status === "idle") {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>
        <Dice5 size={28} />
        <div style={{ marginTop: 8, fontSize: 11 }}>No results yet. Configure and run Monte Carlo simulation.</div>
      </div>
    );
  }

  if (status === "running") {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 11, marginBottom: 6 }}>Running… {progress}%</div>
        <div className="mc-panel__progress">
          <div className="mc-panel__progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  const activeStat = statistics.find((s) => s.name === activeHistogramMeasurement);
  const maxBinCount = activeStat ? Math.max(...activeStat.histogram.map((b) => b.count), 1) : 1;

  return (
    <div>
      {/* Controls */}
      <div className="mc-panel__section" style={{ display: "flex", gap: 6 }}>
        <button className="mc-panel__btn mc-panel__btn--sm" onClick={() => setOverlayWaveforms(!overlayWaveforms)}>
          <Layers size={11} /> {overlayWaveforms ? "Overlay ON" : "Overlay OFF"}
        </button>
        <button className="mc-panel__btn mc-panel__btn--sm mc-panel__btn--danger" onClick={clearResults}>
          <Trash2 size={11} /> Clear
        </button>
      </div>

      <div className="mc-panel__section">
        <div className="mc-panel__label">Summary ({results.length} runs)</div>
      </div>

      {/* Statistics Cards */}
      {statistics.map((s) => {
        const yieldColor = s.yield >= 99.7 ? "#22c55e" : s.yield >= 95 ? "#f59e0b" : "#ef4444";
        return (
          <div
            key={s.name}
            className="mc-panel__stat-card"
            onClick={() => setActiveHistogramMeasurement(s.name)}
            style={{ cursor: "pointer", borderColor: activeHistogramMeasurement === s.name ? "var(--accent, #2563eb)" : undefined }}
          >
            <div className="mc-panel__stat-title">
              <span><TrendingUp size={12} /> {s.name} ({s.unit})</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: yieldColor }}>
                {s.yield.toFixed(1)}% yield
              </span>
            </div>
            <div className="mc-panel__stat-grid">
              <div className="mc-panel__stat-item">
                <div className="mc-panel__stat-value">{s.mean.toFixed(2)}</div>
                <div className="mc-panel__stat-label">Mean</div>
              </div>
              <div className="mc-panel__stat-item">
                <div className="mc-panel__stat-value">{s.stddev.toFixed(2)}</div>
                <div className="mc-panel__stat-label">σ</div>
              </div>
              <div className="mc-panel__stat-item">
                <div className="mc-panel__stat-value">{s.median.toFixed(2)}</div>
                <div className="mc-panel__stat-label">Median</div>
              </div>
              <div className="mc-panel__stat-item">
                <div className="mc-panel__stat-value">{s.min.toFixed(2)}</div>
                <div className="mc-panel__stat-label">Min</div>
              </div>
              <div className="mc-panel__stat-item">
                <div className="mc-panel__stat-value">{s.max.toFixed(2)}</div>
                <div className="mc-panel__stat-label">Max</div>
              </div>
              <div className="mc-panel__stat-item">
                <div className="mc-panel__stat-value">{(s.max - s.min).toFixed(2)}</div>
                <div className="mc-panel__stat-label">Range</div>
              </div>
            </div>
            <div className="mc-panel__yield-bar">
              <div className="mc-panel__yield-fill" style={{ width: `${s.yield}%`, background: yieldColor }} />
            </div>
          </div>
        );
      })}

      {/* Histogram */}
      {activeStat && (
        <div className="mc-panel__section">
          <div className="mc-panel__label">Histogram — {activeStat.name}</div>
          <div className="mc-panel__histogram">
            {activeStat.histogram.map((bin, i) => (
              <div
                key={i}
                className="mc-panel__hist-bar"
                style={{ height: `${(bin.count / maxBinCount) * 100}%` }}
                title={`${bin.binStart.toFixed(2)}–${bin.binEnd.toFixed(2)}: ${bin.count}`}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>
            <span>{activeStat.min.toFixed(2)}</span>
            <span>{activeStat.max.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Corner Matrix Tab ──────────────────────────────────────────── */

function CornerMatrixTab() {
  const { cornerMatrix, initCornerMatrix, runCornerMatrixDemo, toggleCornerMatrixCell, clearCornerMatrix } = useMonteCarloStore();

  if (!cornerMatrix) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <Grid3x3 size={28} style={{ color: "var(--text-secondary)" }} />
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>
          Corner matrix not initialised.
        </div>
        <button className="mc-panel__btn mc-panel__btn--primary" style={{ marginTop: 8 }} onClick={initCornerMatrix}>
          <Grid3x3 size={12} /> Initialise Matrix
        </button>
      </div>
    );
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case "passed":  return <CheckCircle2 size={10} />;
      case "failed":  return <XCircle size={10} />;
      case "running": return <Play size={10} />;
      default:        return null;
    }
  };

  return (
    <div>
      <div className="mc-panel__section" style={{ display: "flex", gap: 6 }}>
        <button className="mc-panel__btn mc-panel__btn--primary" onClick={runCornerMatrixDemo}>
          <Play size={12} /> Run All Corners
        </button>
        <button className="mc-panel__btn mc-panel__btn--sm mc-panel__btn--danger" onClick={clearCornerMatrix}>
          <Trash2 size={11} /> Clear
        </button>
      </div>

      {/* Matrix per corner type */}
      {cornerMatrix.corners.map((corner) => {
        const cells = cornerMatrix.cells.filter((c) => c.corner === corner);
        return (
          <div key={corner} className="mc-panel__section">
            <div className="mc-panel__label">{corner}</div>
            <table className="mc-panel__matrix">
              <thead>
                <tr>
                  <th>V \ T</th>
                  {cornerMatrix.temperatures.map((t) => <th key={t}>{t}°C</th>)}
                </tr>
              </thead>
              <tbody>
                {cornerMatrix.voltages.map((v) => (
                  <tr key={v}>
                    <td style={{ fontWeight: 600 }}>{v}V</td>
                    {cornerMatrix.temperatures.map((t) => {
                      const cell = cells.find((c) => c.voltage === v && c.temperature === t);
                      if (!cell) return <td key={t}>—</td>;
                      return (
                        <td key={t}>
                          <div
                            className={`mc-panel__matrix-cell mc-panel__matrix-cell--${cell.status}`}
                            onClick={() => toggleCornerMatrixCell(corner, v, t)}
                            title={cell.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                          >
                            {statusIcon(cell.status) ?? (cell.enabled ? "●" : "○")}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
