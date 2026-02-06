import { useGeometryStore } from "../../stores/geometryStore";
import { useLayerStore } from "../../stores/layerStore";

export function CellHierarchy() {
  const geometries = useGeometryStore((s) => s.geometries);
  const projectName = useGeometryStore((s) => s.projectName);
  const layers = useLayerStore((s) => s.layers);

  if (geometries.length === 0) {
    return (
      <div className="cell-hierarchy">
        <div style={{ padding: "8px", color: "var(--os-fg-muted)", fontSize: "var(--os-font-size-sm)" }}>
          <p>No geometries on canvas.</p>
          <p style={{ marginTop: "4px", opacity: 0.7 }}>
            Draw shapes or use <em>Load Demo Layout</em> from the Command Palette.
          </p>
        </div>
      </div>
    );
  }

  // Group by layer
  const byLayer = new Map<number, number>();
  for (const g of geometries) {
    byLayer.set(g.layerId, (byLayer.get(g.layerId) ?? 0) + 1);
  }

  return (
    <div className="cell-hierarchy">
      <div style={{ padding: "8px", fontSize: "var(--os-font-size-sm)" }}>
        <div style={{ marginBottom: "8px", color: "var(--os-fg)" }}>
          <strong>▾ {projectName} (top)</strong>
        </div>
        <div style={{ paddingLeft: "12px", color: "var(--os-fg-muted)", lineHeight: 1.8 }}>
          {Array.from(byLayer.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([layerId, count]) => {
              const layer = layers.find((l) => l.id === layerId);
              return (
                <div key={layerId} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      backgroundColor: layer?.color ?? "#888",
                      opacity: layer?.visible ? 1 : 0.3,
                    }}
                  />
                  <span>{layer?.name ?? `Layer ${layerId}`}</span>
                  <span style={{ opacity: 0.5 }}>({count})</span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
