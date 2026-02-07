import { useState, useRef, useEffect, useCallback } from "react";
import {
  calculateWireRC,
  calculateEM,
  calculateMatching,
  calculateGmId,
  generateMosfetCurves,
  type WireRCParams,
  type WireRCResult,
  type EMParams,
  type EMResult,
  type MatchingParams,
  type MatchingResult,
  type GmIdParams,
  type GmIdResult,
  type MosfetViewerParams,
  type MosfetCurvePoint,
} from "../../engines/calculators";
import "./CalculatorsPanel.css";

// ── Shared helpers ──

function NumInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="calc-field">
      <label>{label}{unit ? ` (${unit})` : ""}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 0.01}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function ResultRow({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="calc-result-row">
      <span className="calc-result-label">{label}</span>
      <span className="calc-result-value">
        {typeof value === "number" ? value.toPrecision(4) : value}
        {unit ? <span className="calc-result-unit"> {unit}</span> : null}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Wire R/C Calculator
// ══════════════════════════════════════════════════════════════════════

function WireRCTab() {
  const [params, setParams] = useState<WireRCParams>({
    length: 100,
    width: 0.28,
    rSheet: 0.125,
    cPerArea: 0.038,
    cFringe: 0.04,
    viaCount: 2,
    rVia: 4.5,
  });
  const [result, setResult] = useState<WireRCResult | null>(null);

  const update = <K extends keyof WireRCParams>(k: K, v: WireRCParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const handleCalc = () => setResult(calculateWireRC(params));

  return (
    <div className="calc-tab">
      <p className="calc-desc">
        Calculate wire resistance, capacitance, and RC delay from metal geometry and PDK parameters.
      </p>
      <NumInput label="Length" value={params.length} onChange={(v) => update("length", v)} unit="µm" min={0} />
      <NumInput label="Width" value={params.width} onChange={(v) => update("width", v)} unit="µm" min={0.01} />
      <NumInput label="Rsheet" value={params.rSheet} onChange={(v) => update("rSheet", v)} unit="Ω/□" min={0} />
      <NumInput label="C area" value={params.cPerArea} onChange={(v) => update("cPerArea", v)} unit="fF/µm²" min={0} />
      <NumInput label="C fringe" value={params.cFringe} onChange={(v) => update("cFringe", v)} unit="fF/µm" min={0} />
      <NumInput label="Via Count" value={params.viaCount} onChange={(v) => update("viaCount", Math.max(0, Math.round(v)))} step={1} min={0} />
      <NumInput label="R via" value={params.rVia} onChange={(v) => update("rVia", v)} unit="Ω" min={0} />

      <button className="calc-btn" onClick={handleCalc}>Calculate</button>

      {result && (
        <div className="calc-results">
          <ResultRow label="Wire R" value={result.breakdown.rWire} unit="Ω" />
          <ResultRow label="Via R" value={result.viaResistance} unit="Ω" />
          <ResultRow label="Total R" value={result.resistance} unit="Ω" />
          <ResultRow label="C (area)" value={result.breakdown.cArea} unit="fF" />
          <ResultRow label="C (fringe)" value={result.breakdown.cFringe} unit="fF" />
          <ResultRow label="Total C" value={result.capacitance} unit="fF" />
          <ResultRow label="RC Delay" value={result.rcDelay} unit="ps" />
          <ResultRow label="Elmore Delay" value={result.elmoreDelay} unit="ps" />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// EM Calculator
// ══════════════════════════════════════════════════════════════════════

function EMTab() {
  const [params, setParams] = useState<EMParams>({
    width: 0.28,
    thickness: 0.36,
    current: 1.0,
    jMax: 2.0,
    temperature: 85,
    signalType: "dc",
    dutyCycle: 0.5,
  });
  const [result, setResult] = useState<EMResult | null>(null);

  const update = <K extends keyof EMParams>(k: K, v: EMParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const handleCalc = () => setResult(calculateEM(params));

  return (
    <div className="calc-tab">
      <p className="calc-desc">
        Check electromigration current density limits for metal interconnects. Accounts for temperature and AC derating.
      </p>
      <NumInput label="Width" value={params.width} onChange={(v) => update("width", v)} unit="µm" min={0.01} />
      <NumInput label="Thickness" value={params.thickness} onChange={(v) => update("thickness", v)} unit="µm" min={0.01} />
      <NumInput label="Current" value={params.current} onChange={(v) => update("current", v)} unit="mA" />
      <NumInput label="J max" value={params.jMax} onChange={(v) => update("jMax", v)} unit="mA/µm²" min={0} />
      <NumInput label="Temperature" value={params.temperature} onChange={(v) => update("temperature", v)} unit="°C" />

      <div className="calc-field">
        <label>Signal Type</label>
        <select value={params.signalType} onChange={(e) => update("signalType", e.target.value as "dc" | "ac")}>
          <option value="dc">DC</option>
          <option value="ac">AC</option>
        </select>
      </div>

      {params.signalType === "ac" && (
        <NumInput label="Duty Cycle" value={params.dutyCycle} onChange={(v) => update("dutyCycle", v)} min={0.01} max={1} step={0.05} />
      )}

      <button className="calc-btn" onClick={handleCalc}>Calculate</button>

      {result && (
        <div className={`calc-results ${result.violation ? "calc-results--violation" : "calc-results--ok"}`}>
          <div className={`calc-badge ${result.violation ? "calc-badge--fail" : "calc-badge--pass"}`}>
            {result.violation ? "⚠ EM VIOLATION" : "✓ EM OK"}
          </div>
          <ResultRow label="Cross Section" value={result.crossSection} unit="µm²" />
          <ResultRow label="J actual" value={result.currentDensity} unit="mA/µm²" />
          <ResultRow label="J max (eff)" value={result.effectiveJMax} unit="mA/µm²" />
          <ResultRow label="I max" value={result.maxCurrent} unit="mA" />
          <ResultRow label="Margin" value={result.margin.toFixed(1)} unit="%" />
          <ResultRow label="Min Width" value={result.minWidth} unit="µm" />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Matching Estimator
// ══════════════════════════════════════════════════════════════════════

function MatchingTab() {
  const [params, setParams] = useState<MatchingParams>({
    avt: 5.0,
    aBeta: 1.5,
    width: 1.0,
    length: 0.5,
    multiplier: 1,
    distance: 10,
    gradientCoeff: 0.05,
  });
  const [result, setResult] = useState<MatchingResult | null>(null);

  const update = <K extends keyof MatchingParams>(k: K, v: MatchingParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const handleCalc = () => setResult(calculateMatching(params));

  return (
    <div className="calc-tab">
      <p className="calc-desc">
        Estimate device mismatch using the Pelgrom model. Computes σ(ΔVt) and σ(Δβ/β) for given device dimensions.
      </p>
      <NumInput label="Avt" value={params.avt} onChange={(v) => update("avt", v)} unit="mV·µm" min={0} />
      <NumInput label="Aβ" value={params.aBeta} onChange={(v) => update("aBeta", v)} unit="%·µm" min={0} />
      <NumInput label="Width W" value={params.width} onChange={(v) => update("width", v)} unit="µm" min={0.01} />
      <NumInput label="Length L" value={params.length} onChange={(v) => update("length", v)} unit="µm" min={0.01} />
      <NumInput label="Multiplier M" value={params.multiplier} onChange={(v) => update("multiplier", Math.max(1, Math.round(v)))} min={1} step={1} />
      <NumInput label="Distance" value={params.distance} onChange={(v) => update("distance", v)} unit="µm" min={0} />
      <NumInput label="Gradient" value={params.gradientCoeff} onChange={(v) => update("gradientCoeff", v)} unit="mV/µm" min={0} />

      <button className="calc-btn" onClick={handleCalc}>Calculate</button>

      {result && (
        <div className="calc-results">
          <ResultRow label="σ(ΔVt)" value={result.sigmaVt} unit="mV" />
          <ResultRow label="3σ(ΔVt)" value={result.threeSignaVt} unit="mV" />
          <ResultRow label="σ(Δβ/β)" value={result.sigmaBeta} unit="%" />
          <ResultRow label="3σ(Δβ/β)" value={result.threeSigmaBeta} unit="%" />
          <ResultRow label="Gradient ΔVt" value={result.gradientOffset} unit="mV" />
          <ResultRow label="Total ΔVt" value={result.totalVtMismatch} unit="mV" />
          <ResultRow label="Eff. Area" value={result.effectiveArea} unit="µm²" />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// gm/Id Sizer
// ══════════════════════════════════════════════════════════════════════

function GmIdTab() {
  const [params, setParams] = useState<GmIdParams>({
    gmOverId: 15,
    targetGm: 100,
    currentBudget: 50,
    cox: 8.6,
    mobility: 450,
    vth: 0.45,
    vdd: 1.8,
    deviceType: "nmos",
    lMin: 0.13,
  });
  const [result, setResult] = useState<GmIdResult | null>(null);

  const update = <K extends keyof GmIdParams>(k: K, v: GmIdParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const handleCalc = () => setResult(calculateGmId(params));

  return (
    <div className="calc-tab">
      <p className="calc-desc">
        Size a MOSFET using the gm/Id methodology. Set your target transconductance and gm/Id operating point to get W/L.
      </p>
      <NumInput label="gm/Id" value={params.gmOverId} onChange={(v) => update("gmOverId", v)} unit="V⁻¹" min={1} max={40} />
      <NumInput label="Target gm" value={params.targetGm} onChange={(v) => update("targetGm", v)} unit="µS" min={0.1} />
      <NumInput label="I budget" value={params.currentBudget} onChange={(v) => update("currentBudget", v)} unit="µA" />
      <NumInput label="Cox" value={params.cox} onChange={(v) => update("cox", v)} unit="fF/µm²" min={0.1} />
      <NumInput label="µ" value={params.mobility} onChange={(v) => update("mobility", v)} unit="cm²/Vs" min={1} />
      <NumInput label="Vth" value={params.vth} onChange={(v) => update("vth", v)} unit="V" />
      <NumInput label="Vdd" value={params.vdd} onChange={(v) => update("vdd", v)} unit="V" min={0.1} />
      <NumInput label="L min" value={params.lMin} onChange={(v) => update("lMin", v)} unit="µm" min={0.01} />

      <div className="calc-field">
        <label>Device</label>
        <select value={params.deviceType} onChange={(e) => update("deviceType", e.target.value as "nmos" | "pmos")}>
          <option value="nmos">NMOS</option>
          <option value="pmos">PMOS</option>
        </select>
      </div>

      <button className="calc-btn" onClick={handleCalc}>Size Device</button>

      {result && (
        <div className="calc-results">
          <div className="calc-badge calc-badge--info">{result.region.replace("-", " ").toUpperCase()}</div>
          <ResultRow label="Id" value={result.drainCurrent} unit="µA" />
          <ResultRow label="Vov" value={(result.vov * 1000).toFixed(0)} unit="mV" />
          <ResultRow label="Vgs" value={result.vgs.toFixed(3)} unit="V" />
          <ResultRow label="W/L" value={result.wOverL} />
          <ResultRow label="W" value={result.width} unit="µm" />
          <ResultRow label="L" value={result.length} unit="µm" />
          <ResultRow label="fT" value={result.fT} unit="GHz" />
          <ResultRow label="ro" value={result.ro} unit="kΩ" />
          <ResultRow label="gm·ro" value={result.intrinsicGain} />
          <ResultRow label="Power" value={result.power} unit="µW" />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MOSFET Parameter Viewer (with Canvas chart)
// ══════════════════════════════════════════════════════════════════════

function MosfetViewerTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [params, setParams] = useState<MosfetViewerParams>({
    cox: 8.6,
    mobility: 450,
    vth: 0.45,
    width: 10,
    length: 0.13,
    lambda: 0.1,
    subthresholdN: 1.5,
    thermalVoltage: 26,
  });
  const [curveData, setCurveData] = useState<MosfetCurvePoint[]>([]);
  const [chartType, setChartType] = useState<"id-vds" | "id-vgs" | "gm-vgs">("id-vds");

  const update = <K extends keyof MosfetViewerParams>(k: K, v: MosfetViewerParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const handleGenerate = useCallback(() => {
    const vgsValues = [0.3, 0.45, 0.6, 0.8, 1.0, 1.2, 1.5, 1.8];
    const data = generateMosfetCurves(params, vgsValues, 1.8, 50);
    setCurveData(data);
  }, [params]);

  // Draw chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || curveData.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const margin = { top: 20, right: 20, bottom: 35, left: 55 };
    const pw = w - margin.left - margin.right;
    const ph = h - margin.top - margin.bottom;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, w, h);

    // Group data by Vgs
    const groups = new Map<number, MosfetCurvePoint[]>();
    for (const pt of curveData) {
      if (!groups.has(pt.vgs)) groups.set(pt.vgs, []);
      groups.get(pt.vgs)!.push(pt);
    }

    // Determine axes based on chart type
    let xLabel: string, yLabel: string;
    let getX: (p: MosfetCurvePoint) => number;
    let getY: (p: MosfetCurvePoint) => number;
    let xMax: number, yMax: number;

    if (chartType === "id-vds") {
      xLabel = "Vds (V)";
      yLabel = "Id (µA)";
      getX = (p) => p.vds;
      getY = (p) => p.id;
      xMax = 1.8;
      yMax = Math.max(...curveData.map((p) => p.id), 1);
    } else if (chartType === "id-vgs") {
      xLabel = "Vgs (V)";
      yLabel = "Id (µA)";
      getX = (p) => p.vgs;
      getY = (p) => p.id;
      xMax = 1.8;
      yMax = Math.max(...curveData.map((p) => p.id), 1);
    } else {
      xLabel = "Vgs (V)";
      yLabel = "gm (µS)";
      getX = (p) => p.vgs;
      getY = (p) => p.gm;
      xMax = 1.8;
      yMax = Math.max(...curveData.map((p) => p.gm), 1);
    }

    // Grid
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const x = margin.left + (i / 5) * pw;
      const y = margin.top + (i / 5) * ph;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + ph);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + pw, y);
      ctx.stroke();
    }

    // Axes labels
    ctx.fillStyle = "#888";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(xLabel, margin.left + pw / 2, h - 5);

    ctx.save();
    ctx.translate(12, margin.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Tick labels
    ctx.fillStyle = "#666";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i <= 5; i++) {
      const v = (i / 5) * xMax;
      ctx.fillText(v.toFixed(1), margin.left + (i / 5) * pw, margin.top + ph + 15);
    }
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const v = ((5 - i) / 5) * yMax;
      ctx.fillText(v.toFixed(0), margin.left - 5, margin.top + (i / 5) * ph + 4);
    }

    // Curves
    const colors = ["#ff6384", "#36a2eb", "#ffce56", "#4bc0c0", "#9966ff", "#ff9f40", "#c9cbcf", "#7fc97f"];
    let ci = 0;
    for (const [vgs, pts] of groups.entries()) {
      const sorted = [...pts].sort((a, b) => getX(a) - getX(b));

      ctx.strokeStyle = colors[ci % colors.length];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (const pt of sorted) {
        const x = margin.left + (getX(pt) / xMax) * pw;
        const y = margin.top + ph - (getY(pt) / yMax) * ph;
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Label
      const last = sorted[sorted.length - 1];
      if (last && chartType === "id-vds") {
        const lx = margin.left + (getX(last) / xMax) * pw + 2;
        const ly = margin.top + ph - (getY(last) / yMax) * ph;
        ctx.fillStyle = colors[ci % colors.length];
        ctx.font = "8px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`${vgs.toFixed(1)}V`, lx, ly);
      }

      ci++;
    }
  }, [curveData, chartType]);

  return (
    <div className="calc-tab">
      <p className="calc-desc">
        Interactive MOSFET I-V characteristic viewer. Generates Id vs Vds, Id vs Vgs, and gm vs Vgs curves.
      </p>

      <NumInput label="Cox" value={params.cox} onChange={(v) => update("cox", v)} unit="fF/µm²" min={0.1} />
      <NumInput label="µ" value={params.mobility} onChange={(v) => update("mobility", v)} unit="cm²/Vs" min={1} />
      <NumInput label="Vth" value={params.vth} onChange={(v) => update("vth", v)} unit="V" />
      <NumInput label="W" value={params.width} onChange={(v) => update("width", v)} unit="µm" min={0.01} />
      <NumInput label="L" value={params.length} onChange={(v) => update("length", v)} unit="µm" min={0.01} />
      <NumInput label="λ" value={params.lambda} onChange={(v) => update("lambda", v)} unit="1/V" min={0} />
      <NumInput label="n (subth)" value={params.subthresholdN} onChange={(v) => update("subthresholdN", v)} min={1} max={3} />

      <div className="calc-field">
        <label>Chart</label>
        <select value={chartType} onChange={(e) => setChartType(e.target.value as typeof chartType)}>
          <option value="id-vds">Id vs Vds</option>
          <option value="id-vgs">Id vs Vgs</option>
          <option value="gm-vgs">gm vs Vgs</option>
        </select>
      </div>

      <button className="calc-btn" onClick={handleGenerate}>Generate Curves</button>

      <canvas
        ref={canvasRef}
        width={360}
        height={240}
        className="calc-canvas"
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Main Panel
// ══════════════════════════════════════════════════════════════════════

type CalcTabId = "wire-rc" | "em" | "matching" | "gm-id" | "mosfet-viewer";

export function CalculatorsPanel() {
  const [activeTab, setActiveTab] = useState<CalcTabId>("wire-rc");

  const tabs: { id: CalcTabId; label: string; icon: string }[] = [
    { id: "wire-rc", label: "Wire R/C", icon: "⏛" },
    { id: "em", label: "EM", icon: "⚡" },
    { id: "matching", label: "Matching", icon: "⊿" },
    { id: "gm-id", label: "gm/Id", icon: "△" },
    { id: "mosfet-viewer", label: "MOSFET", icon: "📈" },
  ];

  return (
    <div className="calculators-panel">
      <div className="calc-header">
        <h3>Analog Calculators</h3>
      </div>

      <div className="calc-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`calc-tab-btn ${activeTab === t.id ? "calc-tab-btn--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
            title={t.label}
          >
            <span className="calc-tab-icon">{t.icon}</span>
            <span className="calc-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="calc-content">
        {activeTab === "wire-rc" && <WireRCTab />}
        {activeTab === "em" && <EMTab />}
        {activeTab === "matching" && <MatchingTab />}
        {activeTab === "gm-id" && <GmIdTab />}
        {activeTab === "mosfet-viewer" && <MosfetViewerTab />}
      </div>
    </div>
  );
}
