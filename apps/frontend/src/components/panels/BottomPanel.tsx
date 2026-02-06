import { useSimStore } from "../../stores/simStore";
import { useRef, useEffect, useCallback } from "react";
import "./BottomPanel.css";

export function BottomPanel() {
  const activeTab = useSimStore((s) => s.activeTab);
  const setActiveTab = useSimStore((s) => s.setActiveTab);

  const tabs = [
    { id: "terminal" as const, label: "Terminal" },
    { id: "netlist" as const, label: "Netlist" },
    { id: "simulation" as const, label: "Simulation" },
    { id: "waveform" as const, label: "Waveform" },
  ];

  return (
    <div className="bottom-panel">
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

  return (
    <div className="bottom-panel__simulation">
      <div className="bottom-panel__sim-header">
        <span className="bottom-panel__sim-status">
          Status: <strong>{simState}</strong>
        </span>
        <button className="bottom-panel__sim-btn" onClick={generateDemoWaveform}>
          Generate Demo Waveform
        </button>
      </div>
      {error && (
        <div className="bottom-panel__sim-error">Error: {error}</div>
      )}
      {spiceOutput && (
        <pre className="bottom-panel__sim-output">{spiceOutput}</pre>
      )}
      {!spiceOutput && !error && (
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

    // Title
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("Waveform Viewer", margin.left, 16);

  }, [waveform]);

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
        No waveform data. Run a simulation or click <strong>Generate Demo Waveform</strong> in the Simulation tab.
      </div>
    );
  }

  return (
    <div className="bottom-panel__waveform" ref={containerRef}>
      <canvas ref={canvasRef} className="bottom-panel__waveform-canvas" />
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
