import { useState, useCallback } from "react";
import { useGeometryStore } from "../../stores/geometryStore";
import { useCellStore } from "../../stores/cellStore";
import {
  generateMosfet,
  generateResistor,
  generateCapacitor,
  generateGuardRing,
  generateEsdDiode,
  DEFAULT_NMOS,
  DEFAULT_PMOS,
  DEFAULT_RESISTOR,
  type MosfetParams,
  type ResistorParams,
  type CapacitorParams,
  type EsdDiodeParams,
} from "../../engines/transistorGen";
import { Plus, RotateCcw } from "lucide-react";
import "./TransistorPanel.css";

type DeviceTab = "mosfet" | "resistor" | "capacitor" | "guardring" | "esd";

export function TransistorPanel() {
  const [activeTab, setActiveTab] = useState<DeviceTab>("mosfet");
  const addGeometries = useGeometryStore((s) => s.addGeometries);
  const addCellDef = useCellStore((s) => s.addCellDefinition);

  // ── MOSFET state ──
  const [mosType, setMosType] = useState<"nmos" | "pmos">("nmos");
  const [mosW, setMosW] = useState(0.42);
  const [mosL, setMosL] = useState(0.15);
  const [mosNf, setMosNf] = useState(1);
  const [mosContacts, setMosContacts] = useState(true);
  const [mosGuardRing, setMosGuardRing] = useState(false);
  const [mosWell, setMosWell] = useState(true);
  const [mosImplant, setMosImplant] = useState(true);

  // ── Resistor state ──
  const [resType, setResType] = useState<"poly" | "ndiff" | "pdiff">("poly");
  const [resW, setResW] = useState(0.33);
  const [resL, setResL] = useState(2.0);
  const [resContacts, setResContacts] = useState(true);

  // ── Capacitor state ──
  const [capType, setCapType] = useState<"mim" | "mom">("mim");
  const [capW, setCapW] = useState(5.0);
  const [capL, setCapL] = useState(5.0);
  const [capFingers, setCapFingers] = useState(10);

  // ── ESD state ──
  const [esdW, setEsdW] = useState(2.0);
  const [esdL, setEsdL] = useState(1.0);
  const [esdType, setEsdType] = useState<"p+/nwell" | "n+/psub">("n+/psub");

  // ── Generate & place MOSFET ──
  const generateMos = useCallback(() => {
    const params: MosfetParams = {
      type: mosType,
      W: mosW,
      L: mosL,
      nf: mosNf,
      contacts: mosContacts,
      guardRing: mosGuardRing,
      includeWell: mosWell || mosType === "pmos",
      includeImplant: mosImplant,
    };
    const result = generateMosfet(params);

    // Register as cell definition
    const cellId = addCellDef({
      name: `${mosType}_W${mosW}_L${mosL}_nf${mosNf}`,
      category: "transistor",
      description: `${mosType.toUpperCase()} W=${mosW}µm L=${mosL}µm nf=${mosNf}`,
      geometries: result.geometries,
      pins: result.pins,
      parameters: { type: mosType, W: mosW, L: mosL, nf: mosNf },
      pdk: "SKY130",
      source: "generated",
    });

    // Also add to flat geometry list for immediate rendering
    addGeometries(result.geometries);

    return cellId;
  }, [mosType, mosW, mosL, mosNf, mosContacts, mosGuardRing, mosWell, mosImplant, addGeometries, addCellDef]);

  // ── Generate & place resistor ──
  const generateRes = useCallback(() => {
    const params: ResistorParams = { type: resType, W: resW, L: resL, contacts: resContacts };
    const result = generateResistor(params);

    addCellDef({
      name: `res_${resType}_W${resW}_L${resL}`,
      category: "passive",
      description: `${resType} resistor W=${resW}µm L=${resL}µm ≈ ${result.resistance.toFixed(0)}Ω`,
      geometries: result.geometries,
      pins: result.pins,
      parameters: { type: resType, W: resW, L: resL, resistance: result.resistance },
      pdk: "SKY130",
      source: "generated",
    });

    addGeometries(result.geometries);
  }, [resType, resW, resL, resContacts, addGeometries, addCellDef]);

  // ── Generate & place capacitor ──
  const generateCap = useCallback(() => {
    const params: CapacitorParams = { type: capType, W: capW, L: capL, fingers: capFingers };
    const result = generateCapacitor(params);

    addCellDef({
      name: `cap_${capType}_W${capW}_L${capL}`,
      category: "passive",
      description: `${capType.toUpperCase()} cap ≈ ${result.capacitance.toFixed(1)}fF`,
      geometries: result.geometries,
      pins: result.pins,
      parameters: { type: capType, W: capW, L: capL, capacitance: result.capacitance },
      pdk: "SKY130",
      source: "generated",
    });

    addGeometries(result.geometries);
  }, [capType, capW, capL, capFingers, addGeometries, addCellDef]);

  // ── Generate ESD diode ──
  const generateEsd = useCallback(() => {
    const params: EsdDiodeParams = { W: esdW, L: esdL, pnType: esdType };
    const result = generateEsdDiode(params);

    addCellDef({
      name: `esd_${esdType}_W${esdW}_L${esdL}`,
      category: "esd",
      description: `${esdType} ESD diode`,
      geometries: result.geometries,
      pins: result.pins,
      parameters: { W: esdW, L: esdL, pnType: esdType },
      pdk: "SKY130",
      source: "generated",
    });

    addGeometries(result.geometries);
  }, [esdW, esdL, esdType, addGeometries, addCellDef]);

  // ── Reset to defaults ──
  const resetMos = () => {
    const d = mosType === "nmos" ? DEFAULT_NMOS : DEFAULT_PMOS;
    setMosW(d.W); setMosL(d.L); setMosNf(d.nf); setMosContacts(d.contacts);
    setMosGuardRing(d.guardRing); setMosWell(d.includeWell); setMosImplant(d.includeImplant);
  };

  const resetRes = () => {
    setResType(DEFAULT_RESISTOR.type); setResW(DEFAULT_RESISTOR.W); setResL(DEFAULT_RESISTOR.L);
    setResContacts(DEFAULT_RESISTOR.contacts);
  };

  // Computed values
  const mosArea = mosW * mosL * mosNf;
  const resSquares = resL / resW;
  const resOhms = (resType === "poly" ? 48 : 100) * resSquares;

  return (
    <div className="transistor-panel">
      {/* Tab bar */}
      <div className="transistor-panel__tabs">
        {([
          { id: "mosfet" as DeviceTab, label: "MOSFET" },
          { id: "resistor" as DeviceTab, label: "Resistor" },
          { id: "capacitor" as DeviceTab, label: "Capacitor" },
          { id: "guardring" as DeviceTab, label: "Guard Ring" },
          { id: "esd" as DeviceTab, label: "ESD" },
        ]).map((tab) => (
          <button
            key={tab.id}
            className={`transistor-panel__tab ${activeTab === tab.id ? "transistor-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── MOSFET tab ── */}
      {activeTab === "mosfet" && (
        <div className="transistor-panel__form">
          <div className="transistor-panel__row">
            <label>Type</label>
            <div className="transistor-panel__toggle">
              <button
                className={`transistor-panel__toggle-btn ${mosType === "nmos" ? "transistor-panel__toggle-btn--active" : ""}`}
                onClick={() => setMosType("nmos")}
              >NMOS</button>
              <button
                className={`transistor-panel__toggle-btn ${mosType === "pmos" ? "transistor-panel__toggle-btn--active" : ""}`}
                onClick={() => setMosType("pmos")}
              >PMOS</button>
            </div>
          </div>

          <div className="transistor-panel__row">
            <label>W (µm)</label>
            <input type="number" value={mosW} min={0.15} max={50} step={0.01}
              onChange={(e) => setMosW(parseFloat(e.target.value) || 0.15)} />
          </div>
          <div className="transistor-panel__row">
            <label>L (µm)</label>
            <input type="number" value={mosL} min={0.15} max={10} step={0.01}
              onChange={(e) => setMosL(parseFloat(e.target.value) || 0.15)} />
          </div>
          <div className="transistor-panel__row">
            <label>Fingers</label>
            <input type="number" value={mosNf} min={1} max={50} step={1}
              onChange={(e) => setMosNf(parseInt(e.target.value) || 1)} />
          </div>

          <div className="transistor-panel__checks">
            <label><input type="checkbox" checked={mosContacts} onChange={(e) => setMosContacts(e.target.checked)} /> Contacts</label>
            <label><input type="checkbox" checked={mosGuardRing} onChange={(e) => setMosGuardRing(e.target.checked)} /> Guard Ring</label>
            <label><input type="checkbox" checked={mosWell} onChange={(e) => setMosWell(e.target.checked)} /> Well</label>
            <label><input type="checkbox" checked={mosImplant} onChange={(e) => setMosImplant(e.target.checked)} /> Implant</label>
          </div>

          {/* Computed info */}
          <div className="transistor-panel__info">
            <div className="transistor-panel__info-item">
              <span>W/L</span><span>{(mosW / mosL).toFixed(2)}</span>
            </div>
            <div className="transistor-panel__info-item">
              <span>Total W</span><span>{(mosW * mosNf).toFixed(2)} µm</span>
            </div>
            <div className="transistor-panel__info-item">
              <span>Area</span><span>{mosArea.toFixed(3)} µm²</span>
            </div>
          </div>

          <div className="transistor-panel__actions">
            <button className="transistor-panel__generate" onClick={generateMos}>
              <Plus size={14} /> Generate {mosType.toUpperCase()}
            </button>
            <button className="transistor-panel__reset" onClick={resetMos} title="Reset to defaults">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Resistor tab ── */}
      {activeTab === "resistor" && (
        <div className="transistor-panel__form">
          <div className="transistor-panel__row">
            <label>Type</label>
            <select value={resType} onChange={(e) => setResType(e.target.value as ResistorParams["type"])}>
              <option value="poly">Poly</option>
              <option value="ndiff">N-Diffusion</option>
              <option value="pdiff">P-Diffusion</option>
            </select>
          </div>
          <div className="transistor-panel__row">
            <label>W (µm)</label>
            <input type="number" value={resW} min={0.15} max={50} step={0.01}
              onChange={(e) => setResW(parseFloat(e.target.value) || 0.15)} />
          </div>
          <div className="transistor-panel__row">
            <label>L (µm)</label>
            <input type="number" value={resL} min={0.5} max={200} step={0.1}
              onChange={(e) => setResL(parseFloat(e.target.value) || 0.5)} />
          </div>
          <div className="transistor-panel__checks">
            <label><input type="checkbox" checked={resContacts} onChange={(e) => setResContacts(e.target.checked)} /> Contacts</label>
          </div>

          <div className="transistor-panel__info">
            <div className="transistor-panel__info-item">
              <span>Squares</span><span>{resSquares.toFixed(1)}</span>
            </div>
            <div className="transistor-panel__info-item">
              <span>R ≈</span><span>{resOhms.toFixed(0)} Ω</span>
            </div>
          </div>

          <div className="transistor-panel__actions">
            <button className="transistor-panel__generate" onClick={generateRes}>
              <Plus size={14} /> Generate Resistor
            </button>
            <button className="transistor-panel__reset" onClick={resetRes} title="Reset">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Capacitor tab ── */}
      {activeTab === "capacitor" && (
        <div className="transistor-panel__form">
          <div className="transistor-panel__row">
            <label>Type</label>
            <div className="transistor-panel__toggle">
              <button
                className={`transistor-panel__toggle-btn ${capType === "mim" ? "transistor-panel__toggle-btn--active" : ""}`}
                onClick={() => setCapType("mim")}
              >MIM</button>
              <button
                className={`transistor-panel__toggle-btn ${capType === "mom" ? "transistor-panel__toggle-btn--active" : ""}`}
                onClick={() => setCapType("mom")}
              >MOM</button>
            </div>
          </div>
          <div className="transistor-panel__row">
            <label>W (µm)</label>
            <input type="number" value={capW} min={1} max={100} step={0.5}
              onChange={(e) => setCapW(parseFloat(e.target.value) || 1)} />
          </div>
          <div className="transistor-panel__row">
            <label>L (µm)</label>
            <input type="number" value={capL} min={1} max={100} step={0.5}
              onChange={(e) => setCapL(parseFloat(e.target.value) || 1)} />
          </div>
          {capType === "mom" && (
            <div className="transistor-panel__row">
              <label>Fingers</label>
              <input type="number" value={capFingers} min={2} max={100} step={1}
                onChange={(e) => setCapFingers(parseInt(e.target.value) || 2)} />
            </div>
          )}

          <div className="transistor-panel__actions">
            <button className="transistor-panel__generate" onClick={generateCap}>
              <Plus size={14} /> Generate {capType.toUpperCase()} Cap
            </button>
          </div>
        </div>
      )}

      {/* ── Guard Ring tab ── */}
      {activeTab === "guardring" && (
        <div className="transistor-panel__form">
          <div className="transistor-panel__info" style={{ marginBottom: 8 }}>
            <p className="transistor-panel__help">
              Guard rings are auto-generated when you enable "Guard Ring" on a MOSFET.
              You can also generate a standalone guard ring around existing geometry.
            </p>
          </div>
          <div className="transistor-panel__actions">
            <button className="transistor-panel__generate" onClick={() => {
              const geoms = generateGuardRing({
                type: "p-sub",
                innerBbox: { x1: -0.5, y1: -0.5, x2: 2.5, y2: 2.5 },
                ringWidth: 0.27,
                contacts: true,
              });
              addGeometries(geoms);
            }}>
              <Plus size={14} /> P-Sub Guard Ring
            </button>
            <button className="transistor-panel__generate" onClick={() => {
              const geoms = generateGuardRing({
                type: "n-well",
                innerBbox: { x1: -0.5, y1: -0.5, x2: 2.5, y2: 2.5 },
                ringWidth: 0.27,
                contacts: true,
              });
              addGeometries(geoms);
            }}>
              <Plus size={14} /> N-Well Guard Ring
            </button>
          </div>
        </div>
      )}

      {/* ── ESD tab ── */}
      {activeTab === "esd" && (
        <div className="transistor-panel__form">
          <div className="transistor-panel__row">
            <label>Type</label>
            <select value={esdType} onChange={(e) => setEsdType(e.target.value as EsdDiodeParams["pnType"])}>
              <option value="n+/psub">N+/P-sub</option>
              <option value="p+/nwell">P+/N-well</option>
            </select>
          </div>
          <div className="transistor-panel__row">
            <label>W (µm)</label>
            <input type="number" value={esdW} min={0.5} max={50} step={0.1}
              onChange={(e) => setEsdW(parseFloat(e.target.value) || 0.5)} />
          </div>
          <div className="transistor-panel__row">
            <label>L (µm)</label>
            <input type="number" value={esdL} min={0.5} max={50} step={0.1}
              onChange={(e) => setEsdL(parseFloat(e.target.value) || 0.5)} />
          </div>

          <div className="transistor-panel__actions">
            <button className="transistor-panel__generate" onClick={generateEsd}>
              <Plus size={14} /> Generate ESD Diode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
