import { useState } from "react";
import { useLayerStore, LAYER_GROUPS } from "../../stores/layerStore";
import { Eye, EyeOff, Lock, Unlock, ChevronDown, ChevronRight } from "lucide-react";
import "./LayerPalette.css";

export function LayerPalette() {
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const collapsedGroups = useLayerStore((s) => s.collapsedGroups);
  const setActiveLayer = useLayerStore((s) => s.setActiveLayer);
  const toggleVisibility = useLayerStore((s) => s.toggleVisibility);
  const toggleLocked = useLayerStore((s) => s.toggleLocked);
  const setFillAlpha = useLayerStore((s) => s.setFillAlpha);
  const showAll = useLayerStore((s) => s.showAll);
  const hideAll = useLayerStore((s) => s.hideAll);
  const showMetalOnly = useLayerStore((s) => s.showMetalOnly);
  const showActiveOnly = useLayerStore((s) => s.showActiveOnly);
  const showDrawingLayers = useLayerStore((s) => s.showDrawingLayers);
  const toggleGroupCollapsed = useLayerStore((s) => s.toggleGroupCollapsed);
  const toggleGroupVisibility = useLayerStore((s) => s.toggleGroupVisibility);

  const [filter, setFilter] = useState("");
  const [editingOpacity, setEditingOpacity] = useState<number | null>(null);

  const filteredLayers = filter
    ? layers.filter(
        (l) =>
          l.name.toLowerCase().includes(filter.toLowerCase()) ||
          (l.alias && l.alias.toLowerCase().includes(filter.toLowerCase()))
      )
    : layers;

  // Group layers
  const grouped = LAYER_GROUPS.map((g) => ({
    ...g,
    layers: filteredLayers.filter((l) => l.group === g.id),
  })).filter((g) => g.layers.length > 0);

  return (
    <div className="layer-palette">
      {/* Filter */}
      <input
        className="layer-palette__filter"
        type="text"
        placeholder="Filter layers…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {/* Quick actions */}
      <div className="layer-palette__actions">
        <button className="layer-palette__btn" title="Show All" onClick={showAll}>All</button>
        <button className="layer-palette__btn" title="Show None" onClick={hideAll}>None</button>
        <button className="layer-palette__btn" title="Show Metal Only" onClick={showMetalOnly}>Metal</button>
        <button className="layer-palette__btn" title="Show Active Only" onClick={showActiveOnly}>Active</button>
        <button className="layer-palette__btn" title="Show Drawing Layers" onClick={showDrawingLayers}>Draw</button>
      </div>

      {/* Layer count */}
      <div className="layer-palette__count">
        {layers.filter((l) => l.visible).length}/{layers.length} visible
      </div>

      {/* Grouped layer list */}
      <div className="layer-palette__list">
        {grouped.map((group) => {
          const isCollapsed = collapsedGroups.has(group.id);
          const allVisible = group.layers.every((l) => l.visible);
          const someVisible = group.layers.some((l) => l.visible);

          return (
            <div key={group.id} className="layer-palette__group">
              <div className="layer-palette__group-header">
                <button
                  className="layer-palette__group-toggle"
                  onClick={() => toggleGroupCollapsed(group.id)}
                  title={isCollapsed ? "Expand" : "Collapse"}
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </button>
                <button
                  className="layer-palette__group-vis"
                  onClick={() => toggleGroupVisibility(group.id, !allVisible)}
                  title={allVisible ? "Hide group" : "Show group"}
                >
                  {allVisible ? <Eye size={12} /> : someVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <span className="layer-palette__group-label">{group.label}</span>
                <span className="layer-palette__group-count">{group.layers.length}</span>
              </div>

              {!isCollapsed && group.layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`layer-palette__item ${activeLayerId === layer.id ? "layer-palette__item--active" : ""} ${layer.locked ? "layer-palette__item--locked" : ""}`}
                  onClick={() => setActiveLayer(layer.id)}
                >
                  <button
                    className="layer-palette__icon-btn"
                    title={layer.visible ? "Hide" : "Show"}
                    onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                  >
                    {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    className="layer-palette__icon-btn"
                    title={layer.locked ? "Unlock" : "Lock"}
                    onClick={(e) => { e.stopPropagation(); toggleLocked(layer.id); }}
                  >
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                  <div
                    className="layer-palette__swatch"
                    style={{ backgroundColor: layer.color, opacity: layer.visible ? layer.fillAlpha + 0.3 : 0.15 }}
                  />
                  <span className={`layer-palette__name ${!layer.visible ? "layer-palette__name--hidden" : ""}`}>
                    {layer.alias || layer.name}
                  </span>
                  {/* Opacity slider (shown on hover or click) */}
                  {editingOpacity === layer.id ? (
                    <input
                      type="range"
                      className="layer-palette__opacity"
                      min={0}
                      max={100}
                      value={Math.round(layer.fillAlpha * 100)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setFillAlpha(layer.id, parseInt(e.target.value) / 100);
                      }}
                      onBlur={() => setEditingOpacity(null)}
                    />
                  ) : (
                    <span
                      className="layer-palette__alpha"
                      onClick={(e) => { e.stopPropagation(); setEditingOpacity(layer.id); }}
                      title="Click to adjust opacity"
                    >
                      {Math.round(layer.fillAlpha * 100)}%
                    </span>
                  )}
                  {layer.gdsLayer !== undefined && (
                    <span className="layer-palette__gds">
                      {layer.gdsLayer}/{layer.gdsDatatype ?? 0}
                    </span>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
