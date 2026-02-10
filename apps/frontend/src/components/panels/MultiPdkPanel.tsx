import { useState, useMemo } from "react";
import {
  AVAILABLE_PDKS,
  GF180MCU_PDK,
  IHP_SG13G2_PDK,
  generateLayerMappings,
  analyseProcessMigration,
  type MigrationReport,
} from "../../engines/multiPdk";
import { useGeometryStore } from "../../stores/geometryStore";
import {
  Cpu, ArrowRightLeft, Layers, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Package,
} from "lucide-react";
import "./MultiPdkPanel.css";

type Tab = "browser" | "migration";

export function MultiPdkPanel() {
  const [tab, setTab] = useState<Tab>("browser");

  return (
    <div className="pdk-panel">
      <div className="pdk-panel__tabs">
        <button
          className={`pdk-panel__tab ${tab === "browser" ? "pdk-panel__tab--active" : ""}`}
          onClick={() => setTab("browser")}
        >
          <Cpu size={13} /> PDK Browser
        </button>
        <button
          className={`pdk-panel__tab ${tab === "migration" ? "pdk-panel__tab--active" : ""}`}
          onClick={() => setTab("migration")}
        >
          <ArrowRightLeft size={13} /> Migration
        </button>
      </div>

      {tab === "browser" ? <BrowserTab /> : <MigrationTab />}
    </div>
  );
}

/* ── PDK Browser ────────────────────────────────────────────────── */

function BrowserTab() {
  const [selectedPdk, setSelectedPdk] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["layers"]));

  const toggle = (section: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) { next.delete(section); } else { next.add(section); }
      return next;
    });

  const current = AVAILABLE_PDKS.find((p) => p.pdk.name === selectedPdk);

  return (
    <div>
      {/* PDK Cards */}
      <div className="pdk-panel__section">
        <div className="pdk-panel__label">Available PDKs</div>
        {AVAILABLE_PDKS.map(({ pdk }) => (
          <div
            key={pdk.name}
            className={`pdk-panel__card ${selectedPdk === pdk.name ? "pdk-panel__card--active" : ""}`}
            onClick={() => setSelectedPdk(pdk.name)}
          >
            <div className="pdk-panel__card-title">
              <Package size={13} /> {pdk.name}
              <span className="pdk-panel__chip">{pdk.node}</span>
            </div>
            <div className="pdk-panel__card-meta">
              {pdk.foundry} · {pdk.metalLayers} metal layers · Grid {pdk.manufacturingGrid * 1000}nm
            </div>
          </div>
        ))}
      </div>

      {/* Detail */}
      {current && (
        <>
          {/* Layers */}
          <SectionHeader
            title={`Layers (${current.pdk.layers.length})`}
            expanded={expandedSections.has("layers")}
            onToggle={() => toggle("layers")}
          />
          {expandedSections.has("layers") && (
            <div className="pdk-panel__section">
              {current.pdk.layers.map((l) => (
                <div key={l.name} className="pdk-panel__layer-row">
                  <div className="pdk-panel__layer-swatch" style={{ background: l.color }} />
                  <span style={{ minWidth: 50, fontWeight: 500 }}>{l.alias}</span>
                  <span style={{ flex: 1, color: "var(--text-secondary)" }}>{l.name}</span>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>GDS {l.gdsLayer}/{l.gdsDatatype}</span>
                </div>
              ))}
            </div>
          )}

          {/* Design Rules */}
          <SectionHeader
            title={`Design Rules (${current.pdk.designRules.length})`}
            expanded={expandedSections.has("rules")}
            onToggle={() => toggle("rules")}
          />
          {expandedSections.has("rules") && (
            <div className="pdk-panel__section">
              {current.pdk.designRules.map((r) => (
                <div key={r.id} className="pdk-panel__rule-row">
                  <span style={{ minWidth: 70, fontFamily: "monospace", fontWeight: 500 }}>{r.id}</span>
                  <span style={{ flex: 1 }}>{r.description}</span>
                  <span className="pdk-panel__rule-value">{r.value}µm</span>
                </div>
              ))}
            </div>
          )}

          {/* Device Generators */}
          <SectionHeader
            title={`Device Generators (${current.generators.length})`}
            expanded={expandedSections.has("generators")}
            onToggle={() => toggle("generators")}
          />
          {expandedSections.has("generators") && (
            <div className="pdk-panel__section">
              {current.generators.map((g) => (
                <div key={g.name} className="pdk-panel__generator-card">
                  <div className="pdk-panel__generator-name">{g.name}</div>
                  <div className="pdk-panel__generator-desc">{g.description}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                    {g.parameters.map((p) => (
                      <span key={p.name} className="pdk-panel__chip">
                        {p.name}: {p.default}{p.name === "nf" ? "" : "µm"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Vias */}
          <SectionHeader
            title={`Vias (${current.pdk.vias.length})`}
            expanded={expandedSections.has("vias")}
            onToggle={() => toggle("vias")}
          />
          {expandedSections.has("vias") && (
            <div className="pdk-panel__section">
              {current.pdk.vias.map((v) => (
                <div key={v.name} className="pdk-panel__rule-row">
                  <span style={{ fontWeight: 600, minWidth: 50 }}>{v.name}</span>
                  <span style={{ fontSize: 10 }}>{v.bottomLayer} → {v.topLayer}</span>
                  <span className="pdk-panel__rule-value">{v.width}×{v.height}µm</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Migration Tab ──────────────────────────────────────────────── */

function MigrationTab() {
  const geometries = useGeometryStore((s) => s.geometries);

  const allPdks = [GF180MCU_PDK, IHP_SG13G2_PDK];
  const [sourceName, setSourceName] = useState(allPdks[0].name);
  const [targetName, setTargetName] = useState(allPdks[1].name);
  const [report, setReport] = useState<MigrationReport | null>(null);

  const sourcePdk = allPdks.find((p) => p.name === sourceName)!;
  const targetPdk = allPdks.find((p) => p.name === targetName)!;

  const layerMappings = useMemo(
    () => generateLayerMappings(sourcePdk, targetPdk),
    [sourcePdk, targetPdk],
  );

  const handleAnalyse = () => {
    const r = analyseProcessMigration(geometries, sourcePdk, targetPdk, layerMappings);
    setReport(r);
  };

  return (
    <div>
      {/* Source / Target selectors */}
      <div className="pdk-panel__section">
        <div className="pdk-panel__label">Process Migration</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <select
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            style={{
              flex: 1, padding: "4px 8px", fontSize: 11,
              background: "var(--surface, #1e1e1e)", border: "1px solid var(--border, #444)",
              borderRadius: 4, color: "var(--text, #eee)",
            }}
          >
            {allPdks.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <ArrowRightLeft size={14} />
          <select
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            style={{
              flex: 1, padding: "4px 8px", fontSize: 11,
              background: "var(--surface, #1e1e1e)", border: "1px solid var(--border, #444)",
              borderRadius: 4, color: "var(--text, #eee)",
            }}
          >
            {allPdks.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>
        <button className="pdk-panel__btn pdk-panel__btn--primary" onClick={handleAnalyse}>
          <Layers size={12} /> Analyse Migration
        </button>
      </div>

      {/* Layer Mappings */}
      <div className="pdk-panel__section">
        <div className="pdk-panel__label">Layer Mapping ({layerMappings.length})</div>
        {layerMappings.map((m) => (
          <div key={m.sourceLayer} className={`pdk-panel__mapping-row pdk-panel__mapping-row--${m.confidence}`}>
            <span style={{ minWidth: 100, fontFamily: "monospace" }}>{m.sourceLayer}</span>
            <span className="pdk-panel__arrow">→</span>
            <span style={{ minWidth: 100, fontFamily: "monospace" }}>
              {m.targetLayer ?? "—"}
            </span>
            <span className={`pdk-panel__confidence pdk-panel__confidence--${m.confidence}`}>
              {m.confidence}
            </span>
          </div>
        ))}
      </div>

      {/* Report */}
      {report && (
        <div className="pdk-panel__section">
          <div className="pdk-panel__label">
            Migration Report
            {report.status === "ready" && <CheckCircle2 size={12} style={{ color: "#22c55e", marginLeft: 4 }} />}
            {report.status !== "ready" && <AlertTriangle size={12} style={{ color: "#f59e0b", marginLeft: 4 }} />}
          </div>

          {report.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: "#f59e0b", marginBottom: 2 }}>
              <AlertTriangle size={10} /> {w}
            </div>
          ))}

          {report.ruleViolations.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div className="pdk-panel__label">Rule Violations ({report.ruleViolations.length})</div>
              {report.ruleViolations.slice(0, 20).map((v, i) => (
                <div key={i} style={{ fontSize: 11, color: v.severity === "error" ? "#ef4444" : "#f59e0b", marginBottom: 2 }}>
                  [{v.ruleId}] {v.description}
                  {v.suggestion && <span style={{ color: "var(--text-secondary)" }}> — {v.suggestion}</span>}
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: 11, marginTop: 4, color: "var(--text-secondary)" }}>
            {report.geometryChanges} geometries processed
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Collapsible Section Header ─────────────────────────────────── */

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      className="pdk-panel__label"
      style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4, userSelect: "none" }}
      onClick={onToggle}
    >
      {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      {title}
    </div>
  );
}
