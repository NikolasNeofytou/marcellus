import { useGeometryStore } from "../../stores/geometryStore";
import { useLayerStore } from "../../stores/layerStore";

export function ExplorerPanel() {
  const projectName = useGeometryStore((s) => s.projectName);
  const geometries = useGeometryStore((s) => s.geometries);
  const modified = useGeometryStore((s) => s.modified);
  const layers = useLayerStore((s) => s.layers);

  // Count geometries per type
  const counts: Record<string, number> = { rect: 0, polygon: 0, path: 0, via: 0, instance: 0 };
  for (const g of geometries) counts[g.type]++;

  // Count used layers
  const usedLayers = new Set(geometries.map((g) => g.layerId));
  const visibleLayers = layers.filter((l) => l.visible).length;

  return (
    <div className="explorer-panel">
      <div style={{ padding: "8px", fontSize: "var(--os-font-size-sm)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "12px",
            color: "var(--os-fg)",
          }}
        >
          <span style={{ fontSize: "14px" }}>◇</span>
          <strong>{projectName}</strong>
          {modified && (
            <span style={{ color: "var(--os-accent)", fontSize: "10px" }}>●</span>
          )}
        </div>

        <div style={{ color: "var(--os-fg-muted)", lineHeight: 1.8 }}>
          <div>
            <strong style={{ color: "var(--os-fg)" }}>Geometries</strong>{" "}
            <span style={{ opacity: 0.6 }}>({geometries.length})</span>
          </div>
          {geometries.length > 0 ? (
            <div style={{ paddingLeft: "12px" }}>
              {counts.rect > 0 && <div>▭ Rectangles: {counts.rect}</div>}
              {counts.polygon > 0 && <div>⬡ Polygons: {counts.polygon}</div>}
              {counts.path > 0 && <div>╌ Paths: {counts.path}</div>}
              {counts.via > 0 && <div>⊞ Vias: {counts.via}</div>}
            </div>
          ) : (
            <div style={{ paddingLeft: "12px", opacity: 0.5 }}>
              Empty canvas
            </div>
          )}

          <div style={{ marginTop: "8px" }}>
            <strong style={{ color: "var(--os-fg)" }}>Layers</strong>{" "}
            <span style={{ opacity: 0.6 }}>
              ({usedLayers.size} used / {visibleLayers} visible)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
