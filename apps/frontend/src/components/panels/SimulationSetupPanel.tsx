/**
 * SimulationSetupPanel — simulation configuration sidebar panel.
 *
 * Provides UI for:
 *  - Analysis type selection (OP, Transient, DC Sweep, AC)
 *  - Analysis parameter configuration
 *  - Engine backend selection (ngspice WASM / built-in)
 *  - SPICE netlist editor
 *  - Quick-load demo circuits
 *  - Simulation launch & abort
 *  - Simulation history
 */

import { useSimStore, type AnalysisType } from "../../stores/simStore";
import {
  generateDemoNetlist,
  generateNandNetlist,
  generateAmplifierNetlist,
  generateDcSweepNetlist,
} from "../../engines/ngspiceEngine";
import { analysisToSpice } from "../../engines/spiceParser";
import "./SimulationSetupPanel.css";

export function SimulationSetupPanel() {
  const analysisConfig = useSimStore((s) => s.analysisConfig);
  const setAnalysisType = useSimStore((s) => s.setAnalysisType);
  const updateTranConfig = useSimStore((s) => s.updateTranConfig);
  const updateDcConfig = useSimStore((s) => s.updateDcConfig);
  const updateAcConfig = useSimStore((s) => s.updateAcConfig);
  const engineBackend = useSimStore((s) => s.engineBackend);
  const state = useSimStore((s) => s.state);
  const progress = useSimStore((s) => s.progress);
  const spiceNetlistText = useSimStore((s) => s.spiceNetlistText);
  const setSpiceNetlistText = useSimStore((s) => s.setSpiceNetlistText);
  const runSimulation = useSimStore((s) => s.runSimulation);
  const abortSimulation = useSimStore((s) => s.abortSimulation);
  const simulationHistory = useSimStore((s) => s.simulationHistory);
  const lastResult = useSimStore((s) => s.lastResult);
  const getCurrentAnalysis = useSimStore((s) => s.getCurrentAnalysis);

  const analysisTypes: { id: AnalysisType; label: string; desc: string }[] = [
    { id: "op", label: "OP", desc: "DC Operating Point" },
    { id: "tran", label: "Tran", desc: "Transient Analysis" },
    { id: "dc", label: "DC", desc: "DC Sweep" },
    { id: "ac", label: "AC", desc: "AC Small-Signal" },
  ];

  const demoCircuits = [
    { label: "CMOS Inverter", fn: generateDemoNetlist },
    { label: "NAND Gate", fn: generateNandNetlist },
    { label: "CS Amplifier", fn: generateAmplifierNetlist },
    { label: "NMOS I-V Curve", fn: generateDcSweepNetlist },
  ];

  const handleLoadDemo = (fn: () => string) => {
    const text = fn();
    setSpiceNetlistText(text);
  };

  const isRunning = state === "running";

  return (
    <div className="sim-setup">
      <div className="sim-setup__header">
        <span className="sim-setup__title">Simulation Setup</span>
        <span className="sim-setup__engine-badge">{engineBackend === "ngspice-wasm" ? "ngspice" : "built-in"}</span>
      </div>

      {/* Analysis Type Selector */}
      <section className="sim-setup__section">
        <div className="sim-setup__section-label">Analysis Type</div>
        <div className="sim-setup__analysis-tabs">
          {analysisTypes.map((a) => (
            <button
              key={a.id}
              className={`sim-setup__analysis-tab ${analysisConfig.type === a.id ? "sim-setup__analysis-tab--active" : ""}`}
              onClick={() => setAnalysisType(a.id)}
              title={a.desc}
              disabled={isRunning}
            >
              {a.label}
            </button>
          ))}
        </div>
      </section>

      {/* Analysis Parameters */}
      <section className="sim-setup__section">
        <div className="sim-setup__section-label">Parameters</div>
        {analysisConfig.type === "tran" && (
          <div className="sim-setup__params">
            <ParamRow label="Step" value={analysisConfig.tran.step} unit="s" onChange={(v) => updateTranConfig({ step: v })} disabled={isRunning} />
            <ParamRow label="Stop" value={analysisConfig.tran.stop} unit="s" onChange={(v) => updateTranConfig({ stop: v })} disabled={isRunning} />
            <ParamRow label="Start" value={analysisConfig.tran.start ?? 0} unit="s" onChange={(v) => updateTranConfig({ start: v })} disabled={isRunning} />
          </div>
        )}
        {analysisConfig.type === "dc" && (
          <div className="sim-setup__params">
            <div className="sim-setup__param-row">
              <label>Source</label>
              <input
                type="text"
                value={analysisConfig.dc.source}
                onChange={(e) => updateDcConfig({ source: e.target.value })}
                className="sim-setup__input sim-setup__input--text"
                disabled={isRunning}
              />
            </div>
            <ParamRow label="Start" value={analysisConfig.dc.start} unit="V" onChange={(v) => updateDcConfig({ start: v })} disabled={isRunning} />
            <ParamRow label="Stop" value={analysisConfig.dc.stop} unit="V" onChange={(v) => updateDcConfig({ stop: v })} disabled={isRunning} />
            <ParamRow label="Step" value={analysisConfig.dc.step} unit="V" onChange={(v) => updateDcConfig({ step: v })} disabled={isRunning} />
          </div>
        )}
        {analysisConfig.type === "ac" && (
          <div className="sim-setup__params">
            <div className="sim-setup__param-row">
              <label>Variation</label>
              <select
                value={analysisConfig.ac.variation}
                onChange={(e) => updateAcConfig({ variation: e.target.value as "dec" | "oct" | "lin" })}
                className="sim-setup__input sim-setup__input--select"
                disabled={isRunning}
              >
                <option value="dec">Decade</option>
                <option value="oct">Octave</option>
                <option value="lin">Linear</option>
              </select>
            </div>
            <ParamRow label="Points" value={analysisConfig.ac.points} unit="pts" onChange={(v) => updateAcConfig({ points: Math.round(v) })} disabled={isRunning} />
            <ParamRow label="F start" value={analysisConfig.ac.fstart} unit="Hz" onChange={(v) => updateAcConfig({ fstart: v })} disabled={isRunning} />
            <ParamRow label="F stop" value={analysisConfig.ac.fstop} unit="Hz" onChange={(v) => updateAcConfig({ fstop: v })} disabled={isRunning} />
          </div>
        )}
        {analysisConfig.type === "op" && (
          <div className="sim-setup__params">
            <div className="sim-setup__info-text">
              Computes the DC operating point of the circuit. No additional parameters needed.
            </div>
          </div>
        )}
        <div className="sim-setup__directive">
          <code>{analysisConfig.type === "op" ? ".op" : analysisToSpice(getCurrentAnalysis())}</code>
        </div>
      </section>

      {/* Demo Circuits */}
      <section className="sim-setup__section">
        <div className="sim-setup__section-label">Demo Circuits</div>
        <div className="sim-setup__demo-grid">
          {demoCircuits.map((demo) => (
            <button
              key={demo.label}
              className="sim-setup__demo-btn"
              onClick={() => handleLoadDemo(demo.fn)}
              disabled={isRunning}
            >
              {demo.label}
            </button>
          ))}
        </div>
      </section>

      {/* SPICE Netlist Editor */}
      <section className="sim-setup__section sim-setup__section--grow">
        <div className="sim-setup__section-label">
          SPICE Netlist
          <span className="sim-setup__char-count">{spiceNetlistText.length > 0 ? `${spiceNetlistText.split("\n").length} lines` : "empty"}</span>
        </div>
        <textarea
          className="sim-setup__netlist-editor"
          value={spiceNetlistText}
          onChange={(e) => setSpiceNetlistText(e.target.value)}
          placeholder="Paste or type SPICE netlist here..."
          spellCheck={false}
          disabled={isRunning}
        />
      </section>

      {/* Simulation Controls */}
      <section className="sim-setup__section">
        <div className="sim-setup__controls">
          {!isRunning ? (
            <button
              className="sim-setup__run-btn"
              onClick={runSimulation}
              disabled={spiceNetlistText.length === 0}
            >
              ▶ Run Simulation
            </button>
          ) : (
            <button className="sim-setup__abort-btn" onClick={abortSimulation}>
              ■ Abort
            </button>
          )}
        </div>

        {/* Progress bar */}
        {progress && (
          <div className="sim-setup__progress">
            <div className="sim-setup__progress-bar">
              <div
                className="sim-setup__progress-fill"
                style={{ width: `${progress.percent * 100}%` }}
              />
            </div>
            <span className="sim-setup__progress-text">{progress.message}</span>
          </div>
        )}

        {/* Last Result Summary */}
        {lastResult && state !== "running" && (
          <div className={`sim-setup__result ${lastResult.converged ? "sim-setup__result--ok" : "sim-setup__result--warn"}`}>
            <div className="sim-setup__result-row">
              <span>{lastResult.converged ? "✓ Converged" : "⚠ Not converged"}</span>
              <span>{lastResult.timeMs.toFixed(1)}ms</span>
            </div>
            <div className="sim-setup__result-row">
              <span>{lastResult.waveform.signals.length} signals</span>
              <span>{lastResult.iterations} iterations</span>
            </div>
          </div>
        )}
      </section>

      {/* Simulation History */}
      {simulationHistory.length > 0 && (
        <section className="sim-setup__section">
          <div className="sim-setup__section-label">History</div>
          <div className="sim-setup__history">
            {simulationHistory.slice().reverse().slice(0, 5).map((h) => (
              <div key={h.id} className="sim-setup__history-item">
                <span className={`sim-setup__history-dot ${h.converged ? "sim-setup__history-dot--ok" : "sim-setup__history-dot--fail"}`} />
                <span className="sim-setup__history-type">{h.analysis.toUpperCase()}</span>
                <span className="sim-setup__history-time">{h.durationMs.toFixed(0)}ms</span>
                <span className="sim-setup__history-date">{new Date(h.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────

function ParamRow({
  label,
  value,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  const displayValue = formatEngDisplay(value);

  return (
    <div className="sim-setup__param-row">
      <label>{label}</label>
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          const parsed = parseEngInput(e.target.value);
          if (!isNaN(parsed)) onChange(parsed);
        }}
        className="sim-setup__input"
        disabled={disabled}
      />
      <span className="sim-setup__unit">{unit}</span>
    </div>
  );
}

function formatEngDisplay(value: number): string {
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${value / 1e12}T`;
  if (abs >= 1e9) return `${value / 1e9}G`;
  if (abs >= 1e6) return `${value / 1e6}M`;
  if (abs >= 1e3) return `${value / 1e3}k`;
  if (abs >= 1) return `${value}`;
  if (abs >= 1e-3) return `${value * 1e3}m`;
  if (abs >= 1e-6) return `${value * 1e6}u`;
  if (abs >= 1e-9) return `${value * 1e9}n`;
  if (abs >= 1e-12) return `${value * 1e12}p`;
  if (abs >= 1e-15) return `${value * 1e15}f`;
  return value.toExponential(2);
}

function parseEngInput(input: string): number {
  const s = input.trim().toLowerCase();
  const match = s.match(/^([+-]?\d+\.?\d*(?:e[+-]?\d+)?)\s*([a-z]*)$/);
  if (!match) return NaN;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  const multipliers: Record<string, number> = {
    f: 1e-15, p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3,
    k: 1e3, meg: 1e6, g: 1e9, t: 1e12,
  };
  if (!suffix) return num;
  if (suffix.startsWith("meg")) return num * 1e6;
  return num * (multipliers[suffix.charAt(0)] ?? 1);
}
