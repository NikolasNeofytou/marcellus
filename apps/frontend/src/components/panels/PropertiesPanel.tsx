import { useMemo, useState, useCallback } from "react";
import React from "react";
import { useToolStore } from "../../stores/toolStore";
import { useLayerStore } from "../../stores/layerStore";
import { useGeometryStore, type CanvasGeometry } from "../../stores/geometryStore";
import { useCellStore, type CellInstance, type CellDefinition } from "../../stores/cellStore";
import { usePluginStore } from "../../stores/pluginStore";
import "./PropertiesPanel.css";

// ── Helpers ──────────────────────────────────────────────────────────

function computeGeomBbox(g: CanvasGeometry): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } {
  if (!g.points || g.points.length === 0) return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  const hw = (g.width ?? 0) / 2;
  for (const p of g.points) {
    x1 = Math.min(x1, p.x - hw);
    y1 = Math.min(y1, p.y - hw);
    x2 = Math.max(x2, p.x + hw);
    y2 = Math.max(y2, p.y + hw);
  }
  return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
}

function fmt(n: number): string {
  return n.toFixed(3);
}

// ── Editable number input ────────────────────────────────────────────

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(fmt(value));
    setEditing(true);
  };

  const commit = () => {
    const v = parseFloat(draft);
    if (!isNaN(v)) onChange(v);
    setEditing(false);
  };

  return (
    <>
      <span className="properties-panel__label">{label}</span>
      {editing ? (
        <input
          className="properties-panel__input"
          type="number"
          value={draft}
          step={0.001}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
      ) : (
        <span className="properties-panel__value properties-panel__value--editable" onClick={startEdit}>
          {fmt(value)}
        </span>
      )}
    </>
  );
}

// ── Layer swatch ─────────────────────────────────────────────────────

function LayerSwatch({ color, name }: { color: string; name: string }) {
  return (
    <span className="properties-panel__layer">
      <span className="properties-panel__layer-swatch" style={{ background: color }} />
      {name}
    </span>
  );
}

// ── Instance Properties Sub-panel ────────────────────────────────────

function InstanceProperties({ instance, cellDef }: { instance: CellInstance; cellDef: CellDefinition }) {
  const moveInstance = useCellStore((s) => s.moveInstance);
  const setConnection = useCellStore((s) => s.setConnection);

  const handleMoveX = useCallback((v: number) => {
    moveInstance(instance.id, { x: v, y: instance.position.y });
  }, [instance.id, instance.position.y, moveInstance]);

  const handleMoveY = useCallback((v: number) => {
    moveInstance(instance.id, { x: instance.position.x, y: v });
  }, [instance.id, instance.position.x, moveInstance]);

  return (
    <>
      <div className="properties-panel__section">
        <div className="properties-panel__section-header">Instance</div>
        <div className="properties-panel__grid">
          <span className="properties-panel__label">Name</span>
          <span className="properties-panel__value properties-panel__value--type">{instance.instanceName}</span>
          <span className="properties-panel__label">Cell</span>
          <span className="properties-panel__value">{cellDef.name}</span>
          <span className="properties-panel__label">Category</span>
          <span className="properties-panel__value">{cellDef.category}</span>
          <NumField label="X (µm)" value={instance.position.x} onChange={handleMoveX} />
          <NumField label="Y (µm)" value={instance.position.y} onChange={handleMoveY} />
          <span className="properties-panel__label">Rotation</span>
          <span className="properties-panel__value">{instance.rotation}°</span>
          <span className="properties-panel__label">Mirror</span>
          <span className="properties-panel__value">{instance.mirror ? "Yes" : "No"}</span>
        </div>
      </div>

      {/* Cell parameters */}
      {cellDef.parameters && Object.keys(cellDef.parameters).length > 0 && (
        <div className="properties-panel__section">
          <div className="properties-panel__section-header">Parameters</div>
          <div className="properties-panel__grid">
            {Object.entries(cellDef.parameters).map(([key, val]) => (
              <React.Fragment key={key}>
                <span className="properties-panel__label">{key}</span>
                <span className="properties-panel__value">{String(val)}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Pins & Connections */}
      {cellDef.pins.length > 0 && (
        <div className="properties-panel__section">
          <div className="properties-panel__section-header">Pins ({cellDef.pins.length})</div>
          <div className="properties-panel__pin-list">
            {cellDef.pins.map((pin) => (
              <div key={pin.name} className="properties-panel__pin-row">
                <span className="properties-panel__pin-name">{pin.name}</span>
                <span className="properties-panel__pin-dir">{pin.direction}</span>
                <input
                  className="properties-panel__pin-net"
                  type="text"
                  placeholder="net…"
                  value={instance.connections[pin.name] ?? ""}
                  onChange={(e) => setConnection(instance.id, pin.name, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geometry count */}
      <div className="properties-panel__section">
        <div className="properties-panel__section-header">Cell Geometry</div>
        <div className="properties-panel__grid">
          <span className="properties-panel__label">Shapes</span>
          <span className="properties-panel__value">{cellDef.geometries.length}</span>
          <span className="properties-panel__label">BBox</span>
          <span className="properties-panel__value">
            {fmt(cellDef.bbox.x2 - cellDef.bbox.x1)} × {fmt(cellDef.bbox.y2 - cellDef.bbox.y1)} µm
          </span>
          {cellDef.pdk && (
            <>
              <span className="properties-panel__label">PDK</span>
              <span className="properties-panel__value">{cellDef.pdk}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════

export function PropertiesPanel() {
  const selectedItems = useToolStore((s) => s.selectedItems);
  const activeTool = useToolStore((s) => s.activeTool);
  const toolState = useToolStore((s) => s.toolState);
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const geometries = useGeometryStore((s) => s.geometries);
  const selectedInstances = useCellStore((s) => s.selectedInstances);
  const instances = useCellStore((s) => s.instances);
  const cellLibrary = useCellStore((s) => s.cellLibrary);

  const plugins = usePluginStore((s) => s.plugins);
  const activePdkId = usePluginStore((s) => s.activePdkId);
  const activePdk = useMemo(() => {
    if (!activePdkId) return undefined;
    const plugin = plugins.find((p) => p.manifest.id === activePdkId);
    return plugin?.manifest.contributes.pdk;
  }, [plugins, activePdkId]);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  // ── Instance selection takes priority ─────────────────────────────
  const selectedInst: CellInstance | undefined = selectedInstances.length === 1
    ? instances.find((i) => i.id === selectedInstances[0])
    : undefined;
  const selectedCellDef: CellDefinition | undefined = selectedInst
    ? cellLibrary.get(selectedInst.cellId)
    : undefined;

  if (selectedInst && selectedCellDef) {
    return (
      <div className="properties-panel">
        <InstanceProperties instance={selectedInst} cellDef={selectedCellDef} />
      </div>
    );
  }

  // ── Multiple instances selected ───────────────────────────────────
  if (selectedInstances.length > 1) {
    const selected = instances.filter((i) => selectedInstances.includes(i.id));
    return (
      <div className="properties-panel">
        <div className="properties-panel__section">
          <div className="properties-panel__section-header">
            {selectedInstances.length} Instances Selected
          </div>
          <div className="properties-panel__multi-list">
            {selected.map((inst) => {
              const def = cellLibrary.get(inst.cellId);
              return (
                <div key={inst.id} className="properties-panel__multi-item">
                  <span className="properties-panel__multi-type">{inst.instanceName}</span>
                  <span className="properties-panel__multi-idx">{def?.name ?? "?"}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── No geometry selection either → tool/PDK info ──────────────────
  if (selectedItems.length === 0) {
    return (
      <div className="properties-panel">
        <div className="properties-panel__section">
          <div className="properties-panel__section-header">Tool Info</div>
          <div className="properties-panel__grid">
            <span className="properties-panel__label">Active Tool</span>
            <span className="properties-panel__value">{activeTool}</span>
            <span className="properties-panel__label">State</span>
            <span className="properties-panel__value">{toolState}</span>
            <span className="properties-panel__label">Active Layer</span>
            <span className="properties-panel__value" style={{ color: activeLayer?.color }}>
              {activeLayer?.name ?? "—"}
            </span>
          </div>
        </div>

        <div className="properties-panel__section">
          <div className="properties-panel__section-header">PDK Info</div>
          <div className="properties-panel__grid">
            <span className="properties-panel__label">PDK</span>
            <span className="properties-panel__value">{activePdk?.name ?? "None"}</span>
            <span className="properties-panel__label">Foundry</span>
            <span className="properties-panel__value">{activePdk?.foundry ?? "—"}</span>
            <span className="properties-panel__label">Node</span>
            <span className="properties-panel__value">{activePdk?.node ?? "—"}</span>
            <span className="properties-panel__label">Metal Layers</span>
            <span className="properties-panel__value">{activePdk?.metalLayers ?? "—"}</span>
            <span className="properties-panel__label">Mfg Grid</span>
            <span className="properties-panel__value">{activePdk?.manufacturingGrid ?? "—"}µm</span>
          </div>
        </div>

        <div className="properties-panel__section">
          <div className="properties-panel__section-header">Design Stats</div>
          <div className="properties-panel__grid">
            <span className="properties-panel__label">Geometries</span>
            <span className="properties-panel__value">{geometries.length}</span>
            <span className="properties-panel__label">Instances</span>
            <span className="properties-panel__value">{instances.length}</span>
            <span className="properties-panel__label">Cell Defs</span>
            <span className="properties-panel__value">{cellLibrary.size}</span>
          </div>
        </div>

        <div className="properties-panel__empty">
          Select an object to view its properties.
        </div>
      </div>
    );
  }

  // ── Single geometry selection ─────────────────────────────────────
  if (selectedItems.length === 1) {
    const item = selectedItems[0];
    const geom = geometries[item.geometryIndex];

    if (!geom) {
      return (
        <div className="properties-panel">
          <div className="properties-panel__empty">Geometry not found.</div>
        </div>
      );
    }

    const layer = layers.find((l) => l.id === geom.layerId);
    const bbox = computeGeomBbox(geom);

    return (
      <div className="properties-panel">
        <div className="properties-panel__section">
          <div className="properties-panel__section-header">
            {geom.type.toUpperCase()}
          </div>
          <div className="properties-panel__grid">
            <span className="properties-panel__label">Type</span>
            <span className="properties-panel__value properties-panel__value--type">{geom.type}</span>
            <span className="properties-panel__label">Layer</span>
            {layer ? (
              <LayerSwatch color={layer.color} name={layer.name} />
            ) : (
              <span className="properties-panel__value">#{geom.layerId}</span>
            )}
            <span className="properties-panel__label">Index</span>
            <span className="properties-panel__value">#{item.geometryIndex}</span>
          </div>
        </div>

        <div className="properties-panel__section">
          <div className="properties-panel__section-header">Coordinates</div>
          <div className="properties-panel__grid">
            {geom.type === "rect" && geom.points.length === 2 && (
              <>
                <span className="properties-panel__label">X1, Y1</span>
                <span className="properties-panel__value">{fmt(geom.points[0].x)}, {fmt(geom.points[0].y)}</span>
                <span className="properties-panel__label">X2, Y2</span>
                <span className="properties-panel__value">{fmt(geom.points[1].x)}, {fmt(geom.points[1].y)}</span>
              </>
            )}
            {geom.type === "via" && geom.points.length >= 1 && (
              <>
                <span className="properties-panel__label">Center</span>
                <span className="properties-panel__value">{fmt(geom.points[0].x)}, {fmt(geom.points[0].y)}</span>
                <span className="properties-panel__label">Size</span>
                <span className="properties-panel__value">{fmt(geom.width ?? 0)} µm</span>
              </>
            )}
            {(geom.type === "polygon" || geom.type === "path") && (
              <>
                <span className="properties-panel__label">Vertices</span>
                <span className="properties-panel__value">{geom.points.length}</span>
                {geom.type === "path" && (
                  <>
                    <span className="properties-panel__label">Width</span>
                    <span className="properties-panel__value">{fmt(geom.width ?? 0)} µm</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="properties-panel__section">
          <div className="properties-panel__section-header">Dimensions</div>
          <div className="properties-panel__grid">
            <span className="properties-panel__label">Width</span>
            <span className="properties-panel__value">{fmt(bbox.w)} µm</span>
            <span className="properties-panel__label">Height</span>
            <span className="properties-panel__value">{fmt(bbox.h)} µm</span>
            <span className="properties-panel__label">Area</span>
            <span className="properties-panel__value">{fmt(bbox.w * bbox.h)} µm²</span>
            <span className="properties-panel__label">BBox</span>
            <span className="properties-panel__value">
              ({fmt(bbox.x1)}, {fmt(bbox.y1)}) → ({fmt(bbox.x2)}, {fmt(bbox.y2)})
            </span>
          </div>
        </div>

        {/* Custom properties */}
        {geom.properties && Object.keys(geom.properties).filter(k => !k.startsWith("_")).length > 0 && (
          <div className="properties-panel__section">
            <div className="properties-panel__section-header">Properties</div>
            <div className="properties-panel__grid">
              {Object.entries(geom.properties).filter(([k]) => !k.startsWith("_")).map(([key, val]) => (
                <React.Fragment key={key}>
                  <span className="properties-panel__label">{key}</span>
                  <span className="properties-panel__value">{String(val)}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Multi geometry selection ──────────────────────────────────────
  const selectedGeoms = selectedItems.map((s) => geometries[s.geometryIndex]).filter(Boolean);
  const typeCounts = new Map<string, number>();
  const layerCounts = new Map<number, number>();
  for (const g of selectedGeoms) {
    typeCounts.set(g.type, (typeCounts.get(g.type) ?? 0) + 1);
    layerCounts.set(g.layerId, (layerCounts.get(g.layerId) ?? 0) + 1);
  }

  return (
    <div className="properties-panel">
      <div className="properties-panel__section">
        <div className="properties-panel__section-header">
          {selectedItems.length} Shapes Selected
        </div>
        <div className="properties-panel__grid">
          {Array.from(typeCounts.entries()).map(([type, count]) => (
            <React.Fragment key={type}>
              <span className="properties-panel__label">{type}</span>
              <span className="properties-panel__value">{count}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="properties-panel__section">
        <div className="properties-panel__section-header">By Layer</div>
        <div className="properties-panel__multi-list">
          {Array.from(layerCounts.entries()).map(([lid, count]) => {
            const lr = layers.find((l) => l.id === lid);
            return (
              <div key={lid} className="properties-panel__multi-item">
                {lr ? <LayerSwatch color={lr.color} name={lr.name} /> : <span>#{lid}</span>}
                <span className="properties-panel__multi-idx">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
