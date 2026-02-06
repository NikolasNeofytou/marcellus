import { useMemo } from "react";
import { useToolStore } from "../../stores/toolStore";
import { useLayerStore } from "../../stores/layerStore";
import { usePluginStore } from "../../stores/pluginStore";
import "./PropertiesPanel.css";

export function PropertiesPanel() {
  const selectedItems = useToolStore((s) => s.selectedItems);
  const activeTool = useToolStore((s) => s.activeTool);
  const toolState = useToolStore((s) => s.toolState);
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);

  const plugins = usePluginStore((s) => s.plugins);
  const activePdkId = usePluginStore((s) => s.activePdkId);
  const activePdk = useMemo(() => {
    if (!activePdkId) return undefined;
    const plugin = plugins.find((p) => p.manifest.id === activePdkId);
    return plugin?.manifest.contributes.pdk;
  }, [plugins, activePdkId]);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

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

        <div className="properties-panel__empty">
          Select an object to view its properties.
        </div>
      </div>
    );
  }

  // Single selection
  if (selectedItems.length === 1) {
    const item = selectedItems[0];
    const layer = layers.find((l) => l.id === Number(item.type === "rect" ? activeLayerId : activeLayerId));

    return (
      <div className="properties-panel">
        <div className="properties-panel__section">
          <div className="properties-panel__section-header">
            Selection ({item.type})
          </div>
          <div className="properties-panel__grid">
            <span className="properties-panel__label">Type</span>
            <span className="properties-panel__value properties-panel__value--type">{item.type}</span>
            <span className="properties-panel__label">Index</span>
            <span className="properties-panel__value">{item.geometryIndex}</span>
            <span className="properties-panel__label">Cell</span>
            <span className="properties-panel__value">{item.cellId}</span>
          </div>
        </div>

        <div className="properties-panel__section">
          <div className="properties-panel__section-header">Geometry</div>
          <div className="properties-panel__grid">
            <span className="properties-panel__label">Layer</span>
            <span className="properties-panel__value" style={{ color: layer?.color }}>
              {layer?.name ?? "—"}
            </span>
          </div>
          <div className="properties-panel__hint">
            Full property editing coming in Phase 3.
          </div>
        </div>
      </div>
    );
  }

  // Multi selection
  return (
    <div className="properties-panel">
      <div className="properties-panel__section">
        <div className="properties-panel__section-header">
          Multiple Selection ({selectedItems.length} items)
        </div>
        <div className="properties-panel__multi-list">
          {selectedItems.map((item, i) => (
            <div key={i} className="properties-panel__multi-item">
              <span className="properties-panel__multi-type">{item.type}</span>
              <span className="properties-panel__multi-idx">#{item.geometryIndex}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
