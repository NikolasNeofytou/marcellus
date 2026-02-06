export function ExplorerPanel() {
  return (
    <div className="explorer-panel">
      <div style={{ padding: "8px", color: "var(--os-fg-muted)", fontSize: "var(--os-font-size-sm)" }}>
        <p style={{ marginBottom: "8px" }}>No folder open.</p>
        <p>Open a project folder to browse files.</p>
      </div>
    </div>
  );
}
