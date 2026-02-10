import { useState } from "react";
import {
  Activity,
  Zap,
  Radio,
  TrendingUp,
  Play,
  AlertTriangle,
  CheckCircle,
  BarChart3,
} from "lucide-react";
import { useAdvancedAnalysisStore } from "../../stores/advancedAnalysisStore";
import "./AdvancedAnalysisPanel.css";

type Tab = "irdrop" | "antenna" | "noise" | "stability";

export function AdvancedAnalysisPanel() {
  const [tab, setTab] = useState<Tab>("irdrop");
  return (
    <div className="analysis-panel">
      <div className="analysis-panel__tabs">
        <button
          className={`analysis-panel__tab${tab === "irdrop" ? " analysis-panel__tab--active" : ""}`}
          onClick={() => setTab("irdrop")}
        >
          <Activity size={12} /> IR Drop
        </button>
        <button
          className={`analysis-panel__tab${tab === "antenna" ? " analysis-panel__tab--active" : ""}`}
          onClick={() => setTab("antenna")}
        >
          <Radio size={12} /> Antenna
        </button>
        <button
          className={`analysis-panel__tab${tab === "noise" ? " analysis-panel__tab--active" : ""}`}
          onClick={() => setTab("noise")}
        >
          <BarChart3 size={12} /> Noise
        </button>
        <button
          className={`analysis-panel__tab${tab === "stability" ? " analysis-panel__tab--active" : ""}`}
          onClick={() => setTab("stability")}
        >
          <TrendingUp size={12} /> Stability
        </button>
      </div>
      <div className="analysis-panel__body">
        {tab === "irdrop" && <IrDropTab />}
        {tab === "antenna" && <AntennaTab />}
        {tab === "noise" && <NoiseTab />}
        {tab === "stability" && <StabilityTab />}
      </div>
    </div>
  );
}

/* ── IR Drop ──────────────────────────────────────────── */
function IrDropTab() {
  const { irDropResult, irDropConfig, setIRDropConfig, runIRDrop } =
    useAdvancedAnalysisStore();

  return (
    <>
      <div className="analysis-panel__section">
        <div className="analysis-panel__label">IR Drop Configuration</div>
        <div className="analysis-panel__input-row">
          <span className="analysis-panel__input-label">Voltage (V)</span>
          <input
            className="analysis-panel__input"
            type="number"
            step="0.1"
            value={irDropConfig.nominalVoltage}
            onChange={(e) => setIRDropConfig({ nominalVoltage: parseFloat(e.target.value) || 1.8 })}
          />
        </div>
        <div className="analysis-panel__input-row">
          <span className="analysis-panel__input-label">Grid size</span>
          <input
            className="analysis-panel__input"
            type="number"
            value={irDropConfig.gridResolution}
            onChange={(e) =>
              setIRDropConfig({ gridResolution: parseInt(e.target.value) || 16 })
            }
          />
        </div>
        <div className="analysis-panel__input-row">
          <span className="analysis-panel__input-label">Max I (mA)</span>
          <input
            className="analysis-panel__input"
            type="number"
            step="0.1"
            value={irDropConfig.maxCurrent}
            onChange={(e) =>
              setIRDropConfig({ maxCurrent: parseFloat(e.target.value) || 1 })
            }
          />
        </div>
        <button
          className="analysis-panel__btn analysis-panel__btn--primary"
          onClick={runIRDrop}
        >
          <Play size={12} /> Analyze
        </button>
      </div>

      {irDropResult && (
        <>
          <div className="analysis-panel__heatmap">
            IR Drop Heat Map
            <div className="analysis-panel__heatmap-legend">
              <span>{irDropResult.minV.toFixed(3)} V</span>
              <span>{irDropResult.maxV.toFixed(3)} V</span>
            </div>
          </div>
          <div className="analysis-panel__stats">
            <div className="analysis-panel__stat analysis-panel__stat--warn">
              <div className="analysis-panel__stat-value">
                {(irDropResult.maxDrop * 1000).toFixed(1)}
              </div>
              <div className="analysis-panel__stat-label">Max Drop (mV)</div>
            </div>
            <div className="analysis-panel__stat analysis-panel__stat--ok">
              <div className="analysis-panel__stat-value">
                {(irDropResult.avgDrop * 1000).toFixed(1)}
              </div>
              <div className="analysis-panel__stat-label">Avg Drop (mV)</div>
            </div>
            <div className="analysis-panel__stat">
              <div className="analysis-panel__stat-value">{irDropResult.nodes.length}</div>
              <div className="analysis-panel__stat-label">Grid Nodes</div>
            </div>
            <div className="analysis-panel__stat">
              <div className="analysis-panel__stat-value">{irDropResult.gridResolution}</div>
              <div className="analysis-panel__stat-label">Resolution</div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Antenna ──────────────────────────────────────────── */
function AntennaTab() {
  const { antennaViolations, antennaConfig, setAntennaConfig, runAntennaCheck } =
    useAdvancedAnalysisStore();

  return (
    <>
      <div className="analysis-panel__section">
        <div className="analysis-panel__label">Antenna Rule Check</div>
        <div className="analysis-panel__input-row">
          <span className="analysis-panel__input-label">Max Ratio</span>
          <input
            className="analysis-panel__input"
            type="number"
            step="10"
            value={antennaConfig.maxRatio}
            onChange={(e) => setAntennaConfig({ maxRatio: parseFloat(e.target.value) || 400 })}
          />
        </div>
        <button
          className="analysis-panel__btn analysis-panel__btn--primary"
          onClick={runAntennaCheck}
        >
          <Play size={12} /> Check
        </button>
      </div>

      <div className="analysis-panel__stats" style={{ padding: "8px 12px" }}>
        <div
          className={`analysis-panel__stat ${antennaViolations.length === 0 ? "analysis-panel__stat--ok" : "analysis-panel__stat--error"}`}
        >
          <div className="analysis-panel__stat-value">{antennaViolations.length}</div>
          <div className="analysis-panel__stat-label">Violations</div>
        </div>
        <div className="analysis-panel__stat analysis-panel__stat--ok">
          <div className="analysis-panel__stat-value">
            {antennaViolations.length === 0 ? (
              <CheckCircle size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
          </div>
          <div className="analysis-panel__stat-label">Status</div>
        </div>
      </div>

      {antennaViolations.map((v) => (
        <div key={v.id} className="analysis-panel__violation">
          <div className="analysis-panel__violation-header">
            <span>
              <AlertTriangle size={10} /> Gate L{v.gateLayerId} — Metal L{v.metalLayerId}
            </span>
            <span style={{ color: "#ef4444" }}>{v.ratio.toFixed(0)}x</span>
          </div>
          <div className="analysis-panel__violation-detail">
            Gate: {v.gateArea.toFixed(3)} µm² · Metal: {v.metalArea.toFixed(1)} µm² · Max: {v.maxAllowedRatio.toFixed(0)}x
          </div>
          {v.suggestion && (
            <div className="analysis-panel__violation-detail" style={{ color: "var(--accent)" }}>
              💡 {v.suggestion}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/* ── Noise ──────────────────────────────────────────── */
function NoiseTab() {
  const { noiseResult, runNoiseAnalysis } = useAdvancedAnalysisStore();

  const maxContrib = noiseResult
    ? Math.max(...noiseResult.sources.map((s) => s.contribution))
    : 1;

  return (
    <>
      <div className="analysis-panel__section">
        <div className="analysis-panel__label">Noise Contribution Analysis</div>
        <button
          className="analysis-panel__btn analysis-panel__btn--primary"
          onClick={runNoiseAnalysis}
        >
          <Play size={12} /> Analyze
        </button>
      </div>

      {noiseResult && (
        <>
          <div className="analysis-panel__stats">
            <div className="analysis-panel__stat">
              <div className="analysis-panel__stat-value">
                {(noiseResult.totalNoise * 1e6).toFixed(2)}
              </div>
              <div className="analysis-panel__stat-label">Total (µV rms)</div>
            </div>
            <div className="analysis-panel__stat">
              <div className="analysis-panel__stat-value">{noiseResult.sources.length}</div>
              <div className="analysis-panel__stat-label">Sources</div>
            </div>
          </div>

          <div style={{ padding: "4px 0" }}>
            {noiseResult.sources.map((s) => (
              <div key={s.name} className="analysis-panel__noise-row">
                <span style={{ minWidth: 70, fontSize: 10 }}>{s.name}</span>
                <div className="analysis-panel__noise-bar">
                  <div
                    className="analysis-panel__noise-fill"
                    style={{
                      width: `${(s.contribution / maxContrib) * 100}%`,
                      background:
                        s.type === "flicker"
                          ? "#f59e0b"
                          : s.type === "thermal"
                            ? "#2563eb"
                            : s.type === "shot"
                              ? "#ec4899"
                              : "#3b82f6",
                    }}
                  />
                </div>
                <span className="analysis-panel__noise-value">
                  {(s.contribution * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          <div className="analysis-panel__plot">
            <div className="analysis-panel__plot-grid" />
            <Zap size={16} style={{ color: "var(--accent)", opacity: 0.4 }} />
            <div className="analysis-panel__plot-label">
              Noise Spectrum ({noiseResult.spectrum.length} points)
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ── Stability ──────────────────────────────────────── */
function StabilityTab() {
  const { stabilityResult, runStabilityAnalysis } =
    useAdvancedAnalysisStore();

  return (
    <>
      <div className="analysis-panel__section">
        <div className="analysis-panel__label">Stability Analyzer</div>
        <button
          className="analysis-panel__btn analysis-panel__btn--primary"
          onClick={runStabilityAnalysis}
        >
          <Play size={12} /> Analyze
        </button>
      </div>

      {stabilityResult && (
        <>
          <div className="analysis-panel__stats">
            <div
              className={`analysis-panel__stat ${stabilityResult.gainMargin > 0 ? "analysis-panel__stat--ok" : "analysis-panel__stat--error"}`}
            >
              <div className="analysis-panel__stat-value">
                {stabilityResult.gainMargin.toFixed(1)}
              </div>
              <div className="analysis-panel__stat-label">Gain Margin (dB)</div>
            </div>
            <div
              className={`analysis-panel__stat ${stabilityResult.phaseMargin > 0 ? "analysis-panel__stat--ok" : "analysis-panel__stat--error"}`}
            >
              <div className="analysis-panel__stat-value">
                {stabilityResult.phaseMargin.toFixed(1)}
              </div>
              <div className="analysis-panel__stat-label">Phase Margin (°)</div>
            </div>
            <div className="analysis-panel__stat">
              <div className="analysis-panel__stat-value">
                {(stabilityResult.unityGainFreq / 1e6).toFixed(1)}
              </div>
              <div className="analysis-panel__stat-label">UGF (MHz)</div>
            </div>
            <div
              className={`analysis-panel__stat ${stabilityResult.isStable ? "analysis-panel__stat--ok" : "analysis-panel__stat--error"}`}
            >
              <div className="analysis-panel__stat-value">
                {stabilityResult.isStable ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div className="analysis-panel__stat-label">
                {stabilityResult.isStable ? "Stable" : "Unstable"}
              </div>
            </div>
          </div>

          <div style={{ padding: "4px 12px" }}>
            <div className="analysis-panel__label">Margins</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <span
                className={`analysis-panel__margin ${stabilityResult.gainMargin > 0 ? "analysis-panel__margin--positive" : "analysis-panel__margin--negative"}`}
              >
                GM: {stabilityResult.gainMargin > 0 ? "+" : ""}
                {stabilityResult.gainMargin.toFixed(1)} dB
              </span>
              <span
                className={`analysis-panel__margin ${stabilityResult.phaseMargin > 0 ? "analysis-panel__margin--positive" : "analysis-panel__margin--negative"}`}
              >
                PM: {stabilityResult.phaseMargin > 0 ? "+" : ""}
                {stabilityResult.phaseMargin.toFixed(1)}°
              </span>
            </div>
          </div>

          <div className="analysis-panel__plot">
            <div className="analysis-panel__plot-grid" />
            <TrendingUp size={16} style={{ color: "var(--accent)", opacity: 0.4 }} />
            <div className="analysis-panel__plot-label">
              Bode Plot ({stabilityResult.bode.length} points)
            </div>
          </div>
        </>
      )}
    </>
  );
}
