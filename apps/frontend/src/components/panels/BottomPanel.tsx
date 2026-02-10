import { useSimStore } from "../../stores/simStore";
import { LvsPanel } from "./LvsPanel";
import { TerminalPanel } from "./TerminalPanel";
import { ProblemsPanel } from "./ProblemsPanel";
import { WaveformViewer } from "./WaveformViewer";
import { SerialMonitor } from "./SerialMonitor";
import { FlashProgrammer } from "./FlashProgrammer";
import { DebugDashboard } from "./DebugDashboard";
import "./BottomPanel.css";

export function BottomPanel({ style }: { style?: React.CSSProperties }) {
  const activeTab = useSimStore((s) => s.activeTab);
  const setActiveTab = useSimStore((s) => s.setActiveTab);

  const tabs = [
    { id: "terminal" as const, label: "Terminal" },
    { id: "problems" as const, label: "Problems" },
    { id: "netlist" as const, label: "Netlist" },
    { id: "simulation" as const, label: "Simulation" },
    { id: "waveform" as const, label: "Waveform" },
    { id: "lvs" as const, label: "LVS" },
    { id: "serial" as const, label: "Serial" },
    { id: "flash" as const, label: "Flash" },
    { id: "debug" as const, label: "Debug" },
  ];

  return (
    <div className="bottom-panel" style={style}>
      <div className="bottom-panel__tabs" role="tablist" aria-label="Output panels">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`bottom-panel__tab ${activeTab === tab.id ? "bottom-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bottom-panel__content" role="tabpanel">
        {activeTab === "terminal" && <TerminalPanel />}
        {activeTab === "problems" && <ProblemsPanel />}
        {activeTab === "netlist" && <NetlistTab />}
        {activeTab === "simulation" && <SimulationTab />}
        {activeTab === "waveform" && <WaveformViewer />}
        {activeTab === "lvs" && <LvsPanel />}
        {activeTab === "serial" && <SerialMonitor />}
        {activeTab === "flash" && <FlashProgrammer />}
        {activeTab === "debug" && <DebugDashboard />}
      </div>
    </div>
  );
}

// ── Netlist Tab ───────────────────────────────────────────────────

function NetlistTab() {
  const netlist = useSimStore((s) => s.netlist);

  if (!netlist) {
    return (
      <div className="bottom-panel__placeholder">
        No netlist extracted. Run <strong>Extract SPICE Netlist</strong> from the command palette.
      </div>
    );
  }

  return (
    <div className="bottom-panel__netlist">
      <div className="bottom-panel__netlist-stats">
        {netlist.stats.deviceCount} devices · {netlist.stats.nodeCount} nodes · {netlist.stats.parasiticCount} parasitics · {netlist.stats.extractionTimeMs}ms
      </div>
      <pre className="bottom-panel__netlist-spice">{netlist.spiceText}</pre>
    </div>
  );
}

// ── Simulation Tab ────────────────────────────────────────────────

function SimulationTab() {
  const simState = useSimStore((s) => s.state);
  const spiceOutput = useSimStore((s) => s.spiceOutput);
  const error = useSimStore((s) => s.error);
  const generateDemoWaveform = useSimStore((s) => s.generateDemoWaveform);
  const runParameterSweep = useSimStore((s) => s.runParameterSweep);
  const runCornerAnalysis = useSimStore((s) => s.runCornerAnalysis);
  const sweep = useSimStore((s) => s.sweep);
  const cornerAnalysis = useSimStore((s) => s.cornerAnalysis);
  const analysisConfig = useSimStore((s) => s.analysisConfig);
  const progress = useSimStore((s) => s.progress);
  const lastResult = useSimStore((s) => s.lastResult);
  const engineBackend = useSimStore((s) => s.engineBackend);
  const runSimulation = useSimStore((s) => s.runSimulation);
  const abortSimulation = useSimStore((s) => s.abortSimulation);
  const spiceNetlistText = useSimStore((s) => s.spiceNetlistText);

  const handleSweep = () => {
    runParameterSweep([
      { name: "VDD", values: [1.62, 1.8, 1.98], unit: "V" },
      { name: "Temp", values: [-40, 27, 125], unit: "°C" },
    ]);
  };

  const isRunning = simState === "running";

  return (
    <div className="bottom-panel__simulation">
      <div className="bottom-panel__sim-header">
        <span className="bottom-panel__sim-status">
          Status: <strong>{simState}</strong>
          {simState === "completed" && lastResult && (
            <span style={{ marginLeft: 8, opacity: 0.7 }}>
              ({lastResult.analysis.type.toUpperCase()} — {lastResult.timeMs.toFixed(1)}ms)
            </span>
          )}
        </span>
        <span className="bottom-panel__sim-engine">
          Engine: {engineBackend === "ngspice-wasm" ? "ngspice WASM" : "Built-in Solver"}
        </span>
      </div>

      {/* Progress */}
      {progress && (
        <div className="bottom-panel__sim-progress">
          <div className="bottom-panel__sim-progress-bar">
            <div
              className="bottom-panel__sim-progress-fill"
              style={{ width: `${progress.percent * 100}%` }}
            />
          </div>
          <span className="bottom-panel__sim-progress-text">{progress.message}</span>
        </div>
      )}

      <div className="bottom-panel__sim-actions">
        {!isRunning ? (
          <button
            className="bottom-panel__sim-btn bottom-panel__sim-btn--primary"
            onClick={runSimulation}
            disabled={!spiceNetlistText}
            title={!spiceNetlistText ? "Load a netlist first (use Simulation Setup panel or demo)" : `Run ${analysisConfig.type.toUpperCase()} analysis`}
          >
            ▶ Run {analysisConfig.type.toUpperCase()}
          </button>
        ) : (
          <button className="bottom-panel__sim-btn bottom-panel__sim-btn--danger" onClick={abortSimulation}>
            ■ Abort
          </button>
        )}
        <button className="bottom-panel__sim-btn" onClick={generateDemoWaveform} disabled={isRunning}>
          Demo Waveform
        </button>
        <button className="bottom-panel__sim-btn" onClick={handleSweep} disabled={isRunning}>
          Parameter Sweep
        </button>
        <button className="bottom-panel__sim-btn" onClick={runCornerAnalysis} disabled={isRunning}>
          Corner Analysis
        </button>
      </div>

      {/* Last result summary */}
      {lastResult && simState === "completed" && (
        <div className="bottom-panel__sim-result">
          <table className="bottom-panel__sim-result-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Analysis</td>
                <td>{lastResult.analysis.type.toUpperCase()}</td>
              </tr>
              <tr>
                <td>Converged</td>
                <td style={{ color: lastResult.converged ? "#22c55e" : "#f59e0b" }}>
                  {lastResult.converged ? "Yes" : "No"}
                </td>
              </tr>
              <tr>
                <td>NR Iterations</td>
                <td>{lastResult.iterations}</td>
              </tr>
              <tr>
                <td>Signals</td>
                <td>{lastResult.waveform.signals.length}</td>
              </tr>
              <tr>
                <td>Data Points</td>
                <td>{lastResult.waveform.signals[0]?.data.length ?? 0}</td>
              </tr>
              <tr>
                <td>Time</td>
                <td>{lastResult.timeMs.toFixed(1)}ms</td>
              </tr>
              {lastResult.opPoint && Object.entries(lastResult.opPoint).slice(0, 6).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td>{v.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sweep results summary */}
      {sweep && (
        <div className="bottom-panel__sweep-summary">
          <div className="bottom-panel__sweep-title">Parameter Sweep — {sweep.results.length} configs</div>
          <div className="bottom-panel__sweep-params">
            {sweep.parameters.map((p) => (
              <span key={p.name} className="bottom-panel__sweep-param">
                {p.name}: [{p.values.join(", ")}] {p.unit}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Corner analysis summary */}
      {cornerAnalysis && (
        <div className="bottom-panel__corner-summary">
          <div className="bottom-panel__corner-title">Corner Analysis — {cornerAnalysis.results.length} corners</div>
          <table className="bottom-panel__corner-table">
            <thead>
              <tr>
                <th>Corner</th>
                <th>Temp</th>
                <th>VDD</th>
                <th>Delay</th>
                <th>Power</th>
              </tr>
            </thead>
            <tbody>
              {cornerAnalysis.results.map((r) => (
                <tr key={r.corner}>
                  <td><strong>{r.corner}</strong></td>
                  <td>{cornerAnalysis.corners.find((c) => c.name === r.corner)?.temperature}°C</td>
                  <td>{cornerAnalysis.corners.find((c) => c.name === r.corner)?.voltage}V</td>
                  <td>{(r.metrics.delay * 1e12).toFixed(1)}ps</td>
                  <td>{(r.metrics.power * 1e6).toFixed(1)}µW</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <div className="bottom-panel__sim-error">Error: {error}</div>
      )}
      {spiceOutput && (
        <pre className="bottom-panel__sim-output">{spiceOutput}</pre>
      )}
      {!spiceOutput && !error && !sweep && !cornerAnalysis && (
        <div className="bottom-panel__placeholder">
          Simulation output will appear here. Press <strong>F5</strong> to run simulation.
        </div>
      )}
    </div>
  );
}
