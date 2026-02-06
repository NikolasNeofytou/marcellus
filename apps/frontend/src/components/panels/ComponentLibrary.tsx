import { usePluginStore } from "../../stores/pluginStore";

export function ComponentLibrary() {
  const activePdkId = usePluginStore((s) => s.activePdkId);
  const plugins = usePluginStore((s) => s.plugins);
  const plugin = activePdkId
    ? plugins.find((p) => p.manifest.id === activePdkId)
    : undefined;
  const pdk = plugin?.manifest.contributes.pdk;

  if (!pdk) {
    return (
      <div className="component-library">
        <div style={{ padding: "8px", color: "var(--os-fg-muted)", fontSize: "var(--os-font-size-sm)" }}>
          <p style={{ marginBottom: "8px" }}>No PDK loaded.</p>
          <p>Install a PDK plugin (e.g., SKY130) to access standard cells and device templates.</p>
        </div>
      </div>
    );
  }

  const cells = pdk.standardCells?.cells ?? [];
  const deviceGens = plugin?.manifest.contributes.deviceGenerators ?? [];

  return (
    <div className="component-library">
      <div style={{ padding: "8px", fontSize: "var(--os-font-size-sm)" }}>
        <div style={{ marginBottom: "8px", color: "var(--os-fg)" }}>
          <strong>{pdk.name}</strong>
          <span style={{ marginLeft: "6px", opacity: 0.6 }}>
            {pdk.foundry} {pdk.node}
          </span>
        </div>

        {cells.length > 0 && (
          <>
            <div style={{ color: "var(--os-fg)", marginBottom: "4px" }}>
              <strong>Standard Cells ({cells.length})</strong>
            </div>
            <div
              style={{
                paddingLeft: "8px",
                color: "var(--os-fg-muted)",
                lineHeight: 1.8,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {cells.map((cell) => (
                <div key={cell.name} title={cell.function}>
                  {cell.name}
                </div>
              ))}
            </div>
          </>
        )}

        {deviceGens.length > 0 && (
          <>
            <div style={{ color: "var(--os-fg)", marginTop: "8px", marginBottom: "4px" }}>
              <strong>Device Generators ({deviceGens.length})</strong>
            </div>
            <div
              style={{
                paddingLeft: "8px",
                color: "var(--os-fg-muted)",
                lineHeight: 1.8,
                maxHeight: "200px",
                overflowY: "auto",
              }}
            >
              {deviceGens.map((gen) => (
                <div key={gen.name}>
                  {gen.name}
                  <span style={{ opacity: 0.5 }}> ({gen.deviceType})</span>
                </div>
              ))}
            </div>
          </>
        )}

        {cells.length === 0 && deviceGens.length === 0 && (
          <div style={{ color: "var(--os-fg-muted)" }}>
            PDK loaded but no standard cells or devices defined.
          </div>
        )}
      </div>
    </div>
  );
}
