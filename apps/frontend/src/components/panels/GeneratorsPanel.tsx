import { useState } from "react";
import { useGeometryStore } from "../../stores/geometryStore";
import {
  generateGuardRing,
  generateCommonCentroid,
  generateInterdigitation,
  generateDummies,
  type GuardRingParams,
  type CommonCentroidParams,
  type InterdigitationParams,
  type DummyInsertionParams,
  type GeneratorResult,
} from "../../engines/layoutGenerators";
import "./GeneratorsPanel.css";

// ── Number Input ──

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
    <div className="gen-field">
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

// ── Guard Ring Tab ──

function GuardRingTab() {
  const commit = useGeometryStore((s) => s.commit);
  const [result, setResult] = useState<GeneratorResult | null>(null);

  const [params, setParams] = useState<GuardRingParams>({
    centerX: 1.0,
    centerY: 2.0,
    innerWidth: 2.0,
    innerHeight: 4.0,
    ringType: "psubstrate",
    contactWidth: 0.5,
    spacing: 0.3,
    includeWell: true,
    contactPitch: 0.5,
  });

  const update = <K extends keyof GuardRingParams>(k: K, v: GuardRingParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const handleGenerate = () => {
    const res = generateGuardRing(params);
    setResult(res);
    commit((prev) => [...prev, ...res.geometries]);
  };

  return (
    <div className="gen-tab">
      <p className="gen-desc">
        Generate a substrate/well contact ring for noise isolation around a device region.
      </p>

      <NumInput label="Center X" value={params.centerX} onChange={(v) => update("centerX", v)} unit="µm" />
      <NumInput label="Center Y" value={params.centerY} onChange={(v) => update("centerY", v)} unit="µm" />
      <NumInput label="Inner Width" value={params.innerWidth} onChange={(v) => update("innerWidth", v)} unit="µm" min={0.1} />
      <NumInput label="Inner Height" value={params.innerHeight} onChange={(v) => update("innerHeight", v)} unit="µm" min={0.1} />

      <div className="gen-field">
        <label>Ring Type</label>
        <select
          value={params.ringType}
          onChange={(e) => update("ringType", e.target.value as "psubstrate" | "nwell")}
        >
          <option value="psubstrate">P-Substrate (P+ tap)</option>
          <option value="nwell">N-Well (N+ tap)</option>
        </select>
      </div>

      <NumInput label="Contact Width" value={params.contactWidth} onChange={(v) => update("contactWidth", v)} unit="µm" min={0.1} />
      <NumInput label="Spacing" value={params.spacing} onChange={(v) => update("spacing", v)} unit="µm" min={0.05} />
      <NumInput label="Contact Pitch" value={params.contactPitch} onChange={(v) => update("contactPitch", v)} unit="µm" min={0.1} />

      <div className="gen-field">
        <label>
          <input
            type="checkbox"
            checked={params.includeWell}
            onChange={(e) => update("includeWell", e.target.checked)}
          /> Include Well Layer
        </label>
      </div>

      <button className="gen-btn" onClick={handleGenerate}>Generate Guard Ring</button>

      {result && (
        <div className="gen-result">
          <div className="gen-result__desc">{result.description}</div>
          <div className="gen-result__stats">
            {result.stats.totalShapes} shapes on {result.stats.layersUsed.length} layers
          </div>
        </div>
      )}
    </div>
  );
}

// ── Common-Centroid Tab ──

function CommonCentroidTab() {
  const commit = useGeometryStore((s) => s.commit);
  const [result, setResult] = useState<GeneratorResult | null>(null);

  const [params, setParams] = useState<CommonCentroidParams>({
    unitsA: 4,
    unitsB: 4,
    unitWidth: 0.5,
    unitHeight: 1.0,
    spacing: 0.2,
    originX: 0,
    originY: 0,
    columns: 4,
    deviceType: "nmos",
    layerIdA: 2, // diff
    layerIdB: 2, // diff (same layer, different visual in real design)
  });

  const update = <K extends keyof CommonCentroidParams>(k: K, v: CommonCentroidParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const handleGenerate = () => {
    const res = generateCommonCentroid(params);
    setResult(res);
    commit((prev) => [...prev, ...res.geometries]);
  };

  return (
    <div className="gen-tab">
      <p className="gen-desc">
        Place matched devices in a common-centroid pattern to minimise systematic offset from process gradients.
      </p>

      <NumInput label="Units A" value={params.unitsA} onChange={(v) => update("unitsA", Math.max(1, Math.round(v)))} min={1} step={1} />
      <NumInput label="Units B" value={params.unitsB} onChange={(v) => update("unitsB", Math.max(1, Math.round(v)))} min={1} step={1} />
      <NumInput label="Unit Width" value={params.unitWidth} onChange={(v) => update("unitWidth", v)} unit="µm" min={0.1} />
      <NumInput label="Unit Height" value={params.unitHeight} onChange={(v) => update("unitHeight", v)} unit="µm" min={0.1} />
      <NumInput label="Spacing" value={params.spacing} onChange={(v) => update("spacing", v)} unit="µm" min={0.05} />
      <NumInput label="Columns" value={params.columns} onChange={(v) => update("columns", Math.max(1, Math.round(v)))} min={1} step={1} />
      <NumInput label="Origin X" value={params.originX} onChange={(v) => update("originX", v)} unit="µm" />
      <NumInput label="Origin Y" value={params.originY} onChange={(v) => update("originY", v)} unit="µm" />

      <div className="gen-field">
        <label>Device Type</label>
        <select
          value={params.deviceType}
          onChange={(e) => update("deviceType", e.target.value as CommonCentroidParams["deviceType"])}
        >
          <option value="nmos">NMOS</option>
          <option value="pmos">PMOS</option>
          <option value="resistor">Resistor</option>
          <option value="capacitor">Capacitor</option>
        </select>
      </div>

      <NumInput label="Layer ID (A)" value={params.layerIdA} onChange={(v) => update("layerIdA", Math.round(v))} step={1} />
      <NumInput label="Layer ID (B)" value={params.layerIdB} onChange={(v) => update("layerIdB", Math.round(v))} step={1} />

      <button className="gen-btn" onClick={handleGenerate}>Generate Common-Centroid</button>

      {result && (
        <div className="gen-result">
          <div className="gen-result__desc">{result.description}</div>
          <div className="gen-result__stats">
            {result.stats.totalShapes} shapes on {result.stats.layersUsed.length} layers
          </div>
        </div>
      )}
    </div>
  );
}

// ── Interdigitation Tab ──

function InterdigitationTab() {
  const commit = useGeometryStore((s) => s.commit);
  const [result, setResult] = useState<GeneratorResult | null>(null);

  const [params, setParams] = useState<InterdigitationParams>({
    fingersA: 4,
    fingersB: 4,
    fingerWidth: 0.42,
    fingerLength: 2.0,
    spacing: 0.28,
    originX: 0,
    originY: 0,
    layerIdA: 2,
    layerIdB: 2,
    pattern: "ABAB",
    includeGate: true,
    gateLayerId: 4, // poly
  });

  const update = <K extends keyof InterdigitationParams>(k: K, v: InterdigitationParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const handleGenerate = () => {
    const res = generateInterdigitation(params);
    setResult(res);
    commit((prev) => [...prev, ...res.geometries]);
  };

  return (
    <div className="gen-tab">
      <p className="gen-desc">
        Create interleaved device fingers for improved matching. Supports ABAB, ABBA, and AABB patterns.
      </p>

      <NumInput label="Fingers A" value={params.fingersA} onChange={(v) => update("fingersA", Math.max(1, Math.round(v)))} min={1} step={1} />
      <NumInput label="Fingers B" value={params.fingersB} onChange={(v) => update("fingersB", Math.max(1, Math.round(v)))} min={1} step={1} />
      <NumInput label="Finger Width" value={params.fingerWidth} onChange={(v) => update("fingerWidth", v)} unit="µm" min={0.01} />
      <NumInput label="Finger Length" value={params.fingerLength} onChange={(v) => update("fingerLength", v)} unit="µm" min={0.1} />
      <NumInput label="Spacing" value={params.spacing} onChange={(v) => update("spacing", v)} unit="µm" min={0.01} />

      <div className="gen-field">
        <label>Pattern</label>
        <select
          value={params.pattern}
          onChange={(e) => update("pattern", e.target.value as InterdigitationParams["pattern"])}
        >
          <option value="ABAB">ABAB (alternating)</option>
          <option value="ABBA">ABBA (mirrored)</option>
          <option value="AABB">AABB (grouped)</option>
        </select>
      </div>

      <div className="gen-field">
        <label>
          <input
            type="checkbox"
            checked={params.includeGate}
            onChange={(e) => update("includeGate", e.target.checked)}
          /> Include Gate (Poly)
        </label>
      </div>

      <NumInput label="Origin X" value={params.originX} onChange={(v) => update("originX", v)} unit="µm" />
      <NumInput label="Origin Y" value={params.originY} onChange={(v) => update("originY", v)} unit="µm" />
      <NumInput label="Layer A" value={params.layerIdA} onChange={(v) => update("layerIdA", Math.round(v))} step={1} />
      <NumInput label="Layer B" value={params.layerIdB} onChange={(v) => update("layerIdB", Math.round(v))} step={1} />
      <NumInput label="Gate Layer" value={params.gateLayerId} onChange={(v) => update("gateLayerId", Math.round(v))} step={1} />

      <button className="gen-btn" onClick={handleGenerate}>Generate Interdigitated</button>

      {result && (
        <div className="gen-result">
          <div className="gen-result__desc">{result.description}</div>
          <div className="gen-result__stats">
            {result.stats.totalShapes} shapes on {result.stats.layersUsed.length} layers
          </div>
        </div>
      )}
    </div>
  );
}

// ── Auto-Dummy Tab ──

function AutoDummyTab() {
  const commit = useGeometryStore((s) => s.commit);
  const [result, setResult] = useState<GeneratorResult | null>(null);

  const [params, setParams] = useState<DummyInsertionParams>({
    arrayLeft: 0,
    arrayTop: 0,
    arrayRight: 4.0,
    arrayBottom: 6.0,
    dummyWidth: 0.42,
    dummyHeight: 1.0,
    spacing: 0.28,
    layerId: 2,
    sides: ["left", "right", "top", "bottom"],
    count: 1,
    gateLayerId: 4,
    includeGate: true,
  });

  const update = <K extends keyof DummyInsertionParams>(k: K, v: DummyInsertionParams[K]) =>
    setParams((p) => ({ ...p, [k]: v }));

  const toggleSide = (side: "left" | "right" | "top" | "bottom") => {
    setParams((p) => {
      const sides = p.sides.includes(side)
        ? p.sides.filter((s) => s !== side)
        : [...p.sides, side];
      return { ...p, sides };
    });
  };

  const handleGenerate = () => {
    const res = generateDummies(params);
    setResult(res);
    commit((prev) => [...prev, ...res.geometries]);
  };

  return (
    <div className="gen-tab">
      <p className="gen-desc">
        Insert dummy structures at array boundaries for improved lithographic uniformity and etch loading.
      </p>

      <h4>Array Bounds</h4>
      <NumInput label="Left" value={params.arrayLeft} onChange={(v) => update("arrayLeft", v)} unit="µm" />
      <NumInput label="Top" value={params.arrayTop} onChange={(v) => update("arrayTop", v)} unit="µm" />
      <NumInput label="Right" value={params.arrayRight} onChange={(v) => update("arrayRight", v)} unit="µm" />
      <NumInput label="Bottom" value={params.arrayBottom} onChange={(v) => update("arrayBottom", v)} unit="µm" />

      <h4>Dummy Parameters</h4>
      <NumInput label="Dummy Width" value={params.dummyWidth} onChange={(v) => update("dummyWidth", v)} unit="µm" min={0.01} />
      <NumInput label="Dummy Height" value={params.dummyHeight} onChange={(v) => update("dummyHeight", v)} unit="µm" min={0.01} />
      <NumInput label="Spacing" value={params.spacing} onChange={(v) => update("spacing", v)} unit="µm" min={0.01} />
      <NumInput label="Rows/Cols" value={params.count} onChange={(v) => update("count", Math.max(1, Math.round(v)))} min={1} step={1} />
      <NumInput label="Layer" value={params.layerId} onChange={(v) => update("layerId", Math.round(v))} step={1} />

      <div className="gen-field">
        <label>
          <input
            type="checkbox"
            checked={params.includeGate}
            onChange={(e) => update("includeGate", e.target.checked)}
          /> Include Gate (Poly)
        </label>
      </div>

      <h4>Sides</h4>
      <div className="gen-sides">
        {(["left", "right", "top", "bottom"] as const).map((s) => (
          <label key={s}>
            <input
              type="checkbox"
              checked={params.sides.includes(s)}
              onChange={() => toggleSide(s)}
            /> {s}
          </label>
        ))}
      </div>

      <button className="gen-btn" onClick={handleGenerate}>Generate Dummies</button>

      {result && (
        <div className="gen-result">
          <div className="gen-result__desc">{result.description}</div>
          <div className="gen-result__stats">
            {result.stats.totalShapes} shapes on {result.stats.layersUsed.length} layers
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Main Panel
// ══════════════════════════════════════════════════════════════════════

type GeneratorTab = "guard-ring" | "common-centroid" | "interdigitation" | "auto-dummy";

export function GeneratorsPanel() {
  const [activeTab, setActiveTab] = useState<GeneratorTab>("guard-ring");

  const tabs: { id: GeneratorTab; label: string; icon: string }[] = [
    { id: "guard-ring", label: "Guard Ring", icon: "◻" },
    { id: "common-centroid", label: "Common Centroid", icon: "⊞" },
    { id: "interdigitation", label: "Interdigitation", icon: "⫼" },
    { id: "auto-dummy", label: "Auto Dummy", icon: "◫" },
  ];

  return (
    <div className="generators-panel">
      <div className="gen-header">
        <h3>Layout Generators</h3>
      </div>

      <div className="gen-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`gen-tab-btn ${activeTab === t.id ? "gen-tab-btn--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
            title={t.label}
          >
            <span className="gen-tab-icon">{t.icon}</span>
            <span className="gen-tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="gen-content">
        {activeTab === "guard-ring" && <GuardRingTab />}
        {activeTab === "common-centroid" && <CommonCentroidTab />}
        {activeTab === "interdigitation" && <InterdigitationTab />}
        {activeTab === "auto-dummy" && <AutoDummyTab />}
      </div>
    </div>
  );
}
