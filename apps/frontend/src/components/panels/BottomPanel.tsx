import { useSimStore } from "../../stores/simStore";
import { useRef, useEffect, useCallback } from "react";
import { LvsPanel } from "./LvsPanel";
import "./BottomPanel.css";

export function BottomPanel({ style }: { style?: React.CSSProperties }) {
  const activeTab = useSimStore((s) => s.activeTab);
  const setActiveTab = useSimStore((s) => s.setActiveTab);

  const tabs = [
    { id: "terminal" as const, label: "Terminal" },
    { id: "netlist" as const, label: "Netlist" },
    { id: "simulation" as const, label: "Simulation" },
    { id: "waveform" as const, label: "Waveform" },
    { id: "lvs" as const, label: "LVS" },
  ];

  return (
    <div className="bottom-panel" style={style}>
      <div className="bottom-panel__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`bottom-panel__tab ${activeTab === tab.id ? "bottom-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bottom-panel__content">
        {activeTab === "terminal" && <TerminalTab />}
        {activeTab === "netlist" && <NetlistTab />}
        {activeTab === "simulation" && <SimulationTab />}
        {activeTab === "waveform" && <WaveformTab />}
        {activeTab === "lvs" && <LvsPanel />}
      </div>
    </div>
  );
}

// ── Terminal Tab ───────────────────────────────────────────────────

function TerminalTab() {
  const lines = useSimStore((s) => s.terminalLines);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="bottom-panel__terminal" ref={scrollRef}>
      {lines.map((line, i) => (
        <div key={i} className="bottom-panel__terminal-line">
          {line || "\u00A0"}
        </div>
      ))}
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

// ── Waveform Tab ──────────────────────────────────────────────────

function WaveformTab() {
  const waveform = useSimStore((s) => s.waveform);
  const cursors = useSimStore((s) => s.cursors);
  const cursorMeasurements = useSimStore((s) => s.cursorMeasurements);
  const addCursor = useSimStore((s) => s.addCursor);
  const clearCursors = useSimStore((s) => s.clearCursors);
  const sweep = useSimStore((s) => s.sweep);
  const cornerAnalysis = useSimStore((s) => s.cornerAnalysis);
  const setActiveSweepIndex = useSimStore((s) => s.setActiveSweepIndex);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Background
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    const visibleSignals = waveform.signals.filter((s) => s.visible);
    if (visibleSignals.length === 0) return;

    const margin = { top: 30, right: 60, bottom: 30, left: 60 };
    const plotW = w - margin.left - margin.right;
    const plotH = h - margin.top - margin.bottom;
    const trackH = plotH / visibleSignals.length;

    // Time axis
    const tStart = waveform.timeRange.start;
    const tEnd = waveform.timeRange.end;
    const toScreenX = (t: number) => margin.left + ((t - tStart) / (tEnd - tStart)) * plotW;

    // Draw time grid
    const numGridLines = 10;
    const tStep = (tEnd - tStart) / numGridLines;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= numGridLines; i++) {
      const t = tStart + i * tStep;
      const x = toScreenX(t);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, h - margin.bottom);
      ctx.stroke();

      // Time labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(formatTime(t), x, h - margin.bottom + 14);
    }

    // Draw each signal track
    visibleSignals.forEach((signal, trackIdx) => {
      const trackTop = margin.top + trackIdx * trackH;
      const trackBottom = trackTop + trackH;

      // Track separator
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(margin.left, trackBottom);
      ctx.lineTo(w - margin.right, trackBottom);
      ctx.stroke();

      // Signal name label
      ctx.fillStyle = signal.color;
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(signal.name, margin.left - 6, trackTop + trackH / 2 + 3);

      // Compute value range
      let vMin = Infinity, vMax = -Infinity;
      for (const pt of signal.data) {
        if (pt.value < vMin) vMin = pt.value;
        if (pt.value > vMax) vMax = pt.value;
      }
      const vRange = vMax - vMin || 1;
      const padding = trackH * 0.1;
      const innerH = trackH - 2 * padding;

      const toScreenY = (v: number) =>
        trackBottom - padding - ((v - vMin) / vRange) * innerH;

      // Value labels
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${vMax.toFixed(2)} ${signal.unit}`, w - margin.right + 4, trackTop + padding + 6);
      ctx.fillText(`${vMin.toFixed(2)}`, w - margin.right + 4, trackBottom - padding);

      // Draw waveform
      ctx.strokeStyle = signal.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (const pt of signal.data) {
        const x = toScreenX(pt.time);
        const y = toScreenY(pt.value);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    });

    // Draw corner analysis overlay (all corner waveforms)
    if (cornerAnalysis) {
      for (const result of cornerAnalysis.results) {
        for (const sig of result.waveform.signals) {
          if (!sig.visible) continue;
          let vMin = Infinity, vMax = -Infinity;
          for (const pt of sig.data) {
            if (pt.value < vMin) vMin = pt.value;
            if (pt.value > vMax) vMax = pt.value;
          }
          const vRange = vMax - vMin || 1;
          const padY = plotH * 0.1;
          const innerH = plotH - 2 * padY;
          const toY = (v: number) => h - margin.bottom - padY - ((v - vMin) / vRange) * innerH;

          ctx.strokeStyle = sig.color;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          let started = false;
          for (const pt of sig.data) {
            const x = toScreenX(pt.time);
            const y = toY(pt.value);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
          }
          ctx.stroke();
          ctx.globalAlpha = 1.0;

          // Corner label
          ctx.fillStyle = sig.color;
          ctx.font = "8px 'JetBrains Mono', monospace";
          ctx.textAlign = "left";
          const lastPt = sig.data[sig.data.length - 1];
          ctx.fillText(result.corner, toScreenX(lastPt.time) + 4, toY(lastPt.value));
        }
      }
    }

    // Draw sweep overlay
    if (sweep && sweep.results.length > 1) {
      for (let si = 0; si < sweep.results.length; si++) {
        if (si === sweep.activeSweepIndex) continue;
        for (const sig of sweep.results[si].waveform.signals) {
          let vMin = Infinity, vMax = -Infinity;
          for (const pt of sig.data) {
            if (pt.value < vMin) vMin = pt.value;
            if (pt.value > vMax) vMax = pt.value;
          }
          const vRange = vMax - vMin || 1;
          const padY = plotH * 0.1;
          const innerH = plotH - 2 * padY;
          const toY = (v: number) => h - margin.bottom - padY - ((v - vMin) / vRange) * innerH;

          ctx.strokeStyle = sig.color;
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          let started = false;
          for (const pt of sig.data) {
            const x = toScreenX(pt.time);
            const y = toY(pt.value);
            if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
          }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1.0;
        }
      }
    }

    // Draw cursors
    for (const cursor of cursors) {
      const x = toScreenX(cursor.time);
      if (x < margin.left || x > w - margin.right) continue;

      ctx.strokeStyle = cursor.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, h - margin.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cursor label
      ctx.fillStyle = cursor.color;
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${cursor.label}: ${formatTime(cursor.time)}`, x, margin.top - 4);
    }

    // Draw delta between cursors
    if (cursors.length === 2) {
      const x1 = toScreenX(cursors[0].time);
      const x2 = toScreenX(cursors[1].time);
      const midX = (x1 + x2) / 2;
      const dt = Math.abs(cursors[1].time - cursors[0].time);
      const freq = dt > 0 ? 1 / dt : 0;

      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`Δt=${formatTime(dt)}  f=${formatFreq(freq)}`, midX, margin.top - 14);
    }

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    const titleParts = ["Waveform Viewer"];
    if (sweep) titleParts.push(`| Sweep: ${sweep.results[sweep.activeSweepIndex]?.label ?? ""}`);
    if (cornerAnalysis) titleParts.push(`| ${cornerAnalysis.results.length} Corners`);
    ctx.fillText(titleParts.join(" "), margin.left, 16);

  }, [waveform, cursors, cornerAnalysis, sweep]);

  // Handle click to place cursor
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const margin = { left: 60, right: 60 };
    const plotW = w - margin.left - margin.right;
    const frac = (x - margin.left) / plotW;
    if (frac < 0 || frac > 1) return;

    const t = waveform.timeRange.start + frac * (waveform.timeRange.end - waveform.timeRange.start);
    addCursor(t);
  }, [waveform, addCursor]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      render();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [render]);

  useEffect(() => {
    render();
  }, [render]);

  if (!waveform) {
    return (
      <div className="bottom-panel__placeholder">
        No waveform data. Run a simulation or click <strong>Demo Waveform</strong> in the Simulation tab.
      </div>
    );
  }

  return (
    <div className="bottom-panel__waveform" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="bottom-panel__waveform-canvas"
        onClick={handleCanvasClick}
        title="Click to place cursor (max 2)"
      />
      {/* Sweep selector */}
      {sweep && sweep.results.length > 1 && (
        <div className="bottom-panel__sweep-bar">
          {sweep.results.map((r, i) => (
            <button
              key={i}
              className={`bottom-panel__sweep-chip ${i === sweep.activeSweepIndex ? "bottom-panel__sweep-chip--active" : ""}`}
              onClick={() => setActiveSweepIndex(i)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {/* Cursor controls + measurements */}
      {cursors.length > 0 && (
        <div className="bottom-panel__cursor-bar">
          <button className="bottom-panel__cursor-clear" onClick={clearCursors}>Clear Cursors</button>
          {cursorMeasurements.length > 0 && (
            <div className="bottom-panel__cursor-measurements">
              {cursorMeasurements.map((m) => (
                <span key={m.signalName} className="bottom-panel__cursor-meas">
                  {m.signalName}: Δ={m.delta.toFixed(3)}{" "}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (seconds === 0) return "0";
  if (seconds >= 1e-3) return `${(seconds * 1e3).toFixed(1)}ms`;
  if (seconds >= 1e-6) return `${(seconds * 1e6).toFixed(1)}µs`;
  if (seconds >= 1e-9) return `${(seconds * 1e9).toFixed(1)}ns`;
  if (seconds >= 1e-12) return `${(seconds * 1e12).toFixed(1)}ps`;
  return `${seconds.toExponential(1)}s`;
}

function formatFreq(hz: number): string {
  if (hz === 0) return "0";
  if (hz >= 1e12) return `${(hz / 1e12).toFixed(1)}THz`;
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(1)}GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(1)}MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)}kHz`;
  return `${hz.toFixed(1)}Hz`;
}
