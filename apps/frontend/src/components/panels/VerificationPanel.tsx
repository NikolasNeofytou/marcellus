import { useState, useRef, useEffect } from "react";
import { useIncrLvsStore, type SnapshotComparison } from "../../stores/incrLvsStore";
import { useCrossProbeStore } from "../../stores/crossProbeStore";
import "./VerificationPanel.css";

// ══════════════════════════════════════════════════════════════════════
// Connectivity Graph Canvas (Graphical LVS Debug)
// ══════════════════════════════════════════════════════════════════════

function ConnectivityGraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graph = useIncrLvsStore((s) => s.connectivityGraph);
  const selectedNode = useIncrLvsStore((s) => s.selectedGraphNode);
  const selectGraphNode = useIncrLvsStore((s) => s.selectGraphNode);
  const setZoomTarget = useIncrLvsStore((s) => s.setZoomTarget);
  const hoverHighlight = useCrossProbeStore((s) => s.hoverHighlight);
  const clearHover = useCrossProbeStore((s) => s.clearHover);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, w, h);

    // Draw edges
    for (const edge of graph.edges) {
      const from = graph.nodes.find((n) => n.id === edge.from);
      const to = graph.nodes.find((n) => n.id === edge.to);
      if (!from || !to) continue;

      ctx.strokeStyle = edge.status === "error" ? "#ff4444" : "#555";
      ctx.lineWidth = edge.status === "error" ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      // Edge label
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      ctx.fillStyle = edge.status === "error" ? "#ff6666" : "#666";
      ctx.font = "8px monospace";
      ctx.textAlign = "center";
      ctx.fillText(edge.label, mx, my - 4);
    }

    // Draw nodes
    const statusColors: Record<string, string> = {
      match: "#3cc864",
      mismatch: "#ff4444",
      extra: "#ff9900",
      missing: "#ff6699",
    };

    for (const node of graph.nodes) {
      const isSelected = node.id === selectedNode;
      const radius = node.type === "device" ? 18 : 14;

      // Node circle
      ctx.fillStyle = isSelected ? "#007acc" : (statusColors[node.status] ?? "#555");
      ctx.globalAlpha = isSelected ? 1 : 0.8;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected ? "#fff" : "#333";
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Icon/type indicator
      ctx.fillStyle = "#fff";
      ctx.font = node.type === "device" ? "bold 9px monospace" : "8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.type === "device" ? "D" : "N", node.x, node.y);

      // Label
      ctx.fillStyle = "#ccc";
      ctx.font = "9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.label, node.x, node.y + radius + 3);
    }
  }, [graph, selectedNode]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!graph) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Hit test
    for (const node of graph.nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy < 20 * 20) {
        selectGraphNode(node.id === selectedNode ? null : node.id);
        if (node.geometryIndices.length > 0) {
          hoverHighlight(node.geometryIndices, node.label);
          setZoomTarget(node.geometryIndices, node.label);
        }
        return;
      }
    }
    selectGraphNode(null);
    clearHover();
  };

  if (!graph) {
    return (
      <div className="veri-empty">
        <p>Run LVS to see connectivity graph.</p>
      </div>
    );
  }

  return (
    <div className="veri-graph">
      <canvas
        ref={canvasRef}
        width={360}
        height={Math.max(200, graph.nodes.length * 30)}
        className="veri-graph-canvas"
        onClick={handleClick}
      />
      {selectedNode && (
        <div className="veri-graph-info">
          {(() => {
            const node = graph.nodes.find((n) => n.id === selectedNode);
            if (!node) return null;
            return (
              <>
                <span className={`veri-badge veri-badge--${node.status}`}>
                  {node.status.toUpperCase()}
                </span>
                <span className="veri-graph-info__label">{node.label}</span>
                <span className="veri-graph-info__type">{node.type}</span>
                {node.geometryIndices.length > 0 && (
                  <button
                    className="veri-zoom-btn"
                    onClick={() => setZoomTarget(node.geometryIndices, node.label)}
                  >
                    Zoom to
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Parasitic Overlay Controls
// ══════════════════════════════════════════════════════════════════════

function ParasiticOverlayTab() {
  const config = useIncrLvsStore((s) => s.heatmapConfig);
  const updateConfig = useIncrLvsStore((s) => s.updateHeatmapConfig);
  const overlayVisible = useIncrLvsStore((s) => s.overlayVisible);
  const toggleOverlay = useIncrLvsStore((s) => s.toggleOverlay);
  const overlayItems = useIncrLvsStore((s) => s.overlayItems);
  const parasiticElements = useIncrLvsStore((s) => s.parasiticElements);

  const totalR = parasiticElements
    .filter((p) => p.type === "resistor")
    .reduce((s, p) => s + p.value, 0);
  const totalC = parasiticElements
    .filter((p) => p.type === "capacitor")
    .reduce((s, p) => s + p.value * 1e15, 0);

  return (
    <div className="veri-parasitic">
      <div className="veri-parasitic__toggle">
        <label>
          <input type="checkbox" checked={overlayVisible} onChange={toggleOverlay} />
          Show Parasitic Overlay
        </label>
      </div>

      {parasiticElements.length > 0 && (
        <div className="veri-parasitic__summary">
          <div className="veri-stat">
            <span className="veri-stat__label">Elements</span>
            <span className="veri-stat__value">{parasiticElements.length}</span>
          </div>
          <div className="veri-stat">
            <span className="veri-stat__label">Total R</span>
            <span className="veri-stat__value">{totalR.toFixed(1)} Ω</span>
          </div>
          <div className="veri-stat">
            <span className="veri-stat__label">Total C</span>
            <span className="veri-stat__value">{totalC.toFixed(2)} fF</span>
          </div>
          <div className="veri-stat">
            <span className="veri-stat__label">Overlay Items</span>
            <span className="veri-stat__value">{overlayItems.length}</span>
          </div>
        </div>
      )}

      <h4>Filters</h4>
      <div className="veri-field">
        <label>
          <input
            type="checkbox"
            checked={config.showResistance}
            onChange={(e) => updateConfig({ showResistance: e.target.checked })}
          /> Resistance
        </label>
      </div>
      <div className="veri-field">
        <label>
          <input
            type="checkbox"
            checked={config.showCapacitance}
            onChange={(e) => updateConfig({ showCapacitance: e.target.checked })}
          /> Capacitance
        </label>
      </div>

      <h4>Display</h4>
      <div className="veri-field">
        <label>Mode</label>
        <select
          value={config.displayMode}
          onChange={(e) => updateConfig({ displayMode: e.target.value as typeof config.displayMode })}
        >
          <option value="labels">Labels Only</option>
          <option value="heatmap">Heatmap Only</option>
          <option value="both">Labels + Heatmap</option>
        </select>
      </div>
      <div className="veri-field">
        <label>Opacity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={config.opacity}
          onChange={(e) => updateConfig({ opacity: parseFloat(e.target.value) })}
        />
        <span className="veri-field__val">{(config.opacity * 100).toFixed(0)}%</span>
      </div>

      <h4>Normalization</h4>
      <div className="veri-field">
        <label>R max (Ω)</label>
        <input
          type="number"
          value={config.rMax}
          min={1}
          onChange={(e) => updateConfig({ rMax: parseFloat(e.target.value) || 100 })}
        />
      </div>
      <div className="veri-field">
        <label>C max (fF)</label>
        <input
          type="number"
          value={config.cMax}
          min={0.1}
          step={0.1}
          onChange={(e) => updateConfig({ cMax: parseFloat(e.target.value) || 10 })}
        />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Pre/Post Comparison
// ══════════════════════════════════════════════════════════════════════

function DeltaValue({ value, unit, invert }: { value: number; unit: string; invert?: boolean }) {
  const improved = invert ? value > 0 : value < 0;
  const className = value === 0
    ? "veri-delta--neutral"
    : improved
    ? "veri-delta--improved"
    : "veri-delta--degraded";

  return (
    <span className={`veri-delta ${className}`}>
      {value > 0 ? "+" : ""}{value.toFixed(2)} {unit}
    </span>
  );
}

function ComparisonView({ comp }: { comp: SnapshotComparison }) {
  return (
    <div className="veri-comparison">
      <div className="veri-comparison__header">
        <span className="veri-comparison__name">{comp.before.name}</span>
        <span className="veri-comparison__arrow">→</span>
        <span className="veri-comparison__name">{comp.after.name}</span>
      </div>

      <div className="veri-comparison__grid">
        <div className="veri-comparison__item">
          <span>Matched Devices</span>
          <DeltaValue value={comp.deltaMatchedDevices} unit="" invert />
        </div>
        <div className="veri-comparison__item">
          <span>Errors</span>
          <DeltaValue value={comp.deltaErrors} unit="" />
        </div>
        <div className="veri-comparison__item">
          <span>Total R</span>
          <DeltaValue value={comp.deltaTotalR} unit="Ω" />
        </div>
        <div className="veri-comparison__item">
          <span>Total C</span>
          <DeltaValue value={comp.deltaTotalC} unit="fF" />
        </div>
      </div>

      {comp.newErrors.length > 0 && (
        <div className="veri-comparison__section">
          <h5>New Errors</h5>
          {comp.newErrors.map((err: string) => (
            <div key={err} className="veri-comparison__error veri-comparison__error--new">
              + {err}
            </div>
          ))}
        </div>
      )}

      {comp.fixedErrors.length > 0 && (
        <div className="veri-comparison__section">
          <h5>Fixed</h5>
          {comp.fixedErrors.map((err: string) => (
            <div key={err} className="veri-comparison__error veri-comparison__error--fixed">
              ✓ {err}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrePostTab() {
  const snapshots = useIncrLvsStore((s) => s.snapshots);
  const activeComparison = useIncrLvsStore((s) => s.activeComparison);
  const takeSnapshot = useIncrLvsStore((s) => s.takeSnapshot);
  const compareSnapshots = useIncrLvsStore((s) => s.compareSnapshots);
  const deleteSnapshot = useIncrLvsStore((s) => s.deleteSnapshot);
  const clearComparison = useIncrLvsStore((s) => s.clearComparison);
  const lvsResult = useCrossProbeStore((s) => s.lvsView.result);
  const parasitics = useIncrLvsStore((s) => s.parasiticElements);

  const [snapName, setSnapName] = useState("");
  const [beforeIdx, setBeforeIdx] = useState(0);
  const [afterIdx, setAfterIdx] = useState(0);

  const handleTakeSnapshot = () => {
    const name = snapName.trim() || `Snapshot ${snapshots.length + 1}`;
    takeSnapshot(name, lvsResult, parasitics);
    setSnapName("");
  };

  return (
    <div className="veri-prepost">
      <h4>Take Snapshot</h4>
      <div className="veri-field">
        <input
          type="text"
          value={snapName}
          onChange={(e) => setSnapName(e.target.value)}
          placeholder="Snapshot name..."
          className="veri-text-input"
        />
        <button className="veri-btn" onClick={handleTakeSnapshot}>
          📸 Snapshot
        </button>
      </div>

      {snapshots.length > 0 && (
        <>
          <h4>Snapshots ({snapshots.length})</h4>
          <div className="veri-snapshots">
            {snapshots.map((s, i) => (
              <div key={i} className="veri-snapshot">
                <span className="veri-snapshot__name">{s.name}</span>
                <span className="veri-snapshot__time">
                  {new Date(s.timestamp).toLocaleTimeString()}
                </span>
                <span className="veri-snapshot__stats">
                  {s.stats.matchedDevices}/{s.stats.deviceCount} dev
                  {s.stats.errors > 0 && `, ${s.stats.errors} err`}
                </span>
                <button
                  className="veri-btn veri-btn--small veri-btn--danger"
                  onClick={() => deleteSnapshot(i)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {snapshots.length >= 2 && (
        <>
          <h4>Compare</h4>
          <div className="veri-compare-controls">
            <div className="veri-field">
              <label>Before</label>
              <select value={beforeIdx} onChange={(e) => setBeforeIdx(parseInt(e.target.value))}>
                {snapshots.map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="veri-field">
              <label>After</label>
              <select value={afterIdx} onChange={(e) => setAfterIdx(parseInt(e.target.value))}>
                {snapshots.map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
            </div>
            <button className="veri-btn" onClick={() => compareSnapshots(beforeIdx, afterIdx)}>
              Compare
            </button>
            {activeComparison && (
              <button className="veri-btn veri-btn--small" onClick={clearComparison}>
                Clear
              </button>
            )}
          </div>
        </>
      )}

      {activeComparison && <ComparisonView comp={activeComparison} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Incremental LVS Status
// ══════════════════════════════════════════════════════════════════════

function IncrLvsStatus() {
  const runState = useIncrLvsStore((s) => s.runState);
  const isDirty = useIncrLvsStore((s) => s.isDirty);
  const dirtyCount = useIncrLvsStore((s) => s.dirtyIndices.size);
  const geoVersion = useIncrLvsStore((s) => s.geometryVersion);
  const lastChecked = useIncrLvsStore((s) => s.lastCheckedVersion);

  const dirty = isDirty();

  return (
    <div className="veri-incr-status">
      <div className="veri-stat">
        <span className="veri-stat__label">State</span>
        <span className={`veri-stat__value veri-stat__value--${runState}`}>{runState}</span>
      </div>
      <div className="veri-stat">
        <span className="veri-stat__label">Dirty</span>
        <span className={`veri-stat__value ${dirty ? "veri-stat__value--warn" : ""}`}>
          {dirty ? `Yes (${dirtyCount} geoms)` : "No"}
        </span>
      </div>
      <div className="veri-stat">
        <span className="veri-stat__label">Version</span>
        <span className="veri-stat__value">{geoVersion} (checked: {lastChecked})</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Main Verification Panel
// ══════════════════════════════════════════════════════════════════════

type VeriTab = "incr-lvs" | "graph" | "parasitics" | "pre-post";

export function VerificationPanel() {
  const [activeTab, setActiveTab] = useState<VeriTab>("incr-lvs");

  const tabs: { id: VeriTab; label: string; icon: string }[] = [
    { id: "incr-lvs", label: "Incr. LVS", icon: "⟳" },
    { id: "graph", label: "Graph Debug", icon: "◎" },
    { id: "parasitics", label: "Parasitics", icon: "🔥" },
    { id: "pre-post", label: "Pre/Post", icon: "⇔" },
  ];

  return (
    <div className="verification-panel">
      <div className="veri-header">
        <h3>Verification</h3>
      </div>

      <div className="veri-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`veri-tab-btn ${activeTab === t.id ? "veri-tab-btn--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
            title={t.label}
          >
            <span className="veri-tab-icon">{t.icon}</span>
            <span className="veri-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="veri-content">
        {activeTab === "incr-lvs" && <IncrLvsStatus />}
        {activeTab === "graph" && <ConnectivityGraphView />}
        {activeTab === "parasitics" && <ParasiticOverlayTab />}
        {activeTab === "pre-post" && <PrePostTab />}
      </div>
    </div>
  );
}
