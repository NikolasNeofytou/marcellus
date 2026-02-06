import { useLayerStore } from "../../stores/layerStore";
import "./LayerPalette.css";

export function LayerPalette() {
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const setActiveLayer = useLayerStore((s) => s.setActiveLayer);
  const toggleVisibility = useLayerStore((s) => s.toggleVisibility);
  const showAll = useLayerStore((s) => s.showAll);
  const hideAll = useLayerStore((s) => s.hideAll);
  const showMetalOnly = useLayerStore((s) => s.showMetalOnly);

  return (
    <div className="layer-palette">
      <div className="layer-palette__actions">
        <button className="layer-palette__btn" title="Show All" onClick={showAll}>All</button>
        <button className="layer-palette__btn" title="Show None" onClick={hideAll}>None</button>
        <button className="layer-palette__btn" title="Show Metal Only" onClick={showMetalOnly}>Metal</button>
      </div>
      <div className="layer-palette__list">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer-palette__item ${activeLayerId === layer.id ? "layer-palette__item--active" : ""}`}
            onClick={() => setActiveLayer(layer.id)}
          >
            <button
              className="layer-palette__visibility"
              title={layer.visible ? "Hide" : "Show"}
              onClick={(e) => {
                e.stopPropagation();
                toggleVisibility(layer.id);
              }}
            >
              {layer.visible ? "\u{1F441}" : "\u2014"}
            </button>
            <div
              className="layer-palette__swatch"
              style={{ backgroundColor: layer.color, opacity: layer.visible ? 1 : 0.3 }}
            />
            <span className={`layer-palette__name ${!layer.visible ? "layer-palette__name--hidden" : ""}`}>
              {layer.name}
            </span>
            <span className="layer-palette__id">({layer.id})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
